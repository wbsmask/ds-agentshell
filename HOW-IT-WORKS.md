# 如何把 DeepSeek Harness 网页版做成桌面应用

> 一份实现方法说明。目标读者：想复刻「把 `dsh web` 变成桌面 App」这件事的开发者。
> 本文讲的是**思路和关键难点**，完整工程在 `ds-agentshell/` 目录里。

---

## 一、一句话原理

`dsh web` 本质上就是一个「**Node 后端 + 浏览器前端**」的 Web 应用。所谓桌面版，就是用一个 **Electron 壳**，把「打开浏览器访问 127.0.0.1:3080」这一步，换成了「打开一个没有地址栏的原生窗口」，并且把后端也一并打包进去。

因为加载的是**同一套前端**（`apps/web/dist`），所以 UI 和功能 100% 一致——你没有重写任何界面，只是换了容器。

---

## 二、先想清楚 `dsh web` 是什么（这是最关键的一步）

动手前必须先搞清楚一件事：**前端不是独立的**。

`dsh web` 启动后，前端页面不是纯静态 HTML，它依赖后端注入的 `window.__DSH_BOOT__`（里面是 boot manifest、API 端点、RPC 通道），前端再通过 `/api` + WebSocket 跟后端通信。

这意味着：**不能**只把前端塞进 Electron 就完事，必须把后端一起带上。

所以「桌面版」= 「Electron 窗口」+「一个跑着的 `dsh web` 后端进程」。

---

## 三、整体架构

```
双击图标
   │
   ▼
Electron 主进程
   ├─ 1. spawn 后端进程：node backend/.../bin.js web --port 3080
   ├─ 2. 轮询 http://127.0.0.1:3080/ 直到返回 200
   ├─ 3. 打开 BrowserWindow，加载 http://127.0.0.1:3080/
   └─ 4. 关闭窗口 → kill 后端进程
```

后端进程是独立的子进程，Electron 只负责「拉起它、等它就绪、关窗时杀掉它」。

---

## 四、分两个阶段实现

### 阶段一：本机版（先跑通，最简单）

Electron 壳 spawn 你本机 checkout 里的 `dsh web`。这一步不打包后端，只是验证「壳 + 后端生命周期」这条链路通不通。

关键代码（Electron 主进程）：

```js
const { spawn } = require('node:child_process')

// 1. spawn 后端
const child = spawn('node', ['apps/cli/lib/bin.js', 'web', '--port', '3080'], {
  cwd: '/path/to/deepseek-harness',
  env: { ...process.env },
})

// 2. 轮询端口直到就绪
async function waitReady(port) {
  for (;;) {
    const ok = await probe(`http://127.0.0.1:${port}/`) // HTTP GET，看是否 200
    if (ok) break
    await sleep(500)
  }
}

// 3. 打开窗口
win.loadURL(`http://127.0.0.1:${port}/`)

