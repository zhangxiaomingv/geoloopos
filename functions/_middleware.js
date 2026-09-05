// ⚠️ 本文件由 geoloopos/scripts/gen-observer.mjs 生成 —— 勿手改
// 数据源：geoloopos/data/bots.json（22 个爬虫 · 25 条匹配规则）
// 重新生成：在 ~/geoloopos 下运行 node scripts/gen-observer.mjs 后重新部署。
//
// 职责（geoloopos.com · Cloudflare Pages · 2026-09-06「半移分叉 A」拓扑）：
//   公开静态层走 Pages 常开；动态层(/api /app /packs …)反代到本机 origin 容器。
//   1) 动态前缀 → 反代 env.ORIGIN（本机容器，经隧道；机器关机回 502，公开页不受影响）
//   2) 静态页 AI 爬虫来访 → 异步上报 env.ORIGIN/api/observe（双信号·输入侧，机器在线才入库）
//   其余请求一律 next() 走 Pages 静态。
// 动态 /api 等请求由 origin 容器内联 UA 检测记账，这里不重复上报（避免双计）。

const SITE = "geoloopos.com";
const ORIGIN_FALLBACK = "https://origin.geoloopos.com";
const BOTS = [["gptbot","gptbot"],["oai-searchbot","oai-searchbot"],["chatgpt-user","chatgpt-user"],["claudebot","claudebot"],["claude-user","claude-user"],["claude-searchbot","claude-searchbot"],["perplexitybot","perplexitybot"],["perplexity-user","perplexity-user"],["google-extended","google-extended"],["applebot-extended","applebot-extended"],["amazonbot","amazonbot"],["meta-externalagent","meta-externalagent"],["meta-externalagent","meta-externalagent"],["ccbot","ccbot"],["duckassistbot","duckassistbot"],["youbot","youbot"],["cohere-ai","cohere-ai"],["bytespider","bytespider"],["baiduspider","baiduspider"],["petalbot","petalbot"],["yisouspider","yisouspider"],["sogou-spider","sogou web spider"],["sogou-spider","sogou inst spider"],["haosouspider","haosouspider"],["haosouspider","360spider"]];

// 需要回源到本机 origin 的动态路径前缀（公开静态页 / 观测 / SEO 文件不在此列 → Pages 直出）
const DYNAMIC_RE = /^\/(app|api|packs|deploy|report|audit|effect)(\/|$)/;
const DYNAMIC_EXACT = new Set(["/logo-original.png"]);

export async function onRequest({ request, env, next, waitUntil }) {
  const u = new URL(request.url);
  const origin = String(env?.ORIGIN || ORIGIN_FALLBACK).replace(/\/+$/, "");

  // 1) 动态 → 反代本机 origin（透传方法/头/体，机器关机时 502，绝不影响公开静态层）
  if (DYNAMIC_RE.test(u.pathname) || DYNAMIC_EXACT.has(u.pathname)) {
    return proxy(request, origin);
  }

  // 2) 静态页 AI 爬虫观测上报（异步、永不阻塞主站）
  if (request.method === "GET") {
    try {
      const ua = (request.headers.get("user-agent") || "").toLowerCase();
      if (ua && env?.OBSERVE_TOKEN) {
        let botId = null;
        for (const [id, kw] of BOTS) {
          if (ua.indexOf(kw) !== -1) { botId = id; break; }
        }
        if (botId) {
          const body = JSON.stringify({
            events: [{ site: SITE, bot_id: botId, url: (u.pathname + u.search).slice(0, 512), ts: Date.now() }],
          });
          waitUntil(
            fetch(origin + "/api/observe", {
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
  }

  return next();
}

/** 反代：把请求原样转给 origin（同域透传 cookie；真实访客 IP 经 x-forwarded-for 带回，保住按 IP 限流） */
async function proxy(request, origin) {
  const u = new URL(request.url);
  const target = origin + u.pathname + u.search;
  const headers = new Headers(request.headers);
  const cip = request.headers.get("cf-connecting-ip");
  if (cip) headers.set("x-forwarded-for", cip);
  try {
    const resp = await fetch(target, {
      method: request.method,
      headers,
      redirect: "manual",
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
    });
    // Cloudflare 源站连通性错误（530/52x/1033，HTML 错误页）与抛错 → 统一转成友好 502；
    // 容器自身 5xx（JSON）原样透传，保留真实错误信息。
    const ct = resp.headers.get("content-type") || "";
    if (resp.status >= 500 && ct.includes("text/html")) return unreachable();
    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers: resp.headers,
    });
  } catch (e) {
    return unreachable();
  }
}

function unreachable() {
  return new Response(
    "GEOloopOS 动态服务暂不可用（源站未开机）。公开页面不受影响，请稍后再试。",
    {
      status: 502,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    }
  );
}
