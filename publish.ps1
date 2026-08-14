# 一键发布到 GitHub：创建公开仓库 + 推送代码 + 发 Release 上传安装包
# 用法：在 dsh-desktop 目录打开 PowerShell，执行  .\publish.ps1

param(
  [string]$RepoName = "dsh-desktop",
  [string]$Version = "0.2.0"
)

$ErrorActionPreference = "Stop"
$ExePath = "release\DeepSeek-Harness-Setup-$Version.exe"

Write-Host "=== 1. 检查 GitHub CLI ===" -ForegroundColor Cyan
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Host "未安装 GitHub CLI。请先到 https://cli.github.com/ 下载安装。" -ForegroundColor Red
  Write-Host "安装后运行:  gh auth login   （选 GitHub.com -> HTTPS -> 用浏览器登录）" -ForegroundColor Yellow
  exit 1
}

Write-Host "=== 2. 检查登录状态 ===" -ForegroundColor Cyan
gh auth status 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "未登录。请运行:  gh auth login" -ForegroundColor Yellow
  exit 1
}
$user = (gh api user --jq .login)
Write-Host "已登录账号: $user" -ForegroundColor Green

Write-Host "=== 3. 创建公开仓库并推送代码 ===" -ForegroundColor Cyan
# 若仓库已存在，改为直接推送
gh repo view "$user/$RepoName" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "创建仓库 $RepoName ..."
  gh repo create $RepoName --public --source . --push
} else {
  Write-Host "仓库已存在，直接推送 ..."
  git remote add origin "https://github.com/$user/$RepoName.git" 2>$null
  git push -u origin main
}

Write-Host "=== 4. 设置 Topics ===" -ForegroundColor Cyan
gh repo edit "$user/$RepoName" --add-topic deepseek-harness --add-topic electron --add-topic desktop-app --add-topic deepseek --add-topic ai-coding-assistant

Write-Host "=== 5. 发布 Release 并上传安装包 ===" -ForegroundColor Cyan
if (-not (Test-Path $ExePath)) {
  Write-Host "找不到安装包: $ExePath" -ForegroundColor Yellow
  Write-Host "跳过 Release。如需上传，请先运行 npm run dist 重新打包。" -ForegroundColor Yellow
} else {
  $title = "v$Version 首个可分发版本"
  gh release create "v$Version" $ExePath --title $title --notes-file RELEASE_NOTES.md
}

Write-Host ""
Write-Host "=== 发布完成！仓库地址: https://github.com/$user/$RepoName ===" -ForegroundColor Green