// 4. 关窗时杀后端
app.on('window-all-closed', () => { child.kill(); app.quit() })
```

这一阶段能跑通后，你就已经有一个「能用的桌面版」了，只是它依赖本机有 Node 和 checkout。

### 阶段二：自包含可分发版（真正能发给别人）

把后端**整个运行时**打包进安装包，让别人装上后双击即用，不需要 Node、不需要源码。这才是难点所在。

---

## 五、核心难点与解法（重点）

### 难点 1：如何导出 `dsh web` 的「生产依赖闭包」

这是整个项目最难的一步。

`dsh` 是一个 **pnpm monorepo**，它的运行时插件是靠「按包名字符串动态 import」加载的（Cordis 的 Loader 机制）。在 checkout 里能跑，是因为 pnpm workspace 把所有包都链接到了 `node_modules`。

但你不可能把整个 `node_modules`（约 1.3 GB，含大量测试工具）打进安装包。于是自然想到 `pnpm deploy --prod` 导出「生产依赖」。结果它导出的是**不完整**的：

- `--prod` 只导出 `dependencies`；
- 但 DSH 大量**运行时需要的包**声明在 `peerDependencies` / `devDependencies` 里（靠 workspace 链接解析）；
- 还有一些包通过 `pnpm-workspace.yaml` 的 `overrides: link:` 引用（如 `cosmokit`、`schemastery`）。

**解法：仿照官方已有的 `python/sdk-runtime` 的 deploy-root 模式。**

官方为了给 Python SDK 打单文件 exe，已经建了一个 `python/sdk-runtime/package.json`——它是一个「纯依赖清单」包，**显式列出所有运行时包**（100+ 个），它的依赖闭包就是要打包的内容。

于是我们为 web 版做同样的事：

1. **生成一个 deploy root 清单包**，dependencies = 官方 sdk-runtime 的基础闭包 ∪ web 专属包（webserver、client-*、ui-*、web-frontend 等）∪ 几个遗漏的传递包：

```js
// 伪代码：合并两份清单
deps = sdkRuntime.dependencies            // 基础 agent 运行时闭包
     + cli.dependencies                    // web 层
     + ['@deepseek-ai/dsh', ...extra]      // CLI 自身 + 遗漏的传递依赖
```

2. **用官方同款参数导出**：

```sh
pnpm --filter dsh-web-runtime-pkg deploy --legacy --prod \
  --config.node-linker=hoisted \
  --config.auto-install-peers=false \
  --config.link-workspace-packages=true \
  ./backend
```

3. **补全 legacy deploy 遗漏的包**：legacy 模式会漏掉少数 peer-specialized 包（`dsh-atomic-write`、`dsh-spill` 等）和顶层 app 包（`@deepseek-ai/dsh` 本身）。做法是遍历清单，发现缺失就从 checkout 的 workspace 目录把它们复制进来。

4. **物化 symlink**：deploy 出来的 workspace 包是 junction/symlink，指向 checkout。必须把它们 dereference 复制成**真实文件**，否则打包后链接就断了、也不自包含。

5. **验证闭环**：反复跑 `node backend/.../bin.js web --port 随机端口`，看报缺哪个包就补哪个，直到打印出 `dsh web: http://...`。

> 经验：这一步是「迭代式」的——跑起来 → 报缺包 → 补 → 再跑，直到 `dsh web:` 出来、HTTP 返回 200 且页面带 `__DSH_BOOT__`。

### 难点 2：Node 运行时哪来

后端需要一个 Node 进程。Electron 主进程本身是 Node，但它内置的 Node 版本太旧，不满足 DSH 的 `engines: node ^22.19 || >=24`。

**解法：内嵌一个独立 node.exe**（从本机复制 `node.exe`，87 MB，含 ICU），和 `backend/` 一起打包。Electron 壳 spawn 的就是这个内嵌 node：

```js
const node = path.join(backendRoot, 'node.exe')
const bin  = path.join(backendRoot, 'node_modules/@deepseek-ai/dsh/lib/bin.js')
spawn(node, [bin, 'web', '--port', String(port)], { cwd: backendRoot })
```

### 难点 3：electron-builder 的 winCodeSign 解压失败

electron-builder 打包 Windows 时会下载 `winCodeSign`（用于写 exe 图标和签名），它的压缩包里含 macOS 的 `.dylib` 符号链接。Windows 在没开「开发者模式」时，7zip 解压到符号链接会报错，导致打包失败。

**解法：跳过它，自己写图标。** 两步：

1. `signAndEditExecutable: false`（跳过 electron-builder 的 rcedit/签名）；
2. 用 `afterPack` 钩子，在打包完成后、生成安装包前，自己调用 `rcedit.exe` 把图标和版本号写进 exe：

```jsonc
// package.json
"win": { "signAndEditExecutable": false },
"afterPack": "scripts/after-pack.cjs"
```

```js
// scripts/after-pack.cjs（节选）
spawnSync('tools/rcedit-x64.exe', [
  exe, '--set-icon', 'assets/icon.ico',
  '--set-version-string', 'ProductName', productName,
  '--set-file-version', version, '--set-product-version', version,
])
```

