import { Fragment, type ComponentType } from "react";
import {
  ArrowRight,
  ChevronDown,
  Crosshair,
  Layers,
  Radar,
  Search,
  Send,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FreeCheck } from "@/components/FreeCheck";
import {
  nav,
  hero,
  loop,
  features,
  media,
  trust,
  cta,
  footer,
} from "@/lib/content";
import {
  DotGrid,
  GhostLink,
  GradientBorder,
  Reveal,
  ShimmerLink,
  ShineText,
  SpotlightCard,
} from "@/components/effects";

/* 每节标题前的 mono 眉标（装饰，非文案数据） */
function Eyebrow({ label }: { label: string }) {
  return (
    <p className="mb-3 flex items-center justify-center gap-2 font-mono text-[11px] font-medium tracking-[0.18em] text-[#4c8dff] uppercase">
      <span aria-hidden className="inline-block h-px w-6 bg-[#4c8dff]/50" />
      {label}
      <span aria-hidden className="inline-block h-px w-6 bg-[#4c8dff]/50" />
    </p>
  );
}

function SecHead({
  title,
  sub,
  className,
}: {
  title: string;
  sub?: string;
  className?: string;
}) {
  return (
    <Reveal className={cn("max-w-2xl", className)}>
      <h2 className="text-[clamp(24px,3.4vw,31px)] leading-[1.22] font-bold tracking-[-0.02em] text-pretty">
        {title}
      </h2>
      {sub && (
        <p className="mt-3 text-[13.5px] leading-7 text-muted-foreground">{sub}</p>
      )}
    </Reveal>
  );
}

/* ================= 顶栏 ================= */
export function Topbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/6 bg-background/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
        <a
          href="#top"
          aria-label="GEOloopOS — 回到顶部"
          className="group flex shrink-0 items-center gap-2.5 no-underline"
        >
          <img
            src="/logo.png"
            alt=""
            aria-hidden
            className="size-10 shrink-0 object-contain opacity-95 transition-opacity group-hover:opacity-100"
          />
          {/* 字标：GEOloop 细白 + OS 取 logo 主色（azure→皇家蓝渐变） */}
          <span className="brand-lock text-[21px] text-[#f2f5fb]">
            GEOloop
            <span className="brand-os">OS</span>
          </span>
        </a>
        <nav aria-label="页面导航" className="hidden items-center gap-7 md:flex">
          {nav.anchors.map((a) => (
            <a
              key={a.href}
              href={a.href}
              className="text-[13.5px] text-muted-foreground no-underline transition-colors hover:text-foreground"
            >
              {a.label}
            </a>
          ))}
        </nav>
        <ShimmerLink
          href={nav.cta.href}
          className="h-10 rounded-[10px] px-5 text-[13.5px]"
        >
          {nav.cta.label}
        </ShimmerLink>
      </div>
    </header>
  );
}

/* ================= Hero ================= */
function SparkMini() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 2 2 7l10 5 10-5-10-5Z" />
      <path d="M2 17 12 22l10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      {/* 局部主光晕 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-[420px] w-[min(860px,92vw)]"
        style={{
          background:
            "radial-gradient(540px 300px at 50% 30%, rgba(76,141,255,.16), transparent 70%), radial-gradient(420px 250px at 24% 12%, rgba(124,92,252,.11), transparent 72%), radial-gradient(420px 250px at 78% 10%, rgba(167,139,250,.08), transparent 72%)",
          filter: "blur(10px)",
        }}
      />
      <div className="relative mx-auto max-w-6xl px-5 pt-[68px] pb-6 text-center md:pt-[92px]">
        <Reveal>
          <span className="glow-chip inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[12px] font-medium tracking-[0.02em] text-[#4c8dff]">
            <SparkMini />
            <b className="font-semibold text-[#7db4ff]">{hero.badgeLead}</b>
            {hero.badge}
          </span>
        </Reveal>
        <Reveal delay={90}>
          <h1 className="mx-auto mt-7 max-w-[680px] text-[clamp(34px,5.6vw,52px)] leading-[1.14] font-bold tracking-[-0.028em] text-pretty [text-shadow:0_0_34px_rgba(76,141,255,.2)]">
            {hero.h1Pre}
            <ShineText>{hero.h1Shine}</ShineText>
          </h1>
        </Reveal>
        <Reveal delay={180}>
          <p className="mx-auto mt-6 max-w-[620px] text-[15.5px] leading-[1.8] tracking-[0.002em] text-[#b8b9c3]">
            {hero.sub}
          </p>
        </Reveal>
        <FreeCheck compact />
      </div>
    </section>
  );
}

