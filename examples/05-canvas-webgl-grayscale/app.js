const sourceCanvas = document.querySelector("#source");
const glCanvas = document.querySelector("#gl-canvas");
const strengthInput = document.querySelector("#strength");
const message = document.querySelector("#message");

const sourceSize = { width: 420, height: 280 };
const sourceContext = sourceCanvas.getContext("2d");
const gl = glCanvas.getContext("webgl");

let programInfo = null;
let texture = null;
let geometryReady = false;

function setup2dCanvas(canvas, context, width, height) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  // setTransform(a, b, c, d, e, f) ↓
  //   a c e      x  
  // [ b d f ]  [ y ] 
  //   0 0 1      1
  // 新x = a*x + c*y + e；新y = b*x + d*y + f
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function setupGlCanvas(canvas, width, height) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
}

function drawSourceImage() {
  setup2dCanvas(sourceCanvas, sourceContext, sourceSize.width, sourceSize.height);

  const gradient = sourceContext.createLinearGradient(0, 0, sourceSize.width, sourceSize.height);
  gradient.addColorStop(0, "#2dd4bf");
  gradient.addColorStop(0.45, "#60a5fa");
  gradient.addColorStop(1, "#f97316");

  sourceContext.fillStyle = gradient;
  sourceContext.fillRect(0, 0, sourceSize.width, sourceSize.height);

  sourceContext.fillStyle = "rgba(255, 255, 255, 0.86)";
  sourceContext.beginPath();
  // arc(x, y, r, startAngle, endAngle)：以圆心 (110,100)、半径 56 画一段弧。
  // 角度用弧度：0 到 Math.PI*2（即 0 到 360°）正好是一整圈，所以这里画的是一个完整的圆。
  // 注意 arc 只是「描出路径」，要配合上面的 beginPath() 和下面的 fill() 才会真正填充成实心圆。
  sourceContext.arc(110, 100, 56, 0, Math.PI * 2);
  sourceContext.fill();

  sourceContext.fillStyle = "rgba(17, 24, 39, 0.72)";
  sourceContext.fillRect(205, 82, 130, 96);

  sourceContext.fillStyle = "#ffffff";
  // canvas 的 font 用的是 CSS font 简写语法，顺序是：font-weight font-size font-family
  //   700      字重（粗细），700 等于 bold；正常是 400。
  //   28px     字号，28 像素高。
  //   system-ui 字体族，表示“用操作系统的默认 UI 字体”（Mac 上是苹方/SF，Windows 上是雅黑等）。
  sourceContext.font = "700 28px system-ui";
  sourceContext.fillText("shader", 220, 140);
}

function compileShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader));
  }

  return shader;
}

