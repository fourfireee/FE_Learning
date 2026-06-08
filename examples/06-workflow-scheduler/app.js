const nodesView = document.querySelector("#nodes");
const logView = document.querySelector("#log");
const runButton = document.querySelector("#run");
const cancelButton = document.querySelector("#cancel");
const failUpscaleInput = document.querySelector("#fail-upscale");

const graph = [
  { id: "input", label: "读取图片", deps: [], duration: 700 },
  { id: "grayscale", label: "灰度滤镜", deps: ["input"], duration: 900 },
  { id: "edge", label: "边缘检测", deps: ["input"], duration: 1100 },
  { id: "merge", label: "合并结果", deps: ["grayscale", "edge"], duration: 800 },
  { id: "upscale", label: "模型放大", deps: ["merge"], duration: 1300 },
  { id: "save", label: "保存输出", deps: ["upscale"], duration: 500 },
];

let runToken = { cancelled: false };
let state = createInitialState();

function createInitialState() {
  return Object.fromEntries(graph.map((node) => [
    node.id,
    { status: "idle", progress: 0 },
  ]));
}

function log(message) {
  const item = document.createElement("li");
  item.textContent = message;
  logView.append(item);
}

function render() {
  nodesView.replaceChildren(...graph.map((node) => {
    const current = state[node.id];
    const item = document.createElement("article");
    item.className = "node";

    item.innerHTML = `
      <h2>${node.label}</h2>
      <p>id: ${node.id}</p>
      <p>依赖: ${node.deps.length ? node.deps.join(", ") : "无"}</p>
      <p><span class="status ${current.status}">${current.status}</span></p>
      <progress max="100" value="${current.progress}"></progress>
    `;

    return item;
  }));
}

function validateDag() {
  const visiting = new Set();
  const visited = new Set();
  const byId = new Map(graph.map((node) => [node.id, node]));

  function visit(id) {
    if (visiting.has(id)) {
      throw new Error(`发现环：${id}`);
    }

    if (visited.has(id)) {
      return;
    }

    visiting.add(id);

    for (const dep of byId.get(id).deps) {
      visit(dep);
    }

    visiting.delete(id);
    visited.add(id);
  }

  graph.forEach((node) => visit(node.id));
}

function canRun(node) {
  return node.deps.every((dep) => state[dep].status === "success");
}

function setNodeState(id, patch) {
  state[id] = { ...state[id], ...patch };
  render();
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function runNode(node, token) {
  setNodeState(node.id, { status: "running", progress: 0 });
  log(`${node.label} 开始运行`);

  const steps = 10;

  for (let step = 1; step <= steps; step += 1) {
    if (token.cancelled) {
      setNodeState(node.id, { status: "cancelled" });
      throw new Error("cancelled");
    }

    await sleep(node.duration / steps);
    setNodeState(node.id, { progress: step * 10 });
  }

  if (node.id === "upscale" && failUpscaleInput.checked) {
    setNodeState(node.id, { status: "failed" });
    throw new Error("upscale failed");
  }

  setNodeState(node.id, { status: "success", progress: 100 });
  log(`${node.label} 运行成功`);
}

function markBlockedAsCancelled() {
  for (const node of graph) {
    if (state[node.id].status === "idle" || state[node.id].status === "pending") {
      setNodeState(node.id, { status: "cancelled" });
    }
  }
}

async function runWorkflow() {
  runToken.cancelled = true;
  runToken = { cancelled: false };
  state = createInitialState();
  logView.replaceChildren();
  render();

  try {
    validateDag();
    log("DAG 校验通过");

    const remaining = new Set(graph.map((node) => node.id));

    while (remaining.size > 0) {
      const runnable = graph.filter((node) => remaining.has(node.id) && canRun(node));

      if (runnable.length === 0) {
        throw new Error("没有可运行节点，可能有依赖失败或图结构错误");
      }

      // 这里为了方便观察，按批次并行运行所有已满足依赖的节点。
      await Promise.all(runnable.map(async (node) => {
        remaining.delete(node.id);
        await runNode(node, runToken);
      }));
    }

    log("workflow 全部完成");
  } catch (error) {
    if (error.message === "cancelled") {
      log("workflow 已取消");
    } else {
      log(`workflow 失败：${error.message}`);
    }

    markBlockedAsCancelled();
  }
}

runButton.addEventListener("click", runWorkflow);
cancelButton.addEventListener("click", () => {
  runToken.cancelled = true;
});

render();
