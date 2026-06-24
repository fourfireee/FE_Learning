// 读取并播放本地视频的最小示例：
//   1. 用 <input type="file"> 让用户选一个本地视频文件；
//   2. 用 URL.createObjectURL 给这个文件生成一个临时 URL，喂给 <video> 播放；
//   3. 额外演示：把视频当前帧用 drawImage 画到 canvas 上（视频 → 图形渲染的衔接点）。

const fileInput = document.getElementById("file");
const video = document.getElementById("video");
const grabButton = document.getElementById("grab");
const seekButton = document.getElementById("seek");
const fpsInput = document.getElementById("fps");
const frameNoInput = document.getElementById("frame-no");
const frameCanvas = document.getElementById("frame");
const message = document.getElementById("message");

// 记住上一次创建的临时 URL，换视频时要释放，避免内存泄漏。
let currentObjectUrl = null;

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) {
    return;
  }

  // 选了新文件，先释放上一个临时 URL（它指向的内存不会自动回收，要手动 revoke）。
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
  }

  // createObjectURL 的原理（通俗版）：
  //   浏览器内部已经持有这个文件的数据（用户选中时就拿到了它的引用，并不复制内容）。
  //   createObjectURL 只是给这块数据登记一个“门牌号”——一个形如 blob:http://... 的临时 URL，
  //   并在内部维护一张「这个 URL → 那块数据」的对照表。
  //   之后把这个 URL 当普通网址用（赋给 video.src / img.src），浏览器一查表就找到本地数据直接读，
  //   全程不发网络请求、也不把文件转成 base64 塞进内存，几乎零开销、瞬间完成。
  //   代价：这个登记会一直占着，直到你 revokeObjectURL 注销它（所以上面换文件时先 revoke）。
  currentObjectUrl = URL.createObjectURL(file);
  // 用什么解码器？不是你写的代码、也不是这个 blob URL 决定的，而是浏览器的内置媒体管线：
  //   它先读文件头识别容器格式（mp4 / webm 等）和里面的编码（H.264 / H.265 / VP9 / AV1…），
  //   再交给底层对应的解码器解码。优先走 GPU/系统的「硬件解码」（省电流畅），
  //   不支持时回退到「软件解码」（纯 CPU，更耗电）。
  //   所以同一段代码，能不能播、用硬解还是软解，取决于浏览器 + 操作系统 + 显卡对该编码的支持，
  //   而不取决于这里的写法。常见坑：H.265/HEVC 在部分浏览器不支持，会加载失败（可监听 video 的 error 事件）。
  video.src = currentObjectUrl;

  message.textContent = `已加载：${file.name}`;
});

// loadedmetadata：视频的元数据（宽高、时长）已就绪，此时才知道画面尺寸。
// 用它把 canvas 的像素尺寸设成和视频一致，抓帧时画面不会被拉伸。
video.addEventListener("loadedmetadata", () => {
  frameCanvas.width = video.videoWidth;
  frameCanvas.height = video.videoHeight;
  grabButton.disabled = false;
  seekButton.disabled = false;
});

// 把视频当前帧画到 canvas。抽成函数，给「抓取当前帧」和「跳转后抓取」共用。
function drawCurrentFrame() {
  const ctx = frameCanvas.getContext("2d");
  // drawImage 可以直接接收一个 <video> 元素，画的是它“当前这一帧”的画面。
  // 这就是视频和 Canvas/WebGL 图形处理的衔接口：拿到帧后就能做滤镜、贴图、分析等。
  ctx.drawImage(video, 0, 0, frameCanvas.width, frameCanvas.height);
}

grabButton.addEventListener("click", () => {
  drawCurrentFrame();
  message.textContent = `已抓取第 ${video.currentTime.toFixed(2)} 秒的画面`;
});

seekButton.addEventListener("click", () => {
  const fps = Number(fpsInput.value);
  const frameNo = Number(frameNoInput.value);
  if (fps <= 0) {
    message.textContent = "帧率要大于 0。";
    return;
  }

  // 核心换算：帧号 → 时间(秒) = 帧号 / 帧率。视频只能按时间定位，所以必须先换算。
  // 加 0.5 帧再除，是让目标时间落在「这一帧的中间」而不是边界上，
  // 避免因浮点/关键帧误差恰好取到相邻的上一帧。
  const targetTime = (frameNo + 0.5) / fps;

  // 不能超过视频时长，否则 seek 无效。
  if (targetTime > video.duration) {
    message.textContent = `超出视频时长（${video.duration.toFixed(2)} 秒）。`;
    return;
  }

  // seeked：设置 currentTime 后，画面解码到位是异步的，要等这个事件触发才说明帧已就绪。
  // { once: true } 表示这个监听只执行一次，触发后自动移除，避免重复累积监听器。
  video.addEventListener("seeked", () => {
    drawCurrentFrame();
    message.textContent = `已跳转到第 ${frameNo} 帧（约 ${targetTime.toFixed(3)} 秒）并抓取`;
  }, { once: true });

  // 真正触发跳转：浏览器会 seek 到最接近 targetTime 的可解码画面。
  video.currentTime = targetTime;
});
