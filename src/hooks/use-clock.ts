import { useEffect, useState } from "react"

const fmt = {
  short: new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" }),
  long: new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", second: "2-digit" }),
}

/** Live Phú Yên (ICT) time. Renders a placeholder on the server so hydration matches. */
export function useClock(kind: keyof typeof fmt) {
  const [now, setNow] = useState<string | null>(null)
  useEffect(() => {
    const tick = () => setNow(fmt[kind].format(new Date()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [kind])
  return now ?? (kind === "short" ? "--:--" : "--:--:--")
}
