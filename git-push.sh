#!/bin/bash
set -euo pipefail

# Safe GitHub workflow for one local project.
# Defaults: current directory, main branch, private GitHub repository.
# This script never force-pushes and never deletes or resets files.

GH_DEFAULT="$(cd "$(dirname "$0")" && pwd)/tools/gh-cli/bin/gh"
GH="${GH_BIN:-$GH_DEFAULT}"
REMOTE="origin"

usage() {
  cat <<'EOF'
用法:
  ./git-push.sh init
  ./git-push.sh publish [仓库名] [--public]
  ./git-push.sh status
  ./git-push.sh commit-push "提交信息"
  ./git-push.sh help

说明:
  publish 默认创建私有 GitHub 仓库；加 --public 才创建公开仓库。
  所有命令默认作用于当前目录，也可以用 PROJECT_DIR=/path/to/project 指定项目目录。
  不执行 force push，不执行 reset --hard，不删除本地文件。
EOF
}

project_dir() {
  local dir="${PROJECT_DIR:-$PWD}"
  [[ -d "$dir" ]] || { echo "项目目录不存在: $dir" >&2; exit 1; }
  cd "$dir"
  pwd
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || { echo "找不到命令: $1" >&2; exit 1; }
}

require_gh() {
  if [[ ! -x "$GH" ]]; then
    GH="$(command -v gh || true)"
  fi
  [[ -n "$GH" && -x "$GH" ]] || {
    echo "找不到 GitHub CLI。请设置 GH_BIN，或安装 gh。" >&2
    exit 1
  }
  "$GH" auth status --hostname github.com >/dev/null 2>&1 || {
    echo "尚未登录 GitHub，请先执行: $GH auth login" >&2
    exit 1
  }
}

repo_root() {
  git rev-parse --show-toplevel 2>/dev/null
}

ensure_main_branch() {
  if ! git rev-parse --verify HEAD >/dev/null 2>&1; then
    git checkout -B main >/dev/null 2>&1 || git branch -M main
  else
    local branch
    branch="$(git branch --show-current)"
    [[ "$branch" == "main" ]] || git branch -M main
  fi
}

cmd_init() {
  if git rev-parse --show-toplevel >/dev/null 2>&1; then
    echo "已经是 Git 仓库: $(repo_root)"
    return
  fi
  git init -b main
  echo "已初始化 Git 仓库: $(pwd)"
}

cmd_status() {
  if ! repo_root >/dev/null 2>&1; then
    echo "当前目录还不是 Git 仓库"
    return 0
  fi
  echo "项目: $(repo_root)"
  echo "分支: $(git branch --show-current || true)"
  git status --short
  if git remote get-url "$REMOTE" >/dev/null 2>&1; then
    echo "远程: $(git remote get-url "$REMOTE")"
    git status --short --branch
  else
    echo "远程: 未配置 origin"
  fi
}

cmd_publish() {
  local name="$(basename "$(pwd)")" visibility="--private"
  if [[ "${1:-}" != "" && "${1:-}" != --* ]]; then name="$1"; shift; fi
  if [[ "${1:-}" == "--public" ]]; then
    visibility="--public"
    shift
  fi
  [[ $# -eq 0 ]] || { echo "publish 参数不正确" >&2; usage; exit 2; }
  require_gh
  cmd_init
  ensure_main_branch
  git add -A
  if ! git diff --cached --quiet; then
    git commit -m "Initial commit"
  else
    echo "没有需要提交的初始文件"
  fi
  "$GH" repo create "$name" "$visibility" --source=. --remote="$REMOTE" --push
  echo "已发布到 GitHub: $name ($visibility)"
}

cmd_commit_push() {
  local message="${1:-}"
  [[ -n "$message" ]] || { echo "请提供提交信息" >&2; usage; exit 2; }
  repo_root >/dev/null 2>&1 || { echo "当前目录还不是 Git 仓库，请先执行 init 或 publish" >&2; exit 1; }
  git add -A
  if git diff --cached --quiet; then
    echo "没有新的改动，不执行 commit 或 push"
    return 0
  fi
  git commit -m "$message"
  if git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' >/dev/null 2>&1; then
    git push "$REMOTE"
  else
    local branch
    branch="$(git branch --show-current)"
    git push -u "$REMOTE" "$branch"
  fi
  echo "已提交并推送: $message"
}

main() {
  require_command git
  project_dir >/dev/null
  case "${1:-help}" in
    init) shift; [[ $# -eq 0 ]] || { usage; exit 2; }; cmd_init ;;
    publish) shift; cmd_publish "$@" ;;
    status) shift; [[ $# -eq 0 ]] || { usage; exit 2; }; cmd_status ;;
    commit-push) shift; cmd_commit_push "$@" ;;
    help|-h|--help) usage ;;
    *) echo "未知命令: $1" >&2; usage; exit 2 ;;
  esac
}

main "$@"
