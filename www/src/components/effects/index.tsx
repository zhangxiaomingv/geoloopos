import {
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

/* ================= Reveal：滚动淡入上移（IO + .rv/.in，once） ================= */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.classList.add("in");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add("in");
            io.disconnect();
            return;
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={cn("rv", className)}
      style={delay ? ({ "--d": `${delay}ms` } as CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}

/* ================= SpotlightCard：鼠标跟随径向光 ================= */
export function SpotlightCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--x", `${e.clientX - r.left}px`);
    el.style.setProperty("--y", `${e.clientY - r.top}px`);
  }, []);
  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      className={cn("spot", className)}
    >
      <span aria-hidden className="spot-glow" />
      <span aria-hidden className="spot-edge" />
      {children}
    </div>
  );
}

/* ================= GradientBorder：@property 旋转 conic 流光边 ================= */
export function GradientBorder({
  children,
  className,
  innerClassName,
}: {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
}) {
  return (
    <div className={cn("gb", className)}>
      <div className={cn("rounded-[inherit]", innerClassName)}>{children}</div>
    </div>
  );
}

/* ================= ShineText：渐变扫光高亮字 ================= */
export function ShineText({ children }: { children: ReactNode }) {
  return <span className="sh-hl">{children}</span>;
}

/* ================= DotGrid：局部点阵装饰 ================= */
export function DotGrid({ className }: { className?: string }) {
  return <span aria-hidden className={cn("dots", className)} />;
}

/* ================= PageBg：全屏固定 Aurora 光层 ================= */
export function PageBg() {
  return (
    <div aria-hidden className="page-bg">
      <span className="glow-a ga-1" />
      <span className="glow-a ga-2" />
      <span className="glow-a ga-3" />
      <span className="beam beam-1" />
      <span className="beam beam-2" />
      <span className="bg-dots" />
    </div>
  );
}

/* ================= ShimmerLink：蓝渐变流光 CTA 链接 ================= */
export function ShimmerLink({
  href,
  children,
  className,
  external = false,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      className={cn(
        "btn-glow inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-[14px] px-7 text-[15px] font-semibold whitespace-nowrap no-underline",
        className,
      )}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </a>
  );
}

/* ================= GhostLink：描边次级链接 ================= */
export function GhostLink({
  href,
  children,
  className,
  external = false,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      className={cn(
        "inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-[14px] border border-white/16 bg-white/[0.02] px-7 text-[15px] font-semibold whitespace-nowrap text-foreground no-underline transition-colors hover:border-white/30 hover:bg-white/[0.06]",
        className,
      )}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </a>
  );
}
