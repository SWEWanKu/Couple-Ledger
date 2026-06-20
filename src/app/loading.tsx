export default function RouteLoading() {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="flex min-h-screen items-center justify-center bg-[#7DC395] px-4 text-center text-[#794f27]"
      style={{
        fontFamily:
          'Nunito, "Noto Sans SC", -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif'
      }}
    >
      <div className="rounded-[28px] border-[5px] border-[#e3bd74] bg-[#f8f8f0] px-6 py-5 shadow-[0_10px_0_rgba(93,112,67,0.24)]">
        <p className="text-lg font-black">小岛账本</p>
        <p className="mt-2 text-sm font-bold text-[#725d42]">正在准备小岛...</p>
      </div>
    </main>
  );
}
