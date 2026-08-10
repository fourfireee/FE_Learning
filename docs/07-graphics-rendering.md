# 图形与渲染相关能力

- 前端里做图形，不是所有情况都应该用同一种技术。
- 先判断图形是结构化 UI（User Interface，用户界面）、矢量图、大量 2D 绘制，还是 GPU shader 处理。
- GPU（Graphics Processing Unit，图形处理器）适合做大量并行计算，shader 可以理解成运行在 GPU 上的小程序。

## DOM

- DOM 是 Document Object Model，文档对象模型。
- 适合按钮、输入框、面板、列表、表单。
- 优点是可访问性、事件、布局能力都成熟。
- 缺点是大量节点频繁变化时成本高。

## SVG

- SVG 是 Scalable Vector Graphics，可缩放矢量图形。
- 适合少量矢量图形、路径、图标、节点连线。
- 图形元素仍然是 DOM 节点，可以直接绑定事件。
- 大量 SVG 节点会变慢。
- SVG 实际是怎么渲染的（CPU 还是 GPU）？
    - 主流浏览器里，SVG 的矢量路径主要由 **CPU 光栅化（rasterize）**：用图形库（Chrome 的 Skia）把路径、曲线、填充算成一张位图（bitmap）。这一步是 CPU 干的，**通常不会把路径转成三角形 mesh 交给 GPU**。
    - 光栅化出来的位图会作为图层「贴图」上传给 **GPU**，GPU 负责把这些图层**合成（composite）**到屏幕，以及对图层整体做 `transform`/`opacity` 这类变换。
    - 所以可以记成：**画内容 = CPU，搬运/合成图层 = GPU**。这也解释了为什么「大量节点频繁变化」会卡——每次变化都要 CPU 重新光栅化；而只做平移/缩放/淡入淡出时，能只走 GPU 合成，就很流畅。
    - 注：业界有「GPU 直接渲染矢量路径（tessellation 生成 mesh）」的方案，但目前不是主流浏览器渲染普通 SVG 的默认路径。

## SMIL

- SMIL 全称 Synchronized Multimedia Integration Language（同步多媒体集成语言），是 W3C 的一个 XML 标准，用来描述“随时间播放的动画/多媒体”
- 简单示例：在 SVG 里给圆加一个 `<animate>` 子标签，不写一行 JS、不写一行 CSS，圆就会自己动起来——“动画描述”直接写在标签属性里，这就是 SMIL：

```html
<svg width="220" height="100">
  <circle cx="30" cy="50" r="20" fill="tomato">
    <!-- 让圆心的 x 坐标（cx）在 2 秒内从 30 变到 190，无限循环 -->
    <animate attributeName="cx" from="30" to="190" dur="2s" repeatCount="indefinite" />
  </circle>
</svg>
```

- 把这段直接存成 .html 用浏览器打开，就能看到小球不断从左滑到右、再跳回左边重来。声明式（“从哪到哪、多长时间”写在标签里，浏览器自己驱动每一帧）正是 SMIL 和 JS 逐帧改属性的本质区别

## Canvas

- 适合大量 2D 绘制、像素处理、游戏式刷新。
- Canvas 不是 DOM 子节点，画完之后浏览器不知道每个图形对象是什么。
- 命中测试、选择、撤销重做需要自己维护数据结构。
- 准确地说：`<canvas>` 标签本身**是**一个 DOM 节点，能像普通元素一样挂在页面里；但你在它上面画的图形（线、圆、矩形）**不是** DOM 节点，只是画布上的一片像素。
- 挂载与绘制流程：① 页面里放一个 `<canvas>` 元素 → ② JS 拿到它、调用 `getContext("2d")` 拿到「画笔」(上下文对象) → ③ 用画笔在这块像素区域上作画。画完后 DOM 里始终只有 `<canvas>` 这一个节点，里面的图形浏览器无从感知。
- 简单例子：

```html
<!-- ① <canvas> 本身是 DOM 节点，正常挂在页面里 -->
<canvas id="c" width="200" height="120"></canvas>

<script>
  const canvas = document.getElementById("c");
  // ② 拿到 2D 绘图上下文，可以理解成「一支画笔」
  const ctx = canvas.getContext("2d");

  // ③ 用画笔在画布上画一个红色矩形——这是直接往像素上画，不产生任何子 DOM 节点
  ctx.fillStyle = "red";
  ctx.fillRect(20, 20, 100, 60);
  // 画完后想知道「这个矩形在哪、能不能点中」，得自己用变量记下它的坐标，浏览器不会帮你记。
</script>
```

