#!/usr/bin/env bash
# 安装 dsh-sound-alert 到当前用户的 DSH profile。
# 用法: ./install.sh [profile]   （默认 profile 为 web）
set -euo pipefail

PROFILE="${1:-web}"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROFILE_DIR="$HOME/.dsh/profiles/$PROFILE"

if [ ! -d "$PROFILE_DIR" ]; then
  echo "错误: 找不到 DSH profile 目录: $PROFILE_DIR" >&2
  exit 1
fi

DEST="$PROFILE_DIR/node_modules/dsh-sound-alert"
mkdir -p "$(dirname "$DEST")"

echo "复制插件到: $DEST"
rm -rf "$DEST"
mkdir -p "$DEST"
# 复制包内容（排除脚本自身与临时文件）
find "$SRC" -mindepth 1 -maxdepth 1 \
  ! -name 'install.ps1' ! -name 'install.sh' ! -name '.git' ! -name 'node_modules' ! -name 'dist' \
  -exec cp -R {} "$DEST/" \;

PATCH_FILE="$PROFILE_DIR/cordis.patch.yml"
if [ ! -f "$PATCH_FILE" ]; then
  echo "错误: 找不到 $PATCH_FILE —— 该 profile 可能不是 Web profile" >&2
  exit 1
fi

if grep -q 'dsh-sound-alert' "$PATCH_FILE"; then
  echo "cordis.patch.yml 已包含 sound-alert，跳过追加。"
else
  # 默认 profile 的 patch 文件是一行 `[]`（流式空序列，本身就是一个完整的
  # YAML 文档）。直接在其后追加 insert 块会变成同一流里的第二个文档而解析失败，
  # 因此先把独立的 `[]` 行删掉再追加。
  grep -v '^[[:space:]]*\[\][[:space:]]*$' "$PATCH_FILE" > "$PATCH_FILE.tmp" && mv "$PATCH_FILE.tmp" "$PATCH_FILE"
  # 确保文件以换行结尾，避免追加内容粘在最后一行
  if [ -s "$PATCH_FILE" ] && [ "$(tail -c 1 "$PATCH_FILE" | od -An -c | tr -d ' \n')" != "\\n" ]; then
    echo >> "$PATCH_FILE"
  fi
  cat >> "$PATCH_FILE" <<'EOF'

- insert:
    - id: sound-alert
      name: 'dsh-sound-alert'
EOF
  echo "已在 cordis.patch.yml 追加 sound-alert 挂载配置。"
fi

echo
echo "✅ 安装完成。请【完全退出并重启 DSH】（插件集变更需要重启才生效），"
echo "   重新打开 Web 界面后，输入框上方会出现「🔔 提示音已开启」。"
