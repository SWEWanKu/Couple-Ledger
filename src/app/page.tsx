import {
  ArrowRight,
  Coffee,
  HeartHandshake,
  LockKeyhole,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Train,
  Utensils,
  WalletCards
} from "lucide-react";
import { Card, Cursor, Divider, Footer, Icon, Title, Wallet } from "animal-island-ui";
import { IslandLink } from "@/components/IslandLink";

const features = [
  {
    title: "一起记账",
    note: "晚饭、电影、周末采购，都轻轻放进同一本小账本。",
    color: "app-yellow",
    islandIcon: "icon-chat",
    icon: ReceiptText
  },
  {
    title: "月底结算",
    note: "月底像整理背包一样，把谁先付、谁补上看清楚。",
    color: "app-teal",
    islandIcon: "icon-miles",
    icon: HeartHandshake
  },
  {
    title: "分类复盘",
    note: "看看小岛生活花在吃饭、通勤、约会还是日常补给。",
    color: "app-green",
    islandIcon: "icon-map",
    icon: WalletCards
  },
  {
    title: "安心私密",
    note: "仅给两个人使用，不做公开入口，也不展示真实账单。",
    color: "warm-peach-pink",
    islandIcon: "icon-design",
    icon: ShieldCheck
  }
] as const;

const previewEntries = [
  { item: "晚饭", helper: "两人份小火锅", amount: "¥126.00", icon: Utensils },
  { item: "奶茶", helper: "周六散步路上", amount: "¥32.00", icon: Coffee },
  { item: "地铁", helper: "回家通勤", amount: "¥12.00", icon: Train }
] as const;

const leaves = [
  "left-[9%] top-[18%] rotate-[-24deg] bg-[#6fba2c]/45",
  "left-[4%] top-[62%] rotate-[18deg] bg-[#f7cd67]/50",
  "right-[7%] top-[24%] rotate-[30deg] bg-[#6fba2c]/40",
  "right-[14%] bottom-[17%] rotate-[-18deg] bg-[#f8f8f0]/45"
] as const;

