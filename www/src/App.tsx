import { PageBg } from "@/components/effects";
import {
  Topbar,
  Hero,
  ProcessLoop,
  BentoFeatures,
  MediaShowcase,
  TrustStrip,
  CtaSection,
  Footer,
} from "@/components/sections";

/**
 * GEOloopOS 营销大页（React 焕新版）
 * 结构顺序严格对应原 src/web/index.html 营销区：顶栏→Hero→能力闭环→功能亮点
 * →发稿能力→数据可信→CTA→页脚。
 * 内部链接全部为绝对路径，直接命中后端真实路由（/app /packs /deploy /app#kb-sec…）。
 */
export default function App() {
  return (
    <>
      <PageBg />
      <div className="relative">
        <Topbar />
        <main>
          <Hero />
          <ProcessLoop />
          <BentoFeatures />
          <MediaShowcase />
          <TrustStrip />
          <CtaSection />
        </main>
        <Footer />
      </div>
    </>
  );
}
