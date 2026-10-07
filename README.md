# DSH GitHub 面板插件

在 DSH 里一键完成 Git/GitHub 工作流的持久插件：右侧栏提供可视化面板，不用命令行就能初始化仓库、发布到 GitHub、提交和推送。

## 功能

- **状态总览**：分支、改动文件数、未推送/落后提交数、远程地址（30 秒自动刷新）
- **初始化仓库**：一键 `git init`（主分支 `main`）
- **发布到 GitHub**：填仓库名即可创建远程仓库并推送，默认**私有**
- **AI 提交信息**：根据 diff 自动生成提交信息
- **提交并推送 / 同步**：两次点击完成日常上传；同步 = `pull --rebase` + `push`，遇冲突安全停止
- **模型工具**：同时注册 `github_status` / `github_init` / `github_publish` / `github_push` / `github_commit` / `github_sync` / `github_auth_status` 七个工具，对话里也能直接让 AI 操作

## 目录结构

```
dsh-github-sync/
├── index.js          # Host 端：git/gh 命令封装、7 个模型工具、HTTP 路由
├── client.js         # 浏览器端：右侧栏 GitHub 面板（React）
├── package.json      # DSH 插件清单（dsh.client 声明 + exports）
└── cordis.patch.yml  # composition 补丁（注册插件行）
```

## 安装

1. 在 DSH profile 的 `package.json` 里加依赖和 bundle：

   ```json
   "dependencies": { "dsh-github-sync": "link:<本目录绝对路径>/dsh-github-sync" },
   "dsh": { "profile": { "bundles": [ "...", "dsh-github-sync" ] } }
   ```

2. 在 profile 的 `node_modules/` 里建同名符号链接指向插件目录
3. 重启 DSH，右侧栏「+」菜单中选择 **GitHub**

## 依赖

- DSH Desktop（含 dsh-better-sidebar ≥ 0.19）
- 已登录的 GitHub CLI（`gh auth login`）
- git 已配置用户身份（`git config --global user.name / user.email`）

## 安全设计

- 新建仓库**默认私有**，公开需显式勾选
- 永不 force-push
- 面板校验会话工作目录，不会误操作其他项目
