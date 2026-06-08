const logList = document.querySelector("#log");
const taskList = document.querySelector("#tasks");

let taskId = 1;

function log(message) {
  const item = document.createElement("li");
  item.textContent = message;
  logList.append(item);
}

function clearLog() {
  logList.replaceChildren();
}

function runEventLoopDemo() {
  clearLog();

  log("1. 同步代码开始");

  setTimeout(() => {
    log("4. setTimeout 是宏任务，排在后面执行");
  }, 0);

  Promise.resolve().then(() => {
    log("3. Promise.then 是微任务，会在本轮同步代码结束后尽快执行");
  });

  log("2. 同步代码结束");
}

function createCounter() {
  let count = 0;

  // 这个内部函数会记住 count，这就是闭包最常见的用法。
  return function next() {
    count += 1;
    return count;
  };
}

function runClosureDemo() {
  clearLog();

  const next = createCounter();
  log(`第一次调用：${next()}`);
  log(`第二次调用：${next()}`);
  log(`第三次调用：${next()}`);
}

function addTask() {
  const item = document.createElement("li");
  item.textContent = `任务 ${taskId}`;
  taskId += 1;

  // DOM 是一棵对象树。append 会把新节点挂到现有节点下面。
  taskList.append(item);
}

document.querySelector("#run-event-loop").addEventListener("click", runEventLoopDemo);
document.querySelector("#run-closure").addEventListener("click", runClosureDemo);
document.querySelector("#add-task").addEventListener("click", addTask);
document.querySelector("#clear-log").addEventListener("click", clearLog);
