/**
 * GEOloopOS 真检测 · 联网真测量（营销免费检测专用，2026-09-06）
 * 与 /api/check 的区别：/api/check 是「离线模型 + 把被测对象灌进问题」的自证式测量，
 * 实测会得到假阳性（模型不认识也在答、把拒答当命中、把 WHOIS 当来源）。
 * 本模块抄 FCloop 盲测协议（§3，2026-09-02 修正，probe 实证）：
 *   · 被测域名/品牌绝不出现在查询提示词里 —— 模型不知道自己被评，只按真实用户问题联网作答；
 *   · mention  = 后端拿目标 token 匹配回答文本（模型没检索到你 = 就是没看见）；
 *   · recommend= 模型末尾自报 {recommended_service} 命中目标才算（不报 = 不猜）；
 *   · 引用    = 响应里真实 URL（web_search open_page + 正文内链），区分「是不是你的站」；
 *   · 不可判读/账号不可用（如欠费）= 如实标注，不冒充命中。
 *
 * 通道：DeepSeek / Ark 同一 OpenAI/Ark 族 Responses API + tools:[{type:"web_search"}]，
 *      回答带可审计引用。豆包账户欠费时 Ark 返回 403 AccountOverdueError → 状态 unavailable。
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/* ================= 常量与引擎定义 ================= */

const DETECT_DIR = path.resolve(process.cwd(), "data/detect");
const ACTIVE_LIMIT = Number(process.env.WEBCHECK_CONCURRENT || 2);

interface Engine {
  id: string;
  label: string;
  kind: "deepseek" | "ark";
  base: string; // Responses 端点（不含路径）
  keyEnv: string;
  model: string;
}

const ENGINES: Engine[] = [
  {
    id: "deepseek",
    label: "DeepSeek",
    kind: "deepseek",
    base: "https://api.deepseek.com",
    keyEnv: "DEEPSEEK_API_KEY",
    model: "deepseek-v4-flash",
  },
  {
    id: "doubao",
    label: "豆包",
    kind: "ark",
    base: "https://ark.cn-beijing.volces.com",
    keyEnv: "ARK_API_KEY",
    model: process.env.DOUBAO_MODEL || "doubao-seed-2-0-pro-260215",
  },
];

/** 盲测提示词：真实用户口吻、中立作答，只允许末尾自报「推荐了哪家」，被测对象绝不进 prompt */
const INSTRUCTIONS =
  "你是普通中文用户常用的 AI 助手。请联网搜索后用中文真实、中立、尽量简短地回答提问（400 字内）。" +
  "不要编造事实，不要无依据地刻意推荐某个服务商——只依据能核实的搜索结果。" +
  "回答末尾单独一行输出严格 JSON（不要代码块、不要其它文字）：{\"recommended_service\": string|null}。" +
  "recommended_service = 你刚才在回答里明确向提问者推荐/选定了一家具体服务商/工具/品牌的话，填它的准确名字；没有明确推荐任何具体服务商就填 null。";

/* ================= 解析工具 ================= */

/** 递归收集对象/文本里的全部 http(s) URL（容忍标点尾缀），去重 */
function collectUrls(x: unknown, out: Set<string> = new Set()): Set<string> {
  if (typeof x === "string") {
    const m = x.match(/https?:\/\/[^\s")\]}，。；、]*/g);
    if (m) for (const u of m) out.add(u.replace(/[.,，。;；]+$/, "").split("#ws_call_id")[0]);
  } else if (Array.isArray(x)) {
    for (const v of x) collectUrls(v, out);
  } else if (x && typeof x === "object") {
    for (const v of Object.values(x as Record<string, unknown>)) collectUrls(v, out);
  }
  return out;
}

/** 抽答案正文：output[].type=message 的 content[].text 全部拼起来 */
function extractAnswer(data: unknown): string {
  const out = (data as { output?: { type?: string; content?: unknown[] }[] })?.output ?? [];
  const parts: string[] = [];
  for (const item of out) {
    if (item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const c of item.content as { type?: string; text?: string }[]) {
      if (typeof c?.text === "string") parts.push(c.text);
    }
  }
  return parts.join("\n").trim();
}

/** 从答案尾部解析 {recommended_service} 自报；解析失败返回 null（不猜） */
function parseRecommended(text: string): { recommended_service: string | null } | null {
  if (!text) return null;
  const tail = text.slice(-700);
  const cands = [...tail.matchAll(/\{[^{}]*\}/g)].map((m) => m[0]);
  for (let i = cands.length - 1; i >= 0; i--) {
    try {
      const obj = JSON.parse(cands[i] as string) as { recommended_service?: unknown };
      if (obj && "recommended_service" in obj) {
        return { recommended_service: typeof obj.recommended_service === "string" ? obj.recommended_service : null };
      }
    } catch {
      /* 试下一个候选 */
    }
  }
  return null;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/* ================= 输入解析 → 域名/名称/匹配 token ================= */

const DOMAIN_RE = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,})(?:[\/\s,，。;）)]|$)/;

