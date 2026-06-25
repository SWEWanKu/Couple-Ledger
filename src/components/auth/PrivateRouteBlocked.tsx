import { ArrowLeft, Home, LockKeyhole, MailCheck, ShieldCheck, Sparkles } from "lucide-react";
import { Card, Cursor, Divider, Icon, Title } from "animal-island-ui";
import { IslandLink } from "@/components/IslandLink";

export function PrivateRouteBlocked() {
  return (
    <Cursor>
      <main
        className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[#e7f7ed] px-3 py-5 text-[#794f27] sm:px-6 lg:px-8"
        style={{
          fontFamily:
            'Nunito, "Noto Sans SC", -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif'
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgba(25,200,185,0.08) 1px, transparent 1px), linear-gradient(180deg, rgba(25,200,185,0.08) 1px, transparent 1px), repeating-linear-gradient(-18deg, rgba(247,205,103,0.18) 0 10px, transparent 10px 34px)",
            backgroundSize: "34px 34px, 34px 34px, 160px 160px"
          }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 left-[-10%] h-64 w-[120%] rounded-[50%_50%_0_0] border-t-2 border-[#8ac57c] bg-[#bde8ba]/45"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-[7%] top-[17%] hidden h-14 w-8 -rotate-[24deg] rounded-[100%_0_100%_0] bg-[#82d5bb]/55 shadow-[0_5px_0_rgba(93,112,67,0.12)] sm:block"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-[9%] top-[20%] hidden h-12 w-7 rotate-[30deg] rounded-[100%_0_100%_0] bg-[#f7cd67]/45 shadow-[0_5px_0_rgba(93,112,67,0.12)] sm:block"
        />

        <section
          aria-labelledby="private-route-blocked-title"
          className="relative z-10 w-full max-w-5xl rounded-[34px] border-2 border-[#d9c49b] bg-[#f7f3df] p-3 shadow-[0_22px_60px_rgba(121,79,39,0.18)] sm:rounded-[44px] sm:p-5"
        >
          <div
            aria-hidden="true"
            className="absolute inset-y-8 left-4 hidden w-3 rounded-full bg-[repeating-linear-gradient(180deg,#d9c49b_0_10px,transparent_10px_22px)] opacity-70 md:block"
          />
          <div
            aria-hidden="true"
            className="absolute inset-x-10 top-0 h-5 rounded-b-[18px] bg-[#f7cd67]/75 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
          />
          <div
            aria-hidden="true"
            className="absolute -right-3 top-24 hidden h-24 w-9 rotate-3 rounded-r-[18px] border-2 border-l-0 border-[#d9c49b] bg-[#fff1ed] shadow-[0_8px_0_rgba(121,79,39,0.08)] lg:block"
          />

          <div className="rounded-[26px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] px-3 py-6 shadow-[inset_0_0_0_6px_rgba(255,255,255,0.42)] sm:rounded-[34px] sm:px-7 sm:py-8 md:pl-10">
            <Card color="default" pattern="app-yellow" className="relative overflow-visible px-4 py-6 sm:px-7 sm:py-8">
              <div
                aria-hidden="true"
                className="absolute -top-4 left-8 h-8 w-28 -rotate-2 rounded-[10px] bg-[#82d5bb]/70 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
              />
              <div
                aria-hidden="true"
                className="absolute -bottom-3 right-10 h-7 w-24 rotate-2 rounded-[10px] bg-[#fff1a8]/80 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
              />

              <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1fr)_290px] lg:items-stretch">
                <div className="min-w-0">
                  <div className="inline-flex max-w-full items-center gap-2 rounded-full border-2 border-[#d9c49b] bg-white/80 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#8a7556] shadow-[0_5px_0_rgba(121,79,39,0.1)]">
                    <Icon name="icon-map" size={22} bounce />
                    <span className="truncate">等待通行</span>
                  </div>

                  <h1 id="private-route-blocked-title" className="sr-only">
                    还没有登上共同小岛
                  </h1>
                  <div className="mt-5 max-w-3xl">
                    <span className="hidden sm:inline-block">
                      <Title size="large" color="app-yellow" className="leading-tight">
                        还没有登上共同小岛
                      </Title>
                    </span>
                    <span className="inline-block sm:hidden">
                      <Title size="middle" color="app-yellow" className="leading-tight">
                        还没有登上共同小岛
                      </Title>
                    </span>
                  </div>

                  <p className="mt-5 max-w-3xl text-base font-bold leading-8 text-[#725d42] sm:text-lg">
                    这个账号还没有被加入 99岛，请确认邮箱是否正确，或让管理员完成初始化。
                  </p>
                  <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-[#8a7556] sm:text-base">
                    如果你刚刚换了邮箱，可以返回登录重新确认。
                  </p>

                  <Divider type="wave-yellow" className="my-6" />

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
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

                  <p className="mt-5 inline-flex items-center gap-2 rounded-full border-2 border-dashed border-[#d9c49b] bg-[#fffdf3]/85 px-4 py-2 text-xs font-black text-[#8a7556] shadow-[0_4px_0_rgba(121,79,39,0.08)]">
                    <ShieldCheck aria-hidden="true" size={15} />
                    仅两人可见 · 私密手账
                  </p>
                </div>

                <aside className="relative flex min-h-[260px] flex-col rounded-[30px] border-2 border-[#d9c49b] bg-[#fffdf3] p-4 shadow-[0_8px_0_rgba(121,79,39,0.1)]">
                  <div className="absolute -top-3 right-8 rotate-3 rounded-full border-2 border-[#d9c49b] bg-[#fff1ed] px-4 py-1 text-xs font-black text-[#9b6c48] shadow-[0_4px_0_rgba(121,79,39,0.08)]">
                    未登岛
                  </div>

                  <div className="rounded-[24px] bg-[#82d5bb] px-4 py-4 text-white shadow-[0_5px_0_#5fb89f]">
                    <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] opacity-90">
                      <Icon name="icon-chat" size={18} bounce />
                      Island Memo
                    </p>
                    <p className="mt-3 text-2xl font-black leading-tight">99岛</p>
                    <p className="mt-1 text-sm font-bold leading-6 text-white/90">正在等待把邮箱写进岛民名册</p>
                  </div>

                  <div className="mt-4 grid flex-1 gap-3">
                    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-[22px] bg-[#f8f8f0] px-4 py-3 text-[#725d42] shadow-[0_3px_0_rgba(121,79,39,0.08)]">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f7cd67] text-[#794f27]">
                        <LockKeyhole aria-hidden="true" size={18} />
                      </span>
                      <span className="min-w-0 text-sm font-black leading-6 text-[#794f27]">
                        登录已完成，账本入口仍需初始化
                      </span>
                    </div>
                    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-[22px] bg-[#f8f8f0] px-4 py-3 text-[#725d42] shadow-[0_3px_0_rgba(121,79,39,0.08)]">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f7cd67] text-[#794f27]">
                        <MailCheck aria-hidden="true" size={18} />
                      </span>
                      <span className="min-w-0 text-sm font-black leading-6 text-[#794f27]">
                        换过邮箱时，可以返回登录重新确认
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 rounded-[22px] border-2 border-dashed border-[#d9c49b] bg-[#fff8da] px-4 py-3 text-xs font-black text-[#8a7556]">
                    <span>Private Notebook</span>
                    <Sparkles aria-hidden="true" size={16} />
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