export default function HomePage() {
  return (
    <Cursor>
      <main
        className="relative min-h-screen overflow-hidden bg-[#7DC395] px-3 py-4 text-[#794f27] sm:px-6 lg:px-8"
        style={{
          fontFamily:
            'Nunito, "Noto Sans SC", -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif'
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            backgroundImage:
              "radial-gradient(circle at 18% 16%, rgba(248,248,240,0.34) 0 74px, transparent 75px), radial-gradient(circle at 86% 18%, rgba(247,205,103,0.34) 0 96px, transparent 97px), radial-gradient(circle at 6% 72%, rgba(25,200,185,0.22) 0 120px, transparent 121px), linear-gradient(135deg, rgba(255,255,255,0.17) 0 11%, transparent 11% 50%, rgba(255,255,255,0.12) 50% 61%, transparent 61% 100%)",
            backgroundSize: "auto, auto, auto, 40px 40px"
          }}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(248,248,240,0.2),transparent)]" />
        <div className="pointer-events-none absolute -bottom-14 left-[-10%] h-44 w-[120%] rounded-[50%_50%_0_0] bg-[#6fba2c]/28" />
        {leaves.map((leaf) => (
          <span
            key={leaf}
            aria-hidden="true"
            className={`pointer-events-none absolute h-9 w-5 rounded-[100%_0_100%_0] ${leaf}`}
          />
        ))}

        <section className="relative z-10 mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-6xl items-center py-4 sm:py-6">
          <div className="relative w-full rounded-[34px] border-[7px] border-[#e3bd74] bg-[#f8f8f0] p-3 shadow-[0_16px_0_rgba(93,112,67,0.32),0_30px_70px_rgba(55,86,54,0.26)] sm:rounded-[48px] sm:p-5">
            <div aria-hidden="true" className="absolute -left-3 top-20 h-8 w-8 rounded-full bg-[#f7cd67] shadow-[0_5px_0_rgba(121,79,39,0.16)] sm:-left-5 sm:h-12 sm:w-12" />
            <div aria-hidden="true" className="absolute -right-3 bottom-24 h-10 w-10 rounded-full bg-[#82d5bb] shadow-[0_5px_0_rgba(121,79,39,0.12)] sm:-right-6 sm:h-14 sm:w-14" />

            <div className="rounded-[26px] border-2 border-dashed border-[#d9c49b] bg-[rgb(247,243,223)] px-4 py-6 shadow-[inset_0_0_0_6px_rgba(255,255,255,0.42)] sm:rounded-[38px] sm:px-7 lg:px-10">
              <h1 className="sr-only">小岛账本</h1>

              <div className="flex flex-col items-center gap-3 text-center">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/75 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#9f927d] shadow-[0_5px_0_rgba(121,79,39,0.12)]">
                  <Icon name="icon-map" size={22} bounce />
                  Island Notice
                  <Icon name="icon-camera" size={22} bounce />
                </div>

                <div className="mt-1">
                  <Title size="large" color="app-yellow" style={{ fontSize: 36 }}>
                    小岛账本
                  </Title>
                </div>

                <p className="max-w-2xl text-2xl font-black leading-tight text-[#794f27] sm:text-3xl lg:text-4xl">
                  只属于两个人的温柔记账小岛
                </p>
                <p className="max-w-xl text-sm font-bold leading-7 text-[#725d42] sm:text-base">
                  把每天的小花费记成岛上的留言，不争吵、不公开，只给两个人慢慢整理生活。
                </p>
              </div>

              <div className="mt-7 grid items-stretch gap-5 lg:grid-cols-[0.92fr_1.08fr]">
                <div className="flex flex-col gap-4">
                  <Card color="default" pattern="app-teal" className="p-5 sm:p-6">
                    <div className="flex items-start gap-4">
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#82d5bb] text-white shadow-[0_6px_0_#5fb89f]">
                        <Sparkles aria-hidden="true" size={27} />
                      </span>
                      <div>
                        <p className="text-lg font-black text-[#794f27]">今日小岛公告</p>
                        <p className="mt-2 text-sm font-bold leading-7 text-[#725d42]">
                          这里会通往登录页。真实账本只在登录后出现，首页只放温柔的假示例。
                        </p>
                      </div>
                    </div>

                    <Divider type="wave-yellow" className="my-5" />

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <IslandLink
                        href="/login"
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#19c8b9] px-6 py-3 text-sm font-black text-white shadow-[0_7px_0_#0d9d92] transition hover:-translate-y-0.5 hover:shadow-[0_9px_0_#0d9d92] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/30"
                      >
                        进入登录页
                        <ArrowRight aria-hidden="true" size={18} />
                      </IslandLink>
                      <span className="inline-flex -rotate-1 items-center justify-center gap-2 rounded-full border-2 border-dashed border-[#d9c49b] bg-white/80 px-4 py-3 text-xs font-black text-[#9f927d] sm:justify-start">
                        <LockKeyhole aria-hidden="true" size={16} />
                        仅限两个人使用，不开放注册
                      </span>
                    </div>
                  </Card>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {features.map((feature) => {
                      const FeatureIcon = feature.icon;

                      return (
                        <Card
                          key={feature.title}
                          color={feature.color}
                          pattern="default"
                          className="min-h-[146px] p-4"
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/25">
                              <Icon name={feature.islandIcon} size={26} bounce />
                            </span>
                            <div className="min-w-0">
                              <h2 className="text-lg font-black leading-tight">{feature.title}</h2>
                              <FeatureIcon aria-hidden="true" className="mt-1 opacity-85" size={18} />
                            </div>
                          </div>
                          <p className="mt-3 text-sm font-bold leading-6 opacity-90">{feature.note}</p>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                <Card color="default" pattern="app-yellow" className="relative overflow-hidden p-4 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9f927d]">Demo Note</p>
                      <h2 className="mt-2 text-3xl font-black text-[#794f27]">示例预览</h2>
                      <p className="mt-2 max-w-sm text-sm font-bold leading-7 text-[#725d42]">
                        像一张贴在公告板上的账本便签，只展示假的日常条目。
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 self-start">
                      <Wallet value="¥3,580" size="small" />
                      <span className="rotate-3 rounded-full bg-[#f7cd67] px-4 py-2 text-xs font-black text-[#794f27] shadow-[0_4px_0_rgba(121,79,39,0.18)]">
                        全部为假数据
                      </span>
                    </div>
                  </div>

                  <Divider type="dashed-brown" className="my-5" />

                  <div className="rounded-[30px] bg-[#fffdf3] p-4 shadow-[inset_0_0_0_2px_rgba(217,196,155,0.72),0_8px_0_rgba(121,79,39,0.10)]">
                    <div className="mb-4 flex items-center justify-between gap-3 rounded-[24px] bg-[#82d5bb] px-4 py-3 text-white shadow-[0_5px_0_#5fb89f]">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.14em] opacity-80">Island Memo</p>
                        <p className="text-xl font-black">周末小账单</p>
                      </div>
                      <Icon name="icon-shopping" size={36} bounce />
                    </div>

                    <div className="space-y-3">
                      {previewEntries.map((entry) => {
                        const EntryIcon = entry.icon;

                        return (
                          <div
                            key={entry.item}
                            className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[22px] bg-[#f8f8f0] px-4 py-3 text-[#725d42] shadow-[0_3px_0_rgba(121,79,39,0.08)]"
                          >
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f7cd67] text-[#794f27]">
                              <EntryIcon aria-hidden="true" size={19} />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-base font-black text-[#794f27]">
                                {entry.item}
                              </span>
                              <span className="block truncate text-xs font-bold text-[#9f927d]">
                                {entry.helper}
                              </span>
                            </span>
                            <span className="text-sm font-black text-[#794f27]">{entry.amount}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[22px] bg-[#f7cd67]/55 px-4 py-3 text-sm font-black text-[#794f27]">
                      <span>本页不连接真实账本</span>
                      <span>Preview only</span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <Footer type="sea" seamless className="pointer-events-none absolute bottom-0 left-0 right-0 opacity-80" />
      </main>
    </Cursor>
  );
}
