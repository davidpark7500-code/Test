#!/usr/bin/env bash
# Render a batch of seamless 9:16 loops, 4 at a time, resumable (rerun to continue).
# Usage: ./batch.sh batch.txt [supersampling=2]
# Each line of batch.txt:  style seed seconds [hook text...]   (lines starting with # are skipped)
cd "$(dirname "$0")"; mkdir -p out/frames
SS="${2:-2}"
one() {
  local style=$1 seed=$2 dur=$3; shift 3; local hook="$*"
  local name="out/${style}-${seed}.mp4"; [[ -f "$name" ]] && { echo "skip $name"; return; }
  local enc; enc=$(node -e 'console.log(encodeURIComponent(process.argv[1]||""))' "$hook")
  local fr="out/frames/${style}-${seed}/"
  Q="style=$style&seed=$seed&dur=$dur&ss=$SS&hook=$enc" node ../animation-tests/render.js loop.html "$fr" "$dur" 30 1080 1920 > "out/frames/${style}-${seed}.log" 2>&1
  local n=$(ls "$fr"*.jpg 2>/dev/null | wc -l); local want=$(( dur * 30 ))
  [[ "$n" -eq "$want" ]] || { echo "incomplete $name ($n/$want)"; return; }
  ffmpeg -v error -y -framerate 30 -i "$fr%05d.jpg" -c:v libx264 -preset slow -crf 19 -maxrate 14M -bufsize 28M -pix_fmt yuv420p -movflags +faststart "$name" && echo "done $name"
}
export -f one; export SS
# one NUL-separated line per job, passed as a single argument so quotes/apostrophes in hooks survive
grep -v '^\s*#' "$1" | grep -v '^\s*$' | tr '\n' '\0' | \
  xargs -0 -P 4 -n 1 bash -c 'read -r st sd du hk <<< "$1"; one "$st" "$sd" "$du" "$hk"' _
