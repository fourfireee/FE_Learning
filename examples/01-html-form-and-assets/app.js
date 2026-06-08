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

form.addEventListener("input", renderConfig);

renderConfig();
