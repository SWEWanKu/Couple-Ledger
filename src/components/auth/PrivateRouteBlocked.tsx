import { ArrowLeft, Home, LockKeyhole, Sparkles } from "lucide-react";
import { Card, Cursor, Divider, Icon, Title, Wallet } from "animal-island-ui";
import { IslandLink } from "@/components/IslandLink";

export function PrivateRouteBlocked() {
  return (
    <Cursor>
      <main
        className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[#7DC395] px-3 py-5 text-[#794f27] sm:px-6 lg:px-8"
        style={{
          fontFamily:
            'Nunito, "Noto Sans SC", -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif'
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-95"
          style={{
            backgroundImage:
              "radial-gradient(circle at 16% 18%, rgba(248,248,240,0.36) 0 72px, transparent 73px), radial-gradient(circle at 88% 16%, rgba(247,205,103,0.34) 0 96px, transparent 97px), radial-gradient(circle at 8% 78%, rgba(25,200,185,0.22) 0 118px, transparent 119px), linear-gradient(135deg, rgba(255,255,255,0.18) 0 11%, transparent 11% 50%, rgba(255,255,255,0.12) 50% 61%, transparent 61% 100%)",
            backgroundSize: "auto, auto, auto, 40px 40px"
          }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 left-[-12%] h-56 w-[124%] rounded-[50%_50%_0_0] bg-[#6fba2c]/30"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-[9%] top-[16%] h-10 w-6 -rotate-[24deg] rounded-[100%_0_100%_0] bg-[#6fba2c]/45 shadow-[0_5px_0_rgba(93,112,67,0.12)]"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-[10%] top-[18%] h-10 w-6 rotate-[30deg] rounded-[100%_0_100%_0] bg-[#f8f8f0]/50 shadow-[0_5px_0_rgba(93,112,67,0.12)]"
        />

        <section
          aria-labelledby="private-route-blocked-title"
          className="relative z-10 w-full max-w-5xl rounded-[34px] border-[7px] border-[#e3bd74] bg-[#f8f8f0] p-3 shadow-[0_16px_0_rgba(93,112,67,0.32),0_30px_70px_rgba(55,86,54,0.24)] sm:rounded-[44px] sm:p-5"
        >
          <div className="rounded-[26px] border-2 border-dashed border-[#d9c49b] bg-[rgb(247,243,223)] px-4 py-6 shadow-[inset_0_0_0_6px_rgba(255,255,255,0.42)] sm:rounded-[34px] sm:px-7 sm:py-8">
            <Card color="default" pattern="app-teal" className="relative overflow-hidden p-5 sm:p-7">
              <div
                aria-hidden="true"
                className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[#f7cd67]/45"
              />
              <div
                aria-hidden="true"
                className="absolute -bottom-10 left-8 h-24 w-24 rounded-full bg-[#82d5bb]/30"
              />

              <div className="relative grid gap-6 lg:grid-cols-[1fr_280px] lg:items-center">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/75 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#9f927d] shadow-[0_5px_0_rgba(121,79,39,0.12)]">
                    <Icon name="icon-map" size={22} bounce />
                    Island Notice
                    <Icon name="icon-chat" size={22} bounce />
                  </div>

                  <h1 id="private-route-blocked-title" className="sr-only">
                    还没有登上共同小岛
                  </h1>
                  <div className="mt-4">
                    <Title size="large" color="app-yellow" style={{ fontSize: 32 }}>
                      还没有登上共同小岛
                    </Title>
                  </div>

                  <p className="mt-5 max-w-2xl text-base font-bold leading-8 text-[#725d42] sm:text-lg">
                    这个账号还没有被加入 99岛，请确认邮箱是否正确，或让管理员完成初始化。
                  </p>

                  <Divider type="wave-yellow" className="my-6" />

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <IslandLink
                      href="/login"
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#19c8b9] px-6 py-3 text-sm font-black text-white shadow-[0_7px_0_#0d9d92] transition hover:-translate-y-0.5 hover:shadow-[0_9px_0_#0d9d92] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/30"
                    >
                      <ArrowLeft aria-hidden="true" size={18} />
                      返回登录
                    </IslandLink>
                    <IslandLink
                      href="/"
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-dashed border-[#d9c49b] bg-white/80 px-6 py-3 text-sm font-black text-[#794f27] shadow-[0_5px_0_rgba(121,79,39,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_rgba(121,79,39,0.12)] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
                    >
                      <Home aria-hidden="true" size={18} />
                      回到首页
                    </IslandLink>
                  </div>
                </div>

                <aside className="rounded-[30px] bg-[#fffdf3] p-4 shadow-[inset_0_0_0_2px_rgba(217,196,155,0.72),0_8px_0_rgba(121,79,39,0.10)]">
                  <div className="flex items-center justify-between gap-3 rounded-[24px] bg-[#82d5bb] px-4 py-3 text-white shadow-[0_5px_0_#5fb89f]">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] opacity-80">
                        Boarding Pass
                      </p>
                      <p className="text-lg font-black">99岛</p>
                    </div>
                    <Wallet value="99岛" size="small" />
                  </div>

                  <div className="mt-4 grid gap-3">
                    <div className="grid grid-cols-[auto_1fr] items-center gap-3 rounded-[22px] bg-[#f8f8f0] px-4 py-3 text-[#725d42] shadow-[0_3px_0_rgba(121,79,39,0.08)]">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f7cd67] text-[#794f27]">
                        <LockKeyhole aria-hidden="true" size={18} />
                      </span>
                      <span className="text-sm font-black text-[#794f27]">等待管理员把邮箱写进岛民名单</span>
                    </div>
                    <div className="grid grid-cols-[auto_1fr] items-center gap-3 rounded-[22px] bg-[#f8f8f0] px-4 py-3 text-[#725d42] shadow-[0_3px_0_rgba(121,79,39,0.08)]">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f7cd67] text-[#794f27]">
                        <Sparkles aria-hidden="true" size={18} />
                      </span>
                      <span className="text-sm font-black text-[#794f27]">确认后再回来登岛就好</span>
                    </div>
                  </div>
                </aside>
              </div>
            </Card>
          </div>
        </section>
      </main>
    </Cursor>
  );
}