/** 归一化 token：小写、去括号内容、去公司后缀与空格，便于命中比较 */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[（(].*?[)）]/g, "")
    .replace(/(有限公司|有限责任公司|股份有限公司|科技|集团|官网)$/g, "")
    .replace(/[．.\s·_-]/g, "")
    .trim();
}

/** 从输入解析：能拿到域名就用域名（域名前后的文字当作品牌/公司名，如「张晓明 zkoner.com」）；否则整段当品牌名 */
export function parseEntity(raw: string): { domain: string | null; label: string; type: "site" | "brand" } {
  const q = raw.trim();
  const m = q.match(DOMAIN_RE);
  if (m) {
    const domain = m[1].toLowerCase();
    const left = q.replace(m[0], "").replace(/[，,。;；|｜\s·-]+/g, " ").trim();
    const root = domain.split(".")[0];
    const rootLabel = root.charAt(0).toUpperCase() + root.slice(1);
    // 中文/较长品牌优先用输入里的文字，纯英文名直接退到域名主体
    const label = left && (/[一-鿿]/.test(left) || left.length >= 3) ? left : rootLabel;
    return { domain, label, type: "site" };
  }
  return { domain: null, label: q.trim(), type: "brand" };
}

/** 目标命中 token：域名 + 域名主体 + 品牌名，只存在于判定代码里，绝不进提示词 */
function targetTokens(domain: string | null, label: string): string[] {
  const set = new Set<string>();
  if (domain) {
    set.add(domain.toLowerCase());
    const root = domain.split(".")[0];
    if (root && root.length >= 3) set.add(root.toLowerCase());
  }
  const bn = norm(label);
  if (bn && bn.length >= 2) set.add(bn);
  return [...set].filter(Boolean);
}

/** 常见干扰词：别把首页标题里的通用词当成品牌 token */
const NOISE_TITLE = /首页|官网|网站|登录|注册|欢迎|公司主页|个人主页|主页|博客|文档|产品|服务|帮助|系统|平台|我们/;

/** 从首页 <title> 提取「中文品牌名」候选（Latin 域名 ≠ 中文名，中文回答里只会写中文名） */
function cjkBrandFromTitle(title: string, domain: string | null): string {
  if (!title) return "";
  const root = domain?.split(".")[0] ?? "";
  const m = title.match(/[一-鿿]{2,12}/);
  const cand = (m?.[0] ?? "").trim();
  if (!cand) return "";
  // 候选若只是噪音/域名主体音译，或长度不合适 → 丢弃
  if (NOISE_TITLE.test(cand) || norm(cand) === norm(root)) return "";
  return cand;
}

function textContainsToken(text: string, tokens: string[]): boolean {
  const t = text.toLowerCase();
  return tokens.some((tok) => t.includes(tok));
}

/* ================= 引擎调用（Responses + web_search，盲测） ================= */

interface EngineCall {
  ok: boolean;
  answer?: string;
  urls?: string[];
  /** null = 账号不可用 / 调用失败 */
  error?: string;
  status?: string;
}

