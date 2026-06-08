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
      style: {
        filter: `grayscale(${strength}%)`,
      },
    }, "这个色块的灰度由 React state 决定"),
    h("pre", null, JSON.stringify(config, null, 2)),
  );
}

ReactDOM.createRoot(document.querySelector("#root")).render(h(App));
