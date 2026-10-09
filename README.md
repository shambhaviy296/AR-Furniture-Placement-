# AR Furniture Placement (WebAR)

A deployable WebXR app: scan the floor, pick a furniture model, anchor it at true 1:1 scale, then move / rotate / recolour it.
Built with three.js + WebXR. No build step, no app install, no external assets (models are generated in code, in metres).

Maps to the seminar deck:

| Deck concept | Implementation |
|---|---|
| Room scanning / plane detection | WebXR `hit-test` (ARCore), horizontal upward-facing surfaces only |
| Catalog selection | 6 models in `js/furniture.js` (sofa, armchair, coffee table, lamp, bookshelf, bed) |
| Surface anchoring | Reticle + translucent ghost; tap to place; item faces the camera |
| Interactive adjust | Drag to move, two-finger twist / buttons to rotate, colour swatches (re-style) |
| True 1:1 scale | Geometry authored in metres; real dimensions (cm) shown in the UI |
| Light estimation | WebXR `light-estimation` drives the virtual sun (direction, intensity, colour) |
| Shadows | Shadow-catcher plane so shadows fall on the real floor |

## Run locally
```bash
python3 -m http.server 8000
```
Desktop browser: http://localhost:8000 gives a 3D preview (drag to spin).
For real AR on an Android phone (USB debugging on): run `adb reverse tcp:8000 tcp:8000`, then open `http://localhost:8000` in Chrome on the phone. localhost counts as secure, so WebXR works.

## Deploy (HTTPS required for WebXR)
- **GitHub Pages:** push to `main`, then Settings → Pages → Source: GitHub Actions. The included workflow deploys automatically.
- **Netlify / Vercel / Cloudflare Pages:** drag-and-drop or connect the repo. Build command: none. Publish directory: `/`.

## Device support
- Android Chrome with ARCore: full AR.
- Meta Quest Browser: passthrough AR.
- iOS Safari: no WebXR AR, so it falls back to the 3D preview. (Native iOS AR would use ARKit / Quick Look with USDZ.)

## Add your own furniture
Add an entry to `CATALOG` in `js/furniture.js`. Use metres, origin at floor centre, front facing +Z. Wrap tintable materials with `t(shade)`.
(To use real GLB models, load them with `GLTFLoader` and scale to real dimensions.)

## Files
```
index.html      UI shell (dom-overlay root)
style.css
js/main.js      AR session, hit-test, gestures, lighting
js/furniture.js catalog + procedural models
.github/workflows/pages.yml
```
Three.js is loaded from jsDelivr (pinned 0.160.0), so the device needs internet on first load.
