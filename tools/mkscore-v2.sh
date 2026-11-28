#!/bin/bash
# Builds continue/v2/audio/score-v2.mp3 from the cues in audio/cues. Every change is a crossfade or a dip, never a hard stop.
# cue: file  src_in  src_out  film_at  gain_dB  fade_in  fade_out
cd "$(dirname "$0")/../continue/v2/audio"
CUES=(
"cues/c11.mp3 0  36   0     -3  0.5 0"    # 1994: soft synth lullaby
"cues/c21.mp3 0  49   33.0  -4  2   3.7"  # 2014-19 (leads the cut by a beat): driving synth; dips under the phone, fades out over the declined call
"cues/c12.mp3 0  14   80.2  -8  3   3"    # recital: the lullaby again, quiet, growing out of the synth's fade
"cues/c32.mp3 9  25   92.0  1   2.5 2"    # collapse: clock + organ build, settles on its own over GAME OVER
"cues/c41.mp3 0  34   104.5 -4  2   0"    # couch / voicemail: organ swells back up as the scene opens
"cues/c51.mp3 0  24   136.8 -5  2   0"    # grave: lone reverb guitar
"cues/c42.mp3 2  16   157.0 -20 3   2"    # countdown: faint organ bed under the heartbeat
"cues/c61.mp3 0  37   170.0 0   0.3 0"    # CONTINUE: post-rock rebuild
"cues/c72.mp3 0  17   202.0 -2  2.5 0"    # 2052: the 1994 synth, older
"cues/c81.mp3 0  19.5 217.5 2.5 3   4"    # finale: swells in under 'Kiddo', guitars + organ + synth
"cues/c11.mp3 20 36   234.0 -6  3   0"    # final score: the title-screen lullaby returns
)
# dips (film time): start end dB ramp
DUCKS="43.9 45.0 -6 0.3;76.6 80.7 -10 0.6"
IN=(); F=""; L=""; i=0
for c in "${CUES[@]}"; do set -- $c
  IN+=(-i "$1"); d=$(echo "$3-$2"|bc); fo=$(echo "$d-$7"|bc); ms=$(echo "$4*1000/1"|bc)
  F+="[$i:a]aresample=44100,aformat=channel_layouts=stereo,atrim=$2:$3,asetpts=PTS-STARTPTS,volume=${5}dB,afade=t=in:d=$6"
  [ "$7" != "0" ] && F+=",afade=t=out:st=$fo:d=$7"
  F+=",adelay=${ms}|${ms}[a$i];"; L+="[a$i]"; i=$((i+1))
done
E="0"; IFS=';' read -ra DS <<< "$DUCKS"; for d in "${DS[@]}"; do set -- $d; E+="+($3)*clip(min((t-$1+$4)/$4\,($2+$4-t)/$4)\,0\,1)"; done
F+="${L}amix=inputs=$i:normalize=0:dropout_transition=0,apad,atrim=0:250,volume=volume='pow(10\,($E)/20)':eval=frame,alimiter=limit=0.89:level=false[o]"
ffmpeg -loglevel error -y "${IN[@]}" -filter_complex "$F" -map "[o]" -c:a libmp3lame -b:a 320k score-v2.mp3
