# Rin Ng — First Light

Personal portfolio of Rin Ng (Nguyễn Văn Rin), live at **https://rinchan.xyz**.

The hero is a WebGL rebuild of Mũi Điện, Phú Yên (the easternmost point of Vietnam): shader ocean, clickable ripples, fishing boats and a sunrise/night cycle.

## Stack

TanStack Start · React 19 · Tailwind CSS v4 · shadcn/ui (base-lyra) · three.js · logoforge logos

## Develop

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm build        # static prerender → dist/client
```

Deploy: `pnpm deploy:pages` builds and publishes `dist/client` to the `gh-pages` branch (served by GitHub Pages at rinchan.xyz).

The loading posters in `public/assets/coast-*.webp` are frames of the 3D scene. After changing the scene, regenerate them in dev with `window.__coastPoster(w, h, fov)`.
