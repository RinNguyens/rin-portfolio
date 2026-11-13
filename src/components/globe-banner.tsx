/** Illustrated cover for the GlobeOne project: brand blue, a phone with the shared-data pool screen. */
export function GlobeBanner() {
  return (
    <div className="relative size-full overflow-hidden bg-[radial-gradient(120%_90%_at_15%_10%,#3d7bff_0%,#1238c9_45%,#071a6b_100%)]">
      {/* orbit lines */}
      <svg aria-hidden className="absolute inset-0 size-full opacity-40" viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice">
        {[60, 95, 130, 165].map(r => <ellipse key={r} cx="300" cy="150" rx={r * 1.35} ry={r * .55} fill="none" stroke="#9cc0ff" strokeWidth=".6" transform="rotate(-18 300 150)" />)}
        {[[180, 92], [372, 118], [250, 214], [330, 60]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.2" fill="#cfe0ff" />)}
      </svg>

      <div className="absolute top-5 left-5 text-white max-sm:top-4 max-sm:left-4">
        <div className="font-serif text-[clamp(26px,4vw,38px)] leading-none tracking-tight">GlobeOne</div>
        <div className="mt-1.5 text-[11px] opacity-80">Globe Telecom · 15M monthly users</div>
      </div>

      {/* phone */}
      <div className="absolute right-[12%] -bottom-[18%] w-[34%] min-w-[118px] rotate-[8deg] transition-transform duration-500 group-hover:rotate-[4deg] group-hover:-translate-y-2">
        <div className="rounded-[22px] bg-[#0b1020] p-[5px] shadow-[0_24px_50px_rgba(0,0,30,.45)]">
          <div className="overflow-hidden rounded-[18px] bg-white">
            <div className="flex items-center justify-between bg-[#1238c9] px-3 pt-3 pb-6 text-white">
              <span className="text-[8px] font-bold">Data Pool</span><span className="text-[7px] opacity-80">Family</span>
            </div>
            <div className="-mt-4 px-2.5 pb-3">
              <div className="rounded-lg bg-white p-2 shadow-[0_4px_14px_rgba(0,0,0,.12)]">
                <div className="mx-auto grid aspect-square w-[62%] place-items-center rounded-full bg-[conic-gradient(#1238c9_0_68%,#ffc72c_68%_84%,#e6ebf5_84%)]">
                  <div className="grid size-[72%] place-items-center rounded-full bg-white text-center">
                    <div className="text-[11px] leading-none font-bold text-[#0b1020]">24.6<span className="text-[7px]">GB</span></div>
                    <div className="text-[6px] text-[#6b7280]">shared left</div>
                  </div>
                </div>
              </div>
              {[["You", "#1238c9", "62%"], ["Mom", "#ffc72c", "38%"], ["Ben", "#7aa2ff", "20%"]].map(([n, c, w]) => (
                <div key={n} className="mt-1.5 flex items-center gap-1.5">
                  <span className="size-3 shrink-0 rounded-full" style={{ background: c }} />
                  <div className="h-1 flex-1 rounded bg-[#e6ebf5]"><div className="h-full rounded" style={{ width: w, background: c }} /></div>
                  <span className="w-5 text-[6px] text-[#6b7280]">{n}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
