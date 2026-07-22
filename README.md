# Viewall ARt

**Make printed art come alive.** Point a phone at a poem, painting, poster, card or book page — and 3D models, sound, motion graphics and touchable links rise from it. A free, open alternative to the expensive, quota-limited AR services that have priced artists out of their own work.

> © Sean Fortune · OLP (One Legged Publishing). Licensed under **AGPL-3.0** — free to use, modify and share; if you build on it or run it as a service, your source must stay open too.

---

## What it is

Two parts, one codebase, no backend, no lock-in:

- **Builder** — a visual, canvas-style editor. Load a trigger image, work in layers (one per content type), place up to **10 elements** (text, image, 3D/`.glb`, sound, link, phone, email), position/scale/rotate them, set each to **click** or **drag**, then **Publish** a self-contained package.
- **Viewer** — opens the phone camera, recognises the printed image, and plays the anchored content with tap and drag interactivity.

Built with [MindAR](https://github.com/hiukim/mind-ar-js) (image tracking), [Three.js](https://threejs.org) (rendering), [Konva](https://konvajs.org) (editor canvas) and [Vite](https://vitejs.dev). Recognition data is compiled **in the browser** — nothing is uploaded to a server.

## Run from source

```bash
cd app
npm install
npm run dev        # landing page; also /builder.html and /viewer.html
```

Build a static site:

```bash
npm run build      # → dist/
```

The camera needs **HTTPS or localhost**. To test the Viewer on a phone, host `dist/` on any static host (see below).

## Authoring workflow

1. **Builder** → *Trigger image…* → load a well-lit, detailed image (posters, cards, pages all work; plain paragraph text tracks poorly — use a distinctive layout).
2. Add elements, position them on the canvas, set interactions in the Properties panel.
3. **Publish** → downloads a `*_AR.zip` containing `index.html` (the viewer), `experience.json`, `targets.mind` and your assets — ready to host anywhere static.

## Data format

Projects and published experiences use a simple JSON schema (`public/experience.json`): normalized (0–1) element coordinates relative to the trigger image, with `heightRatio` and `realWidthCm` for scale, and per-element `z` (height above the page) and `scale`. See `src/elements.js` for element types and defaults.

## Hosting the Viewer permanently

Any static host works (GitHub Pages, Netlify, Cloudflare Pages). This repo deploys `dist/` to **GitHub Pages**. Because the camera requires HTTPS, a hosted link is the reliable way to use the Viewer on phones — no local machine required.

## Roadmap

- **Phase 1 (done):** image-anchored AR — content pinned to the visible printed image, can float large in 3D above it.
- **Phase 2 (planned):** world/wall tracking so content stays fixed in a room ("art from blank walls"). Needs WebXR (Android) or a native app / 8th Wall for iOS, since iOS Safari has no WebXR.
- Video element type; multiple trigger images per project; richer interactions.

## Contributing

Issues and pull requests welcome. By contributing you agree your contributions are licensed under AGPL-3.0.

## Licence

[GNU AGPL-3.0](./LICENSE). © Sean Fortune, OLP (One Legged Publishing).
