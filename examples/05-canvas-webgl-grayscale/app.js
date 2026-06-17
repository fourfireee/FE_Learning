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
  // setTransform(a, b, c, d, e, f) 直接「重置」画布的坐标变换矩阵，6 个参数含义：
  //   a=水平缩放, d=垂直缩放, b/c=倾斜(skew), e/f=平移(单位:像素)。
  //   它把你写的坐标 (x, y) 换算成实际绘制位置：新x = a*x + c*y + e；新y = b*x + d*y + f。
  // 举例帮助理解：
  //   setTransform(1,0,0,1, 50,30)  → 画什么都整体右移 50、下移 30（e=平移x, f=平移y）。
  //   setTransform(1,0.5,0,1, 0,0)  → b=0.5：x 越大，y 被额外拉低，图形变成向下斜的平行四边形（倾斜）。
  //   setTransform(2,0,0,2, 0,0)    → a=d=2：整体放大 2 倍。
  // 本行用 (dpr,0,0,dpr,0,0)：不平移不倾斜，只把坐标放大 dpr 倍。
  // 作用：上面把画布物理像素放大了 dpr 倍（为了高分屏清晰），这里让绘图坐标也放大 dpr 倍，
  // 于是后面写 (10, 20) 这种 CSS 坐标会自动落到正确的物理像素上——不必每个坐标手动乘 dpr。
  // 用 setTransform 而非 scale：它是「设为」而不是「叠加」，重复调用也不会越缩越多。
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
    -1, -1,
    1, -1,
    -1, 1,
    -1, 1,
    1, -1,
    1, 1,
  ], programInfo.position, 2);

  // 纹理坐标(UV)：范围 [0,1]，(0,0) 对应图片一角、(1,1) 对应对角，逐顶点和上面的位置一一对应。
  createBuffer([
    0, 0,
    1, 0,
    0, 1,
    0, 1,
    1, 0,
    1, 1,
  ], programInfo.texCoord, 2);

  geometryReady = true;
}

function uploadTexture() {
  if (!texture) {
    texture = gl.createTexture();
  }

  gl.bindTexture(gl.TEXTURE_2D, texture);
  // 上传纹理时把图像在竖直方向翻转一下。原因：图片/canvas 的坐标原点在【左上角】、y 向下，
  // 而 WebGL 纹理坐标(UV)原点在【左下角】、y 向上，两者上下相反。
  // 不翻转的话，贴上去的画面会上下颠倒；设为 true 让 WebGL 在上传时自动翻 y，正好对齐。
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  // 这里把 2D canvas 当成纹理上传给 GPU，fragment shader 后面会逐像素采样它。
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
}

function drawWebGl() {
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

  const strength = Number(strengthInput.value) / 100;
  gl.uniform1f(programInfo.strength, strength);

  // 画两个三角形，刚好覆盖整个画布。
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  message.textContent = `当前灰度强度：${strengthInput.value}%`;
}

function redraw() {
  drawSourceImage();
  drawWebGl();
}

document.querySelector("#redraw").addEventListener("click", redraw);
strengthInput.addEventListener("input", drawWebGl);

redraw();