function createProgram() {
  // 着色器源码本质只是字符串，compileShader 不关心它来自哪，理论上可抽成独立的
  // .vert / .glsl 文件。这里却内联在 JS 里，是为了「零依赖、双击即跑」：
  //   独立文件通常要用 fetch 加载，而 fetch 是异步的，且本地直接以 file:// 打开 index.html 时
  //   会被浏览器同源策略拦截、读不到本地文件，必须额外起一个本地 http 服务（或上打包工具）。
  //   「上打包工具」的原理：Vite / webpack 这类工具在【构建阶段】（代码还没进浏览器、跑在 Node 里时）
  //   就把 .vert 文件的内容读出来、直接拼成一个字符串变量塞进最终的 JS 产物（如 import src from './x.vert?raw'）。
  //   于是运行时浏览器拿到的依然是内联字符串，既无异步 fetch、也不受 file:// 限制——
  //   相当于把「读文件」这步从运行时提前到了构建时。代价是要引入并配置构建工具。
  //   对这个教学小 demo 来说，内联字符串反而最省事，所以刻意写在这里。
  const vertexShader = compileShader(gl.VERTEX_SHADER, `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_texCoord;

    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
      v_texCoord = a_texCoord;
    }
  `);

  const fragmentShader = compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float;

    uniform sampler2D u_image;
    uniform float u_strength;
    varying vec2 v_texCoord;

    void main() {
      vec4 color = texture2D(u_image, v_texCoord);

      // 这组权重来自人眼对 RGB 的敏感度，不是简单平均。
      float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      vec3 finalColor = mix(color.rgb, vec3(gray), u_strength);

      gl_FragColor = vec4(finalColor, color.a);
    }
  `);

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program));
  }

  return {
    program,
    position: gl.getAttribLocation(program, "a_position"),
    texCoord: gl.getAttribLocation(program, "a_texCoord"),
    strength: gl.getUniformLocation(program, "u_strength"),
    // 拿到 sampler uniform u_image 的位置，后面显式告诉它「用哪个纹理单元」。
    image: gl.getUniformLocation(program, "u_image"),
  };
}

function createBuffer(data, location, size) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(location);
  // vertexAttribPointer：告诉 GPU「如何从刚绑定的缓冲区里，把一串数字切成一个个顶点属性」。
  // 参数依次是 (location, size, type, normalized, stride, offset)：
  //   location  —— 对应哪个 attribute（比如 a_position）。
  //   size      —— 每个顶点取几个数（2 = (x,y)，3 = (x,y,z)）。
  //   gl.FLOAT  —— 数据类型是 32 位浮点。
  //   false     —— 不做归一化（不把整数压缩到 0~1，浮点本来就不需要）。
  //   stride=0  —— 相邻顶点数据紧挨着，无间隔（0 表示让 WebGL 按 size 自动算步长）。
  //   offset=0  —— 从缓冲区开头读起。
  // 简单说：这行把上面那块裸数据「解释」成 GPU 能逐顶点读取的属性。
  gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);

  // 防御性解绑：把 ARRAY_BUFFER 的当前绑定清空。
  // 原理：vertexAttribPointer 在上一行已经把「当前绑定的 buffer」记进了这个 attribute 自己的状态里，
  //   绘制时 GPU 按各 attribute 记住的 buffer 取数据，不再看 ARRAY_BUFFER 现在绑的是谁。
  //   所以这里解绑不会影响绘制；它的作用是防止后续某处误调 gl.bufferData(ARRAY_BUFFER, ...) 时，
  //   意外改写到这个还残留绑定的 buffer。解绑后再误操作只会作用到 null（报错/无效），更易暴露问题。
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
}

// 顶点数据是怎么「进」shader 的？WebGL 没有「传参」，靠下面这条数据流（绑定 + 关联 + 绘制）：
//   1. shader 声明入口：vertex shader 里的 `attribute vec2 a_position / a_texCoord`（见 createProgram）。
//   2. 拿入口地址：gl.getAttribLocation(program, "a_position") → 存进 programInfo.position（数字句柄/location）。
//   3. bind 数据（就在本函数的 createBuffer 里）：
//        gl.bindBuffer(ARRAY_BUFFER, buffer)    把某个 buffer 设为「当前操作对象」
//        gl.bufferData(...)                     把 JS 数组上传进这个 buffer
//        gl.enableVertexAttribArray(location)   打开该 attribute 的开关
//        gl.vertexAttribPointer(location,...)   把「当前 buffer」按规则接到这个 location 上
//      （vertexAttribPointer 隐式作用于上一行 bindBuffer 绑定的 buffer，所以两个 buffer 各绑各的、互不干扰）
//   4. 绘制时自动喂数据：drawWebGl 里先 gl.useProgram(program) 激活 shader，
//      再 gl.drawArrays(TRIANGLES, 0, 6)，GPU 就逐顶点从 buffer 取数据灌进 a_position / a_texCoord。
function setupGeometry() {
  if (geometryReady) {
    return;
  }

  // 这里画的是一个铺满屏幕的矩形（两个三角形拼成，共 6 个顶点）。
  // 下面用了「每个属性一个 buffer」的分离布局（SoA = Structure of Arrays，数组的结构体：
  //   每种属性各自连成一个数组），而不是图形学更常见的「位置+UV 交错放进同一个 buffer」
  //   （AoS = Array of Structures，结构体的数组：每个顶点的各属性打包在一起，再排成数组 / interleaved）。原因：
  //   1. 教学清晰：每次 createBuffer 只对应一个 attribute，配 vertexAttribPointer 的
  //      stride/offset 都是 0，读起来最直白，不用算偏移量。
  //   2. 性能无所谓：这只是个全屏 quad，才 6 个顶点，交错带来的缓存友好性收益可忽略。
  // 生产中顶点量大、且位置和 UV 总是一起读时，交错单 buffer（用 stride/offset 切分）
  // 更省带宽、更缓存友好，才是常规做法——这里是为了简单刻意拆开的。

  // 顶点位置：裁剪空间坐标，范围 [-1,1]，(-1,-1) 左下、(1,1) 右上，正好覆盖整个画布。
  createBuffer([
    -1, -1, // 左下
    1, -1, // 右下
    -1, 1, // 左上
    -1, 1, // 左上
    1, -1, // 右下
    1, 1, // 右上
  ], programInfo.position, 2);

  // 纹理坐标(UV)：范围 [0,1]，(0,0) 对应图片一角、(1,1) 对应对角，逐顶点和上面的位置一一对应。
  createBuffer([
    0, 0, // 左下
    1, 0, // 右下
    0, 1, // 左上
    0, 1, // 左上
    1, 0, // 右下
    1, 1, // 右上
  ], programInfo.texCoord, 2);

  geometryReady = true;
}

function uploadTexture() {
  if (!texture) {
    texture = gl.createTexture();
  }

  // 显式激活 0 号纹理单元（TEXTURE0），随后的 bindTexture 就会把纹理绑到这个单元上。
  // 不再依赖「activeTexture 默认是 TEXTURE0」这个隐式默认值。
  gl.activeTexture(gl.TEXTURE0);
  // 底层做的事：把 texture 这个纹理对象「挂」到当前激活的纹理单元（上一行的 TEXTURE0）的
  // TEXTURE_2D 槽位上。之后所有针对 gl.TEXTURE_2D 的操作（texImage2D 上传、texParameteri 设参数、
  // shader 采样）都作用到这张被绑定的纹理。它只是改 WebGL 状态机里「当前纹理是谁」的指针，
  // 不复制像素数据；真正的数据上传是下面的 texImage2D。
  gl.bindTexture(gl.TEXTURE_2D, texture);
  // 上传纹理时把图像在竖直方向翻转一下。原因：图片/canvas 的坐标原点在【左上角】、y 向下，
  // 而 WebGL 纹理坐标(UV)原点在【左下角】、y 向上，两者上下相反。
  // 不翻转的话，贴上去的画面会上下颠倒；设为 true 让 WebGL 在上传时自动翻 y，正好对齐。
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  // 这里把 2D canvas 当成纹理上传给 GPU，fragment shader 后面会逐像素采样它。
  // texImage2D(target, level, internalFormat, format, type, source)：
  //   gl.TEXTURE_2D    —— 目标是 2D 纹理；
  //   0                —— level，即 mipmap 层级。0 表示「最高分辨率的原图（基础层）」；
  //                       1、2… 是逐级缩小的预生成小图（mipmap），用于远处/缩小时采样更快更平滑。
  //                       这里只上传一层原图，所以是 0；不手动建其它层。
  //   gl.RGBA(第3个)   —— internalFormat，GPU 内部怎么存（红绿蓝 + 透明，各 8 位）；
  //   gl.RGBA(第4个)   —— format，源数据的像素格式（要和上面匹配）；
  //   gl.UNSIGNED_BYTE —— 每个通道是 0~255 的无符号字节；
  //   sourceCanvas     —— 数据来源（这里直接用 2D canvas）。
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
}

function drawWebGl() {
  // gl 来自前面的 glCanvas.getContext("webgl")，拿不到时为 null，这里要兜底。
  // 什么情况下会拿不到（!gl 为真）：
  //   1. 太老的浏览器（如老 IE）本就不支持 WebGL；
  //   2. 浏览器支持，但 GPU 驱动有问题/被列入黑名单，或用户在设置里禁用了硬件加速/WebGL；
  //      （即：你的显卡驱动太旧或有已知崩溃 bug，浏览器为防止崩溃/花屏，主动把这类驱动拉黑、不让它跑 WebGL。）
  //   3. 同一个 canvas 已经先 getContext("2d") 拿过 2D 上下文了——一个 canvas 的上下文类型是“一次性绑定、互斥”的，之后再要 webgl 会返回 null；
  //   4. 资源紧张：页面同时存在的 WebGL 上下文过多（浏览器有数量上限），新建会失败。
  // 另外要澄清：canvas 不会“自带” gl 上下文。canvas 默认只是一块空白画布，
  // 必须显式调用 getContext("webgl") 才会创建并返回上下文；不调用就没有。
  // 每个 canvas 各自 getContext("webgl") 拿到的是相互独立的 gl context
  if (!gl) {
    message.textContent = "当前浏览器不支持 WebGL。";
    return;
  }

  setupGlCanvas(glCanvas, sourceSize.width, sourceSize.height);
  gl.viewport(0, 0, glCanvas.width, glCanvas.height);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  if (!programInfo) {
    programInfo = createProgram();
  }

  gl.useProgram(programInfo.program);
  setupGeometry();

  uploadTexture();

  // 显式把 sampler u_image 指到 0 号纹理单元（必须在 useProgram 之后设置 uniform）。
  // 这样「u_image → TEXTURE0 → uploadTexture 里绑到 TEXTURE0 的那张纹理」整条链路就打通了。
  gl.uniform1i(programInfo.image, 0);

  const strength = Number(strengthInput.value) / 100;
  gl.uniform1f(programInfo.strength, strength);

  // 画两个三角形，刚好覆盖整个画布。
  // drawArrays(模式, first, count)：
  //   gl.TRIANGLES 模式 = 每 3 个顶点组成一个三角形；
  //   0 = first，从顶点缓冲里第 0 个顶点开始读；
  //   6 = count，一共读 6 个顶点 → 6 / 3 = 2 个三角形（两个三角形拼成一个矩形，盖满画布）。
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  message.textContent = `当前灰度强度：${strengthInput.value}%`;
}

// 读取并显示 WebGL 版本等信息。
function showGlInfo() {
  const glInfo = document.querySelector("#gl-info");
  if (!gl) {
    glInfo.textContent = "WebGL 信息：当前环境不支持 WebGL。";
    return;
  }

  // gl.getParameter 用一个常量去查询 WebGL 的各种状态/信息，这里查的是版本相关字符串：
  //   gl.VERSION                  —— 运行时版本，如 "WebGL 1.0 (OpenGL ES 2.0 Chromium)"。
  //   gl.SHADING_LANGUAGE_VERSION —— 着色器语言(GLSL)版本。
  const version = gl.getParameter(gl.VERSION);
  const glsl = gl.getParameter(gl.SHADING_LANGUAGE_VERSION);

  // 显卡型号默认被浏览器打码（隐私保护），需要 WEBGL_debug_renderer_info 扩展才能拿到真实型号。
  // 扩展不一定存在，所以要判空兜底。
  const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
  const renderer = debugInfo
    ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
    : gl.getParameter(gl.RENDERER); // 没有扩展时退回到（通常被打码的）RENDERER

  glInfo.textContent = `WebGL 版本：${version}｜GLSL：${glsl}｜渲染器：${renderer}`;
}

function redraw() {
  drawSourceImage();
  drawWebGl();
}

document.querySelector("#redraw").addEventListener("click", redraw);
strengthInput.addEventListener("input", drawWebGl);

redraw();
showGlInfo();
