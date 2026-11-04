#!/usr/bin/env bash
# Render a batch of seamless 9:16 loops.  Usage: ./batch.sh batch.txt [ss]
# Each line of batch.txt:  style seed seconds [hook text...]   (lines starting with # are skipped)
set -euo pipefail
cd "$(dirname "$0")"; mkdir -p out
SS="${2:-2}"
while read -r style seed dur hook; do
  [[ -z "${style:-}" || "$style" == \#* ]] && continue
  name="out/${style}-${seed}.mp4"
  [[ -f "$name" ]] && { echo "skip $name"; continue; }
  enc=$(node -e 'console.log(encodeURIComponent(process.argv[1]||""))' "${hook:-}")
  echo "render $name"
  Q="style=$style&seed=$seed&dur=$dur&ss=$SS&hook=$enc" node ../animation-tests/render.js loop.html "$name" "$dur" 30 1080 1920
done < "$1"
