#!/usr/bin/env node
/**
 * 打包 Cloudflare Pages 部署目录（geoloopos.com · 公开层 · 2026-09-06「半移分叉 A」）
 *
 * 拓扑：公开静态（首页 React 焕新版 + whitepaper/observe/SEO 文件）常开上 Pages；
 *      动态层(/api /app …)由 functions/_middleware.js 反代到本机 origin 容器。
 *
 * 产物：.pages/（gitignored，非仓库源）——
 *    .pages/index.html            ← www/dist（React 首页焕新版）
 *    .pages/assets/               ← www/dist（JS/CSS/字体）
 *    .pages/logo.png              ← www/dist（新 logo，覆盖 site/ 旧图）
 *    .pages/observe/ …/whitepaper/ …/robots.txt …   ← site/ 公开静态
 *    .pages/functions/_middleware.js  ← functions/（反代 + 观测上报）
 *
 * 用法：在 ~/geoloopos 下
 *   （www 需先构建）cd www && npm run build && cd ..
 *   node scripts/build-pages.mjs
 *   npx wrangler pages deploy .pages --project-name geoloopos-com [--branch <预览分支>]
 */
import { cpSync, rmSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = path.join(ROOT, ".pages");
const SITE = path.join(ROOT, "site");
const WWW_DIST = path.join(ROOT, "www", "dist");
const FUNC = path.join(ROOT, "functions");

if (!existsSync(path.join(WWW_DIST, "index.html"))) {
  console.error("✗ www/dist 不存在 —— 请先 cd www && npm run build");
  process.exit(1);
}

rmSync(PAGES, { recursive: true, force: true });
mkdirSync(PAGES, { recursive: true });

// 1) site/ 公开静态（observe/robots/sitemap/llms/style/5b53-key；whitepaper.html 单独转目录别名）
const SKIP_ROOT = new Set(["whitepaper.html", "logo.png"]); // logo 用新版；whitepaper 走 /whitepaper/ 目录
for (const ent of ["5b53e066ee93a3da020b2e5666b46d42.txt", "llms.txt", "robots.txt", "sitemap.xml", "style.css", "observe"]) {
  cpSync(path.join(SITE, ent), path.join(PAGES, ent), { recursive: true });
}
// /whitepaper → whitepaper/index.html（Pages 目录 index，sitemap 清洁 URL /whitepaper 保持常开）
mkdirSync(path.join(PAGES, "whitepaper"));
cpSync(path.join(SITE, "whitepaper.html"), path.join(PAGES, "whitepaper", "index.html"));

// 2) www React 首页（index.html + assets + 新版 logo）
cpSync(path.join(WWW_DIST, "index.html"), path.join(PAGES, "index.html"));
cpSync(path.join(WWW_DIST, "logo.png"), path.join(PAGES, "logo.png"));
cpSync(path.join(WWW_DIST, "assets"), path.join(PAGES, "assets"), { recursive: true });

// 3) Pages Functions（反代 + 观测上报）
cpSync(FUNC, path.join(PAGES, "functions"), { recursive: true });

console.log("✓ .pages/ 打包完成：");
for (const ent of ["index.html", "logo.png", "robots.txt", "sitemap.xml", "llms.txt", "style.css", "whitepaper/index.html", "observe/index.html", "assets/", "functions/_middleware.js"]) {
  console.log("   · " + ent + (existsSync(path.join(PAGES, ent)) ? "" : "  ✗缺失"));
}