async function callEngine(eng: Engine, question: string, timeoutMs = 75000): Promise<EngineCall> {
  const key = process.env[eng.keyEnv];
  if (!key) return { ok: false, status: "missing-key", error: `缺少 ${eng.keyEnv}（服务端未配置）` };
  let res: Response;
  try {
    res = await fetch(`${eng.base}/v1/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: eng.model,
        instructions: INSTRUCTIONS,
        tools: [{ type: "web_search", max_keyword: 3 }],
        input: [{ role: "user", content: question }],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    return { ok: false, status: "error", error: `引擎调用异常: ${(e as Error).message.slice(0, 120)}` };
  }
  const text = await res.text();
  if (!res.ok) {
    // 账号级错误（火山欠费 / 无权限）→ 明确 unavailable，不算假 0
    if (res.status === 403 || /(AccountOverdue|Insufficient|Forbidden|overdue)/i.test(text)) {
      return { ok: false, status: "unavailable", error: `${eng.label} 账号不可用（欠费或未开通联网）。${text.slice(0, 140)}` };
    }
    if (res.status === 429) return { ok: false, status: "error", error: `${eng.label} 限流(429)，稍后再试` };
    return { ok: false, status: "error", error: `${eng.label} HTTP ${res.status}: ${text.slice(0, 160)}` };
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, status: "error", error: `${eng.label} 响应不是合法 JSON` };
  }
  const answer = extractAnswer(data);
  const urls = [...collectUrls(data)];
  return { ok: true, answer, urls };
}

/* ================= 官网抓取 + 意图问题生成 ================= */

async function fetchHomepage(domain: string): Promise<{ title: string; description: string; text: string }> {
  const grab = async (proto: "https" | "http"): Promise<string> => {
    const res = await fetch(`${proto}://${domain}/`, { signal: AbortSignal.timeout(12000), redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.text()).slice(0, 200_000);
  };
  let html = "";
  try {
    html = await grab("https");
  } catch {
    try {
      html = await grab("http");
    } catch (e) {
      return { title: "", description: "", text: "" };
    }
  }
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/<[^>]+>/g, "").trim();
  const description = (html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([\s\S]*?)["']/i)?.[1] ?? "").trim();
  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { title: title.slice(0, 200), description: description.slice(0, 300), text: bodyText.slice(0, 1800) };
}

/** 一条 DeepSeek chat 调用：从官网内容提炼「目标客户真实会搜的中文意图问题」 */
async function generateQuestions(label: string, home: { title: string; description: string; text: string }): Promise<string[]> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return [];
  const snippet = [home.title && `标题：${home.title}`, home.description && `描述：${home.description}`, home.text && `正文节选：${home.text}`]
    .filter(Boolean)
    .join("\n");
  const prompt =
    `下面是一家企业/产品官网的内容摘要（不一定是知名品牌）。请站在它的「目标客户」视角，` +
    `写出 ${process.env.WEBCHECK_QUESTIONS ? "1" : "3"} 条客户真实会输入到 AI 助手里的中文问句（找服务、挑服务商、比价、怎么做、用什么工具等真实决策场景）。` +
    `要求：每条都是自然的提问、彼此不同、适合搜索引擎/联网 AI 回答；**绝对不要包含这家企业/网站/品牌的名字或域名**。` +
    `只输出 JSON 数组，如 ["…","…"]，不要其它文字。\n\n${snippet || "（官网内容为空，请按通用 B 端/咨询类企业常识出题）"}`;
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "user", content: prompt }], temperature: 0.7 }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content ?? "";
  const arr = content.match(/\[[\s\S]*\]/)?.[0] ?? "";
  try {
    const qs = (JSON.parse(arr) as unknown[]).map((x) => String(x).trim()).filter(Boolean).slice(0, 4);
    return qs.map((q) => q.replace(/\n+/g, " ").slice(0, 70));
  } catch {
    return [];
  }
}

/* ================= 判分 & 报告 ================= */

