# 工程化、测试与质量控制

- 工程化的目标是让项目可以稳定开发、构建、测试、部署。
- 对 AI coding 来说，工程化越清楚，AI 生成的代码越容易被约束和验证。

## package manager

- package manager 是包管理器，负责安装依赖和执行脚本。
- npm 是 Node Package Manager，Node.js 生态默认的包管理器。
- pnpm 是 performant npm 的缩写，可以理解成更省磁盘、更快的 npm 替代方案。
- `package.json` 描述项目依赖和命令。
- lockfile 锁定依赖版本，保证多人安装结果尽量一致。

## 构建工具

- Vite 适合现代前端项目，开发启动快。
    - 是什么：一个现代构建工具，同时管「本地开发」和「打包上线」两件事。
    - 开发为什么快：不像老工具那样先把整个项目打包完才让你看到页面，Vite 直接利用浏览器原生 ES 模块，按需加载——你访问哪个页面才编译哪部分，所以项目再大启动也几乎秒开。
    - 主要功能：内置 dev server（本地开发服务器）、HMR（改代码局部热更新，不刷整页）、对 TS/JSX/CSS 等开箱即用；上线时用 build 命令（底层用 Rollup）打成优化过的静态产物。
    - 和你相关：它对 WASM、Web Worker、glsl 等有良好支持，做特效/可视化工具时接入引擎和着色器较省心。
- Webpack 更传统，生态和配置能力强。
- dev server 负责本地开发。
    - 是什么：开发期临时跑在你电脑上的一个小型本地服务器（如运行后访问 http://localhost:5173），把项目跑起来供你边写边看。
    - 为什么需要它：现代前端用 ES 模块、裸导入(import "react")、TS/JSX 等，浏览器不能直接打开 .ts/.vue 文件；dev server 在请求时即时编译成浏览器能懂的代码再返回。直接双击 html 文件用 file:// 打开则做不到这些。
      （.vue 是 Vue 的单文件组件格式：把一个组件的模板 template、逻辑 script、样式 style 写在同一个文件里，需经编译才能在浏览器运行。）
    - 主要能力：提供本地访问地址、即时编译、配合 HMR 改代码自动局部刷新、还能代理后端接口(解决开发期跨域)。
    - 注意：它只用于开发，不是上线用的服务器；上线要用 build 打出静态产物，再部署到正式服务器/CDN。
- HMR 是 Hot Module Replacement，热模块替换，负责修改代码后局部刷新。
- build 负责生成线上静态产物。

## 常见脚本

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

## 测试

- 单元测试：验证纯函数和小模块。
- 组件测试：验证组件在某些输入下是否渲染正确。
- E2E 是 End to End，端到端测试，像用户一样操作页面，验证完整流程。
- mock API：模拟后端接口，让前端在没有真实后端时也能稳定测试。API 是 Application Programming Interface，应用程序编程接口。

## 调试

- Console：看日志和临时表达式。
- Sources：断点调试。
    - 叫 Sources(源代码)是因为这个面板列出页面加载的所有源文件(JS/CSS 等源码)，你在这里查看代码、打断点。
    - 断点：在某行代码做个标记，程序跑到那行会暂停，让你逐行执行、查看当时的变量值——是定位逻辑 bug 最常用的手段。
    - 配合 source map 还能直接在原始 TS/未压缩代码上打断点，而不是面对编译后乱码般的产物。
- Network：看请求、响应、缓存、耗时。
- Performance：看主线程和帧率。
- Memory：看泄漏。
- React DevTools / Vue DevTools：看组件树和状态。DevTools 是 Developer Tools，开发者工具。

## 质量判断标准

- 数据结构是否明确。
- 状态变化是否能解释。
- 错误路径是否处理。
- 边界条件是否覆盖。
- 关键逻辑是否有测试。
- 性能瓶颈是否能定位。

## 当前教程里的纯静态示例

- 可以直接打开对应 `index.html`。
- 也可以在仓库根目录启动一个静态服务器后访问。

```bash
# 在仓库根目录(FE_Learning，即包含 examples/ 的那一层)执行：
cd /path/to/FE_Learning   # 换成你本地仓库的实际路径
python3 -m http.server 5173
# 这会以「当前目录」为网站根目录，启动一个本地静态服务器，监听 5173 端口。
```

## 启动后在浏览器访问（URL 路径 = 文件相对仓库根目录的路径）

- 打开某个示例：`http://localhost:5173/examples/06-workflow-scheduler/index.html`
- 访问目录(末尾带 /)会自动找该目录下的 index.html：`http://localhost:5173/examples/06-workflow-scheduler/`
- 直接开 `http://localhost:5173/` 则会列出仓库根目录的文件清单，点进去逐级浏览。
- 停止服务器：在终端按 Ctrl + C。换端口：把 5173 改成别的（如 8000），URL 里也跟着改。
