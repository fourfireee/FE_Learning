# WASM 与 native 引擎接入

- WASM（WebAssembly）让 C / C++ / Rust 编译出的代码能在浏览器里高速运行。
- 对你来说这是关键一篇：自研 native 渲染引擎要进 web app，主流路径就是编译成 WASM。
- 这一篇讲清楚 WASM 是什么、怎么编译、怎么和 JS / Canvas 协作，以及性能边界在哪。

## WASM 是什么

- WASM 是一种二进制指令格式，浏览器能直接加载并接近原生速度执行。
- 它不是用来取代 JS 的，而是补位：计算密集的部分（图像处理、几何运算、引擎核心）交给 WASM，UI 和胶水逻辑还是 JS。
- 它运行在和 JS 同一个沙箱里，受同样的安全限制，不能直接碰文件系统或网络。

- 心智模型：
    - JS 负责页面、事件、调度、调接口。
    - WASM 负责把一段输入数据高速算成输出数据。
    - 两者之间通过函数调用和一块共享内存来传数据。

```mermaid
flowchart LR
    A["C/C++ native 引擎源码"] --> B["emscripten 编译"]
    B --> C[".wasm 二进制 + .js 胶水"]
    C --> D["JS 里 import 并初始化"]
    D --> E["JS 调用 WASM 导出的函数"]
    E --> F["WASM 计算后把结果写回共享内存"]
    F --> G["JS 取结果, 交给 Canvas/WebGL 显示"]
```

## 编译工具：emscripten

- C / C++ 编译到 WASM 最成熟的工具链是 emscripten。
- 它不仅把代码编成 `.wasm`，还会生成一段 `.js` 胶水代码，帮你处理加载、内存、函数导出这些麻烦事。
- 它还能把 OpenGL ES 调用自动翻译成 WebGL，这对渲染引擎接入特别重要：你引擎里的 GL 代码很大程度能直接复用。

```bash
# 把 C++ 编译成 wasm + js 胶水
# -O3 开优化, -s MODULARIZE 让产物成为一个可 import 的模块
# -s EXPORTED_FUNCTIONS 指定要暴露给 JS 调用的函数
emcc engine.cpp -O3 -s MODULARIZE=1 \
  -s EXPORTED_FUNCTIONS='["_process_image","_malloc","_free"]' \
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' \
  -o engine.js
```

## JS 怎么调用 WASM

- 加载后，C 函数会变成 WASM 模块上的方法，可以用 `cwrap` 包装成普通 JS 函数。

```js
import createEngine from "./engine.js"; // emscripten 生成的胶水模块

const engine = await createEngine();    // 异步初始化, 加载并实例化 wasm

// 把 C 函数包成 JS 函数: 函数名, 返回类型, 参数类型
const processImage = engine.cwrap("process_image", "number", [
  "number", // 输入数据指针
  "number", // 宽
  "number", // 高
]);
```

## 数据怎么传：共享内存

- 这是 WASM 接入最核心、也最容易出错的地方。
- JS 和 WASM 不能直接互传图片、数组这种大块数据，只能传数字。
- 大数据要放进 WASM 的线性内存（一块连续的字节缓冲），JS 和 WASM 都能读写它，互相只传「这块数据在内存里的起始位置（指针）」。

- 传一张图片给 WASM 处理的标准流程：
    - JS 向 WASM 申请一块内存（malloc），拿到指针。
    - JS 把像素数据写进这块内存。
    - JS 调用 WASM 函数，把指针和尺寸传进去。
    - WASM 原地处理，或把结果写回某块内存。
    - JS 从内存里把结果读出来。
    - 用完手动释放内存（free），否则会泄漏。

```js
// 假设有一张 RGBA 图片的像素数据 pixels (Uint8Array)
const size = pixels.length;

// 1. 在 wasm 内存里申请空间, 拿到起始指针(其实是个整数偏移量)
const ptr = engine._malloc(size);

// 2. 把像素写进 wasm 内存的这块区域
//    HEAPU8 是 JS 视角下 wasm 整块内存的字节视图
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

- 渲染引擎接入有两条路：
    - 引擎只算像素，结果回传 JS，由 JS 画到 2D Canvas（适合滤镜、后处理这类逐像素结果）。
    - 引擎直接驱动 WebGL，把一个 canvas 交给 WASM，引擎内部的 GL 调用经 emscripten 直接渲染到这个 canvas（适合完整的实时渲染管线）。
- 你的 shader 特效场景大概率走第二条：emscripten 把引擎的 GL 上下文绑定到页面上的 canvas，引擎照常画，浏览器负责呈现。
- 不论哪条路，DPR、坐标系、资源生命周期这些 07 篇讲的图形问题都还要处理。

## 性能与边界

- WASM 计算快，但 JS 和 WASM 之间频繁来回调用、频繁拷贝大块内存，反而会拖慢。
- 优化方向：
    - 减少跨边界调用次数，一次传一大批数据，而不是循环里一个个传。
    - 尽量原地处理，复用同一块内存，避免反复 malloc / free。
    - 大数据用共享内存视图直接读写，不要序列化成 JSON。
- WASM 也有限制：
    - 不能直接访问 DOM，操作页面必须经过 JS。
    - 默认是单线程，多线程要用 SharedArrayBuffer 且有跨域隔离等额外要求。
    - 初始加载 `.wasm` 文件有体积和启动成本，首屏要考虑加载时机。

## 接入步骤建议

- 先用一个最小例子打通链路：一个 C 函数做灰度，JS 传图、收图、显示。
- 再把内存管理、错误处理、加载时机做扎实。
- 最后才把完整引擎编进来，并决定走 2D 回传还是 WebGL 直驱。
- 这条最小链路就是 `知识.md` 里「后续需要继续补充的示例」第一项，建议作为第一个真正动手的练习。

## 判断 WASM 接入是否靠谱

- 申请的内存是否都成对释放，没有泄漏。
- JS 和 WASM 的边界调用是否足够少、传输是否足够批量。
- 引擎的 GL 上下文和页面 canvas、DPR 是否对齐。
- `.wasm` 的加载是否异步、是否处理了加载失败。
- 计算密集的部分是否真的放在了 WASM，胶水和 UI 是否还留在 JS。