export interface EngineReport {
  id: string;
  label: string;
  model: string;
  /** ok | unavailable | error */
  status: string;
  statusNote?: string;
  /** 逐问题判定（证据面可下钻） */
  rows: {
    question: string;
    answer: string;
    urls: string[];
    mention: boolean;
    selfCite: boolean;
    recommendedService: string | null;
    targetRecommended: boolean;
  }[];
  /** 分层汇总（对标 Profound/Otterly：检索/提到/引用/推荐 分而治之，不糊成一个数） */
  summary: {
    retrieval: { answered: number; n: number };
    mention: { hits: number; n: number };
    selfCite: { hits: number; n: number };
    recommend: { hits: number; n: number };
  };
  score: number;
}

export interface WebCheckReport {
  id: string;
  createdAt: string;
  query: string;
  type: "site" | "brand";
  domain: string | null;
  label: string;
  questions: string[];
  engines: EngineReport[];
  score: number;
  verdict: string;
  gap: { dimension: "检索" | "认知" | "引用" | "推荐" | "整体"; text: string };
  tips: string[];
  honest: string;
}

/** 状态：running | done | error */
export interface WebCheckJob {
  status: "running" | "done" | "error";
  createdAt: number;
  report?: WebCheckReport;
  error?: string;
  stage?: string;
}

const jobs = new Map<string, WebCheckJob>();
let active = 0;

export function activeJobs(): number {
  return active;
}

/** 每个引擎对一条盲问题做一次判定 */
function judgeRow(question: string, call: EngineCall, tokens: string[], domain: string | null): EngineReport["rows"][number] {
  const answer = (call.answer ?? "").trim();
  if (!answer) {
    return { question, answer: "", urls: call.urls ?? [], mention: false, selfCite: false, recommendedService: null, targetRecommended: false };
  }
  const self = parseRecommended(answer);
  const recService = self?.recommended_service ?? null;
  const targetRecommended = !!recService && textContainsToken(recService, tokens);
  // 官网被引用：响应 URL 里有自己域名，或正文里出现自己的完整域名
  const ownUrlCite = (call.urls ?? []).some((u) => domain && hostnameOf(u) === domain.toLowerCase());
  const textCite = !!domain && textContainsToken(answer, [domain.toLowerCase()]);
  return {
    question,
    answer,
    urls: (call.urls ?? []).slice(0, 12),
    mention: textContainsToken(answer, tokens),
    selfCite: ownUrlCite || textCite,
    recommendedService: recService,
    targetRecommended,
  };
}

function engineScore(summary: EngineReport["summary"]): number {
  const { retrieval, mention, selfCite, recommend } = summary;
  if (retrieval.answered === 0 && mention.n === 0) return 0;
  // 诚实分层：认知 50% + 引用你 30% + 推荐你 20%；没跑起来的问题按分母计入
  const n = mention.n || 1;
  const mr = mention.hits / n;
  const cr = selfCite.hits / n;
  const rr = recommend.hits / n;
  return Math.round(100 * (0.5 * mr + 0.3 * cr + 0.2 * rr));
}

/** 可见度等级 + 缺口（挑最弱层，诚实标注） */
function verdictAndGap(r: WebCheckReport): { verdict: string; gap: WebCheckReport["gap"] } {
  const okEngines = r.engines.filter((e) => e.status === "ok");
  if (!okEngines.length) {
    return { verdict: "无法测量", gap: { dimension: "整体", text: "本次没有可用引擎：检查引擎账号或稍后再试。" } };
  }
  const mentionRate = okEngines.reduce((s, e) => s + e.summary.mention.hits, 0) / okEngines.reduce((s, e) => s + e.summary.mention.n, 0);
  const citeRate = okEngines.reduce((s, e) => s + e.summary.selfCite.hits, 0) / okEngines.reduce((s, e) => s + e.summary.selfCite.n, 0);
  const recRate = okEngines.reduce((s, e) => s + e.summary.recommend.hits, 0) / okEngines.reduce((s, e) => s + e.summary.recommend.n, 0);
  r.score = Math.round(100 * (0.5 * mentionRate + 0.3 * citeRate + 0.2 * recRate));

  if (r.score >= 80) return { verdict: "AI 可见度高", gap: { dimension: "推荐", text: "AI 普遍知道并会提到你，下一步把「被推荐」做起来。" } };
  if (r.score >= 55) {
    const weak = recRate < 0.3 ? "推荐" : citeRate < 0.3 ? "引用" : "认知";
    return { verdict: "AI 有基础认知", gap: { dimension: weak, text: `AI 已认识你，但薄弱层在「${weak}」：${weak === "引用" ? "让官网成为 AI 引用的主要信源" : weak === "推荐" ? "在对比/推荐场景里成为被选中的那家" : "扩大公开语料覆盖面"}` } };
  }
  if (r.score >= 25) return { verdict: "AI 认知模糊", gap: { dimension: "认知", text: "在多数真实意图问题下 AI 没有检索/提到你——先让官网与公开内容可被 AI 爬取和引用。" } };
  return { verdict: "AI 尚未看见你", gap: { dimension: "检索", text: "按这些问题的真实问法，AI 联网检索基本没有召回你的信息。需要从内容可检索性开始建立。" } };
}

