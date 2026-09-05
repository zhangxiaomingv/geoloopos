#!/usr/bin/env bash
# geoloopos.com 公开层 Pages 部署（半移分叉 A · 2026-09-06）
# 拓扑：公开静态（React 首页 + whitepaper/observe/SEO 文件）常开上 Pages；
#      动态层(/api /app …)由 Pages Function 反代到本机 origin 容器。
#
# 何时调用：
#   1) crontab 观察页每小时再生后（17 * * * * sync-observations 之后）
#   2) www/（React 首页）改动后手动跑
# 产物 .pages/ 由 scripts/build-pages.mjs 合成，gitignored。
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -f www/dist/index.html ]; then
  echo "[deploy-pages] www/dist 缺失，先构建 React 首页…"
  (cd www && npm run build >/dev/null 2>&1)
fi
node scripts/build-pages.mjs
npx wrangler pages deploy .pages --project-name geoloopos-com 2>&1 | grep -E "Deployment complete|Success|Error|error" | head -3
