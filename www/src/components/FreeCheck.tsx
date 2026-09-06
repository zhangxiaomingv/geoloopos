/**
 * 免费真检测框（营销首页 · 盲测联网口径）
 * 调用 POST /api/detect {query} → {id}，再轮询 GET /api/detect/{id} 到 done。
 * 引擎 DeepSeek（实时）+ 豆包（欠费/未就绪时如实标 unavailable / no-data，不冒充 0 分）。
 * 报告渲染对齐 Profound/Otterly 免费报告骨架：分层可见度 + 可下钻证据 + 缺口定位。
 */
import { useEffect, useState } from "react";
import { ArrowRight, ChevronDown, ExternalLink, Globe, RotateCw, Search, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { GradientBorder, Reveal, ShimmerLink, SpotlightCard } from "@/components/effects";

/* ---- 与 src/webcheck.ts 报告结构对齐的最小类型（避免跨包 import） ---- */
interface Row {
  question: string;
  answer: string;
  urls: string[];
  mention: boolean;
  selfCite: boolean;
  recommendedService: string | null;
  targetRecommended: boolean;
}
interface EngineRep {
  id: string;
  label: string;
  model: string;
  status: "ok" | "unavailable" | "error" | "no-data";
  statusNote?: string;
  rows: Row[];
  summary: {
    retrieval: { answered: number; n: number };
    mention: { hits: number; n: number };
    selfCite: { hits: number; n: number };
    recommend: { hits: number; n: number };
  };
  score: number;
}
interface Report {
  id: string;
  query: string;
  type: string;
  domain: string | null;
  label: string;
  questions: string[];
  engines: EngineRep[];
  score: number;
  verdict: string;
  gap: { dimension: string; text: string };
  tips: string[];
  honest: string;
}

/* ---- POST /api/audit（结构层 withCheck:false）响应最小镜像 ---- */
interface AuditItemMini {
  id: string;
  label: string;
  max: number;
  score: number;
  status: "pass" | "partial" | "fail";
  detail: string;
}
interface AuditActionMini {
  level: "P0" | "P1" | "P2";
  title: string;
  desc: string;
}
interface SiteAuditMini {
  score: number;
  verdict: string;
  blockedBots: string[];
  htmlChars: number;
  items: AuditItemMini[];
  actions: AuditActionMini[];
}
interface AuditState {
  loading: boolean;
  error?: string;
  data?: SiteAuditMini;
}

type Phase = "idle" | "running" | "done" | "error";

const SCORE_COLOR = (s: number) => (s >= 80 ? "#34d399" : s >= 55 ? "#4c8dff" : s >= 25 ? "#f5a623" : "#f0516b");

const STAGE_CN = [
  "提交中",
  "解析官网内容",
  "生成意图问题",
  "查找官网域名",
  "联网检索中",
];

function statusBadge(e: EngineRep): { text: string; cls: string } {
  switch (e.status) {
    case "ok":
      return { text: "已测量", cls: "border-[rgba(52,211,153,.35)] bg-[rgba(52,211,153,.12)] text-[#34d399]" };
    case "unavailable":
      return { text: "账户待充值", cls: "border-[rgba(245,166,35,.4)] bg-[rgba(245,166,35,.1)] text-[#f5a623]" };
    case "no-data":
      return { text: "能力未就绪", cls: "border-white/10 bg-white/5 text-faint" };
    default:
      return { text: "调用失败", cls: "border-[rgba(240,81,107,.35)] bg-[rgba(240,81,107,.1)] text-[#f0516b]" };
  }
}

export function FreeCheck({ compact = false }: { compact?: boolean } = {}) {
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [stage, setStage] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [jobId, setJobId] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditState>({ loading: false });

  useEffect(() => {
    if (!jobId) return;
    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const r = await fetch(`/api/detect/${jobId}`, { headers: { accept: "application/json" } });
        const j = await r.json();
        if (stopped) return;
        if (j.status === "done") {
          clearInterval(timer);
          setReport(j.report);
          setPhase("done");
          // 可见度报告出来后，顺手拉「官网 AI 可读性体检」（结构层，秒出、不烧 LLM）
          const dom = j.report && typeof j.report.domain === "string" ? j.report.domain : "";
          if (!dom) {
            setAudit({ loading: false });
          } else {
            setAudit({ loading: true });
            fetch("/api/audit", {
              method: "POST",
              headers: { "content-type": "application/json", accept: "application/json" },
              body: JSON.stringify({ url: dom, withCheck: false }),
            })
              .then(async (resp) => {
                const b = await resp.json().catch(() => ({}));
                if (stopped) return;
                const rep = b && b.ok && b.report ? b.report : null;
                if (!rep) {
                  setAudit({ loading: false, error: (b && b.message) || "官网体检暂不可用" });
                  return;
                }
                setAudit({
                  loading: false,
                  data: {
                    score: rep.score,
                    verdict: rep.verdict,
                    blockedBots: rep.audit ? rep.audit.blockedBots ?? [] : [],
                    htmlChars: rep.audit ? rep.audit.htmlChars ?? 0 : 0,
                    items: rep.audit ? rep.audit.items ?? [] : [],
                    actions: rep.actions ?? [],
                  },
                });
              })
              .catch(() => {
                if (!stopped) setAudit({ loading: false, error: "官网体检失败，请重试" });
              });
          }
        } else if (j.status === "error") {
          clearInterval(timer);
          setErr(j.error || "检测失败，请稍后再试");
          setPhase("error");
        } else if (j.stage) {
          setStage(j.stage);
        }
      } catch {
        /* 网络抖动忽略，下一轮再轮询 */
      }
    }, 3000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [jobId]);

  const submit = async () => {
    const q = query.trim();
    if (!q || phase === "running") return;
    setPhase("running");
    setStage("提交中");
    setErr("");
    setReport(null);
    setJobId(null);
    setAudit({ loading: false });
    try {
      const r = await fetch("/api/detect", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setErr(j.message || `服务暂不可用（HTTP ${r.status}），请稍后再试`);
        setPhase("error");
        return;
      }
      setJobId(j.id); // 拿到 jobId 才开始轮询
      setStage("联网检索中");
    } catch {
      setErr("无法连接检测服务，请稍后再试");
      setPhase("error");
    }
  };

  const recheck = () => {
    setPhase("idle");
    setQuery("");
    setReport(null);
    setJobId(null);
    setErr("");
    setAudit({ loading: false });
  };

  return (
    <section className={compact ? "relative mx-auto mt-10 w-full max-w-[680px] text-left" : "mx-auto max-w-6xl px-5 pt-14 md:pt-20"}>
      {!compact && (
        <Reveal>
          <div className="text-center">
            <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-[#4c8dff]">
              Free Real-time Check · 真联网盲测
            </p>
            <h2 className="text-[clamp(22px,3.4vw,30px)] font-bold tracking-[-0.02em]">
              查一下 AI 眼里有没有你
            </h2>
            <p className="mx-auto mt-3 max-w-[520px] text-[13.5px] leading-7 text-muted-foreground">
              输入品牌名或官网域名，我们用真实用户会问的问题让 DeepSeek 联网作答——不告诉它你是谁，
              测出来才算数。豆包在充值后自动接入。
            </p>
          </div>
        </Reveal>
      )}
      <Reveal>
        <GradientBorder className={cn("rounded-[22px]", compact ? "" : "mt-8")} innerClassName="rounded-[inherit] bg-[#0b0b10]">
          <div className="p-5 sm:p-7">
            {/* 输入行 */}
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <div className="relative flex-1">
                <Search
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-3.5 size-[16px] -translate-y-1/2 text-faint"
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  disabled={phase === "running"}
                  placeholder="品牌名或官网域名，如「阿里云」或 aliyun.com"
                  className="h-11 w-full rounded-[11px] border border-white/10 bg-white/[0.04] pr-3 pl-10 text-[13.5px] text-foreground placeholder:text-faint focus:border-[#4c8dff]/60 focus:outline-none disabled:opacity-60"
                />
              </div>
              <button
                onClick={submit}
                disabled={phase === "running" || !query.trim()}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-[11px] bg-[#4c8dff] px-6 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#3f7ae8] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {phase === "running" ? (
                  <>
                    <RotateCw size={14} className="animate-spin" /> 检测中
                  </>
                ) : (
                  <>
                    免费检测 <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>

            {/* 运行中：阶段提示 */}
            {phase === "running" && (
              <div className="mt-5 flex items-center gap-3 rounded-xl border border-[rgba(76,141,255,.22)] bg-[rgba(76,141,255,.07)] px-4 py-3 text-[13px] text-[#8ab6ff]">
                <ShieldCheck size={16} className="shrink-0" />
                <span className="leading-6">
                  正在 {stage || "检测"}…每次联网检索约需 20–60 秒
                  <span className="ml-2 font-mono text-[11px] text-[#4c8dff]">
                    {STAGE_CN.includes(stage) ? stage : "真实联网盲测"}
                  </span>
                </span>
              </div>
            )}

            {/* 错误 */}
            {phase === "error" && (
              <div className="mt-5 rounded-xl border border-[rgba(240,81,107,.3)] bg-[rgba(240,81,107,.08)] px-4 py-3 text-[13px] text-[#f0516b]">
                {err} <span className="opacity-60">（本机源站需开机运行）</span>
              </div>
            )}

            {/* 报告 */}
            {phase === "done" && report && (
              <ReportCard report={report} open={open} setOpen={setOpen} onReset={recheck} audit={audit} />
            )}
          </div>
        </GradientBorder>
      </Reveal>
    </section>
  );
}

/* ---------------- 报告 ---------------- */
function ReportCard({
  report,
  open,
  setOpen,
  onReset,
  audit,
}: {
  report: Report;
  open: Record<number, boolean>;
  setOpen: (f: (p: Record<number, boolean>) => Record<number, boolean>) => void;
  onReset: () => void;
  audit: AuditState;
}) {
  const okEngines = report.engines.filter((e) => e.status === "ok");
  const others = report.engines.filter((e) => e.status !== "ok");
  const color = SCORE_COLOR(report.score);

  return (
    <div className="mt-6">
      {/* 头：分数 + 结论 + 缺口 */}
      <div className="flex flex-wrap items-start gap-4 rounded-2xl border border-white/8 bg-white/[0.03] p-4 sm:p-5">
        <div
          className="grid size-16 shrink-0 place-items-center rounded-full font-mono text-[22px] font-semibold"
          style={{
            color,
            border: `2px solid ${color}`,
            background: `radial-gradient(circle, ${color}14 0%, transparent 70%)`,
          }}
          aria-label={`可见度 ${report.score} 分`}
        >
          {report.score}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-bold">{report.verdict}</span>
            {okEngines.map((e) => (
              <span
                key={e.id}
                className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10.5px] text-muted-foreground"
              >
                {e.label}
              </span>
            ))}
            <span className="font-mono text-[10.5px] text-faint">
              目标：{report.label}
              {report.domain ? ` · ${report.domain}` : ""}
            </span>
          </div>
          <p className="mt-2 text-[13px] leading-6 text-muted-foreground">
            <b className="text-[#8ab6ff]">缺口（{report.gap.dimension}）：</b>
            {report.gap.text}
          </p>
        </div>
      </div>

      {/* 每引擎分层可见度 */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {okEngines.map((e) => (
          <SpotlightCard key={e.id} className="rounded-[16px] border border-white/8 bg-card">
            <div className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[13.5px] font-bold">{e.label}</span>
                <span className="font-mono text-[11px] text-faint">{e.model}</span>
              </div>
              <EngineBars e={e} />
            </div>
          </SpotlightCard>
        ))}
        {others.map((e) => {
          const b = statusBadge(e);
          return (
            <div key={e.id} className="rounded-[16px] border border-white/8 bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-[13.5px] font-bold">{e.label}</span>
                <span className={cn("rounded-full border px-2 py-0.5 text-[10.5px] font-medium", b.cls)}>{b.text}</span>
              </div>
              <p className="mt-2 text-[12px] leading-5 text-faint">{e.statusNote}</p>
            </div>
          );
        })}
      </div>

      {/* 官网 AI 可读性体检（结构层，随报告附赠） */}
      {audit && <AuditPanel audit={audit} />}

      {/* 证据面 */}
      <details className="mt-4 rounded-2xl border border-white/8 bg-white/[0.02] open:pb-2">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[13px] text-muted-foreground [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-[#4c8dff]" />
            证据面：逐条命中判定与引擎原话（审计可下钻）
          </span>
          <ChevronDown size={15} className="text-faint" />
        </summary>
        <div className="space-y-4 px-4 pb-3">
          {report.questions.map((q, qi) => (
            <div key={qi} className="rounded-xl border border-white/6 bg-white/[0.02] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] text-[#4c8dff]">Q{qi + 1}</span>
                <span className="flex-1 text-[13px] text-muted-foreground">{q}</span>
              </div>
              {okEngines.map((e) => {
                const row = e.rows[qi];
                if (!row) return null;
                const isOpen = !!open[qi];
                return (
                  <div key={e.id} className="mt-2 flex flex-col gap-1.5 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px]">
                      <b className="text-[12px] font-semibold text-foreground">{e.label}</b>
                      <Tag ok={row.mention} label="被提到" />
                      <Tag ok={row.selfCite} label="引用官网" />
                      {row.recommendedService ? (
                        row.targetRecommended ? (
                          <span className="rounded border border-[rgba(52,211,153,.35)] bg-[rgba(52,211,153,.1)] px-1.5 py-px text-[#34d399]">
                            ✓ 点名推荐
                          </span>
                        ) : (
                          <span className="text-faint">推荐了「{row.recommendedService}」</span>
                        )
                      ) : (
                        <span className="text-faint">未推荐</span>
                      )}
                    </div>
                    <button
                      onClick={() => setOpen((p) => ({ ...p, [qi]: !isOpen }))}
                      className="flex cursor-pointer items-center gap-1 self-start text-[12px] text-[#4c8dff] hover:text-[#7db4ff]"
                    >
                      {isOpen ? "收起" : "展开引擎原话"}
                      <ChevronDown size={13} className={cn("transition-transform", isOpen && "rotate-180")} />
                    </button>
                    {isOpen && (
                      <p className="max-h-56 overflow-y-auto text-[12px] leading-6 text-muted-foreground">
                        {row.answer || "（引擎未返回可判读回答）"}
                      </p>
                    )}
                    {row.urls.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {row.urls.slice(0, 5).map((u, ui) => (
                          <a
                            key={ui}
                            href={u}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex max-w-[260px] items-center gap-1 truncate rounded border border-white/8 bg-white/[0.03] px-2 py-0.5 font-mono text-[10.5px] text-[#8ab6ff] no-underline hover:border-[#4c8dff]/40"
                          >
                            <ExternalLink size={10} className="shrink-0" />
                            {u.replace(/^https?:\/\//, "").slice(0, 44)}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </details>

      {/* tips + 转付费 */}
      {report.tips.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {report.tips.map((t, i) => (
            <li key={i} className="flex gap-2 text-[12.5px] leading-6 text-muted-foreground">
              <span className="mt-[7px] inline-block size-1 shrink-0 rounded-full bg-[#4c8dff]" />
              {t}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/6 pt-4">
        <p className="max-w-[46ch] font-mono text-[10.5px] leading-5 text-faint">{report.honest}</p>
        <div className="flex items-center gap-2">
          <button
            onClick={onReset}
            className="h-10 rounded-[10px] border border-white/10 bg-white/[0.03] px-4 text-[13px] text-muted-foreground hover:border-white/20"
          >
            再测一个
          </button>
          <ShimmerLink href="/app" className="h-10 rounded-[10px] px-5 text-[13px]">
            控制台持续监测 →
          </ShimmerLink>
        </div>
      </div>
    </div>
  );
}

function EngineBars({ e }: { e: EngineRep }) {
  const rows = [
    { label: "被检索到", v: e.summary.retrieval.answered, n: e.summary.retrieval.n, c: "#4c8dff" },
    { label: "提到你", v: e.summary.mention.hits, n: e.summary.mention.n, c: "#7db4ff" },
    { label: "引用官网", v: e.summary.selfCite.hits, n: e.summary.selfCite.n, c: "#34d399" },
    { label: "推荐你", v: e.summary.recommend.hits, n: e.summary.recommend.n, c: "#f5a623" },
  ];
  return (
    <div className="space-y-1.5">
      {rows.map((r) => {
        const pct = r.n ? Math.round((r.v / r.n) * 100) : 0;
        return (
          <div key={r.label} className="flex items-center gap-2.5 text-[11px]">
            <span className="w-12 shrink-0 text-faint">{r.label}</span>
            <div className="h-[6px] flex-1 overflow-hidden rounded-full bg-white/6">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: r.c }} />
            </div>
            <span className="w-10 shrink-0 text-right font-mono text-[10.5px] text-muted-foreground">
              {r.v}/{r.n}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- 官网 AI 可读性体检（结构层） ---------------- */
function AuditPanel({ audit }: { audit: AuditState }) {
  if (audit.loading) {
    return (
      <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 text-[12.5px] text-faint">
        <Globe size={14} className="shrink-0 animate-pulse text-[#7db4ff]" />
        正在体检官网（robots / llms.txt / 结构化数据 / 纯 HTML 可读量）…
      </div>
    );
  }
  if (!audit.data) return null;
  const a = audit.data;
  const color = SCORE_COLOR(a.score);
  const keyItems = a.items.filter((i) =>
    ["robots", "content", "llms", "jsonld", "sitemap", "meta"].includes(i.id)
  );
  const acts = a.actions.filter((x) => x.level !== "P2").slice(0, 2);
  const dot = (s: string) => (s === "pass" ? "✓" : s === "partial" ? "◐" : "✗");
  const dotCls = (s: string) =>
    s === "pass"
      ? "border-[rgba(52,211,153,.3)] bg-[rgba(52,211,153,.08)] text-[#34d399]"
      : s === "partial"
        ? "border-[rgba(245,166,35,.3)] bg-[rgba(245,166,35,.08)] text-[#f5a623]"
        : "border-[rgba(240,81,107,.35)] bg-[rgba(240,81,107,.08)] text-[#f0516b]";
  return (
    <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[13px] font-bold">
          <Globe size={14} className="text-[#7db4ff]" />
          官网 AI 可读性体检
        </span>
        <div className="flex items-center gap-2">
          <span className="hidden font-mono text-[10px] text-faint sm:inline">结构层 · 秒出</span>
          <span
            className="rounded-full px-2.5 py-0.5 font-mono text-[12.5px] font-semibold"
            style={{ color, border: `1px solid ${color}40`, background: `${color}14` }}
            aria-label={`官网可读性 ${a.score} 分`}
          >
            {a.score}
          </span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {keyItems.map((i) => (
          <span
            key={i.id}
            title={i.detail}
            className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[10.5px]", dotCls(i.status))}
          >
            {dot(i.status)} {auditLabel(i.id)}
          </span>
        ))}
      </div>
      {a.blockedBots.length > 0 && (
        <p className="mt-2.5 text-[12px] leading-5 text-[#f0516b]">
          ⚠ robots.txt 封锁了 {a.blockedBots.length} 个 AI 爬虫（{a.blockedBots.join("、")}）
        </p>
      )}
      {acts.length > 0 && (
        <ul className="mt-2.5 space-y-1.5">
          {acts.map((x, i) => (
            <li key={i} className="flex items-start gap-2 text-[12px] leading-5 text-muted-foreground">
              <span
                className={cn(
                  "mt-px shrink-0 rounded px-1 font-mono text-[9.5px] font-semibold",
                  x.level === "P0"
                    ? "bg-[rgba(240,81,107,.16)] text-[#f0516b]"
                    : "bg-[rgba(245,166,35,.16)] text-[#f5a623]"
                )}
              >
                {x.level}
              </span>
              <span>{x.title}</span>
            </li>
          ))}
        </ul>
      )}
      {a.actions.length > 2 && (
        <details className="mt-1">
          <summary className="cursor-pointer list-none text-[11.5px] text-[#4c8dff] [&::-webkit-details-marker]:hidden">
            展开全部 {a.actions.length} 条行动项
          </summary>
          <ul className="mt-1.5 space-y-1.5">
            {a.actions.map((x, i) => (
              <li key={i} className="text-[12px] leading-5 text-muted-foreground">
                <b className="text-foreground">[{x.level}] {x.title}</b>
                <span className="text-faint"> — {x.desc}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="mt-2.5 font-mono text-[10px] leading-4 text-faint">
        用 AI 爬虫视角抓官网（不执行 JS）。可读性高 ≠ AI 一定引用你——被识别/被引用见上方证据面。
      </p>
    </div>
  );
}

function auditLabel(id: string): string {
  switch (id) {
    case "robots":
      return "robots";
    case "content":
      return "HTML 内容";
    case "llms":
      return "llms.txt";
    case "jsonld":
      return "JSON-LD";
    case "sitemap":
      return "sitemap";
    case "meta":
      return "标题结构";
    default:
      return id;
  }
}

function Tag({ ok, label }: { ok: boolean; label: string }) {
  return ok ? (
    <span className="rounded border border-[rgba(76,141,255,.35)] bg-[rgba(76,141,255,.1)] px-1.5 py-px text-[#7db4ff]">
      ✓ {label}
    </span>
  ) : (
    <span className="rounded border border-white/8 bg-white/[0.03] px-1.5 py-px text-faint">✗ {label}</span>
  );
}
