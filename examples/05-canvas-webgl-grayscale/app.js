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
  gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
}

function setupGeometry() {
  if (geometryReady) {
    return;
  }

  createBuffer([
    -1, -1,
    1, -1,
    -1, 1,
    -1, 1,
    1, -1,
    1, 1,
  ], programInfo.position, 2);

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