/* ================= 能力闭环 4 步 ================= */
export function ProcessLoop() {
  return (
    <section id="loop" className="mx-auto max-w-6xl scroll-mt-24 px-5 pt-24 md:pt-28">
      <SecHead title={loop.title} sub={loop.sub} />
      <div className="mt-10 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
        {loop.steps.map((step, i) => {
          const isKey = i === 2; // DISTRIBUTE 主视觉：流光渐变边
          const body = (
            <>
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-md font-mono text-[10.5px] font-semibold",
                    isKey ? "bg-[#4c8dff]/20 text-[#7db4ff]" : "bg-white/6 text-[#4c8dff]",
                  )}
                >
                  {`0${i + 1}`}
                </span>
                <span className="font-mono text-[10.5px] font-semibold tracking-[0.08em] text-[#4c8dff]">
                  {step.n}
                </span>
              </div>
              <h3 className="text-[16px] font-bold tracking-[-0.01em]">{step.title}</h3>
              <p className="text-[12.5px] leading-[1.7] text-muted-foreground">{step.desc}</p>
            </>
          );
          return (
            <Fragment key={step.n}>
              {/* 移动端：卡片间的下箭头 */}
              {i > 0 && (
                <div aria-hidden className="flex justify-center py-0.5 text-white/22 lg:hidden">
                  <ChevronDown size={16} strokeWidth={1.8} />
                </div>
              )}
              <Reveal delay={i * 90} className="h-full">
                {isKey ? (
                  <GradientBorder
                    className="h-full rounded-[20px]"
                    innerClassName="flex h-full rounded-[inherit] bg-[#0c0c11]"
                  >
                    <div className="flex h-full flex-col gap-2.5 p-5">{body}</div>
                  </GradientBorder>
                ) : (
                  <SpotlightCard className="h-full rounded-[20px] border border-white/8 bg-card transition-colors duration-200 hover:border-white/14">
                    <div className="flex h-full flex-col gap-2.5 p-5">{body}</div>
                  </SpotlightCard>
                )}
              </Reveal>
              {/* lg：步骤间右箭头 */}
              {i < 3 && (
                <div aria-hidden className="hidden items-center lg:flex">
                  <ArrowRight size={19} strokeWidth={1.6} className="text-white/22" />
                </div>
              )}
            </Fragment>
          );
        })}
      </div>
    </section>
  );
}

/* ================= 功能亮点 · Bento ================= */
const ICONS: ComponentType<{ className?: string }>[] = [
  Search,
  Layers,
  Radar,
  Crosshair,
  Send,
  ShieldCheck,
];
const SPANS = [
  "lg:col-span-7 lg:row-span-2",
  "lg:col-span-5",
  "lg:col-span-5",
  "lg:col-span-4",
  "lg:col-span-4",
  "lg:col-span-4",
];

function CardLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="mt-auto inline-flex w-fit items-center gap-1.5 pt-1 text-[13px] font-semibold text-[#4c8dff] no-underline transition-colors hover:text-[#7db4ff]"
    >
      {label}
    </a>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  desc,
  href,
  cta,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  href: string;
  cta: string;
}) {
  return (
    <SpotlightCard className="h-full rounded-[18px] border border-white/8 bg-card/95 transition-colors duration-200 hover:border-white/14">
      <div className="flex h-full flex-col gap-3.5 p-5">
        <span className="grid size-9 place-items-center rounded-xl bg-[rgba(76,141,255,.13)] text-[#4c8dff]">
          <Icon className="size-[17px]" />
        </span>
        <div className="flex flex-col gap-2">
          <h3 className="text-[15px] font-bold tracking-[-0.01em]">{title}</h3>
          <p className="text-[13px] leading-[1.72] text-muted-foreground">{desc}</p>
        </div>
        <CardLink href={href} label={cta} />
      </div>
    </SpotlightCard>
  );
}

function FeatureMain({
  icon: Icon,
  title,
  desc,
  href,
  cta,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  href: string;
  cta: string;
}) {
  return (
    <GradientBorder
      className="h-full rounded-[22px]"
      innerClassName="relative h-full overflow-hidden rounded-[inherit] bg-[#0c0c11]"
    >
      <DotGrid />
      <div className="relative flex h-full flex-col gap-5 p-7 lg:p-8">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[rgba(76,141,255,.13)] text-[#4c8dff]">
            <Icon className="size-5" />
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-white/4 px-2.5 py-1 font-mono text-[10.5px] tracking-[0.1em] text-muted-foreground">
            <span className="inline-block size-1.5 animate-pulse rounded-full bg-[#34d399]" />
            LIVE DETECT
          </span>
        </div>
        <div className="flex flex-col gap-2.5">
          <h3 className="text-[clamp(20px,2.2vw,25px)] font-bold tracking-[-0.015em]">{title}</h3>
          <p className="max-w-[46ch] text-[14px] leading-[1.8] text-muted-foreground">{desc}</p>
        </div>
        {/* 报告产物 chips（真实产品词汇，非虚构指标） */}
        <div className="flex flex-wrap gap-2">
          {["认知分", "描述完整度", "来源引用", "优化建议"].map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-[rgba(76,141,255,.28)] bg-[rgba(76,141,255,.09)] px-3 py-1 text-[12px] font-medium text-[#8ab6ff]"
            >
              {chip}
            </span>
          ))}
        </div>
        <CardLink href={href} label={cta} />
      </div>
    </GradientBorder>
  );
}