- 怎么理解上面的 `<script>` 标签？
    - `<script>` 是用来在 HTML 里**嵌入/引入 JavaScript 代码**的标签，浏览器解析 HTML 读到它时，就会执行里面的代码。
    - **执行时机**：浏览器从上往下解析 HTML，读到 `<script>` 就停下来运行它（默认是「同步阻塞」的，跑完才继续往下解析）。所以这里 `<script>` 放在 `<canvas>` 之后很重要——能保证执行时 `<canvas>` 已经存在、`getElementById("c")` 能拿到它。
    - **只执行一遍吗？** 是的，这段「内联脚本」在页面加载时**自动执行一次**，之后不会自己重复运行。想再画（比如做动画、响应点击），要靠事件监听、`setInterval`、`requestAnimationFrame` 等**再次调用**绘制函数。
    - 补充：给 `<script src="...">` 加 `defer`/`async`、或脚本放在 `<head>` 里，会改变执行时机；上面这种「放在元素后面的内联脚本」是最简单、最直观的写法。

## WebGL / WebGPU

- WebGL 是 Web Graphics Library，浏览器里的 3D 图形接口。

- WebGL 1.0 和 2.0 的区别（简要）：
    - 血统：1.0 基于 OpenGL ES 2.0，2.0 基于 OpenGL ES 3.0；2.0 是超集，1.0 能做的它都能做。
        - ES = Embedded Systems（嵌入式系统）。OpenGL ES 是 OpenGL 的精简版，最初为手机、嵌入式等资源受限设备设计；WebGL 就建立在它之上。
        - OpenGL ES 版本和 GLSL ES 版本是绑定的：每个 OpenGL ES 版本配套规定了它使用的 GLSL ES 版本，不能自由组合。对应关系：OpenGL ES 2.0 → GLSL ES 1.00，OpenGL ES 3.0 → GLSL ES 3.00（注意没有所谓 2.00，版本号是跳着对应的）。
    - 着色器语言：1.0 用 GLSL ES 1.00，2.0 用 GLSL ES 3.00（语法更新、功能更强，写法略有不同）。
    - 多了哪些常用能力：2.0 原生支持多渲染目标(MRT)、3D 纹理、整数纹理、Uniform Buffer Object、变换反馈、实例化绘制、非 2 次幂纹理等；这些在 1.0 里要么没有、要么得靠扩展且不保证可用。
        - 变换反馈（Transform Feedback）：让 vertex shader 计算出的结果不去绘制，而是「写回」到一个 buffer 里留着下次用。
            - 平时管线是「顶点数据 → shader 处理 → 画到屏幕」，结果用完即弃；变换反馈相当于在中途接根管子，把 shader 算出的顶点数据截留下来。
            - 用途：在 GPU 上做可迭代的计算，典型是粒子系统——这一帧用 shader 算出每个粒子的新位置/速度写回 buffer，下一帧拿它当输入接着算，全程不经过 CPU，非常快。
            - 一句话：它把 GPU 当成「能把计算结果存下来反复迭代」的计算器，而不只是「画一次就丢」的绘图器。
    - 兼容性：1.0 支持最广（几乎所有设备），2.0 现代浏览器普遍支持，但极老设备可能没有。
    - 怎么选用：`canvas.getContext("webgl2")` 拿 2.0，`getContext("webgl")` 拿 1.0；常见写法是先试 webgl2、拿不到再退回 webgl。
    - 对本教程示例：05 示例用的是 `getContext("webgl")`（1.0），因为灰度滤镜很简单，1.0 足够且兼容性最好。

- WebGPU 是浏览器里更现代的 GPU 接口，能力更接近底层图形 API。
- 适合 shader、纹理、GPU 加速图形计算。
- 适合滤镜、后处理、粒子、大量并行计算。
- 需要自己管理 shader、buffer、texture、framebuffer 等资源。

## 坐标系

