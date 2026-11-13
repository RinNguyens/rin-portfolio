import { useEffect, useRef, useState, type ReactNode } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { ArrowDownIcon, ArrowRightIcon, ArrowUpRightIcon, PlayIcon } from "@phosphor-icons/react"
import { CoastHero } from "@/components/coast-hero"
import { ContributionSkyline } from "@/components/contribution-skyline"
import { GlobeBanner } from "@/components/globe-banner"
import { SiteNav } from "@/components/site-nav"
import { TypescriptLogo } from "@/components/logos/typescript"
import { JavascriptLogo } from "@/components/logos/javascript"
import { ReactLogo } from "@/components/logos/react"
import { NextjsLogo } from "@/components/logos/nextjs"
import { AngularLogo } from "@/components/logos/angular"
import { Html5Logo } from "@/components/logos/html5"
import { CssLogo } from "@/components/logos/css"
import { TailwindcssLogo } from "@/components/logos/tailwindcss"
import { ThreejsLogo } from "@/components/logos/threejs"
import { ReduxLogo } from "@/components/logos/redux"
import { ReactQueryLogo } from "@/components/logos/react-query"
import { PlaywrightLogo } from "@/components/logos/playwright"
import { ViteLogo } from "@/components/logos/vite"
import { WebpackLogo } from "@/components/logos/webpack"
import { GitLogo } from "@/components/logos/git"
import { DockerLogo } from "@/components/logos/docker"
import { NodejsLogo } from "@/components/logos/nodejs"
import { PythonLogo } from "@/components/logos/python"
import { FastapiLogo } from "@/components/logos/fastapi"
import { PostgresqlLogo } from "@/components/logos/postgresql"
import { MongodbLogo } from "@/components/logos/mongodb"
import { PrismaLogo } from "@/components/logos/prisma"
import { RedisLogo } from "@/components/logos/redis"
import { GithubLogo } from "@/components/logos/github"
import { XLogo } from "@/components/logos/x"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useClock } from "@/hooks/use-clock"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/")({ component: Home })

