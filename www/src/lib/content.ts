// GEOloopOS 营销大页 · 文案数据（逐字对应 src/web/index.html 营销区 L449-599）

export type LoopStep = {
  n: string;
  title: string;
  desc: string;
  highlight?: boolean; // 主视觉：卡2 补认知 / 卡3 分发 轮流做渐变边
};

export type Feature = {
  title: string;
  desc: string;
  href: string;
  cta: string;
};

export type MediaStat = {
  tag: string;
  big: string;
  sub: string;
};

export const nav = {
  anchors: [
    { href: "#loop", label: "能力闭环" },
    { href: "#features", label: "功能模块" },
    { href: "#media", label: "发稿能力" },
  ],
  cta: { href: "/app", label: "进入控制台" },
};

export const hero = {
  badgeLead: "GEOloopOS",
  badge: "AI 可见度增长闭环系统",
  h1Pre: "让 AI ",
  h1Shine: "认识你、理解你、推荐你",
  sub: "从基础搭建，到持续迭代，让企业建立一套可被 AI 理解、识别、信任与引用的数字基础设施。",
  ctaPrimary: { href: "/app", label: "免费检测 →" },
  ctaGhost: { href: "/deploy", label: "企业私有部署" },
};

export const loop = {
  title: "一个闭环，把「被 AI 看到」变成可运营",
  sub: "检测是入口，发稿是出口，复测是验证 —— 每一步都有产出，每一步都可回测。",
  steps: [
    {
      n: "STEP 01 · DETECT",
      title: "检测",
      desc: "输入品牌 / 网站 / 问句，看它在 DeepSeek、豆包、Ox Alpha 眼中被怎么描述、推荐、打分。",
    },
    {
      n: "STEP 02 · FIX",
      title: "补认知",
      desc: "定位锚点 + 知识库生成统一口径，AI 写稿自动覆盖「AI 不知道的事实」，消除认知缺口。",
    },
    {
      n: "STEP 03 · DISTRIBUTE",
      title: "分发",
      desc: "一稿多发门户/行业站，智能选媒体（收录率 × 权威度加权），发布结果回调自动回填台账。",
    },
    {
      n: "STEP 04 · VERIFY",
      title: "复测",
      desc: "重新检测同一域名 / 文章，看引用是否进来、认知分是否上涨 —— 效果有据可循。",
    },
  ] satisfies LoopStep[],
};

export const features = {
  title: "为「AI 决策链」打造的完整工具链",
  sub: "从测量到行动到验证，六个模块覆盖 AI 可见度的每个环节。",
  cards: [
    {
      title: "实时检测报告",
      desc: "一键检测品牌 / 网站 / 问句，独立报告页给出认知分、描述完整度、来源引用与优化建议。",
      href: "/app",
      cta: "现场体验 →",
    },
    {
      title: "定位锚点 + 知识库",
      desc: "一套标准口径 → AI 生成长/中/短简介、站点署名、JSON-LD，统一各平台对「你是谁」的回答。",
      href: "/app#kb-sec",
      cta: "打开控制台 →",
    },
    {
      title: "引用追踪",
      desc: "追踪你的文章 / 域名是否被 AI 精确引用、提及标题或连带站点，把「被采用」量化成趋势曲线。",
      href: "/app#cite-sec",
      cta: "打开控制台 →",
    },
    {
      title: "竞品智能",
      desc: "站在用户问题场景里，统计各 AI 推荐谁、曝光份额多少，输出 0 曝光根因与打法建议。",
      href: "/app#compare-sec",
      cta: "打开控制台 →",
    },
    {
      title: "软文分发",
      desc: "需求单 → AI 成稿 → 9.3万+ 媒体库智能选媒 → 一稿多发门户/行业站，回调闭环回填台账。",
      href: "/packs",
      cta: "进入发稿管理 →",
    },
    {
      title: "企业私有部署",
      desc: "把整套系统部署到你的服务器 / 专有云，检测与数据不出内网，满足政企合规要求。",
      href: "/deploy",
      cta: "了解部署方案 →",
    },
  ] satisfies Feature[],
};

export const media = {
  title: "发稿能力：检测发现的缺口，直接变成可发布的稿",
  sub: "软文街一稿多发，AI 写稿统一口径，发布结果自动回填，衔接复测验证。",
  stats: [
    {
      tag: "媒体库",
      big: "9.3万+ 家媒体",
      sub: "排除自媒体，10,786 家门户/行业站可用",
    },
    {
      tag: "AI 写稿",
      big: "DeepSeek 成稿",
      sub: "按需求单生成可发布 HTML，统一认知口径",
    },
    {
      tag: "智能选媒体",
      big: "收录率×权威度加权",
      sub: "按知识库相关度筛出最优发稿组合",
    },
    {
      tag: "收录回填",
      big: "回调闭环",
      sub: "发布结果自动回填台账，衔接复测验证",
    },
  ] satisfies MediaStat[],
  primaryCta: { href: "/packs", label: "进入发稿管理 →" },
  external: {
    href: "https://i.kol.cn/recharge_center",
    label: "软文街充值 →",
  },
  hint: "需求单 · AI 写稿 · 选媒体 · 下单 · 回填",
};

export const trust = [
  { b: "3", after: " 大 AI 数据源" },
  { b: "9.3万+", after: " 家媒体库" },
  { b: "10,786", after: " 门户/行业站可用" },
  { b: "", after: "结果来自模型实时回答，仅供参考" },
] satisfies { b: string; after: string }[];

export const cta = {
  title: "把 AI 可见度变成可运营的增长资产",
  sub: "先检测现状，再配置口径、追踪引用、发稿验证 —— 用数据决定「下一步优化哪里」。",
  btn: { href: "/app", label: "进入控制台 →" },
};

export const footer = {
  tagline: "GEOloopOS · AI 可见度增长闭环系统 — 让 AI 认识你、理解你、推荐你",
  note: "数据源 DeepSeek / 豆包 / Ox Alpha · 结果来自模型实时回答，仅供参考",
  deployHref: "/deploy",
};