- screen 坐标：鼠标在屏幕或窗口里的位置。
- viewport 坐标：当前编辑器视口里的位置。
- graph 坐标：节点图自己的世界坐标。
- local 坐标：某个节点内部的局部坐标。

## devicePixelRatio

- devicePixelRatio 简称 DPR，表示 1 个 CSS 像素对应多少个物理像素。
- CSS 像素不等于物理像素。
- Canvas 和 WebGL 需要根据 DPR 放大 backing store。backing store 是 canvas 真正存像素的内存区域，太小就会在高分屏上发糊。

```js
const dpr = window.devicePixelRatio || 1;
canvas.width = Math.round(canvas.clientWidth * dpr);
canvas.height = Math.round(canvas.clientHeight * dpr);
```

## WebGL shader 的基础链路

- 准备顶点数据。
- 编译 vertex shader。
- 编译 fragment shader。
- 上传纹理。
- 绘制三角形。
- fragment shader 为每个像素计算颜色。

```mermaid
flowchart LR
    A["vertex buffer"] --> B["vertex shader"]
    B --> C["rasterize"]
    C --> D["fragment shader"]
    E["texture"] --> D
    D --> F["framebuffer"]
```

## 判断图形代码是否靠谱

- 资源创建和释放是否成对。
- 坐标转换是否集中管理。
- 高分屏是否处理。
    - 「高分屏」指 Retina 这类高像素密度屏幕：1 个 CSS 像素对应多个物理像素（倍数就是 `window.devicePixelRatio`，常见 2 或 3）。
    - 如果不处理，Canvas/WebGL 画出来的图在高分屏上会发虚、发糊。常见做法：把画布的实际分辨率乘以 `devicePixelRatio`（如 `canvas.width = cssWidth * dpr`），再用 CSS 把显示尺寸缩回去，这样才清晰。
- 大图、视频帧、纹理上传是否避免不必要重复。
- 渲染循环是否只在必要时运行。

## native渲染引擎使用web gl_context

```js 
const glCanvas = document.querySelector("#gl-canvas"); //拿一个canvas
const gl = glCanvas.getContext("webgl"); // 创建gl context
```

- 场景：有一个 C++ native 渲染引擎，它自己不创建 GL context、只「使用」外部给的 context。想把它编译成 WASM 跑在上面这个 canvas 上。

- 先纠正一个直觉误区：不能把上面 `getContext("webgl")` 拿到的 `gl` 对象，当指针「传」给 C++ 引擎。
    - 原因：WASM 运行在沙箱里，C++ 侧拿不到 JS 对象的引用。
    - 真正的桥是 Emscripten 的 GL 层：它内部维护一个「当前 WebGL context」，引擎里的 `glDrawArrays`、`glBindTexture` 等调用，会被自动翻译成对这个 context 的 WebGL 调用。
    - 所以你要做的不是「传对象」，而是「让某个 context 成为当前(make current)」——这恰好对应你引擎「只使用、不创建 context」的设定：创建交给宿主，引擎只管用。

- 步骤一：编译。用 emscripten（emcc）把引擎编译成 `.wasm` + 胶水 `.js`，链接 GL 并导出入口函数。

```bash
# emcc：emscripten 的编译器（相当于 C/C++ 界的 gcc/clang，但目标是 wasm）。
# engine.cpp：你的引擎源码；-o engine.js：输出胶水 JS（会同时生成同名的 engine.wasm）。
emcc engine.cpp -o engine.js \
  -sUSE_WEBGL2=1 \
  `# 让 GL 调用走 WebGL 2.0（基于 OpenGL ES 3.0）；想要 WebGL 1.0 就去掉它。` \
  -sFULL_ES3=1 \
  `# 完整模拟 OpenGL ES 3.0 API：引擎里那些 glXxx 调用才有对应实现可链接（WebGL 1.0 对应 -sFULL_ES2）。` \
  -sEXPORTED_FUNCTIONS=_init,_render
  # 导出哪些 C 函数给 JS 调用。名字要加下划线前缀（C 的 init→_init）；
  # 导出后 JS 里用 Module._init() / Module._render() 调用，不导出的会被优化掉、JS 调不到。
