import { useEffect, useState } from "react"

const BASE = 2000
// The site is static (GitHub Pages), so the shared count lives in Abacus, a free counter API.
const API = "https://abacus.jasoncameron.dev"
const COUNTER = "rinchan.xyz/views"
const SEEN = "rin:view-counted"

let request: Promise<number> | undefined // shared so a re-mount never counts twice

function load() {
  let seen = false
  try {
    seen = sessionStorage.getItem(SEEN) === "1"
    sessionStorage.setItem(SEEN, "1")
  } catch {
    /* storage blocked: count the visit anyway */
  }
  // one +1 per browser session; reloads only read the current value
  return fetch(`${API}/${seen ? "get" : "hit"}/${COUNTER}`)
    .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((d: { value: number }) => BASE + d.value)
}

/** Total site views: 2,000 plus one per visit. Null until loaded (or if the counter is unreachable). */
export function useVisitorCount() {
  const [count, setCount] = useState<number | null>(null)
  useEffect(() => {
    let alive = true
    request ??= load()
    request.then(n => alive && setCount(n)).catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  return count
}
