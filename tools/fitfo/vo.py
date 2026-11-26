import sys, soundfile as sf
from kokoro_onnx import Kokoro
S=sys.argv[1]
k=Kokoro(f"{S}/models/kokoro-v1.0.onnx", f"{S}/models/voices-v1.0.bin")
M="am_michael"; F="af_heart"
lines=[
 ("01",M,0.95,"Do you have a great idea... that you've been researching... for three years?"),
 ("02",M,0.95,"Do you start every Monday with a plan, and end every Friday with an excuse?"),
 ("03",M,0.95,"You may be suffering from Emotional Dysfunction."),
 ("04",M,0.92,"Introducing Fitfoe."),
 ("05",M,0.97,"Fitfoe is the first prescription treatment for chronic excuse-making, business paralysis, soft mentality, and recurring life losses."),
 ("06",M,0.97,"With Fitfoe, you can stop waiting for the perfect moment... and start making the call."),
 ("07",F,1.22,"Do not take Fitfoe if you are allergic to responsibility. Common side effects may include accountability, action bias, increased ownership, improved follow-through, stronger decision-making, and a sudden intolerance for excuses. Tell your doctor if you experience finishing things. In rare cases, patients have said, I'll handle it, and then actually handled it."),
 ("08",M,0.95,"Ask your doctor if Fitfoe is right for you."),
 ("09",M,0.9,"Fitfoe. Figure it the frick out."),
]
for n,v,sp,t in lines:
    a,sr=k.create(t,voice=v,speed=sp,lang="en-us")
    sf.write(f"{S}/vo/{n}.wav",a,sr); print(n, round(len(a)/sr,2))