> 附带坑：rcedit 偶尔遇到文件刚写完被占用（报 "Unable to commit changes"），加个带退避的重试即可。

### 难点 4：图标（原创设计，避免商标风险）

DeepSeek 的鲸鱼 logo 是其商标，不能直接拿来当应用图标。所以本项目用
`scripts/gen-original-icon.cjs` 从零绘制一个原创图标（圆角蓝紫渐变底 +
终端 `>` 符号 + 光标），再用 resvg 渲染成 PNG、手动拼一个多尺寸 ICO 容器给
rcedit 用。

### 难点 5：国内网络（可选，但很实用）

electron 二进制、electron-builder 的打包工具默认从 GitHub 下载，国内会断。加镜像源即可：

```sh
ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"
```

---

## 六、打包配置要点

```jsonc
// package.json 的 build 字段
{
  "files": ["electron/**/*", "renderer/**/*", "assets/**/*", "ds-agentshell.config.json", "package.json"],
  "extraResources": [{ "from": "backend", "to": "backend" }],  // 内嵌后端放到 resources/backend
  "win": { "target": ["nsis"], "icon": "assets/icon.png", "signAndEditExecutable": false },
  "nsis": { "oneClick": false, "createDesktopShortcut": true }
}
```

`extraResources` 是关键：它把 `backend/`（node.exe + 依赖闭包 + 前端 dist）整目录放进安装目录的 `resources/backend/`，运行时用 `process.resourcesPath` 定位。

---

## 七、隐私设计（为什么 key 不会泄露）

- API key 存在**用户本机**的 `~/.dsh/.credentials.yaml`，从来不在项目目录里，打包白名单也从不包含它。
- 安装包里只有：Electron 壳、内置后端、图标。**零密钥、零会话历史**。
- 别人装上后，首次启动若没配 key，网页自带 onboarding 会引导他填自己的 key。

一句话：**每个人的配置都在他自己的机器上，桌面版只是共享了「代码」，从不共享「数据」**。

---

## 八、踩坑清单（速查）

| 坑 | 现象 | 解法 |
|---|---|---|
| `pnpm deploy --prod` 闭包不完整 | 运行报 `Cannot find package @deepseek-ai/...` | 用 deploy-root 显式清单 + 手动补全遗漏包 |
| legacy deploy 漏 peer 包 | 同上，漏的是 `dsh-atomic-write`/`dsh-spill` 等 | 从 workspace 目录复制补全 |
| workspace 包是 symlink | 打包后链接断、不自包含 | dereference 复制成真实文件 |
| Electron 内置 Node 太旧 | 不满足 DSH 的 node 版本要求 | 内嵌独立 node.exe |
| winCodeSign 解压报错 | 7zip 无法建 macOS 符号链接 | `signAndEditExecutable:false` + afterPack 用 rcedit |
| rcedit 偶发 "Unable to commit changes" | exe 刚写完被占用 | 带退避重试 |
| GitHub 下载 electron 失败 | ECONNRESET | 用 npmmirror 镜像 |

---

## 九、总结：可复现的最小路径

1. **写 Electron 壳**：spawn 后端 + 轮询端口 + 加载窗口 + 关窗杀进程（阶段一，先在本机跑通）。
2. **导出后端闭包**：deploy-root 清单 → `pnpm deploy --legacy --prod` → 补全遗漏包 → 物化 symlink → 内嵌 node.exe（阶段二）。
3. **打图标**：favicon.svg → PNG/ICO。
4. **打包**：electron-builder + `extraResources` 塞 backend + `signAndEditExecutable:false` + afterPack 写图标。
5. **验证**：装到干净环境 → 双击 → 首次启动引导填 key → 能正常对话。

全程最难的是第 2 步——导出 monorepo 的运行时闭包。**凡是「把 Node 后端 + 前端一起塞进桌面应用」的需求，都会遇到同样的问题**，上面的 deploy-root + 补全 + 物化 三连，就是通用解法。
