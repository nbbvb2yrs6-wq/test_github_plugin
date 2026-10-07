#!/bin/bash
# dsh-github-sync 一键安装脚本
# 用法：克隆本仓库后运行 ./install.sh [profile名]（默认 desktop）
set -euo pipefail

PLUGIN_DIR="$(cd "$(dirname "$0")/dsh-github-sync" && pwd)"
PROFILE="${1:-desktop}"
PROFILE_DIR="${DSH_HOME:-$HOME/.dsh}/profiles/$PROFILE"
MANIFEST="$PROFILE_DIR/package.json"

echo "== dsh-github-sync 安装 =="
echo "插件目录: $PLUGIN_DIR"
echo "目标 profile: $PROFILE_DIR"

# 前提检查
[ -f "$MANIFEST" ] || { echo "✗ 找不到 DSH profile（$MANIFEST 不存在）。请先启动过一次 DSH Desktop。"; exit 1; }
command -v git >/dev/null || { echo "✗ 未安装 git。请先安装 Xcode 命令行工具：xcode-select --install"; exit 1; }
if ! command -v gh >/dev/null && [ ! -x "$HOME/bin/gh" ]; then
  echo "⚠ 未检测到 GitHub CLI（gh）。面板的『发布到 GitHub』需要它："
  echo "  安装:  brew install gh   （或从 https://cli.github.com 下载）"
  echo "  登录:  gh auth login"
fi
if [ -z "$(git config --global user.email || true)" ]; then
  echo "⚠ git 还没有配置身份，首次提交前请运行："
  echo "  git config --global user.name \"你的GitHub用户名\""
  echo "  git config --global user.email \"你的GitHub用户名@users.noreply.github.com\""
fi

# 备份 manifest
BACKUP="$MANIFEST.backup-$(date +%Y%m%d-%H%M%S)"
cp -p "$MANIFEST" "$BACKUP"
echo "✓ 已备份 profile manifest 到 $BACKUP"

# 写入 manifest（dependencies + bundles）
python3 - "$MANIFEST" "$PLUGIN_DIR" <<'PYEOF'
import json, sys
manifest_path, plugin_dir = sys.argv[1], sys.argv[2]
with open(manifest_path) as f:
    data = json.load(f)
data.setdefault("dependencies", {})["dsh-github-sync"] = f"link:{plugin_dir}"
profile = data.setdefault("dsh", {}).setdefault("profile", {})
bundles = profile.setdefault("bundles", [])
if "dsh-github-sync" not in bundles:
    bundles.append("dsh-github-sync")
with open(manifest_path, "w") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
    f.write("\n")
print("✓ 已登记到 profile manifest（dependencies + bundles）")
PYEOF

# 建符号链接
mkdir -p "$PROFILE_DIR/node_modules"
ln -sfn "$PLUGIN_DIR" "$PROFILE_DIR/node_modules/dsh-github-sync"
echo "✓ 已创建 node_modules/dsh-github-sync 符号链接"

echo ""
echo "== 安装完成 =="
echo "重启 DSH Desktop，然后在右侧栏「+」菜单中选择 GitHub。"
