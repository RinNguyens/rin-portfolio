import { useEffect, useState } from "react"
import { MoonIcon, SunHorizonIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const SECTIONS = ["top", "about", "home", "stack", "experience", "work", "activity", "contact"] as const
const LABEL: Record<(typeof SECTIONS)[number], string> = { top: "overview", about: "about", home: "home", stack: "stack", experience: "experience", work: "work", activity: "activity", contact: "contact" }

/** Sunrise ↔ Night. The 3D scene reads the same `dark` class on <html>. */
function useNight() {
  const [night, setNight] = useState(false)
  useEffect(() => setNight(document.documentElement.classList.contains("dark")), [])
  const toggle = () => {
    const next = !night
    document.documentElement.classList.toggle("dark", next)
    try { localStorage.setItem("rin-time", next ? "dark" : "light") } catch { /* private mode */ }
    setNight(next)
  }
  return [night, toggle] as const
}

export function SiteNav() {
  const [solid, setSolid] = useState(false)
  const [active, setActive] = useState<string>("top")
  const [night, toggleNight] = useNight()

  useEffect(() => {
    const onScroll = () => {
      const hero = document.getElementById("top")
      setSolid(window.scrollY > (hero?.offsetHeight ?? 600) - 80)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    const spy = new IntersectionObserver(
      es => es.forEach(e => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-45% 0px -50% 0px" },
    )
    SECTIONS.forEach(id => { const el = document.getElementById(id); if (el) spy.observe(el) })
    return () => { window.removeEventListener("scroll", onScroll); spy.disconnect() }
  }, [])

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 border-b border-transparent transition-colors duration-300",
          solid && "border-border bg-background/80 backdrop-blur-md",
        )}
      >
        <div className="mx-auto flex h-14 max-w-[780px] items-center justify-between px-5 max-sm:px-3">
          <a href="#top" className={cn("flex items-center gap-2 font-serif text-[26px] leading-none transition-colors", solid ? "text-foreground" : "text-white [text-shadow:0_1px_12px_rgba(0,0,0,.35)]")}>
            Rin Ng
          </a>
          <nav className="flex items-center gap-0.5">
            {[["about", "About"], ["work", "Work"], ["contact", "Contact"]].map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className={cn("px-2.5 py-1.5 text-[13px] transition-colors hover:bg-muted/40 max-sm:[&:not([href='#work'])]:hidden", solid ? "text-muted-foreground hover:text-foreground" : "text-white/85 hover:text-white")}
              >
                {label}
              </a>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleNight}
              aria-label="Switch between sunrise and night"
              className={cn("ml-2", !solid && "border-white/25 bg-black/45 text-white backdrop-blur hover:bg-black/60 hover:text-white")}
            >
              {night ? <MoonIcon weight="fill" data-icon="inline-start" /> : <SunHorizonIcon weight="fill" data-icon="inline-start" className="text-amber-400" />}
              {night ? "Night" : "Sunrise"}
            </Button>
          </nav>
        </div>
      </header>

      <aside
        className={cn(
          "fixed top-1/2 left-[calc(50%-390px-150px)] z-40 hidden w-[120px] -translate-y-1/2 flex-col gap-1.5 text-right text-xs transition-opacity duration-300 min-[1120px]:flex",
          solid ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        {SECTIONS.map(id => (
          <a key={id} href={`#${id}`} className={cn("transition-colors", active === id ? "text-foreground" : "text-dim hover:text-muted-foreground")}>
            {LABEL[id]}
            {active === id && <span className="ml-1 align-middle text-[8px] text-brand">●</span>}
          </a>
        ))}
      </aside>
    </>
  )
}