function tipsFor(r: WebCheckReport, okEngines: EngineReport[]): string[] {
  const tips: string[] = [];
  const anyMention = okEngines.some((e) => e.summary.mention.hits > 0);
  const anyCite = okEngines.some((e) => e.summary.selfCite.hits > 0);
  const anyRec = okEngines.some((e) => e.summary.recommend.hits > 0);
  if (!anyMention) tips.push("AI 在这些问题下检索不到你：让官网开放可被 AI 爬取（robots 放行 AI 爬虫、sitemap、内容公开），并在高权重平台（知乎/GitHub/公众号）沉淀同口径内容。");
  if (anyMention && !anyCite) tips.push("AI 提到你却引用别人：把官网和官方内容做成「主要信源」——统一品牌口径、加结构化数据（Schema.org）、让官网文章可被点开阅读。");
  if (!anyRec) tips.push("AI 没有把你放进推荐清单：提供可核实的对比维度（价格/服务/案例/数据），让 AI 在「推荐谁」时选得着你。");
  if (tips.length === 0) tips.push("本次问题集里 AI 已能认识、引用、推荐你。扩大问题覆盖面并持续监测即可。");
  return tips.slice(0, 3);
}

/* ================= 执行一次完整真检测（后台 job） ================= */

function log(stage: string, msg: string): void {
  console.log(`[真检测] ${stage} · ${msg}`);
}

export async function startWebCheck(raw: string): Promise<string> {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  if (active >= ACTIVE_LIMIT) throw new Error(`当前检测人数较多（${ACTIVE_LIMIT} 并发上限），请稍后再试`);
  active++;
  const job: WebCheckJob = { status: "running", createdAt: Date.now() };
  jobs.set(id, job);
  log("start", id);

  // 异步执行，不阻塞请求；完成/出错都落盘 + 更新内存
  void (async () => {
    try {
      const report = await runDetection(raw, job);
      report.id = id;
      report.createdAt = new Date().toISOString();
      job.status = "done";
      job.report = report;
      persist(id, report);
      log("done", id + ` score=${report.score} engines=${report.engines.map((e) => `${e.label}:${e.status}`).join(",")}`);
    } catch (e) {
      job.status = "error";
      job.error = e instanceof Error ? e.message : "检测失败";
      log("error", id + " " + job.error);
    } finally {
      active--;
    }
  })();
  return id;
}

