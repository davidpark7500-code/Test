import numpy as np, soundfile as sf, sys
SR=44100; DUR=60.0; N=int(SR*DUR)
out=np.zeros(N)
def mtof(m): return 440*2**((m-69)/12)
def pluck(freq, dur, amp, bright=0.5):
    n=int(SR*dur); p=int(SR/freq)
    buf=np.random.uniform(-1,1,p)
    # lowpass initial noise for warmer tone
    for _ in range(3 if bright<0.5 else 1): buf=0.5*(buf+np.roll(buf,1))
    y=np.zeros(n); d=0.996
    for i in range(n):
        y[i]=buf[i%p]; buf[i%p]=d*0.5*(buf[i%p]+buf[(i+1)%p])
    return y*amp
def keys(freq,dur,amp):
    t=np.arange(int(SR*dur))/SR
    env=np.exp(-t*2.2)*(1-np.exp(-t*200))
    s=np.sin(2*np.pi*freq*t)+0.35*np.sin(2*np.pi*2*freq*t)*np.exp(-t*4)+0.12*np.sin(2*np.pi*3*freq*t)*np.exp(-t*6)
    return s*env*amp
def pad(freqs,dur,amp):
    t=np.arange(int(SR*dur))/SR
    s=sum(np.sin(2*np.pi*f*t+0.3*np.sin(2*np.pi*0.2*t))+0.5*np.sin(2*np.pi*f*1.003*t) for f in freqs)
    a=min(1.0,dur/3); env=np.clip(np.minimum(t/a, (dur-t)/a),0,1)
    return s*env*amp/len(freqs)
def add(sig,start):
    i=int(start*SR); j=min(N,i+len(sig)); out[i:j]+=sig[:j-i]
# Problem section 0-14.6: sparse minor piano, Am - F - C - E
bpm=72; beat=60/bpm
prog=[[57,60,64],[53,57,60],[48,55,60],[52,56,59]]
t=0.3
for ch in prog*2:
    if t>14.0: break
    add(pad([mtof(n) for n in ch],beat*4+1,0.10),t)
    for k,n in enumerate([ch[0]+12,ch[1]+12,ch[2]+12,ch[1]+12]):
        add(keys(mtof(n),2.5,0.09),t+k*beat)
    t+=beat*4
# Hopeful section 14.6-60: C G Am F, plucked arpeggios + keys + pad, 92 bpm
bpm=92; beat=60/bpm; t0=14.6
prog=[[48,55,60,64,67],[43,55,59,62,67],[45,57,60,64,69],[41,57,60,65,69]]
t=t0; bar=0
add(keys(mtof(84),3,0.12),t0); add(keys(mtof(79),3,0.08),t0)  # reveal chime
while t<57.5:
    ch=prog[bar%4]
    add(pad([mtof(n) for n in ch[1:4]],beat*4+1.2,0.07),t)
    add(keys(mtof(ch[0]),3,0.10),t)
    patt=[ch[1],ch[2],ch[3],ch[4],ch[3],ch[2],ch[3],ch[4]]
    for k,n in enumerate(patt):
        add(pluck(mtof(n+12),1.2,0.12),t+k*beat/2)
    t+=beat*4; bar+=1
# final resolve
add(pad([mtof(n) for n in [60,64,67,72]],3.5,0.10),57.4)
add(keys(mtof(72),3,0.12),57.4); add(keys(mtof(76),3,0.08),57.4); add(keys(mtof(79),3,0.07),57.4)
out[-int(SR*1.5):]*=np.linspace(1,0,int(SR*1.5))
# simple reverb
ir_len=int(SR*1.6); ir=np.random.randn(ir_len)*np.exp(-np.arange(ir_len)/SR*3.5)*0.02
from numpy.fft import rfft, irfft
L=N+ir_len; nf=1<<(L-1).bit_length()
wet=irfft(rfft(out,nf)*rfft(ir,nf),nf)[:N]
mix=out+wet*0.6
mix/=np.max(np.abs(mix))*1.12
st=np.stack([mix, np.roll(mix,220)],1)
sf.write(sys.argv[1]+"/music.wav",st,SR)
print("ok")
