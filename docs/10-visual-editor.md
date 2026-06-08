# 可视化编辑器专题

- 可视化编辑器的难点不是把节点画出来，而是交互、坐标、状态和性能要一起正确。
- 节点编辑器通常需要同时处理鼠标、键盘、缩放、平移、选择、连线、撤销重做。

- 核心对象：
    - node：节点。
    - edge：连线。
    - port / handle：节点上的输入输出口。
    - viewport：视口，也就是当前能看到的编辑器区域，包含平移和缩放。
    - selection：选择集，也就是当前选中的节点或边。

- 坐标转换：
    - 鼠标事件给的是 screen 坐标，也就是浏览器窗口里的位置。
    - 编辑器内容有 pan 和 zoom。pan 是平移，zoom 是缩放。
    - 真正保存节点位置时，应该保存 graph 坐标，也就是节点图自己的世界坐标。

```js
function screenToGraph(point, viewport) {
  return {
    x: (point.x - viewport.x) / viewport.zoom,
    y: (point.y - viewport.y) / viewport.zoom,
  };
}
```

- 常见交互：
    - 拖拽节点。
    - 框选节点。
    - 多选移动。
    - 拖拽连线。
    - 缩放平移画布。
    - 对齐和吸附。
    - 复制粘贴。
    - 撤销重做。

- 命中测试：
    - 命中测试就是判断鼠标点到了哪个对象。
    - DOM（Document Object Model，文档对象模型）节点可以直接用事件系统。
    - Canvas 需要自己判断鼠标是否落在图形范围内。
    - SVG（Scalable Vector Graphics，可缩放矢量图形）可以利用 DOM 事件，也可以自己做几何判断。

- 性能关键点：
    - 拖拽中避免全图重算。
    - 大量节点时只渲染视口内对象。
    - 节点位置变化尽量使用 transform。
    - 复杂路径和布局计算要缓存。
    - 临时交互状态和正式文档状态分开。

- React Flow 的核心概念：
    - `nodes`：节点数组。
    - `edges`：边数组。
    - `handles`：连接点。
    - `viewport`：缩放和平移。
    - `custom node`：自定义节点 UI（User Interface，用户界面）。
    - `custom edge`：自定义连线 UI。

- 判断编辑器代码是否靠谱：
    - 坐标转换是否统一。
    - 交互状态是否清楚。
    - 节点和边是否能序列化保存。
    - 撤销重做是否覆盖主要操作。
    - 大图拖拽和缩放是否流畅。

- 可运行示例：
    - [最小可视化编辑器示例](../examples/07-visual-editor-state/index.html)
