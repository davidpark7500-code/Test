#!/bin/bash
# cue: file  src_in  src_out  film_at  gain_dB  fade_in  fade_out
cd /home/user/Test/continue/v2/audio
CUES=(
"cues/c11.mp3 0    36   0     -3   0.5 0"     # 1994: soft synth lullaby
"cues/c21.mp3 0    46.7 34.2  -4   1.5 0"     # 2014-19: driving synth, hard cut on the declined call (80.7)
"cues/c32.mp3 0    21.0 83.5  1    0.5 0"     # hollow -> collapse: clock, organ, stops dead on GAME OVER (104.5)
"cues/c42.mp3 0    31.2 108.0 -16  3   1.5"   # voicemail: barely-there organ
"cues/c52.mp3 0    24   137.7 -2   1.5 0"     # grave: lone reverb guitar
"cues/c61.mp3 0    37   170.0 0    0.3 0"     # CONTINUE: post-rock rebuild
"cues/c72.mp3 0    17   202.0 -2   2   0"     # 2052: the 1994 synth, older
"cues/c81.mp3 0    16.5 220.0 2.5  1.2 2.5"   # finale: guitars + organ + synth together
"cues/c11.mp3 20   36   234.0 -6   2   0"     # final score: the title-screen lullaby returns
)
IN=(); F=""; L=""; i=0
for c in "${CUES[@]}"; do set -- $c
  IN+=(-i "$1"); d=$(echo "$3-$2"|bc); fo=$(echo "$d-$7"|bc); ms=$(echo "$4*1000/1"|bc)
  F+="[$i:a]aresample=44100,aformat=channel_layouts=stereo,atrim=$2:$3,asetpts=PTS-STARTPTS,volume=${5}dB,afade=t=in:d=$6"
  [ "$7" != "0" ] && F+=",afade=t=out:st=$fo:d=$7"
  F+=",adelay=${ms}|${ms}[a$i];"; L+="[a$i]"; i=$((i+1))
done
F+="${L}amix=inputs=$i:normalize=0:dropout_transition=0,apad,atrim=0:250,alimiter=limit=0.89:level=false[o]"
ffmpeg -loglevel error -y "${IN[@]}" -filter_complex "$F" -map "[o]" -c:a libmp3lame -b:a 320k score-v2.mp3