export function BentoFeatures() {
  const cards = features.cards;
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-24 px-5 pt-24 md:pt-28">
      <SecHead title={features.title} sub={features.sub} />
      <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-12">
        {cards.map((f, i) => (
          <Reveal
            key={f.title}
            delay={(i % 3) * 80}
            className={cn("h-full", SPANS[i])}
          >
            {i === 0 ? (
              <FeatureMain
                icon={ICONS[i]}
                title={f.title}
                desc={f.desc}
                href={f.href}
                cta={f.cta}
              />
            ) : (
              <FeatureCard
                icon={ICONS[i]}
                title={f.title}
                desc={f.desc}
                href={f.href}
                cta={f.cta}
              />
            )}
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ================= 软文媒体分发 showcase ================= */
export function MediaShowcase() {
  return (
    <section id="media" className="mx-auto max-w-6xl scroll-mt-24 px-5 pt-24 md:pt-28">
      <SecHead title={media.title} sub={media.sub} />
      <Reveal delay={120}>
        <GradientBorder
          className="mt-10 rounded-[22px]"
          innerClassName="relative overflow-hidden rounded-[inherit] bg-[#0c0c11]/90"
        >
          <DotGrid />
          <div className="relative px-6 pt-9 pb-6 sm:px-8">
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {media.stats.map((s) => (
                <div key={s.tag} className="flex flex-col gap-2.5">
                  <span className="w-fit rounded-full border border-[rgba(76,141,255,.32)] bg-[rgba(76,141,255,.1)] px-3 py-1 text-[11.5px] font-semibold tracking-[0.02em] text-[#4c8dff]">
                    {s.tag}
                  </span>
                  <strong className="text-[17px] leading-snug font-bold tracking-[-0.01em]">
                    {s.big}
                  </strong>
                  <span className="text-[12.5px] leading-[1.7] text-muted-foreground">{s.sub}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="relative flex flex-wrap items-center gap-3 border-t border-white/6 px-6 py-4 sm:px-8">
            <ShimmerLink
              href={media.primaryCta.href}
              className="h-10 rounded-[10px] px-5 text-[13.5px]"
            >
              {media.primaryCta.label}
            </ShimmerLink>
            <GhostLink
              href={media.external.href}
              external
              className="h-10 rounded-[10px] px-5 text-[13.5px]"
            >
              {media.external.label}
            </GhostLink>
            <span className="ml-auto font-mono text-[11px] tracking-[0.05em] text-faint">
              {media.hint}
            </span>
          </div>
        </GradientBorder>
      </Reveal>
    </section>
  );
}

/* ================= 数据可信条 ================= */
export function TrustStrip() {
  return (
    <section className="mx-auto max-w-6xl px-5 pt-20 md:pt-24">
      <Reveal>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 rounded-2xl border border-white/8 bg-card/80 px-6 py-5 backdrop-blur-sm">
          {trust.map((t, i) => (
            <span key={i} className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
              <span
                aria-hidden
                className={cn(
                  "inline-block size-1.5 shrink-0 rounded-full",
                  i === trust.length - 1 ? "bg-[#76767f]" : "bg-[#34d399]",
                )}
              />
              {t.b ? (
                <b className="font-mono text-[15.5px] font-semibold text-foreground">
                  {t.b}
                  <span className="ml-0.5 font-sans text-[13px] font-medium">{t.after}</span>
                </b>
              ) : (
                t.after
              )}
            </span>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

/* ================= CTA ================= */
export function CtaSection() {
  return (
    <section className="mx-auto max-w-6xl px-5 pt-20 md:pt-28">
      <Reveal>
        <GradientBorder
          className="rounded-[24px]"
          innerClassName="relative overflow-hidden rounded-[inherit] bg-[#0b0b0f]"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[260px]"
            style={{
              background:
                "radial-gradient(520px 260px at 50% -60px, rgba(76,141,255,.2), transparent 70%)",
            }}
          />
          <div className="relative px-6 py-16 text-center sm:px-10 md:py-[72px]">
            <Eyebrow label="Start" />
            <h2 className="mx-auto max-w-[620px] text-[clamp(24px,4vw,34px)] leading-[1.2] font-bold tracking-[-0.02em] text-pretty">
              {cta.title}
            </h2>
            <p className="mx-auto mt-4 max-w-[520px] text-[14px] leading-[1.8] text-muted-foreground">
              {cta.sub}
            </p>
            <div className="mt-9 flex justify-center">
              <ShimmerLink href={cta.btn.href} className="h-[52px] px-9 text-[15px]">
                {cta.btn.label}
              </ShimmerLink>
            </div>
          </div>
        </GradientBorder>
      </Reveal>
    </section>
  );
}

/* ================= 页脚 ================= */
export function Footer() {
  return (
    <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-2 px-5 pt-14 pb-10 text-[12px] leading-relaxed text-faint">
      <span>{footer.tagline}</span>
      <span>
        <a
          href={footer.deployHref}
          className="text-muted-foreground no-underline transition-colors hover:text-[#4c8dff]"
        >
          企业私有部署
        </a>
        <span className="mx-2">·</span>
        数据源 <code className="font-mono">DeepSeek</code> / <code className="font-mono">豆包</code> /{" "}
        <code className="font-mono">Ox Alpha</code> · {footer.note}
      </span>
    </footer>
  );
}
