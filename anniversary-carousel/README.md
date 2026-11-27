# Anniversary carousel (2015 → 2026)

`build.py` renders a 5-slide animated Instagram carousel (1080x1350 MP4 plus a PNG fallback per slide) from two photos.

    python3 build.py photo_2015.jpg photo_2026.jpg output

`build_road.py` renders the seamless "car drives across the slides" version into `output_road/`.

`output/` and `output_road/` are git-ignored so family photos never get pushed. Fonts are Playfair Display and Inter (SIL OFL).
