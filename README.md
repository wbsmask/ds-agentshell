# DeepSeek Harness Desktop

> 一个**非官方**、社区制作的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 桌面客户端。
> 把 `dsh web` 变成双击即开的原生桌面应用，UI 与功能与网页版完全一致。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub release](https://img.shields.io/badge/release-0.2.0-green)](../../releases)

> ⚠️ **免责声明**：本项目与 DeepSeek 官方**无任何关联、未经其背书**。它只是基于开源的 DeepSeek Harness（MIT 协议）做的第三方打包，仅用于技术学习和个人使用。

---

## 特性

- ✅ **双击即用**：内置后端运行时，无需安装 Node.js、无需源码 checkout。
- ✅ **UI 100% 一致**：加载的就是 DeepSeek Harness 的原生网页前端，零改动。
- ✅ **隐私安全**：不打包任何 API key、会话历史；每个人的配置都存在自己电脑上。
- ✅ **原生体验**：独立窗口、任务栏图标、无地址栏无浏览器边框。
- ✅ **自动管理后端**：启动自动拉起、关窗自动结束、端口占用自动复用。

## 下载安装

前往 [Releases](../../releases) 下载最新 `DeepSeek-Harness-Setup-*.exe`，双击安装即可。

> 首次运行 Windows 可能提示「已保护你的电脑」——本安装包未做代码签名（个人项目无证书），点「更多信息 → 仍要运行」即可。

## 从源码构建

需要：Node.js ≥ 22、pnpm、一个 deepseek-harness checkout（用于导出后端）。

```sh
npm install
npm run dist          # -> release/DeepSeek-Harness-Setup-<version>.exe
```

完整实现原理见 [HOW-IT-WORKS.md](HOW-IT-WORKS.md)。

## 使用

1. 安装后从开始菜单 / 桌面快捷方式启动。
2. 首次启动若无 API key，网页会引导你配置自己的 DeepSeek key（存在你本机 `~/.dsh`）。
3. 端口、后端来源等可在安装目录的 `dsh-desktop.config.json` 修改。

## 隐私

- 安装包内**不含**任何 API key、凭据、会话历史。
- 你的 key 存在本机 `~/.dsh/.credentials.yaml`，永远不会被打包或上传。
- 发给别人的只有「代码 + 成品」，不包含「你的数据」。

## 免责声明

- 本项目是**独立的第三方**客户端，与 DeepSeek 公司无关。
- 使用 DeepSeek Harness 及 DeepSeek 相关服务时，请遵守其官方条款。
- 应用图标为原创设计，不含任何第三方商标元素。

## 许可证

本项目代码以 [MIT](LICENSE) 开源。内置的 DeepSeek Harness、Electron、Node.js
等第三方组件各自保留其原始许可证，详见 [LICENSE](LICENSE) 末尾的第三方声明。

## 致谢

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（MIT）—— 本应用的核心后端。
- [Electron](https://www.electronjs.org/) —— 桌面运行时。
