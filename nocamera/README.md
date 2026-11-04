# No Camera: loop generator

`loop.html` makes seamless 9:16 loops (frame 0 == last frame + 1) in three styles, each varied by a seed:

| style | what it is |
|---|---|
| `ink` | domain-warped noise "liquid marble"; time travels on a circle through the noise so it loops |
| `chrome` | raymarched chrome object morphing between two seeded shapes, studio-lit |
| `particles` | 120k particles morphing between two seeded shapes and back, with motion blur |

Preview in a browser: open `loop.html?style=ink&seed=21` (it renders a frame when `__render(t)` is called; use the batch to export).

Render a batch: edit `batch.txt`, then `./batch.sh batch.txt` → MP4s in `out/`. On a machine with a real GPU this takes minutes; in the cloud container it is CPU-only and slow.