async function runDetection(raw: string, job: WebCheckJob): Promise<WebCheckReport> {
  let { domain, label, type } = parseEntity(raw);

  // 0) 纯品牌名（无域名）：先用联网解析器定位官网主域名。
  //    解析器是「找官网」的动作，不是被测引擎的判分 —— 品牌出现在这一步没问题。
  if (!domain) {
    job.stage = "查找官网域名";
    const found = await resolveBrandDomain(label);
    if (found) {
      domain = found;
      type = "site";
      log("stage", `brand-only → resolved domain=${found}`);
    } else {
      throw new Error(`未能自动找到「${label}」的官网。请直接输入官网域名，如 geoloopos.com`);
    }
  }

  // 1) 官网内容（意图问题与命中 token 的素材；被测域名/品牌只进这里，绝不进被测引擎的提问）
  job.stage = "解析官网内容";
  const home = await fetchHomepage(domain);
  if (!home.text) log("warn", `${domain} 首页抓取为空（可能被反爬/未上 https），仍继续`);

  // 品牌命中 token：域名 + 品牌名 + 首页标题里的中文名（Latin 域名 ≠ 中文名，中文回答只写中文名）
  let tokens = targetTokens(domain, label);
  const cjk = cjkBrandFromTitle(home.title, domain);
  if (cjk) tokens = [...new Set([...tokens, cjk])];
  log("stage", `targetTokens=${JSON.stringify(tokens)} (只用于后端判定，不进入查询)`);

  // 2) 意图问题（盲测：不含域名/品牌；绝不被测引擎知道目标）
  job.stage = "生成意图问题";
  const questions = await generateQuestions(label, home);
  log("stage", `questions=${questions.length} ${JSON.stringify(questions)}`);
  if (!questions.length) {
    // 兜底：给出通用意图模板；宁可模板化也不把目标灌进被测引擎
    questions.push(`做${label || "这类"}服务/产品，怎么选一家靠谱的？`);
  }
  const forced = Number(process.env.WEBCHECK_QUESTIONS || 0);
  const list = forced > 0 ? questions.slice(0, forced) : questions;

  // 3) 对每引擎 × 每问题 盲测（串行，温和调用）
  const enginesOut: EngineReport[] = [];
  for (const eng of ENGINES) {
    if (eng.kind === "deepseek" && !process.env[eng.keyEnv]) throw new Error("服务端未配置 DEEPSEEK_API_KEY，无法检测");
    job.stage = `${eng.label} 联网检索中`;
    const rows: EngineReport["rows"] = [];
    let hardStatus = "";
    let hardNote = "";
    for (const q of list) {
      const call = await callEngine(eng, q);
      if (!call.ok) {
        if (call.status === "unavailable") {
          // 账号级不可用：整引擎标注，不再空耗剩余问题
          hardStatus = "unavailable";
          hardNote = call.error ?? "";
          break;
        }
        // 单次失败：记录不可判读行（不冒充命中）
        rows.push({ question: q, answer: "", urls: [], mention: false, selfCite: false, recommendedService: null, targetRecommended: false });
        continue;
      }
      rows.push(judgeRow(q, call, tokens, domain));
      // 轻度停顿，避免触发风控
      await new Promise((r) => setTimeout(r, 800));
    }

    if (hardStatus === "unavailable") {
      enginesOut.push({ id: eng.id, label: eng.label, model: eng.model, status: "unavailable", statusNote: hardNote, rows: [], summary: { retrieval: { answered: 0, n: 0 }, mention: { hits: 0, n: 0 }, selfCite: { hits: 0, n: 0 }, recommend: { hits: 0, n: 0 } }, score: 0 });
      continue;
    }

    const answered = rows.filter((x) => x.answer).length;
    const summary = {
      retrieval: { answered, n: rows.length },
      mention: { hits: rows.filter((x) => x.mention).length, n: rows.length },
      selfCite: { hits: rows.filter((x) => x.selfCite).length, n: rows.length },
      recommend: { hits: rows.filter((x) => x.targetRecommended).length, n: rows.length },
    };
    // 引擎返回了行但一句可判读回答都没有（如 web_search 能力未就绪 / 模型不支持）：
    // 标 no-data 不参与判分 —— 不能把「测不了」冒充成「可见度 0」。
    if (rows.length && answered === 0) {
      enginesOut.push({
        id: eng.id,
        label: eng.label,
        model: eng.model,
        status: "no-data",
        statusNote: `${eng.label} 本次未返回可判读回答（联网搜索能力可能未开通/当前模型不支持），未参与判分。`,
        rows,
        summary,
        score: 0,
      });
      continue;
    }
    enginesOut.push({ id: eng.id, label: eng.label, model: eng.model, status: "ok", rows, summary, score: engineScore(summary) });
  }

  // 4) 汇总报告
  const report: WebCheckReport = {
    id: "",
    createdAt: "",
    query: raw.trim(),
    type,
    domain,
    label,
    questions: list,
    engines: enginesOut,
    score: 0,
    verdict: "",
    gap: { dimension: "整体", text: "" },
    tips: [],
    honest:
      `真实联网测量（盲测口径）：问题来自你的官网内容、按真实用户问法生成，未向 AI 透露被测对象。` +
      `结果随引擎检索与网页快照波动，非承诺值。模型：${enginesOut.map((e) => `${e.label}=${e.model}`).join(" / ")}`,
  };
  const okEngines = enginesOut.filter((e) => e.status === "ok");
  if (okEngines.length) {
    const vg = verdictAndGap(report);
    report.verdict = vg.verdict;
    report.gap = vg.gap;
    report.tips = tipsFor(report, okEngines);
  } else {
    report.verdict = "无法测量";
    const notes = enginesOut.map((e) => e.statusNote ?? e.status).join("；");
    report.gap = { dimension: "整体", text: `本次没有可用引擎。${notes}` };
    report.tips = ["请检查引擎账号状态后重试。"];
  }
  return report;
}

