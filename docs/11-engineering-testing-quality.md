# 工程化、测试与质量控制

- 工程化的目标是让项目可以稳定开发、构建、测试、部署。
- 对 AI coding 来说，工程化越清楚，AI 生成的代码越容易被约束和验证。

- package manager：
    - package manager 是包管理器，负责安装依赖和执行脚本。
    - npm 是 Node Package Manager，Node.js 生态默认的包管理器。
    - pnpm 是 performant npm 的缩写，可以理解成更省磁盘、更快的 npm 替代方案。
    - `package.json` 描述项目依赖和命令。
    - lockfile 锁定依赖版本，保证多人安装结果尽量一致。

- 构建工具：
    - Vite 适合现代前端项目，开发启动快。
    - Webpack 更传统，生态和配置能力强。
    - dev server 负责本地开发。
    - HMR 是 Hot Module Replacement，热模块替换，负责修改代码后局部刷新。
    - build 负责生成线上静态产物。

- 常见脚本：

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest",
    "lint": "eslint ."
  }
}
```

- 测试：
    - 单元测试：验证纯函数和小模块。
    - 组件测试：验证组件在某些输入下是否渲染正确。
    - E2E 是 End to End，端到端测试，像用户一样操作页面，验证完整流程。
    - mock API：模拟后端接口，让前端在没有真实后端时也能稳定测试。API 是 Application Programming Interface，应用程序编程接口。

- 调试：
    - Console：看日志和临时表达式。
    - Sources：断点调试。
    - Network：看请求、响应、缓存、耗时。
    - Performance：看主线程和帧率。
    - Memory：看泄漏。
    - React DevTools / Vue DevTools：看组件树和状态。DevTools 是 Developer Tools，开发者工具。

- 质量判断标准：
    - 数据结构是否明确。
    - 状态变化是否能解释。
    - 错误路径是否处理。
    - 边界条件是否覆盖。
    - 关键逻辑是否有测试。
    - 性能瓶颈是否能定位。

- 当前教程里的纯静态示例：
    - 可以直接打开对应 `index.html`。
    - 也可以在仓库根目录启动一个静态服务器后访问。

```bash
python3 -m http.server 5173
```
