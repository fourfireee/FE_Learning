# WASM 与 native 引擎接入

- WASM（WebAssembly）让 C / C++ / Rust 编译出的代码能在浏览器里高速运行。
- 对你来说这是关键一篇：自研 native 渲染引擎要进 web app，主流路径就是编译成 WASM。
- 这一篇讲清楚 WASM 是什么、怎么编译、怎么和 JavaScript / Canvas 协作，以及性能边界在哪。

## WASM 是什么

- WASM 是一种二进制指令格式，浏览器能直接加载并接近原生速度执行。
- 它不是用来取代 JavaScript 的，而是补位：计算密集的部分（图像处理、几何运算、引擎核心）交给 WASM，UI（User Interface，用户界面）和胶水逻辑还是 JavaScript。
- 它运行在和 JavaScript 同一个沙箱里，受同样的安全限制，不能直接碰文件系统或网络。

## 心智模型

- JavaScript 负责页面、事件、调度、调接口。
- WASM 负责把一段输入数据高速算成输出数据。
- 两者之间通过函数调用和一块共享内存来传数据。

```mermaid
flowchart LR
    A["C/C++ native 引擎源码"] --> B["emscripten 编译"]
    B --> C[".wasm 二进制 + .js 胶水"]
    C --> D["JavaScript 里 import 并初始化"]
    D --> E["JavaScript 调用 WASM 导出的函数"]
    E --> F["WASM 计算后把结果写回共享内存"]
    F --> G["JavaScript 取结果, 交给 Canvas/WebGL 显示"]
```

## 编译工具：emscripten

- C / C++ 编译到 WASM 最成熟的工具链是 emscripten。
- 它不仅把代码编成 `.wasm`，还会生成一段 `.js` 胶水代码，帮你处理加载、内存、函数导出这些麻烦事。
- 它还能把 OpenGL ES 调用自动翻译成 WebGL，这对渲染引擎接入特别重要：你引擎里的 GL 代码很大程度能直接复用。
- OpenGL ES 是 Open Graphics Library for Embedded Systems，嵌入式系统图形库；GL 通常就是 Graphics Library，图形库的简称。

```bash
# 把 C++ 编译成 wasm + JavaScript 胶水
# -O3 开优化, -s MODULARIZE 让产物成为一个可 import 的模块
# -s EXPORTED_FUNCTIONS 指定要暴露给 JavaScript 调用的函数
# MODULARIZE=1 里的 =1 是「开启」的意思：emscripten 的 -s 选项是键值对(KEY=VALUE)，
#   1 表示 true(打开)、0 表示 false(关闭)。所以 MODULARIZE=1 等于「把这个开关打开」。
emcc engine.cpp -O3 -s MODULARIZE=1 \
  # EXPORTED_FUNCTIONS：导出「你自己 C/C++ 代码里的函数」，是 wasm 里真正的业务逻辑。
  #   名字前的下划线 _ 是 C 函数编译后的命名约定（_process_image 对应 C 里的 process_image）。
  #   _malloc / _free 是内存分配/释放，跨语言传数据(如图片缓冲)时常要手动管理，所以也一并导出。
  -s EXPORTED_FUNCTIONS='["_process_image","_malloc","_free"]' \
  # EXPORTED_RUNTIME_METHODS：导出「emscripten 运行时(胶水代码)自带的辅助工具」，不是你写的函数。
  #   ccall：直接按名字调用一个 C 函数；cwrap：把 C 函数包成一个可重复调用的 JS 函数。
  #   一句话区分：EXPORTED_FUNCTIONS = 你的业务函数；EXPORTED_RUNTIME_METHODS = 调用它们用的“工具”。
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' \
  -o engine.js
```

## JavaScript 怎么调用 WASM

- 加载后，C 函数会变成 WASM 模块上的方法，可以用 `cwrap` 包装成普通 JavaScript 函数。

```js
import createEngine from "./engine.js"; // emscripten 生成的胶水模块

const engine = await createEngine();    // 异步初始化, 加载并实例化 wasm

// 把 C 函数包成 JavaScript 函数: 函数名, 返回类型, 参数类型
const processImage = engine.cwrap("process_image", "number", [
  "number", // 输入数据指针
  "number", // 宽
  "number", // 高
]);
```

## 数据怎么传：共享内存

- 这是 WASM 接入最核心、也最容易出错的地方。
- JavaScript 和 WASM 不能直接互传图片、数组这种大块数据，只能传数字。
- 大数据要放进 WASM 的线性内存（一块连续的字节缓冲），JavaScript 和 WASM 都能读写它，互相只传「这块数据在内存里的起始位置（指针）」。