```

- 步骤二：创建 context，并设为当前。「创建」由宿主负责，引擎拿来即用。两种常见接法：
- A. 让 Emscripten 自己为 canvas 建 context（C 侧）：

```c
EmscriptenWebGLContextAttributes attrs;
emscripten_webgl_init_context_attributes(&attrs);
EMSCRIPTEN_WEBGL_CONTEXT_HANDLE ctx =
    emscripten_webgl_create_context("#gl-canvas", &attrs);
emscripten_webgl_make_context_current(ctx); // 设为当前，之后引擎的 gl* 调用都作用到它
```

- 关于 `"#gl-canvas"`：它是 CSS 选择器，指向页面里 `id="gl-canvas"` 的 canvas，所以 HTML 要先备好这个元素：`<canvas id="gl-canvas"></canvas>`。
    - 名字随意，但 HTML 的 `id` 和这里字符串必须一致；`#` 是「按 id 找」的选择器语法，不是名字的一部分（HTML 里写 `id="gl-canvas"` 不带 `#`）。
    - canvas 必须在调用前就存在于 DOM 里，否则找不到、创建失败。
    - 版本差异：较新的 Emscripten 可能不再支持「按选择器全局找元素」，需改用 `Module.canvas` 指定目标或加相应编译选项；按上面写法报「找不到 canvas」时多半是这个原因。
        - 怎么理解：老版本里你给个字符串 `"#gl-canvas"`，Emscripten 会自己去整个页面里搜这个元素；新版本默认关掉了这种「自动全局搜」，于是按字符串找不到。
        - 改用 `Module.canvas`：不让它去搜，而是你直接把 canvas 这个对象「递」给它。即加载 WASM 前先 `Module.canvas = document.querySelector("#gl-canvas")`，Emscripten 就用你指定的这个，不再靠选择器。
        - 「加相应编译选项」：就是在 emcc 编译命令里多加一个开关，把上面那种「按选择器找元素」的能力重新打开（不同 Emscripten 版本开关名不同，用你所在版本的文档确认即可）。
        - 一句话：两条路二选一——要么把 canvas 对象直接交给它（`Module.canvas`），要么用编译选项把「按名字找」的老行为打开。

- B. 复用 JS 侧已建好的 context：在加载 WASM 前，把它挂到 Module 上交给 Emscripten 接管。

```js
const gl = glCanvas.getContext("webgl2");
// 让 Emscripten 直接用这个已存在的 context，而不是自己再建一个
Module.preinitializedWebGLContext = gl;
// 关键：不要 JS 和 Emscripten 各建一个 context；要么用 A，要么用 B。
```

- 怎么理解 `Module.preinitializedWebGLContext`：
    - `Module` 是 Emscripten 的「配置 + 运行时」总对象，胶水 JS 启动时会读它身上的字段来决定怎么初始化。它就是 JS 和 WASM 之间传东西的公共桌面。
    - 这个字段的意思是「预先建好的 WebGL context」。你提前 `getContext` 建好 context、挂到这里，相当于告诉 Emscripten：「context 我准备好了，你别自己建，直接用这个。」
    - 它如何作用到 WASM：Emscripten 初始化 GL 时，发现这个字段有值，就把它登记成自己的「当前 context」。之后 WASM 里引擎的 `glDrawArrays` 等调用，经胶水层转成 WebGL 调用时，用的就是你给的这个 context——于是画到你这块 canvas 上。
    - 必须「在加载 / 实例化 WASM 之前」就设好，因为 Emscripten 只在初始化那一刻读它；晚了就来不及，它会走默认流程自己建。
    - 一句话：A 是「让 Emscripten 自己建 context」，B(本段)是「你建好后塞给它复用」，本质都是让引擎拿到同一个当前 context。

- 步骤三：驱动引擎渲染。通过导出的函数调用引擎，它的 `gl*` 调用会画到 canvas 的默认 framebuffer，Emscripten 自动呈现到画布。

```js
Module._init();
function frame() {
  Module._render();          // 引擎内部执行一帧的 gl* 调用
  requestAnimationFrame(frame); // 每帧循环；多 context 时每帧先 make current 再画
}
requestAnimationFrame(frame);
```

## 可运行示例

- [Canvas / WebGL 灰度滤镜示例](../examples/05-canvas-webgl-grayscale/index.html)
