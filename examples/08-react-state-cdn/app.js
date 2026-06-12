// h 只是给 React.createElement 起的短别名（hyperscript 惯例命名）。
// createElement(标签或组件, 属性对象, ...子元素) 用来创建一个“UI 描述对象”（虚拟 DOM 节点）。
// 平时项目里写的 JSX（如 <section className="panel">...</section>）并不是合法 JS，
// 要靠构建工具编译成 React.createElement(...) 调用——也就是这里 h(...) 的样子。
// 这个示例没有构建步骤（CDN 直接跑），所以手写 h(...) 代替 JSX，两者完全等价。
const h = React.createElement;

function App() {
  const [name, setName] = React.useState("demo-image");
  const [strength, setStrength] = React.useState(60);

  const config = React.useMemo(() => {
    return {
      imageName: name,
      filter: "grayscale",
      strength,
    };
  }, [name, strength]);

  React.useEffect(() => {
    // effect 用来处理副作用。这里的副作用是修改浏览器标题。
    document.title = `React 示例 - ${strength}%`;
  }, [strength]);
  /*
  setStrength(80)            // 用户拖滑块
  → React 重新执行 App()      // React 的 render：纯计算，算出新 UI 描述
  → React 把变化提交到 DOM     // commit：真实 DOM 已更新
  → 浏览器把新 DOM 画到屏幕     // paint：用户看到新画面
  → useEffect 执行           // 这时才改 document.title
  // `document.title`属于浏览器 UI（和地址栏、书签栏一个级别），不属于网页画布。
  // 改它不触发页面的 layout/paint/composite——赋值那一刻浏览器就直接更新标签文字了，
  // 是同步、立即生效的，不存在「等下一帧」的问题
   */

  // h("section", {...}, 子1, 子2, ...) 等价于 JSX 的：
  // <section className="panel">子1 子2 ...</section>
  return h("section", { className: "panel" },
    h("label", { className: "row" },
      "图片名称",
      h("input", {
        value: name,
        onChange(event) {
          setName(event.target.value);
        },
      }),
    ),
    h("label", { className: "row" },
      "灰度强度",
      h("input", {
        type: "range",
        min: 0,
        max: 100,
        value: strength,
        onChange(event) {
          setStrength(Number(event.target.value));
        },
      }),
    ),
    h("div", {
      className: "preview",
      // React 里的内联样式：style 接收一个 JS 对象（不是 CSS 字符串），
      // 属性名用驼峰（如 fontSize），值是字符串。最终会写到元素的 style 属性上。
      // filter 是 CSS 滤镜属性，grayscale(N%) 表示灰度化的程度：0% 原色，100% 全灰。
      // 这里把 state 里的 strength 直接拼进样式——拖滑块改 state，React 重新渲染，
      // 色块灰度立刻跟着变。这正是“UI 是 state 的结果”：样式不用手动改 DOM，
      // 描述好“当前 state 下该长什么样”，剩下的交给 React。
      style: {
        filter: `grayscale(${strength}%)`,
      },
    }, "这个色块的灰度由 React state 决定"),
    h("pre", null, JSON.stringify(config, null, 2)),
  );
}

ReactDOM.createRoot(document.querySelector("#root")).render(h(App));