## 传一张图片给 WASM 处理的标准流程

- JavaScript 向 WASM 申请一块内存（malloc），拿到指针。
- JavaScript 把像素数据写进这块内存。
- JavaScript 调用 WASM 函数，把指针和尺寸传进去。
- WASM 原地处理，或把结果写回某块内存。
- JavaScript 从内存里把结果读出来。
- 用完手动释放内存（free），否则会泄漏。

```js
// 假设有一张 RGBA 图片的像素数据 pixels (Uint8Array)
// RGBA 是 Red、Green、Blue、Alpha，表示红、绿、蓝、透明度四个通道。
const size = pixels.length;

// 1. 在 wasm 内存里申请空间, 拿到起始指针(其实是个整数偏移量)
const ptr = engine._malloc(size);

// 2. 把像素写进 wasm 内存的这块区域
//    HEAPU8 是 JavaScript 视角下 wasm 整块内存的字节视图
engine.HEAPU8.set(pixels, ptr);

// 3. 调用 wasm 处理, 传指针和尺寸
processImage(ptr, width, height);

// 4. 处理完后从同一块内存读回结果
const result = engine.HEAPU8.slice(ptr, ptr + size);

// 5. 释放内存, 避免泄漏
engine._free(ptr);
```

- 这里的关键认知：指针只是「内存里的一个偏移量」，本质是个整数。所谓「传数据」其实是约定好双方读写同一块内存的同一段。

## 和 Canvas / WebGL 衔接

- 算完的像素最终要显示出来，渲染引擎接入有两条路：
- 引擎只算像素，结果回传 JavaScript，由 JavaScript 画到 2D Canvas（适合滤镜、后处理这类逐像素结果）。
- 引擎直接驱动 WebGL，把一个 canvas 交给 WASM，引擎内部的 GL 调用经 emscripten 直接渲染到这个 canvas（适合完整的实时渲染管线）。
    - 这条路怎么跑通，分步看（核心：让引擎里原本的 OpenGL 代码「画到」网页的 canvas 上）：
        1. 页面上放一个 `<canvas>`，并在 JS 里告诉 emscripten 用它（通常通过 `Module.canvas` 指定）。

        ```html
        <!-- ① 页面里准备好画布 -->
        <canvas id="game"></canvas>

        <script>
          // ② 在加载 wasm 前，先准备一个 Module 配置对象
          var Module = {
            // ③ 把这个 canvas 交给 emscripten——引擎里的 GL 调用就会画到它上面
            canvas: document.getElementById("game"),
          };
        </script>
        <!-- ④ 再加载 emscripten 生成的胶水脚本；它启动时会读取上面的 Module.canvas -->
        <script src="engine.js"></script>
        ```

        > 关键点：`Module` 要在加载 `engine.js` **之前**定义好，胶水代码初始化时会去读 `Module.canvas`，从而知道该往哪个 canvas 渲染。
        2. 引擎初始化时调用类似 `glViewport`、`glClear` 的 OpenGL ES 函数——注意这些是 C/C++ 引擎里**原封不动**的图形代码。
        3. emscripten 的胶水层把每个 GL 调用**自动翻译**成等价的 WebGL 调用（如 `glClear` → `gl.clear`），并作用在第 1 步那个 canvas 的 WebGL 上下文上。
        4. 于是引擎「以为」自己在跑原生 OpenGL，实际像素被画进了网页 canvas，浏览器负责把 canvas 显示出来。
        5. 每一帧重复 2~4（通常由引擎的渲染循环 / `requestAnimationFrame` 驱动），就得到实时动画。
    - 一句话：你不用改引擎的 GL 代码，emscripten 充当「OpenGL → WebGL 的翻译官」，canvas 就是最终的画布。
- 你的 shader 特效场景大概率走第二条：emscripten 把引擎的 GL 上下文绑定到页面上的 canvas，引擎照常画，浏览器负责呈现。
- 不论哪条路，DPR、坐标系、资源生命周期这些图形问题都还要处理。DPR 是 devicePixelRatio，设备像素比。

## 性能与边界

- WASM 计算快，但 JavaScript 和 WASM 之间频繁来回调用、频繁拷贝大块内存，反而会拖慢。

## 优化方向

