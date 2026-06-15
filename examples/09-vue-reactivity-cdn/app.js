const { createApp } = Vue;

createApp({
  data() {
    return {
      draftName: "新滤镜节点",
      nextId: 3,
      nodes: [
        { id: 1, name: "输入图片", status: "ready" },
        { id: 2, name: "灰度滤镜", status: "ready" },
      ],
    };
  },
  computed: {
    total() {
      // computed 适合表达派生数据。nodes 变了，total 会自动重新计算。
      return this.nodes.length;
    },
  },
  watch: {
    total(nextTotal) {
      // watch 适合在状态变化后做副作用。这里用来同步页面标题。
      document.title = `Vue 示例 - ${nextTotal} 个节点`;
    },
  },
  methods: {
    addNode() {
      const name = this.draftName.trim();

      if (!name) {
        return;
      }

      this.nodes.push({
        id: this.nextId,
        name,
        status: "ready",
      });

      this.nextId += 1;
      this.draftName = "";
    },
  },
// .mount("#app")：把上面 createApp 创建好的应用“挂载”到页面上 id="app" 的元素里。
// 在此之前应用只是内存里的配置，调用 mount 后 Vue 才真正接管那个元素：
// 解析里面的模板、把数据渲染成真实 DOM、并开始监听数据变化做更新。
// 参数 "#app" 是 CSS 选择器，对应 index.html 里的 <main id="app">。
// 这通常是整个应用的最后一步——“配置好 → 挂上去开始跑”。
}).mount("#app");
