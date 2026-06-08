# 安全、部署与线上问题

- 前端安全不是只靠后端。
- 前端负责展示、输入、存储 token、调用接口，因此也会直接暴露安全风险。token 可以理解成一张临时通行证，用来证明当前请求是谁发的。

- XSS：
    - XSS 是 Cross-Site Scripting，跨站脚本攻击。
    - 攻击者把恶意脚本注入页面。
    - 避免把不可信字符串直接当 HTML 插入。
    - React / Vue 默认会转义文本，但手动插入 HTML 时仍然危险。

```js
// 风险高：用户输入可能变成可执行 HTML
container.innerHTML = userInput;

// 更安全：把用户输入当纯文本
container.textContent = userInput;
```

- CSRF：
    - CSRF 是 Cross-Site Request Forgery，跨站请求伪造。
    - 用户登录后，攻击站点诱导浏览器向你的站点发请求。
    - 常见防护包括 SameSite Cookie、CSRF token、后端校验来源。

- CORS：
    - CORS 是 Cross-Origin Resource Sharing，跨源资源共享。
    - CORS 是浏览器对跨域请求的限制。
    - 它不是前端单方面能关闭的东西。
    - 正确做法是让服务端配置允许的 origin、method、header。

- Token 存储：
    - localStorage 容易被 XSS 读到。
    - HttpOnly Cookie 不能被 JavaScript 读取，但要处理 CSRF。
    - 具体方案要结合业务风险和后端能力。

- 环境变量：
    - 前端环境变量会被打进构建产物。
    - 不能把密钥、私有 token、服务端密码放进前端环境变量。
    - 前端只能保存可以公开的配置，比如 API base URL。API 是 Application Programming Interface，应用程序编程接口；URL 是 Uniform Resource Locator，统一资源定位符。

- 部署：
    - 前端构建产物通常是 HTML（HyperText Markup Language，超文本标记语言）、CSS（Cascading Style Sheets，层叠样式表）、JavaScript、图片等静态资源。
    - 可以部署到静态服务器、CDN（Content Delivery Network，内容分发网络）、对象存储或应用服务器。
    - HTML 通常不要强缓存。
    - 带 hash 的 JavaScript / CSS 可以长缓存。hash 是根据文件内容算出的短标识，内容变了 hash 也会变。

- 线上问题：
    - 错误监控记录异常堆栈。
    - 性能监控记录加载时间、长任务、接口耗时。
    - 用户行为日志帮助复现问题。
    - Source Map 是源码映射文件，能把压缩后的线上代码映射回源码，但要控制访问权限。

- 判断安全和部署方案是否靠谱：
    - 敏感信息是否没有进入前端产物。
    - 接口权限是否由后端最终校验。
    - 缓存策略是否能支持快速发布和回滚。
    - 错误和性能是否可观测。