- 减少跨边界调用次数，一次传一大批数据，而不是循环里一个个传。
- 尽量原地处理，复用同一块内存，避免反复 malloc / free。
- 大数据用共享内存视图直接读写，不要序列化成 JSON（JavaScript Object Notation）。

## WASM 也有限制

- 不能直接访问 DOM（Document Object Model，文档对象模型），操作页面必须经过 JavaScript。
- 默认是单线程，多线程要用 SharedArrayBuffer 且有跨域隔离等额外要求。
- 初始加载 `.wasm` 文件有体积和启动成本，首屏要考虑加载时机。

## 接入步骤建议

- 先用一个最小例子打通链路：一个 C 函数做灰度，JavaScript 传图、收图、显示。
- 再把内存管理、错误处理、加载时机做扎实。
- 最后才把完整引擎编进来，并决定走 2D 回传还是 WebGL 直驱。
- 这条最小链路就是 `知识.md` 里「后续需要继续补充的示例」第一项，建议作为第一个真正动手的练习。

## 判断 WASM 接入是否靠谱

- 申请的内存是否都成对释放，没有泄漏。
- JavaScript 和 WASM 的边界调用是否足够少、传输是否足够批量。
- 引擎的 GL 上下文和页面 canvas、DPR 是否对齐。
- `.wasm` 的加载是否异步、是否处理了加载失败。
    - 为什么要异步：`.wasm` 文件要走网络下载、再编译实例化，这是个耗时操作；同步加载会卡住主线程、页面假死。所以用 Promise/`async-await`，加载期间页面照常响应，失败了也能给用户提示。
    - 推荐用 `WebAssembly.instantiateStreaming`：边下载边编译，最快；并用 `try/catch` 兜住失败。

    ```js
    async function loadWasm() {
      try {
        // fetch 拿到响应流，instantiateStreaming 边下边编译（无需等整个文件下载完）
        // 这里的「编译」指什么？.wasm 文件里是「字节码」(一种跨平台的中间二进制，x86/ARM 通用)，
        //   不是 CPU 能直接跑的机器码。浏览器引擎(V8 等)必须把字节码翻译成【当前 CPU 的本地机器码】，
        //   这一步就是编译——所以 wasm 确实仍需编译，只是它的「源」是字节码而非文本源码，比编译 C++ 快得多。
        // 为什么能「边下边编译」？原理有两点：
        //   1. fetch 返回的是一个「流(stream)」：数据分成一小块一小块(chunk)陆续到达，不是一次性全到。
        //      instantiateStreaming 直接吃这个流，每到一块就交给编译器，所以不用等整个文件下完。
        //   2. wasm 字节码是「顺序可解析」的——模块按固定顺序排列(先头部、再函数声明、再函数体…)，
        //      引擎从前往后读到哪就能把哪段编成机器码，不必看到结尾才动工。
        // 二者结合：网络在下后半段的同时，CPU 已经在把前半段编成机器码，下载和编译时间重叠，首次可用更快。
        const { instance } = await WebAssembly.instantiateStreaming(
          fetch("engine.wasm"),
          {} // importObject：wasm 需要的外部函数/内存，没有就传空对象
        );
        return instance.exports; // 这里就是 wasm 导出的函数，可直接调用
      } catch (err) {
        // 处理加载失败：网络断了、文件 404、或服务器没返回 application/wasm 类型等
        console.error("WASM 加载失败：", err);
        // 实际项目里可在这里降级到纯 JS 实现，或给用户一个错误提示
        throw err;
      }
    }

    // 用法：await 不会阻塞主线程，加载期间页面仍可交互
    const engine = await loadWasm();
    ```

    > 小注：`instantiateStreaming` 要求服务器返回的 MIME 类型是 `application/wasm`，否则会报错；万一服务器配置不对，可退回 `WebAssembly.instantiate(await fetch(...).then(r => r.arrayBuffer()), ...)` 这种先下完再编译的写法。
    >
    > `arrayBuffer` 里存的是什么？就是 `.wasm` 文件**一个字节不改的原始二进制内容**——和你在磁盘上看到的那个文件完全一样的一串 0/1 字节。它不是文本、不能直接读懂，只是块「生数据」。后面 `WebAssembly.instantiate` 会把这串字节当成程序去**编译、装进内存**，变成可调用的函数。可以类比：`arrayBuffer` 像下载下来的安装包（一堆二进制），`instantiate` 像把它安装成能运行的程序。
- 计算密集的部分是否真的放在了 WASM，胶水和 UI 是否还留在 JavaScript。
