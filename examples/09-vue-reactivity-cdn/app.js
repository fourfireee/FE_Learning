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
}).mount("#app");
