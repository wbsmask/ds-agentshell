# DS-AgentShell

> ⚠️ **说明**
>
> 本项目为**非官方第三方封装客户端，与 DeepSeek AI 官方无任何关联**。
>
> 上游原版开源仓库：https://github.com/deepseek-ai/deepseek-harness
>
> 安装包未做代码数字签名，请自行评估使用风险。
>
> 项目基于 DeepSeek Harness，将其网页界面封装至原生窗口，现已开源。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 📌 它是什么

DeepSeek Harness 原生需要在终端执行 `dsh web`，再手动打开浏览器访问页面。
我基于它封装为**双击直接启动**的桌面应用。
UI 和功能与原版 100% 一致（程序内部加载的仍是上游原版前端），仅增加原生窗口外壳。

## ✨ 特点

- **双击即用**：内置后端运行时，不用安装 Node.js、无需克隆源码
- **隐私安全**：程序不会打包任何 API Key，密钥保存在本地电脑
- **自动管理**：启动自动拉起后端进程，关闭窗口自动结束服务
- **开源协议**：MIT，自由使用、二次修改

## 🔗 获取

- **源码（GitHub 仓库）**：https://github.com/wbsmask/ds-agentshell
- **Windows 安装包**：前往 [Releases 页面](https://github.com/wbsmask/ds-agentshell/releases) 下载最新安装包

## 📖 技术实现

采用 Electron 外壳 + 内嵌 `dsh web` 后端运行。
核心难点：将 monorepo 整套运行环境闭包打包进安装包。完整实现思路写在仓库内 [HOW-IT-WORKS.md](HOW-IT-WORKS.md)。

---

测试了一遍，基本无明显 Bug。
仓库同时提供源码与打包好的安装包，全部发布在 GitHub。

## 免责声明

本项目是**独立的第三方**客户端，与 DeepSeek AI 公司无关。使用 DeepSeek Harness 及 DeepSeek 相关服务时，请遵守其官方条款。应用图标为原创设计，不含任何第三方商标元素。

## 许可证

本项目代码以 [MIT](LICENSE) 开源。内置的 DeepSeek Harness、Electron、Node.js 等第三方组件各自保留其原始许可证，详见 [LICENSE](LICENSE)。
