import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"

type Day = { date: string; count: number; level: 0 | 1 | 2 | 3 | 4 }
const USER = "RinNguyens"
const LEVEL_BG = ["bg-muted", "bg-sea/30", "bg-sea/55", "bg-sea/80", "bg-sea"]
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** Public contributions for the last year (GitHub's calendar, via the community jogruber API). */
async function loadContributions(): Promise<Day[]> {
  const r = await fetch(`https://github-contributions-api.jogruber.de/v4/${USER}?y=last`)
  if (!r.ok) throw new Error(String(r.status))
  return ((await r.json()) as { contributions: Day[] }).contributions
}

const fmtDay = (d: string, year = true) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(year && { year: "numeric" }) })

/** GitHub-style calendar. Cells sweep in week by week; the busiest days keep a soft glow. */
export function ContributionSkyline() {
  const ref = useRef<HTMLDivElement>(null)
  const [days, setDays] = useState<Day[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [shown, setShown] = useState(false)
  const [tip, setTip] = useState<{ x: number; y: number; d: Day } | null>(null)

  useEffect(() => { loadContributions().then(setDays).catch(() => setFailed(true)) }, [])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect() } }, { threshold: .3 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const view = useMemo(() => {
    if (!days?.length) return null
    const lead = new Date(days[0].date).getDay()                 // pad so columns start on Sunday
    const cells: (Day | null)[] = [...Array<null>(lead).fill(null), ...days]
    const weeks = Math.ceil(cells.length / 7)
    const months: { col: number; label: string }[] = []
    for (let w = 0; w < weeks; w++) {
      const d = cells[w * 7] ?? cells[w * 7 + 6]
      if (!d) continue
      const m = MONTHS[new Date(d.date).getMonth()]
      if (!months.length || months[months.length - 1].label !== m) months.push({ col: w, label: m })
    }
    const sorted = days.map(d => d.count).filter(Boolean).sort((a, b) => b - a)
    const hot = sorted.length ? sorted[Math.min(sorted.length - 1, 6)] : Infinity   // ~top 7 days glow
    let streak = 0, run = 0
    days.forEach(d => { run = d.count ? run + 1 : 0; streak = Math.max(streak, run) })
    const best = days.reduce((a, d) => (d.count > a.count ? d : a), days[0])
    return { cells, months, hot, streak, best, total: days.reduce((a, d) => a + d.count, 0) }
  }, [days])

  return (
    <div ref={ref}>
      <div className="relative border bg-card p-4 max-sm:p-3">
        {!view ? (
          <p className="grid h-[150px] place-items-center text-xs text-dim">{failed ? "couldn't reach GitHub right now" : "loading contributions…"}</p>
        ) : (
          <div className="overflow-x-auto pb-1" onMouseLeave={() => setTip(null)}>
            <div className="mx-auto grid w-max grid-cols-[auto_1fr] gap-x-2">
              <span />
              <div className="relative mb-1.5 h-3 text-[10px] text-dim">
                {view.months.map(m => <span key={m.col} className="absolute" style={{ left: m.col * 12.5 }}>{m.label}</span>)}
              </div>
              <div className="grid grid-rows-7 gap-[2.5px] text-[10px] leading-[10px] text-dim">
                {["", "Mon", "", "Wed", "", "Fri", ""].map((l, i) => <span key={i}>{l}</span>)}
              </div>
              <div className="grid grid-flow-col grid-rows-7 gap-[2.5px]">
                {view.cells.map((d, i) => {
                  const week = Math.floor(i / 7), hot = !!d && d.count >= view.hot
                  return (
                    <i
                      key={i}
                      className={cn(
                        "relative size-[10px] transition-[opacity,scale] duration-500 ease-out",
                        d ? LEVEL_BG[d.level] : "invisible",
                        d && "outline outline-1 -outline-offset-1 outline-black/5 hover:outline-foreground dark:outline-white/5",
                        shown ? "scale-100 opacity-100" : "scale-0 opacity-0",
                        hot && shown && "hot-cell",
                      )}
                      style={{ transitionDelay: `${week * 18 + (i % 7) * 12}ms`, animationDelay: `${1200 + (i % 9) * 260}ms` }}
                      onMouseEnter={e => {
                        const host = ref.current
                        if (!d || !host) return
                        const r = e.currentTarget.getBoundingClientRect(), h = host.getBoundingClientRect()
                        setTip({ x: r.left - h.left + r.width / 2, y: r.top - h.top, d })
                      }}
                    />
                  )
                })}
              </div>
            </div>
          </div>
        )}
        {tip && (
          <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full border bg-popover px-2 py-1 text-[11px] whitespace-nowrap shadow" style={{ left: tip.x, top: tip.y - 6 }}>
            <b>{tip.d.count || "No"}</b> contribution{tip.d.count === 1 ? "" : "s"} · {fmtDay(tip.d.date)}
          </div>
        )}
        <div className="mt-3 flex items-center justify-end gap-1 text-[10px] text-dim">
          less {LEVEL_BG.map(c => <i key={c} className={cn("size-[11px]", c)} />)} more
        </div>
      </div>

      <dl className="grid grid-cols-3 border-x border-b max-sm:grid-cols-1">
        {[
          ["last 12 months", view ? `${view.total.toLocaleString("en")} contributions` : "—"],
          ["busiest day", view ? `${view.best.count} · ${fmtDay(view.best.date, false)}` : "—"],
          ["longest streak", view ? `${view.streak} days` : "—"],
        ].map(([k, v]) => (
          <div key={k} className="border-r px-3.5 py-2.5 last:border-r-0 max-sm:border-r-0 max-sm:border-b max-sm:last:border-b-0">
            <dt className="text-[11px] tracking-wider text-dim uppercase">{k}</dt>
            <dd className="text-[13px] font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <a href={`https://github.com/${USER}`} target="_blank" rel="noopener" className="mt-2 inline-block text-[11px] text-dim hover:text-foreground">github.com/{USER} ↗</a>
    </div>
  )
}
