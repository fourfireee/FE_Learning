const editor = document.querySelector("#editor");
const edgesLayer = document.querySelector("#edges");
const nodesLayer = document.querySelector("#nodes");
const output = document.querySelector("#output");
const connectModeButton = document.querySelector("#connect-mode");

let state = {
  nodes: [
    { id: "input", title: "输入图片", x: 80, y: 90 },
    { id: "gray", title: "灰度滤镜", x: 330, y: 170 },
    { id: "output", title: "输出结果", x: 600, y: 110 },
  ],
  edges: [
    { from: "input", to: "gray" },
    { from: "gray", to: "output" },
  ],
  selectedNodeId: "input",
};

let history = [];
let future = [];
let drag = null;
let connectMode = false;
let connectSourceId = null;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function pushHistory(previousState) {
  history.push(clone(previousState));
  future = [];
}

function commit(nextState) {
  pushHistory(state);
  state = nextState;
  render();
}

function getNode(id) {
  return state.nodes.find((node) => node.id === id);
}

function nodeCenter(node) {
  return {
    x: node.x + 75,
    y: node.y + 36,
  };
}

function renderEdges() {
  edgesLayer.replaceChildren(...state.edges.map((edge) => {
    const from = nodeCenter(getNode(edge.from));
    const to = nodeCenter(getNode(edge.to));
    const midX = (from.x + to.x) / 2;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", "edge");
    // d 是 SVG path 的「路径指令」字符串，描述这条线怎么画。这里画一条三次贝塞尔曲线连接两个节点：
    //   M x y            move to：把画笔移到起点(from)，不画线。
    //   C c1x c1y, c2x c2y, x y   cubic贝塞尔：用两个控制点把画笔从起点弯到终点(to)。
    // 控制点取在水平中点 midX 上(c1=(midX, from.y), c2=(midX, to.y))，
    // 让曲线从起点先水平伸出、再平滑拐向终点，形成节点图里常见的「S 形」连线。
    path.setAttribute("d", `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`);
    return path;
  }));
}

function renderNodes() {
  nodesLayer.replaceChildren(...state.nodes.map((node) => {
    const item = document.createElement("article");
    item.className = "node";
    item.dataset.id = node.id;
    item.style.transform = `translate(${node.x}px, ${node.y}px)`;

    if (node.id === state.selectedNodeId) {
      item.classList.add("selected");
    }

    if (node.id === connectSourceId) {
      item.classList.add("connect-source");
    }

    item.innerHTML = `
      <h2>${node.title}</h2>
      <p>${node.id}</p>
    `;

    return item;
  }));
}

function render() {
  renderEdges();
  renderNodes();
  connectModeButton.classList.toggle("active", connectMode);
}

function selectNode(nodeId) {
  state = { ...state, selectedNodeId: nodeId };
  render();
}

function addNode() {
  const id = `node-${state.nodes.length + 1}`;

  commit({
    ...state,
    nodes: [
      ...state.nodes,
      { id, title: "新节点", x: 140 + state.nodes.length * 36, y: 260 },
    ],
    selectedNodeId: id,
  });
}

function addEdge(from, to) {
  if (from === to) {
    return;
  }

  const exists = state.edges.some((edge) => edge.from === from && edge.to === to);

  if (exists) {
    return;
  }

  commit({
    ...state,
    edges: [...state.edges, { from, to }],
    selectedNodeId: to,
  });
}

function undo() {
  if (history.length === 0) {
    return;
  }

  future.push(clone(state));
  state = history.pop();
  render();
}

function redo() {
  if (future.length === 0) {
    return;
  }

  history.push(clone(state));
  state = future.pop();
  render();
}

function serialize() {
  output.value = JSON.stringify(state, null, 2);
}

function startDrag(event, nodeId, nodeElement) {
  const node = getNode(nodeId);

  // 拖拽开始时保存一份旧状态。松手后再入历史栈，避免每移动一像素都产生一次 undo。
  drag = {
    nodeId,
    startX: event.clientX,
    startY: event.clientY,
    originalX: node.x,
    originalY: node.y,
    before: clone(state),
  };

  // setPointerCapture：把这一次指针(鼠标/触摸/笔)的后续事件「锁定」到 nodeElement 上。
  // 之后即使指针移出节点、甚至移出整个编辑器，pointermove/pointerup 仍会派发给这个节点。
  // 解决拖拽经典问题：拖太快导致指针甩出元素时，不会丢事件、拖拽不会中途断掉。
  // pointerId 标识具体哪根指针(支持多点触控时区分手指)。松手时浏览器会自动释放捕获。
  nodeElement.setPointerCapture(event.pointerId);
}

function updateDrag(event) {
  if (!drag) {
    return;
  }

  const dx = event.clientX - drag.startX;
  const dy = event.clientY - drag.startY;

  state = {
    ...state,
    nodes: state.nodes.map((node) => node.id === drag.nodeId
      ? { ...node, x: drag.originalX + dx, y: drag.originalY + dy }
      : node),
  };

  render();
}

function endDrag() {
  if (!drag) {
    return;
  }

  pushHistory(drag.before);
  drag = null;
  render();
}

nodesLayer.addEventListener("pointerdown", (event) => {
  const nodeElement = event.target.closest(".node");

  if (!nodeElement) {
    return;
  }

  const nodeId = nodeElement.dataset.id;
  selectNode(nodeId);

  if (connectMode) {
    if (!connectSourceId) {
      connectSourceId = nodeId;
      render();
    } else {
      addEdge(connectSourceId, nodeId);
      connectSourceId = null;
      render();
    }

    return;
  }

  startDrag(event, nodeId, nodeElement);
});

document.addEventListener("pointermove", updateDrag);
document.addEventListener("pointerup", endDrag);
document.addEventListener("pointercancel", endDrag);

editor.addEventListener("pointerdown", (event) => {
  if (event.target === editor || event.target === nodesLayer) {
    connectSourceId = null;
    selectNode(null);
  }
});

document.querySelector("#add-node").addEventListener("click", addNode);
document.querySelector("#undo").addEventListener("click", undo);
document.querySelector("#redo").addEventListener("click", redo);
document.querySelector("#serialize").addEventListener("click", serialize);
connectModeButton.addEventListener("click", () => {
  connectMode = !connectMode;
  connectSourceId = null;
  render();
});

render();
serialize();
