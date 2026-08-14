# Release Notes — v0.2.0

首个可分发版本：自包含桌面客户端。

## 新增

- 双击即用的原生桌面应用，内置完整后端运行时（Node 24 + DeepSeek Harness 闭包 + 前端）。
- UI 与 DeepSeek Harness 网页版完全一致（加载同一套前端）。
- 自动管理后端生命周期：启动拉起、关窗结束、端口复用。
- 隐私安全：不打包任何 API key / 会话历史，首次启动引导填写自己的 key。
- 原创应用图标（不包含任何第三方商标元素）。

## 下载

- `DS-AgentShell-Setup-2.0.exe` —— Windows 安装包（推荐）。

## 已知说明

- 安装包未做代码签名，首次运行可能触发 SmartScreen，点「更多信息 → 仍要运行」。
- 本应用为**非官方**第三方客户端，与 DeepSeek 公司无关。

## 校验

SHA-256：
```
E33112F8879DF5542EEE2EC87EDE520EB313AAA7C41BE6A325030F2D540E8A4E
```
