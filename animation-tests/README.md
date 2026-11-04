# Animation capability tests

Three short 1080p/30fps videos, each pushing a different kind of code-only animation. They use no 3D engine, no assets and no keyframing tools: every pixel comes from shader or canvas code in a single HTML file.

| # | File | Technique | What it stresses |
|---|---|---|---|
| 01 | `01-raymarch.html` → `01-raymarch.mp4` (14s) | GLSL raymarched signed-distance fields | 3D maths without meshes: SDF morphing (sphere → twisted box → gyroid shell → metaballs), soft shadows, AO, one-bounce reflections, GGX highlights, fog, ACES tonemap, 2× supersampling |
| 02 | `02-fluid.html` → `02-fluid.mp4` (16s) | GPU Navier–Stokes on WebGL2 float textures | Physically simulated motion: advection, vorticity confinement, 24-iteration Jacobi pressure solve, scripted emitters in four acts |
| 03 | `03-particles.html` → `03-particles.mp4` (15s) | 100k particles, positions computed in the vertex shader | Choreography at scale: staggered sweep transitions through a curl-like flow field, true 6-sample motion blur, two-layer bloom |

## Re-rendering
```
node render.js <page.html> <out.mp4> <seconds> [fps] [w] [h]
Q=ss=2 node render.js 01-raymarch.html 01-raymarch.mp4 14 30 1920 1080
```
`render.js` drives headless Chromium frame by frame (deterministic, not real-time capture) and pipes PNGs into ffmpeg (x264, CRF 16). Each HTML file also opens in a browser, but it only renders when `window.__render(t)` is called.

## Known limits
- There's no audio in these three.
- Rendering here ran on CPU (SwiftShader). On a real GPU the same shaders run in real time.
- Quality was checked from sampled stills, not by watching the motion, so pacing and timing are the least-verified part.
