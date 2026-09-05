#!/usr/bin/env node
/**
 * 观测中间件生成器 —— 双信号架构 · 输入侧采集端
 *
 * 读 data/bots.json（爬虫身份表唯一事实源）→ 生成自包含的
 * Pages Functions 根中间件到目标站点仓库（默认 ../zkoner.com）。
 *
 * 生成的中间件行为：
 *   - 对每个请求做 UA 匹配（大小写不敏感子串），命中已注册 AI 爬虫 →
 *     waitUntil 异步上报 {site, bot_id, url, ts} 到 OBSERVE_ENDPOINT；
 *   - 人类流量零记录、零感知；上报失败静默，永不影响主站响应。
 *
 * 特殊分支：目标站点为 geoloopos.com 时（2026-09-06「半移分叉 A」），
 *   站点函数还承担「动态层反代到 origin 容器」——此时只刷新既有
 *   functions/_middleware.js 的爬虫表，不整体覆盖（反代逻辑为手写维护）。
 *
 * 环境变量（在目标站 Pages 项目上配置）：
 *   OBSERVE_ENDPOINT  如 https://geoloopos.com/api/observe
 *   OBSERVE_TOKEN     与接收器共享的 Bearer token
 *
 * 用法：node scripts/gen-observer.mjs [目标站点仓库根目录]
 * 幂等：重复运行覆盖产出。识别表更新后重跑本脚本 + 重新部署目标站即可。
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const TARGET = path.resolve(process.argv[2] || path.join(ROOT, "..", "zkoner.com"));
const SITE = process.argv[3] || "zkoner.com";

const bots = JSON.parse(readFileSync(path.join(ROOT, "data/bots.json"), "utf8"));

// 展平成 [id, 小写匹配子串] 二元组表——运行时零依赖、单循环匹配
const flat = [];
for (const b of bots) {
  for (const m of b.match) flat.push([b.id, m.toLowerCase()]);
}

const file = `// ⚠️ 本文件由 geoloopos/scripts/gen-observer.mjs 生成 —— 勿手改
// 数据源：geoloopos/data/bots.json（${bots.length} 个爬虫 · ${flat.length} 条匹配规则）
// 重新生成：在 ~/geoloopos 下运行 node scripts/gen-observer.mjs 后重新部署本站。
// 职责：识别 AI 爬虫来访并异步上报（双信号架构·输入侧）；人类流量零感知。

const SITE = ${JSON.stringify(SITE)};
const BOTS = ${JSON.stringify(flat)};

export async function onRequest({ request, env, next, waitUntil }) {
  try {
    const ua = (request.headers.get("user-agent") || "").toLowerCase();
    if (ua && env && env.OBSERVE_ENDPOINT && env.OBSERVE_TOKEN) {
      let botId = null;
      for (let i = 0; i < BOTS.length; i++) {
        if (ua.indexOf(BOTS[i][1]) !== -1) { botId = BOTS[i][0]; break; }
      }
      if (botId) {
        const u = new URL(request.url);
        const body = JSON.stringify({
          events: [{ site: SITE, bot_id: botId, url: (u.pathname + u.search).slice(0, 512), ts: Date.now() }],
        });
        waitUntil(
          fetch(env.OBSERVE_ENDPOINT, {
            method: "POST",
            headers: { "content-type": "application/json", authorization: "Bearer " + env.OBSERVE_TOKEN },
            body,
          }).catch(() => {})
        );
      }
    }
  } catch (e) {
    // 观测永不影响主站
  }
  return next();
}
`;

const outDir = path.join(TARGET, "functions");
mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "_middleware.js");

if (SITE === "geoloopos.com") {
  // 「半移分叉 A」站点：中间件 = 观测上报 + 动态层反代（手写维护）。
  // 这里只做幂等性刷新——重写头部说明 + 内联新爬虫表，其余逻辑原样保留。
  if (!existsSync(outFile)) {
    console.error(`✗ ${outFile} 不存在（geoloopos 站点请勿用纯观测模板生成，需含反代逻辑）`);
    process.exit(1);
  }
  let cur = readFileSync(outFile, "utf8");
  cur = cur.replace(/^\/\/ 数据源：.*$/m, `// 数据源：geoloopos/data/bots.json（${bots.length} 个爬虫 · ${flat.length} 条匹配规则）`);
  cur = cur.replace(/const BOTS = \[[^\n]*\];/, `const BOTS = ${JSON.stringify(flat)};`);
  writeFileSync(outFile, cur);
  console.log(`✓ 已刷新 ${outFile}（站点 ${SITE} · 仅更新爬虫表，反代逻辑保留）`);
  process.exit(0);
}

writeFileSync(outFile, file);
console.log(`✓ 已生成 ${outFile}（站点 ${SITE} · ${flat.length} 条匹配规则）`);
