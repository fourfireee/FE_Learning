const bars = document.querySelector("#bars");
const stats = document.querySelector("#stats");
const runner = document.querySelector("#runner");
const toggleAnimationButton = document.querySelector("#toggle-animation");

let animationId = 0;
let animationRunning = false;
let startTime = 0;

function createBars() {
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < 120; index += 1) {
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.width = `${80 + (index % 20) * 10}px`;
    fragment.append(bar);
  }

  bars.replaceChildren(fragment);
}

function runBadLayout() {
  const items = [...document.querySelectorAll(".bar")];
  const begin = performance.now();

  items.forEach((item) => {
    // 这里读 offsetWidth 后又马上写 width，读写交错会让浏览器更容易反复计算布局。
    const width = item.offsetWidth;
    item.style.width = `${width + 1}px`;
  });

  const cost = performance.now() - begin;
  stats.textContent = `读写交错完成，耗时约 ${cost.toFixed(2)}ms。打开 Performance 面板可以观察 layout 成本。`;
}

function runBatchedLayout() {
  const items = [...document.querySelectorAll(".bar")];
  const begin = performance.now();

  // 先集中读取布局信息。
  const widths = items.map((item) => item.offsetWidth);

  // 再集中写入样式，减少读写交错。
  items.forEach((item, index) => {
    item.style.width = `${widths[index] + 1}px`;
  });

  const cost = performance.now() - begin;
  stats.textContent = `先读后写完成，耗时约 ${cost.toFixed(2)}ms。`;
}

function animate(timestamp) {
  if (!startTime) {
    startTime = timestamp;
  }

  const elapsed = timestamp - startTime;
  const x = 18 + Math.sin(elapsed / 450) * 180 + 180;

  // 动画 transform 通常可以走合成阶段，比每帧改 left 更适合高频视觉更新。
  runner.style.transform = `translateX(${x}px)`;

  animationId = requestAnimationFrame(animate);
}

function toggleAnimation() {
  animationRunning = !animationRunning;
  toggleAnimationButton.textContent = animationRunning ? "停止 rAF 动画" : "启动 rAF 动画";

  if (animationRunning) {
    startTime = 0;
    animationId = requestAnimationFrame(animate);
  } else {
    cancelAnimationFrame(animationId);
  }
}

document.querySelector("#bad-layout").addEventListener("click", runBadLayout);
document.querySelector("#batched-layout").addEventListener("click", runBatchedLayout);
toggleAnimationButton.addEventListener("click", toggleAnimation);

createBars();
