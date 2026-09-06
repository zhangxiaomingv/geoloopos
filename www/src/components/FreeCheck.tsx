/**
 * 免费真检测框（营销首页 · 盲测联网口径）
 * 调用 POST /api/detect {query} → {id}，再轮询 GET /api/detect/{id} 到 done。
 * 引擎 DeepSeek（实时）+ 豆包（欠费/未就绪时如实标 unavailable / no-data，不冒充 0 分）。
 * 报告渲染对齐 Profound/Otterly 免费报告骨架：分层可见度 + 可下钻证据 + 缺口定位。
 */
import { useEffect, useState } from "react";
import { ArrowRight, ChevronDown, ExternalLink, RotateCw, Search, ShieldCheck } from "lucide-react";
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

            {/* 引擎 chips */}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[11px] text-faint">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block size-1.5 animate-pulse rounded-full bg-[#34d399]" />
                DeepSeek · 联网实时
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block size-1.5 rounded-full bg-[#f5a623]" />
                豆包 · 充值后接入
              </span>
              <span className="hidden sm:inline">不告诉 AI 被测对象，结果不作假</span>
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
            {phase === "done" && report && <ReportCard report={report} open={open} setOpen={setOpen} onReset={recheck} />}
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
}: {
  report: Report;
  open: Record<number, boolean>;
  setOpen: (f: (p: Record<number, boolean>) => Record<number, boolean>) => void;
  onReset: () => void;
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

function Tag({ ok, label }: { ok: boolean; label: string }) {
  return ok ? (
    <span className="rounded border border-[rgba(76,141,255,.35)] bg-[rgba(76,141,255,.1)] px-1.5 py-px text-[#7db4ff]">
      ✓ {label}
    </span>
  ) : (
    <span className="rounded border border-white/8 bg-white/[0.03] px-1.5 py-px text-faint">✗ {label}</span>
  );
}
