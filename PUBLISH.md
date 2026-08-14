# 发布到 GitHub 的步骤

把本项目发布为公开仓库 + 附带安装包 Release。全程约 5 分钟。

> **推荐：一键脚本** —— 装好 GitHub CLI 并登录后，在项目目录直接执行：
> `.\publish.ps1`（自动创建仓库、推代码、设 topics、发 Release 上传安装包）。
> 下面的手动步骤是备选方案。

## 前提

- 你有 GitHub 账号（当前 git 用户名：`WbsMusk`）。
- 本机已配置好 SSH 公钥到 GitHub（否则用 HTTPS + token 代替，见文末）。

---

## 第一步：在 GitHub 上建空仓库

1. 打开 https://github.com/new
2. **Repository name** 填：`dsh-desktop`
3. 选 **Public**（公开）
4. **不要**勾选 "Add a README / .gitignore / license"（本目录已带这些文件，勾了会冲突）
5. 点 **Create repository**
6. 记下仓库地址，形如：`git@github.com:WbsMusk/dsh-desktop.git`

---

## 第二步：本地提交并推送

在本目录（`dsh-desktop/`）打开终端，执行：

```sh
# 1. 初始化仓库并提交
git init
git add .
git commit -m "feat: DeepSeek Harness 非官方桌面客户端（自包含）"

# 2. 关联远程（把下面地址换成你第一步记下的）
git remote add origin git@github.com:WbsMusk/dsh-desktop.git

# 3. 推送
git branch -M main
git push -u origin main
```

> 如果提示 SSH 权限错误（permission denied），说明公钥没配到 GitHub，
> 改用 HTTPS + token：`git remote add origin https://github.com/WbsMusk/dsh-desktop.git`，
> push 时输入用户名 + Personal Access Token（GitHub → Settings → Developer settings → Personal access tokens）。

---

## 第三步：发布安装包 Release

1. 打开你的仓库页 → 右侧 **Releases** → **Create a new release**
2. **Tag**：填 `v0.2.0`，点 "Create new tag"
3. **Title**：`v0.2.0 首个可分发版本`
4. **描述**：粘贴 `RELEASE_NOTES.md` 的内容
5. **Attach binaries**：上传 `release/DeepSeek-Harness-Setup-0.2.0.exe`
6. 点 **Publish release**

完成后，别人就能在 Release 页下载安装包了。

---

## 仓库发布后的建议

- **话题（Topics）**：在仓库页点 ⚙️ 设置，添加 topics：
  `deepseek-harness`、`electron`、`desktop-app`、`deepseek`、`ai-coding-assistant`
  （⚠️ 不要加 `dsh-plugin`——本仓库是「客户端」，不是 DSH 插件）。
- **宣传**：到 DeepSeek Harness 的 GitHub Discussions 发帖介绍你的客户端。

---

## 常见问题

**Q：`git add .` 会不会把安装包、后端、隐私都传上去？**
不会。`.gitignore` 已排除 `backend/`、`release/`、`node_modules/`、`.cache/` 和所有日志。
提交到 GitHub 的只有源码 + 文档（约 500 KB），不含安装包、不含任何隐私。
安装包是你在第三步手动上传到 Release 的。

**Q：会不会泄露我的 API key？**
不会。key 在你本机 `~/.dsh`，从来不在项目目录里，更不会被 `git add`。