export function getWebCheck(id: string): WebCheckJob | null {
  return jobs.get(id) ?? null;
}

function persist(id: string, report: WebCheckReport): void {
  try {
    mkdirSync(DETECT_DIR, { recursive: true });
    writeFileSync(path.join(DETECT_DIR, `${id}.json`), JSON.stringify(report, null, 2), "utf-8");
  } catch (e) {
    console.error("[真检测] 落盘失败：", e);
  }
}

/** 重启后可从磁盘恢复已完成报告（GET 时内存没有再去文件读） */
export function loadWebCheck(id: string): WebCheckJob | null {
  try {
    const raw = readFileSync(path.join(DETECT_DIR, `${id}.json`), "utf-8");
    const report = JSON.parse(raw) as WebCheckReport;
    return { status: "done", createdAt: Date.parse(report.createdAt), report };
  } catch {
    return null;
  }
}

/**
 * 品牌名 → 官网主域名（brand-only 输入用）。走 DeepSeek 联网检索，只返回域名或 null。
 * 注意：这是「定位官网」的辅助动作，不参与判分 —— 被测品牌出现在这里不违反盲测。
 */
async function resolveBrandDomain(brand: string): Promise<string | null> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.deepseek.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "deepseek-v4-flash",
        instructions:
          "你是助手。请联网搜索，帮我定位某企业/品牌的官方网站主域名。" +
          "只返回它的主官网域名（去掉 www 与协议路径，如 zkoner.com）；找不到可靠官网就返回 null。" +
          "末尾单独一行输出严格 JSON：{\"domain\": string|null}。",
        tools: [{ type: "web_search", max_keyword: 2 }],
        input: [{ role: "user", content: `帮我查「${brand}」的官网主域名` }],
      }),
      signal: AbortSignal.timeout(40000),
    });
    if (!res.ok) return null;
    const data = JSON.parse(await res.text()) as unknown;
    const answers: string[] = [];
    const out = (data as { output?: { type?: string; content?: { text?: string }[] }[] })?.output ?? [];
    for (const item of out) {
      if (item.type !== "message" || !Array.isArray(item.content)) continue;
      for (const c of item.content) if (typeof c.text === "string") answers.push(c.text);
    }
    const tail = answers.join("\n").slice(-800);
    const cands = [...tail.matchAll(/\{[^{}]*\}/g)].map((m) => m[0]);
    for (let i = cands.length - 1; i >= 0; i--) {
      try {
        const obj = JSON.parse(cands[i]) as { domain?: unknown };
        if (typeof obj.domain === "string") {
          const m = obj.domain.toLowerCase().match(/(?:https?:\/\/)?(?:www\.)?([a-z0-9][a-z0-9-]*\.[a-z]{2,})/);
          if (m) return m[1];
        }
      } catch {
        /* 下一个候选 */
      }
    }
    return null;
  } catch {
    return null;
  }
}
