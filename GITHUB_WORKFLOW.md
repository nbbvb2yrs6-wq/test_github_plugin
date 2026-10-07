# 用脚本在本机发布和推送 GitHub 项目

脚本：`git-push.sh`

## 前置条件

- 安装 Git。
- 安装并登录 GitHub CLI（`gh`）。本目录 `tools/gh-cli/bin/gh` 若存在，脚本会优先使用它；也可通过 `GH_BIN=/path/to/gh` 指定其他位置。
- 首次登录执行：

```bash
./tools/gh-cli/bin/gh auth login
```

按提示选择 GitHub.com 和浏览器设备授权。也可以直接执行 `gh auth login`（如果 `gh` 已在 PATH）。

## 使用

在终端进入项目目录，并调用脚本的绝对路径：

```bash
cd /path/to/project
/Users/demo/Desktop/懂球帝/DSH/插件_Git/git-push.sh status
/Users/demo/Desktop/懂球帝/DSH/插件_Git/git-push.sh init
```

初始化后，确认 `.gitignore` 不会把密钥、`.env` 或大型生成文件提交，然后发布：

```bash
/Users/demo/Desktop/懂球帝/DSH/插件_Git/git-push.sh publish my-project
```

默认创建**私有仓库**。确认内容适合公开后，才显式使用：

```bash
/Users/demo/Desktop/懂球帝/DSH/插件_Git/git-push.sh publish my-project --public
```

以后提交并推送：

```bash
/Users/demo/Desktop/懂球帝/DSH/插件_Git/git-push.sh status
/Users/demo/Desktop/懂球帝/DSH/插件_Git/git-push.sh commit-push "修复登录问题"
```

也可以不切换目录，指定项目路径：

```bash
PROJECT_DIR=/path/to/project /Users/demo/Desktop/懂球帝/DSH/插件_Git/git-push.sh status
```

## 安全行为

- 不使用 `--force`，不重置或删除项目文件。
- 发布会将项目所有未忽略文件加入初始提交。**发布前先检查 `git status` 与 `.gitignore`，尤其注意 `.env`、密钥和令牌。**
- `commit-push` 只在确实有 staged 改动时创建提交；随后推送 `origin`。
- 现阶段脚本是独立工具，不会自动加载为 DSH 插件，也不修改 DSH 的 profile。
