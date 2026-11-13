import { useEffect, useRef, useState } from "react"
import { useClock } from "@/hooks/use-clock"

type SceneState = "loading" | "ready" | "fallback"

// kick off the (large) three.js chunk immediately on the client
const sceneModule = typeof window === "undefined" ? null : import("@/lib/coast-scene")

/** Full-bleed hero: the WebGL rebuild of Mũi Điện, with the photo as a no-WebGL fallback. */
export function CoastHero() {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [state, setState] = useState<SceneState>("loading")
  const [touched, setTouched] = useState(false)
  const time = useClock("short")

  useEffect(() => {
    const host = hostRef.current, canvas = canvasRef.current
    if (!host || !canvas) return
    let dispose: (() => void) | undefined
    let cancelled = false
    // CDN-free, but a slow GPU or blocked WebGL should still end on something pretty
    const timer = setTimeout(() => setState(s => (s === "loading" ? "fallback" : s)), 12000)
    ;(sceneModule ?? import("@/lib/coast-scene"))
      .then(({ createCoastScene }) => {
        if (cancelled) return
        dispose = createCoastScene({ host, canvas, onReady: () => setState("ready"), onInteract: () => setTouched(true) })
        clearTimeout(timer)   // the scene exists; it shows on its first frame
      })
      .catch(() => setState("fallback"))
    return () => { cancelled = true; clearTimeout(timer); dispose?.() }
  }, [])

  return (
    <div
      id="top"
      ref={hostRef}
      data-state={state}
      aria-label="3D scene of Mui Dien lighthouse in Phu Yen, Vietnam"
      className="scene-bg relative h-[420px] overflow-hidden border-b"
    >
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 block size-full cursor-grab touch-pan-y transition-opacity duration-700 active:cursor-grabbing ${state === "ready" ? "opacity-100" : "opacity-0"}`}
      />
      <div className="scene-scrim pointer-events-none absolute inset-0 z-[2]" />
      <div className="pointer-events-none absolute inset-0 z-[2] mx-auto max-w-[780px] border-x border-white/20" />

      <div className="pointer-events-none absolute inset-x-0 top-[68px] z-[3] mx-auto flex max-w-[780px] justify-between px-5 text-xs text-white [text-shadow:0_1px_8px_rgba(0,0,0,.45)]">
        <span>MŨI ĐIỆN · PHÚ YÊN</span>
        <span className="max-sm:hidden">12°53′N 109°27′E · {time} ICT</span>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-1/2 z-[3] mx-auto max-w-[780px] -translate-y-1/2 px-5 text-white">
        <h2 className="font-serif text-[clamp(44px,7vw,84px)] leading-[.88] tracking-tight [text-shadow:0_2px_30px_rgba(0,0,0,.25)]">
          First
          <br />
          <em className="text-[#ffe2b8] dark:text-[#dfe6ff]">light.</em>
        </h2>
        <p className="mt-2.5 max-w-[340px] text-xs leading-normal opacity-90 [text-shadow:0_1px_8px_rgba(0,0,0,.45)]">
          I'm from the easternmost point of Vietnam, the first place the sun reaches each morning.
        </p>
      </div>

      <div
        className={`pointer-events-none absolute right-4 bottom-[64px] z-[3] border border-white/20 bg-black/55 px-2.5 py-1.5 text-xs text-white backdrop-blur transition-opacity duration-500 md:right-[max(1.25rem,calc(50%-370px))] ${touched ? "opacity-0" : ""}`}
      >
        <span className="max-sm:hidden">drag to look around · click the sea · double-click to reset</span><span className="sm:hidden">drag · tap the sea</span>
      </div>

      <div className="scene-fade pointer-events-none absolute inset-x-0 bottom-0 h-[72px]" />
    </div>
  )
}
