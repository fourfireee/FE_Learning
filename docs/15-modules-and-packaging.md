# 模块化与包管理

- 模块化解决一个问题：怎么把代码拆成很多文件，又能清楚地互相引用，而不污染全局。
- 打包（bundling）解决另一个问题：浏览器没法高效加载成百上千个小文件，需要把它们处理成少量优化过的产物。
- 这一篇把模块系统、依赖管理、构建工具串起来，是 11 篇工程化的底层原理。

- 没有模块化的年代：

- 早期前端把所有变量都挂在全局，多个 script 之间靠全局变量通信。
- 问题很明显：命名冲突、加载顺序敏感、看不出谁依赖谁。
- 模块化的本质就是给每个文件一个独立作用域，再用明确的导入导出建立联系。

- ES Modules（ESM）：

- ESM 是 ECMAScript Modules，JavaScript 的标准模块系统，浏览器和 Node 都支持。
- 用 `export` 导出，用 `import` 导入，依赖关系写在代码里一目了然。

```js
// math.js —— 导出
export function add(a, b) {
  return a + b;
}
export const PI = 3.14159; // 命名导出, 可以导出多个

export default function main() {} // 默认导出, 一个文件最多一个
```

```js
// app.js —— 导入
import main, { add, PI } from "./math.js"; // main 是默认导出, 花括号里是命名导出
import * as math from "./math.js";          // 也可以整体导入成一个对象
```

- 几个要点：
    - import 必须写在文件顶层，是静态的，构建工具能据此分析依赖。
    - 模块只会执行一次，多个文件 import 同一个模块拿到的是同一份。
    - 路径要么是相对路径（`./`、`../`），要么是包名（裸导入，由构建工具解析到 node_modules）。

- CommonJS（CJS）：

- CJS 是 CommonJS，Node 早期的模块系统，现在仍大量存在于老库和 Node 脚本里。
- 用 `require` 导入，用 `module.exports` 导出。

```js
// CommonJS 写法
const { add } = require("./math.js"); // 同步加载
module.exports = { add };
```

- 和 ESM 的主要区别：
    - CJS 是运行时同步加载，ESM 是静态分析。
    - ESM 能做 tree-shaking，CJS 不行。
    - 现代项目优先用 ESM，遇到只提供 CJS 的依赖时构建工具会帮忙转换。

- 为什么需要打包：

- 一个真实项目会有几百上千个模块，还会用到 node_modules 里的第三方库。
- 浏览器逐个请求这么多小文件会很慢；很多语法（TS、JSX、新特性）浏览器也不直接认。
- TS 是 TypeScript，JSX 是 JavaScript XML，都是构建工具常见的转换输入。
- 打包工具做几件事：
    - 顺着 import 关系，从入口文件出发把所有依赖找全（依赖图）。
    - 把代码转换成浏览器能跑的版本（TypeScript → JavaScript，JSX → JavaScript）。
    - 合并、压缩，输出少量优化过的产物。

```mermaid
flowchart LR
    A["入口 main.ts"] --> B["顺着 import 收集依赖"]
    B --> C["转换 TS/JSX 为 JavaScript"]
    C --> D["合并 + 压缩"]
    D --> E["产出 bundle.js / css / 资源"]
```

- tree-shaking：

- tree-shaking 指构建时把没被用到的导出代码删掉，减小体积。可以把它理解成「摇树」：没有被引用的枝叶会被摇掉。
- 它依赖 ESM 的静态结构：因为 import 是静态的，工具能确定哪些导出从没被引用。
- 这也是优先用 ESM、并且按需导入（`import { add }` 而不是整包导入）的原因之一。

- 包管理：

- npm / pnpm / yarn 负责安装依赖、记录版本、执行脚本。
- `package.json` 是项目的说明书：
    - dependencies：运行时需要的依赖。
    - devDependencies：只在开发和构建时需要的（如打包工具、测试框架）。
    - scripts：可执行的命令。

```json
{
  "dependencies": {
    "react": "^18.2.0"
  },
  "devDependencies": {
    "vite": "^5.0.0"
  },
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  }
}
```

- 版本号里的符号要看懂：
    - `^18.2.0`：允许升级到 18.x 的最新，但不跨大版本到 19。
    - `~18.2.0`：只允许升级补丁号到 18.2.x。
    - `18.2.0`：锁死这个版本。

- lockfile（如 `package-lock.json`、`pnpm-lock.yaml`）：
    - 记录每个依赖实际装的精确版本和它们的子依赖。
    - 保证不同人、不同机器、CI 上装出来的依赖树完全一致。CI 是 Continuous Integration，持续集成。
    - 要提交到代码仓库，不要手改。

- pnpm 相比 npm 的好处：用硬链接共享依赖，省磁盘、装得快、依赖隔离更严格，现代项目常用。

- 模块化和你的项目：

- 特效工具和 workflow 工具都会拆成很多模块：UI（User Interface，用户界面）组件、坐标转换、调度器、模型客户端等。
- 清晰的模块边界让 AI 生成代码时有明确的「这段逻辑该放哪、该导出什么」的约束。
- WASM（WebAssembly）模块也是通过 import 引入并初始化的，理解模块系统是接入 native 引擎的前提。

- 判断模块和依赖管理是否靠谱：

- 每个模块职责是否单一，导出的东西是否是它真正想对外提供的。
- 是否避免了循环依赖（A 导入 B，B 又导入 A）。
- 是否按需导入而不是无脑整包导入。
- lockfile 是否提交了，依赖版本是否可复现。
- 第三方依赖是否必要，能否用更小的替代或自己写几行解决。
