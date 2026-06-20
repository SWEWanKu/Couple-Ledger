import Link from "next/link";
import { ArrowLeft, HeartHandshake, LockKeyhole, Mail, Send, Sparkles } from "lucide-react";
import { Button, Card, Divider, Footer, Icon, Title, Wallet } from "animal-island-ui";

const leaves = [
  "left-[8%] top-[17%] rotate-[-24deg] bg-[#6fba2c]/45",
  "left-[5%] bottom-[20%] rotate-[18deg] bg-[#f7cd67]/50",
  "right-[8%] top-[22%] rotate-[30deg] bg-[#6fba2c]/40",
  "right-[13%] bottom-[15%] rotate-[-18deg] bg-[#f8f8f0]/45"
] as const;

const accessNotes = ["约定邮箱", "双人小岛", "不开放注册"] as const;

export default function LoginPage() {
  return (
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

        <section className="relative z-10 mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-5xl items-center py-4 sm:py-6">
          <div className="relative w-full rounded-[34px] border-[7px] border-[#e3bd74] bg-[#f8f8f0] p-3 shadow-[0_16px_0_rgba(93,112,67,0.32),0_30px_70px_rgba(55,86,54,0.26)] sm:rounded-[48px] sm:p-5">
            <div aria-hidden="true" className="absolute -left-3 top-20 h-8 w-8 rounded-full bg-[#f7cd67] shadow-[0_5px_0_rgba(121,79,39,0.16)] sm:-left-5 sm:h-12 sm:w-12" />
            <div aria-hidden="true" className="absolute -right-3 bottom-24 h-10 w-10 rounded-full bg-[#82d5bb] shadow-[0_5px_0_rgba(121,79,39,0.12)] sm:-right-6 sm:h-14 sm:w-14" />

            <div className="rounded-[26px] border-2 border-dashed border-[#d9c49b] bg-[rgb(247,243,223)] px-4 py-6 shadow-[inset_0_0_0_6px_rgba(255,255,255,0.42)] sm:rounded-[38px] sm:px-7 lg:px-10">
              <Link
                href="/"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-black text-[#9f927d] shadow-[0_5px_0_rgba(121,79,39,0.12)] transition hover:-translate-y-0.5 hover:text-[#794f27] hover:shadow-[0_7px_0_rgba(121,79,39,0.12)] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
              >
                <ArrowLeft aria-hidden="true" size={17} />
                返回首页
              </Link>

              <div className="mt-5 flex flex-col items-center gap-3 text-center">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/75 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#9f927d] shadow-[0_5px_0_rgba(121,79,39,0.12)]">
                  <Icon name="icon-map" size={22} bounce />
                  Island Pass
                  <Icon name="icon-chat" size={22} bounce />
                </div>
                <h1 className="sr-only">进入小岛</h1>
                <Title size="large" color="app-yellow" style={{ fontSize: 36 }}>
                  进入小岛
                </Title>
                <p className="text-xl font-black leading-tight text-[#794f27] sm:text-2xl">小岛账本</p>
                <p className="max-w-2xl text-sm font-bold leading-7 text-[#725d42] sm:text-base">
                  输入约定好的邮箱，回到只属于两个人的小岛
                </p>
              </div>

              <div className="mt-7 grid items-stretch gap-5 lg:grid-cols-[1.02fr_0.98fr]">
                <Card color="default" pattern="app-teal" className="p-5 sm:p-6">
                  <div className="flex items-start gap-4">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#82d5bb] text-white shadow-[0_6px_0_#5fb89f]">
                      <LockKeyhole aria-hidden="true" size={27} />
                    </span>
                    <div>
                      <p className="text-lg font-black text-[#794f27]">仅限两个人使用，不开放注册</p>
                      <p className="mt-2 text-sm font-bold leading-7 text-[#725d42]">
                        这里先放一封小岛通行信的样子，真正登录功能将在接入 Supabase 后启用
                      </p>
                    </div>
                  </div>

                  <Divider type="wave-yellow" className="my-5" />

                  <form className="grid gap-4" aria-label="小岛账本登录占位表单">
                    <label className="grid gap-2 text-sm font-black text-[#794f27]" htmlFor="login-email">
                      邮箱
                    </label>
                    <div className="relative">
                      <Mail
                        aria-hidden="true"
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#9f927d]"
                        size={18}
                      />
                      <input
                        id="login-email"
                        type="email"
                        placeholder="you@example.com"
                        className="h-14 w-full rounded-full border-2 border-[#d9c49b] bg-[#fffdf3] pl-12 pr-4 text-sm font-bold text-[#794f27] shadow-[inset_0_0_0_4px_rgba(255,255,255,0.5),0_5px_0_rgba(121,79,39,0.08)] outline-none transition placeholder:text-[#9f927d]/70 focus:border-[#19c8b9] focus:ring-4 focus:ring-[#19c8b9]/25"
                      />
                    </div>

                    <Button type="primary" size="large" htmlType="button" block icon={<Send aria-hidden="true" size={18} />}>
                      发送小岛通行信
                    </Button>
                  </form>

                  <div className="mt-5 rounded-[24px] border-2 border-dashed border-[#d9c49b] bg-white/75 px-4 py-3 text-xs font-black leading-6 text-[#9f927d]">
                    真正登录功能将在接入 Supabase 后启用
                  </div>
                </Card>

                <Card color="default" pattern="app-yellow" className="relative overflow-hidden p-5 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9f927d]">Private Dock</p>
                      <h2 className="mt-2 text-3xl font-black text-[#794f27]">小岛通行证</h2>
                      <p className="mt-2 text-sm font-bold leading-7 text-[#725d42]">
                        像一张放在码头边的便签，只提醒入口规则，不展示真实账本。
                      </p>
                    </div>
                    <Wallet value="2 人" size="small" />
                  </div>

                  <Divider type="dashed-brown" className="my-5" />

                  <div className="rounded-[30px] bg-[#fffdf3] p-4 shadow-[inset_0_0_0_2px_rgba(217,196,155,0.72),0_8px_0_rgba(121,79,39,0.10)]">
                    <div className="flex items-center justify-between gap-3 rounded-[24px] bg-[#82d5bb] px-4 py-3 text-white shadow-[0_5px_0_#5fb89f]">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.14em] opacity-80">Only Us</p>
                        <p className="text-xl font-black">只属于两个人</p>
                      </div>
                      <Icon name="icon-helicopter" size={34} bounce />
                    </div>

                    <div className="mt-4 grid gap-3">
                      {accessNotes.map((note, index) => (
                        <div
                          key={note}
                          className="grid grid-cols-[auto_1fr] items-center gap-3 rounded-[22px] bg-[#f8f8f0] px-4 py-3 text-[#725d42] shadow-[0_3px_0_rgba(121,79,39,0.08)]"
                        >
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f7cd67] text-[#794f27]">
                            {index === 0 ? (
                              <Mail aria-hidden="true" size={18} />
                            ) : index === 1 ? (
                              <HeartHandshake aria-hidden="true" size={18} />
                            ) : (
                              <Sparkles aria-hidden="true" size={18} />
                            )}
                          </span>
                          <span className="min-w-0 text-sm font-black text-[#794f27]">{note}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[22px] bg-[#f7cd67]/55 px-4 py-3 text-sm font-black text-[#794f27]">
                      <span>仅限两个人使用，不开放注册</span>
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
  );
}
