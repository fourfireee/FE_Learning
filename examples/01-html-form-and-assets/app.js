const form = document.querySelector("#effect-form");
const result = document.querySelector("#result");

function readForm() {
  // FormData 会按表单控件的 name 收集值，所以 name 是字段名，不只是一个标签。
  const data = new FormData(form);

  return {
    imageName: data.get("imageName"),
    filter: data.get("filter"),
    strength: Number(data.get("strength")),
  };
}

function renderConfig() {
  const config = readForm();

  // DOM 文本用 textContent 写入，浏览器会把它当纯文本处理，不会当 HTML 执行。
  result.textContent = JSON.stringify(config, null, 2);
}

form.addEventListener("submit", (event) => {
  // 阻止表单默认刷新页面，这样可以在当前页面里直接看到计算结果。
  event.preventDefault();
  renderConfig();
});

// input 事件：只要表单里任意一个输入控件的值发生改变就触发，例如：
//   - 在文本框里每敲一个字；
//   - 拖动滑块(range)每移动一点；
//   - 在下拉框(select)里选了别的选项。
// 这里把事件绑在 form 上，而 input 事件会冒泡，所以表单内任何控件变化都会
// 冒泡到 form，从而调用 renderConfig 实时刷新结果，不需要点按钮。
//
// input vs change：
//   - input 是“值一变就触发”（实时）。
//   - change 是“失焦或确认后才触发一次”（比如文本框要等你点到别处）。
//   - 想要实时预览就用 input。
//
// input vs submit：
//   - submit 只在“提交表单”时触发（点提交按钮或回车），见上面的 submit 监听。
//   - input 是输入过程中持续触发。
//   - 两个都调用 renderConfig，所以无论实时改还是点提交，结果都会更新。
form.addEventListener("input", renderConfig);

renderConfig();