/* ================= content ================= */
const LINKS = [
  { label: "GitHub", href: "https://github.com/RinNguyens", Logo: GithubLogo },
  { label: "X", href: "https://x.com/rinng_ash", Logo: XLogo },
]
const ROLES = ["Senior Software Engineer", "Frontend-heavy, full-stack", "TypeScript · React · Next.js", "Runs on cà phê sữa đá"]
type LogoComponent = (props: { className?: string; title?: string }) => ReactNode
// grouped like the CV's skills; items without a logoforge logo get a lettered tile
const STACK: { name: string; cat: "fe" | "arch" | "tool" | "be"; Logo?: LogoComponent }[] = [
  { name: "TypeScript", cat: "fe", Logo: TypescriptLogo }, { name: "JavaScript", cat: "fe", Logo: JavascriptLogo },
  { name: "React", cat: "fe", Logo: ReactLogo }, { name: "Next.js", cat: "fe", Logo: NextjsLogo },
  { name: "Angular", cat: "fe", Logo: AngularLogo }, { name: "HTML5", cat: "fe", Logo: Html5Logo },
  { name: "CSS", cat: "fe", Logo: CssLogo }, { name: "Tailwind CSS", cat: "fe", Logo: TailwindcssLogo },
  { name: "Three.js", cat: "fe", Logo: ThreejsLogo },
  { name: "Microfrontends", cat: "arch" }, { name: "Single-SPA", cat: "arch" },
  { name: "Redux Toolkit", cat: "arch", Logo: ReduxLogo }, { name: "Zustand", cat: "arch" },
  { name: "TanStack Query", cat: "arch", Logo: ReactQueryLogo },
  { name: "Playwright", cat: "tool", Logo: PlaywrightLogo }, { name: "Vite", cat: "tool", Logo: ViteLogo },
  { name: "Webpack", cat: "tool", Logo: WebpackLogo }, { name: "Git", cat: "tool", Logo: GitLogo },
  { name: "Docker", cat: "tool", Logo: DockerLogo },
  { name: "Node.js", cat: "be", Logo: NodejsLogo }, { name: "Python", cat: "be", Logo: PythonLogo },
  { name: "FastAPI", cat: "be", Logo: FastapiLogo }, { name: "PostgreSQL", cat: "be", Logo: PostgresqlLogo },
  { name: "MongoDB", cat: "be", Logo: MongodbLogo }, { name: "Prisma", cat: "be", Logo: PrismaLogo },
  { name: "Redis", cat: "be", Logo: RedisLogo },
]
type Role = { org: string; mark: string; tint: string; logo?: string; role: string; start: [number, number]; end?: [number, number]; line: string }
const EXPERIENCE: Role[] = [
  { org: "VPBank", mark: "VP", tint: "#00a651", logo: "/assets/logos/vpbank.png", role: "Senior Software Engineer", start: [2026, 9], line: "Joined in September 2026 to build banking software." },
  { org: "Primetech Solutions", mark: "PT", tint: "#0f6f86", role: "Senior Software Engineer", start: [2025, 10], end: [2026, 8], line: "Led frontend for KFLY, an airline booking product, and built an AI ticket-ops tool that halved triage time." },
  { org: "VNGGames", mark: "VNG", tint: "#f26522", logo: "/assets/logos/vnggames.svg", role: "Senior Software Engineer", start: [2022, 6], end: [2025, 9], line: "Built campaign automation and real-time KPI dashboards for game live-ops." },
  { org: "Dirox", mark: "DX", tint: "#6b5bd2", logo: "/assets/logos/dirox.svg", role: "Software Engineer", start: [2021, 6], end: [2022, 5], line: "Frontend for the Idareu charity platform and a virtual watch try-on." },
  { org: "Sutrix Solutions", mark: "SX", tint: "#56605d", logo: "/assets/logos/sutrix.png", role: "Software Engineer", start: [2020, 6], end: [2021, 5], line: "Frontend for GlobeOne, a telecom app with 15M monthly users." },
]
const EDUCATION = [
  ["Hoa Sen University", "Information Technology", "2025 — now"],
  ["University of Science, VNU-HCM", "Information Technology", "2016 — 2021"],
] as const
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const fmtYM = ([y, m]: [number, number]) => `${MONTHS[m - 1]} ${y}`
const PROJECTS = [
  {
    title: "Horsemoon", href: "https://github.com/RinNguyens", kind: "Product · motion design",
    text: "A Vietnamese stock-analysis terminal: sector waves, leading tickers, entry points and discipline. I designed its landing page around motion and a 3D orb hero.",
    tags: ["TanStack Start", "Three.js", "Motion", "Go", "Python"],
    videos: [
      { src: "/assets/work/horsemoon-whiteboard.mp4", poster: "/assets/work/horsemoon-whiteboard.jpg", label: "Whiteboard explainer" },
      { src: "/assets/work/horsemoon-3d.mp4", poster: "/assets/work/horsemoon-3d.jpg", label: "3D orb hero" },
    ],
  },
  { title: "Hi Nha Trang Stay", href: "https://hinhatrangstay.com/", kind: "Web · hospitality", text: "A website for a stay in Nha Trang, built to make browsing rooms and booking simple.", tags: ["Web", "Booking"], cover: "linear-gradient(135deg,#0f6f86,#7fd3c8)" },
  { title: "Globe · GlobeOne", href: "https://www.globe.com.ph/", kind: "Telecom · 15M MAU", text: "Frontend for GlobeOne, Globe Telecom's app: accounts, billing, promotions, rewards and the shared mobile data pool.", tags: ["Frontend", "Telecom"], banner: true },
]

/* ================= small building blocks ================= */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.dataset.in = ""; io.disconnect() } }, { threshold: .12 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return ref
}

function Section({ id, title, idx, right, className, children }: { id?: string; title?: ReactNode; idx?: string; right?: ReactNode; className?: string; children: ReactNode }) {
  const ref = useReveal<HTMLElement>()
  return (
    <section id={id} ref={ref} className={cn("reveal relative px-7 py-10 max-sm:px-4 max-sm:py-8", className)}>
      {title && (
        <div className="mb-5 flex items-baseline justify-between gap-3 max-sm:flex-col max-sm:items-start">
          <h2 className="font-serif text-[34px] leading-[1.05] tracking-tight [&_em]:text-brand">{title}</h2>
          {right ?? <span className="text-xs text-dim">{idx}</span>}
        </div>
      )}
      {children}
    </section>
  )
}

