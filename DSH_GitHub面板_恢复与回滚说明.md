# DSH GitHub 面板：启用前备份与故障恢复说明

适用场景：将 `dsh-github-sync` 加入日常 DSH Desktop profile 后，重启出现白屏、恢复模式、页面异常，或想撤销本次安装。

> 本说明只回滚 GitHub 插件配置，不删除 DSH 设置、历史会话、项目文件或 GitHub 仓库。不要清空整个 `~/.dsh`，不要删除 profile 数据目录。

## 本次涉及的路径

- 日常 profile：`~/.dsh/profiles/desktop/`
- 日常 profile 清单：`~/.dsh/profiles/desktop/package.json`
- 生成的 Cordis composition：`~/.dsh/profiles/desktop/cordis.yml`
- 用户 patch（若有）：`~/.dsh/profiles/desktop/cordis.patch.yml`
- 插件源代码：`/Users/demo/Desktop/懂球帝/DSH/插件_Git/dsh-github-sync/`

## 重启前先备份

在 Terminal 运行下面命令。它会把 profile 配置备份到桌面，不会修改原文件：

```bash
PROFILE="$HOME/.dsh/profiles/desktop"
BACKUP="$HOME/Desktop/dsh-desktop-profile-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP"
for f in package.json cordis.yml cordis.patch.yml; do
  if [ -f "$PROFILE/$f" ]; then cp -p "$PROFILE/$f" "$BACKUP/$f"; fi
done
printf '备份位置：%s\n' "$BACKUP"
```

记录命令输出的备份路径。备份只包含配置文件，不包含会话数据，因为本次操作不应改动会话数据。

## 如果重启后 DSH 页面正常

在侧栏确认 GitHub 面板出现即可。仅显示面板不会触发 Git 初始化、提交、发布或推送。不要在真实项目上点击“创建并推送”，除非你已确认仓库名、私有/公开选项和要上传的文件。

## 如果出现白屏、恢复模式或启动异常：安全回滚

1. 退出 DSH Desktop。
2. 打开 Terminal。
3. 把下面的 `BACKUP_DIR` 替换为重启前命令输出的实际备份目录路径，然后执行整段命令：

```bash
BACKUP_DIR="$HOME/Desktop/dsh-desktop-profile-backup-请替换为实际时间戳"
PROFILE="$HOME/.dsh/profiles/desktop"

if [ ! -f "$BACKUP_DIR/package.json" ]; then
  echo "找不到备份 package.json：$BACKUP_DIR/package.json"
  exit 1
fi

cp -p "$BACKUP_DIR/package.json" "$PROFILE/package.json"
if [ -f "$BACKUP_DIR/cordis.yml" ]; then
  cp -p "$BACKUP_DIR/cordis.yml" "$PROFILE/cordis.yml"
fi
if [ -f "$BACKUP_DIR/cordis.patch.yml" ]; then
  cp -p "$BACKUP_DIR/cordis.patch.yml" "$PROFILE/cordis.patch.yml"
fi

echo "Profile 配置已恢复。现在重新启动 DSH Desktop。"
```

若恢复的 `package.json` 不含本次 GitHub 插件，则它会回到启用前状态。请按原方式正常启动 DSH Desktop。不要删除 `~/.dsh/profiles/desktop`，不要重置应用数据。

## 若没有备份或想手动移除插件

只从 `~/.dsh/profiles/desktop/package.json` 做两处精确移除：

1. 在 `dependencies` 对象中删除键 `"dsh-github-sync": "link:/Users/demo/Desktop/懂球帝/DSH/插件_Git/dsh-github-sync"`，并修正相邻逗号，保持合法 JSON。
2. 在 `dsh.profile.bundles` 数组中删除字符串 `"dsh-github-sync"`。
3. 保留其他所有依赖、bundle、profile 文件和 DSH 数据。
4. 如果该 profile 存在 `cordis.yml`，使用随 DSH 安装的 profile 管理/生成流程重新生成配置；不要手工清空或覆盖成 `[]`。
5. 重新启动 DSH。

操作前先复制一份 `package.json`。编辑后可用以下命令检查 JSON 格式：

```bash
node -e "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')); console.log('package.json JSON OK')" "$HOME/.dsh/profiles/desktop/package.json"
```

## 发给其他 AI 的恢复请求模板

```text
请帮我安全回滚 DSH Desktop 的 dsh-github-sync profile bundle。

目标：恢复 DSH 正常启动；保留全部会话历史、设置、项目文件和其他 profile 配置。禁止删除 ~/.dsh、禁止重置应用数据、禁止改动 shipped preset 或应用安装目录。

日常 profile：~/.dsh/profiles/desktop/
插件：/Users/demo/Desktop/懂球帝/DSH/插件_Git/dsh-github-sync/
备份目录：把我保存的 dsh-desktop-profile-backup-时间戳路径填在这里。

先检查备份与当前 package.json/cordis.yml，说明准备改哪些文件；只恢复备份中的 package.json、cordis.yml、cordis.patch.yml（若备份存在），不要删除 profile 或 session 数据。恢复后验证 JSON 格式，并告诉我如何正常重启 DSH。
```

## 安全边界

- 插件面板出现与 GitHub 登录无关；没有点击发布/推送操作时，不会上传项目。
- 回滚 profile 配置不会删除 GitHub 上已经存在的仓库或提交。
- 如果曾经手动执行过发布/推送，回滚插件不会撤销远端内容；不要用 force-push 或删除仓库来“恢复”。
- 不要将 GitHub token、keychain 导出内容或凭证粘贴给其他 AI。