/** Hatched divider with full-bleed rules and + marks where it meets the column. */
function Rule() {
  return (
    <div className="hatch bleed relative h-[34px] border-y" aria-hidden>
      <i className="plus -top-[5px] -left-[5px]" /><i className="plus -top-[5px] -right-[5px]" />
      <i className="-bottom-[5px] -left-[5px] plus" /><i className="plus -right-[5px] -bottom-[5px]" />
    </div>
  )
}

function useTyped(words: readonly string[]) {
  const [text, setText] = useState("")
  useEffect(() => {
    let i = 0, j = 0, del = false, id: ReturnType<typeof setTimeout>
    const tick = () => {
      const w = words[i % words.length]
      setText(w.slice(0, j))
      if (!del && j === w.length) { del = true; id = setTimeout(tick, 1600); return }
      if (del && j === 0) { del = false; i++ }
      j += del ? -1 : 1
      id = setTimeout(tick, del ? 35 : 70)
    }
    tick()
    return () => clearTimeout(id)
  }, [words])
  return text
}

/* ================= page ================= */
function Home() {
  const typed = useTyped(ROLES)
  const clock = useClock("long")
  const [stackFilter, setStackFilter] = useState("all")

  return (
    <>
      <SiteNav />
      <CoastHero />

      <main className="relative mx-auto max-w-[780px] border-x">
        {/* PROFILE */}
        <Section className="pt-0">
          <div className="relative z-[4] -mt-[60px] flex items-end gap-5 max-sm:-mt-[54px] max-sm:flex-col max-sm:items-start max-sm:gap-3">
            <div className="group size-[120px] shrink-0 border border-line-2 bg-card p-2 shadow-[0_14px_34px_rgba(0,0,0,.18)] max-sm:size-24">
              <img src="/assets/rin-avatar.png" alt="Rin's avatar: a cartoon guy tipping his cap" className="size-full bg-[#f4f4f4] object-cover transition-transform duration-500 group-hover:-rotate-3 group-hover:scale-105" />
            </div>
            <div className="min-w-0 flex-1 pb-1.5">
              <h1 className="font-serif text-[50px] leading-none tracking-tight max-sm:text-[40px]">Rin Ng</h1>
              <p className="mt-1.5 min-h-[22px] text-sm text-muted-foreground">{typed}<span className="caret" /></p>
              <Badge variant="outline" className="mt-2 border-ok/40 bg-ok/10 text-ok">
                <span className="size-1.5 rounded-full bg-ok" /> Senior SWE @ VPBank
              </Badge>
            </div>
          </div>
          <dl className="mt-7 grid grid-cols-3 border max-sm:grid-cols-1">
            {[["based in", "Ho Chi Minh City, VN"], ["local time", clock], ["reach me", "rinchan98.py@gmail.com"]].map(([k, v]) => (
              <div key={k} className="border-r px-3.5 py-3 last:border-r-0 max-sm:border-r-0 max-sm:border-b max-sm:last:border-b-0">
                <dt className="text-[11px] tracking-wider text-dim uppercase">{k}</dt>
                <dd className="text-[13px] font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Rule />

        {/* ABOUT */}
        <Section id="about" title="About" idx="01">
          <p className="font-serif text-[27px] leading-[1.25] tracking-tight text-pretty max-sm:text-[23px]">
            Senior Software Engineer at <span className="text-brand">VPBank</span>. For six years I've turned booking flows,
            payment journeys and data-heavy dashboards into products people can <em>rely on</em>.
          </p>
          <p className="mt-4 font-sans text-[15px] leading-relaxed text-muted-foreground">
            TypeScript, React and Next.js up front, Node.js and PostgreSQL behind. Lately I build AI-enabled workflows. Born in Phú Yên, the easternmost point of Vietnam; now based in Ho Chi Minh City.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {LINKS.map(({ label, href, Logo }) => (
              <a key={label} href={href} target="_blank" rel="noopener" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "group/l")}>
                <Logo title="" data-icon="inline-start" className="size-4" />{label} <ArrowUpRightIcon data-icon="inline-end" className="text-dim transition-transform group-hover/l:translate-x-0.5 group-hover/l:-translate-y-0.5 group-hover/l:text-brand" />
              </a>
            ))}
            <a href="#" className={buttonVariants({ size: "lg" })}>Resume <ArrowDownIcon data-icon="inline-end" /></a>
          </div>
        </Section>

        <Rule />

        {/* POSTCARD */}
        <Section id="home" title={<>Postcard from <em>home</em></>} idx="02">
          <div className="grid grid-cols-[1.2fr_1fr] border bg-card max-sm:grid-cols-1">
            <img src="/assets/phu-yen.webp" alt="Mũi Điện lighthouse on a green cliff above the sea, Phú Yên" loading="lazy" className="block size-full min-h-[220px] object-cover" />
            <div className="relative flex flex-col gap-2.5 border-l border-dashed border-line-2 p-5 max-sm:border-t max-sm:border-l-0">
              <div className="absolute top-4 right-4 grid h-16 w-[54px] rotate-6 place-items-center border-2 border-dashed border-brand font-serif text-[24px] text-brand">VN</div>
              <span className="pr-16 text-xs text-dim">Mũi Điện lighthouse, est. 1890</span>
              <p className="pr-16 font-sans text-sm text-muted-foreground">
                The banner above is my hometown rebuilt in WebGL: cliffs, a lighthouse and an ocean you can touch. Switch to <b className="text-foreground">Night</b> and the lighthouse turns on.
              </p>
              <div className="mt-auto grid gap-2.5 text-xs text-dim [&>div]:border-b [&>div]:pb-1">
                <div>to: you, the visitor</div><div>from: Phú Yên, VN</div>
              </div>
            </div>
          </div>
        </Section>

        <Rule />

        {/* STACK */}
        <Section
          id="stack"
          title="Stack"
          right={
            <Tabs value={stackFilter} onValueChange={v => setStackFilter(String(v))}>
              <TabsList variant="line">
                {[["all", "All"], ["fe", "Frontend"], ["arch", "State & Arch"], ["tool", "Tooling"], ["be", "Backend"]].map(([v, l]) => <TabsTrigger key={v} value={v}>{l}</TabsTrigger>)}
              </TabsList>
            </Tabs>
          }
        >
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] border-t border-l">
            {STACK.map(({ name, cat, Logo }) => (
              <span key={name} className={cn("group/t flex items-center gap-3 border-r border-b p-3.5 text-[13px] transition-[opacity,background-color] hover:bg-card", stackFilter !== "all" && stackFilter !== cat && "opacity-20")}>
                {Logo ? (
                  <Logo title="" className="size-5 shrink-0 transition-transform duration-300 group-hover/t:scale-110" />
                ) : (
                  <i aria-hidden className="grid size-5 shrink-0 place-items-center border border-line-2 text-[9px] font-bold text-muted-foreground not-italic">{name.slice(0, 2).toUpperCase()}</i>
                )}
                {name}
              </span>
            ))}
          </div>
        </Section>

        <Rule />

        {/* EXPERIENCE */}
        <Section id="experience" title="Experience" idx="04">
          <ol className="grid">
            {EXPERIENCE.map((x, i) => (
              <li key={x.org} className="relative grid grid-cols-[40px_1fr] gap-x-4 pb-7 last:pb-0 max-sm:grid-cols-[36px_1fr] max-sm:gap-x-3">
                {i < EXPERIENCE.length - 1 && <span aria-hidden className="absolute top-11 bottom-1 left-[19.5px] w-px bg-line-2 max-sm:top-10 max-sm:left-[17.5px]" />}
                {x.logo ? (
                  <span className="grid size-10 place-items-center border bg-white p-1.5 max-sm:size-9">
                    <img src={x.logo} alt={`${x.org} logo`} className="size-full object-contain" />
                  </span>
                ) : (
                  <span aria-hidden className="grid size-10 place-items-center border text-[11px] font-bold text-white max-sm:size-9 max-sm:text-[10px]" style={{ background: x.tint }}>
                    {x.mark}
                  </span>
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <h3 className="text-[15px] font-semibold">
                      {x.org}
                      {!x.end && <Badge variant="outline" className="ml-2 border-brand/40 bg-brand/10 align-middle text-brand">Now</Badge>}
                    </h3>
                    <span className="text-xs text-dim">{fmtYM(x.start)} — {x.end ? fmtYM(x.end) : "Present"}</span>
                  </div>
                  <div className="text-[13px] text-muted-foreground">{x.role}</div>
                  <p className="mt-1.5 flex gap-2.5 font-sans text-sm text-muted-foreground before:shrink-0 before:text-brand before:content-['—']">{x.line}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-10 grid grid-cols-2 border-t border-l max-sm:grid-cols-1">
            {EDUCATION.map(([school, field, when]) => (
              <div key={school} className="border-r border-b px-3.5 py-3">
                <div className="text-[11px] tracking-wider text-dim uppercase">Education · {when}</div>
                <div className="mt-1 text-[13px] font-medium">{school}</div>
                <div className="text-xs text-muted-foreground">{field}</div>
              </div>
            ))}
          </div>
        </Section>

        <Rule />

        {/* WORK */}
        <Section id="work" title={<>Selected <em>work</em></>} idx="05">
          <div className="grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
            {PROJECTS.map((p, i) => (
              <article key={p.title} className={cn("group flex flex-col overflow-hidden border bg-card transition-[border-color,translate] duration-300 hover:-translate-y-[3px] hover:border-line-2", i === 0 && "col-span-2 max-sm:col-span-1")}>
                {p.videos ? (
                  <div className="grid grid-cols-2 gap-px bg-border max-sm:grid-cols-1">
                    {p.videos.map(v => (
                      <figure key={v.src} className="relative aspect-[16/10] overflow-hidden bg-black">
                        <video src={v.src} poster={v.poster} autoPlay muted loop playsInline preload="metadata" className="size-full object-cover" />
                        <figcaption className="absolute bottom-2 left-2 inline-flex items-center gap-1 bg-black/60 px-1.5 py-0.5 text-[11px] text-white backdrop-blur">
                          <PlayIcon weight="fill" className="size-3" />{v.label}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                ) : p.banner ? (
                  <a href={p.href} target="_blank" rel="noopener" className="block aspect-[16/10]"><GlobeBanner /></a>
                ) : (
                  <a href={p.href} target="_blank" rel="noopener" className="relative grid aspect-[16/10] place-items-center overflow-hidden text-white" style={{ background: p.cover }}>
                    <span className="font-serif text-[clamp(26px,4vw,40px)] leading-none tracking-tight transition-transform duration-500 group-hover:scale-105">{p.title}</span>
                    <span className="absolute bottom-3 left-3 text-[11px] opacity-80">{p.href.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</span>
                  </a>
                )}
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-base font-semibold">{p.title}</h3>
                    <span className="text-[11px] text-dim">{p.kind}</span>
                  </div>
                  <p className="font-sans text-[13.5px] text-muted-foreground">{p.text}</p>
                  <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1.5">
                    {p.tags.map(t => <Badge key={t} variant="outline" className="text-muted-foreground">{t}</Badge>)}
                    <a href={p.href} target="_blank" rel="noopener" className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-brand">Visit <ArrowUpRightIcon className="size-3.5" /></a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </Section>

        <Rule />

        {/* ACTIVITY */}
        <Section id="activity" title="Activity" idx="06">
          <ContributionSkyline />
        </Section>

        <Rule />

        {/* CONTACT */}
        <Section id="contact" className="py-[76px] text-center">
          <h2 className="font-serif text-[50px] leading-none tracking-tight max-sm:text-[38px]">Let's make something <em className="text-brand">lovely</em>.</h2>
          <p className="mx-auto mt-3 mb-7 max-w-[420px] font-sans text-muted-foreground">I'm always happy to talk about new projects, roles, or ideas that aren't fully formed yet.</p>
          <a href="mailto:rinchan98.py@gmail.com" className={buttonVariants({ size: "lg" })}>Email Rin <ArrowRightIcon data-icon="inline-end" /></a>
        </Section>

        <Rule />

        <footer className="px-7 pt-8 pb-10 text-center max-sm:px-4">
          <p className="font-serif text-[22px] text-muted-foreground italic">“The sun rises here first. So can good work.”</p>
          <p className="mt-2 text-[11px] tracking-widest text-dim">— RIN NG</p>
          <div className="mt-8 flex justify-between text-[11px] text-dim"><span>© 2026 Rin Ng</span><span>Designed & built in Ho Chi Minh City</span></div>
        </footer>
      </main>
    </>
  )
}
