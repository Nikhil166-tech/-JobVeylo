"""Render the first verified JobVeylo reel with original generated audio."""
from pathlib import Path
import math, struct, subprocess, sys, wave
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT.parents[1]/'.reel-tools'))
import imageio_ffmpeg
OUT=ROOT/'public'/'reels'; OUT.mkdir(parents=True,exist_ok=True)
QA=ROOT/'.wrangler'/'reel-qa'; QA.mkdir(parents=True,exist_ok=True)
W,H=1080,1920
NAVY='#112C36'; PAPER='#F4F4EC'; MINT='#B9F16D'; GRAY='#4A626B'
def font(n,bold=False):return ImageFont.truetype('C:/Windows/Fonts/'+('segoeuib.ttf' if bold else 'segoeui.ttf'),n)
def lines(draw,text,xy,size,color=NAVY,bold=False,width=860,leading=1.24):
    x,y=xy; f=font(size,bold)
    for para in text.split('\n'):
        line=''
        for word in para.split():
            candidate=(line+' '+word).strip()
            if draw.textlength(candidate,font=f)>width and line:
                draw.text((x,y),line,font=f,fill=color);y+=int(size*leading);line=word
            else:line=candidate
        draw.text((x,y),line,font=f,fill=color);y+=int(size*leading)
    return y
def base(page,label):
    im=Image.new('RGB',(W,H),PAPER);d=ImageDraw.Draw(im)
    d.rounded_rectangle((76,130,363,201),35,fill=NAVY)
    d.text((102,137),'JobVeylo',font=font(39,True),fill=PAPER)
    d.text((78,258),label.upper(),font=font(29,True),fill=GRAY)
    d.line((78,1690,1002,1690),fill=NAVY,width=2)
    d.text((78,1728),'@jobveylo',font=font(31,True),fill=NAVY)
    d.text((875,1728),f'0{page} / 04',font=font(26),fill=GRAY)
    for i in range(4):d.rounded_rectangle((78+i*234,1630,78+i*234+214,1638),4,fill=NAVY if i<page else '#D8DDD2')
    return im,d

slides=[]
im,d=base(1,'Active employer opening')
lines(d,'AiPrise',(78,365),62,bold=True)
lines(d,'Software\nEngineer II,\nFrontend',(74,490),94,bold=True)
d.rounded_rectangle((78,935,1002,1130),28,fill=MINT)
lines(d,'Bengaluru · On-site\nFull-time · 2–4 years',(112,970),43,bold=True)
lines(d,'₹30–50 lakh / year',(78,1220),58,bold=True)
lines(d,'Employer-listed salary range; bonus offered.\nFinal offer may vary.',(80,1325),30,color=GRAY)
lines(d,'Source checked · 25 Oct 2026',(80,1510),28,color=GRAY)
slides.append(im)

im,d=base(2,'What you need')
lines(d,'Your frontend\nskills, in focus.',(78,365),78,bold=True)
items=[('01','React + TypeScript','JavaScript, HTML and CSS'),('02','Mobile-first thinking','Camera permissions, browser reliability'),('03','Feature ownership','Ship, test and improve production features')]
for i,(num,title,body) in enumerate(items):
    y=675+i*270;d.rounded_rectangle((78,y,155,y+73),20,fill=MINT);d.text((91,y+10),num,font=font(35,True),fill=NAVY)
    lines(d,title,(190,y-2),44,bold=True,width=800)
    lines(d,body,(190,y+80),34,color=GRAY,width=790)
lines(d,'Preferred: Flutter / React Native, SDKs,\nPython or Node.js, identity verification.',(78,1510),29,color=GRAY)
slides.append(im)

im,d=base(3,'Employer-listed selection process')
lines(d,'Know the\ninterview path.',(78,365),82,bold=True)
stages=[('1','Remote introductory discussion'),('2','Two in-office DSA / problem-solving rounds'),('3','In-office frontend system design'),('4','Remote behavioural + compensation discussions')]
for i,(num,text) in enumerate(stages):
    y=710+i*190;d.ellipse((78,y,145,y+67),fill=MINT);d.text((99,y+8),num,font=font(33,True),fill=NAVY);lines(d,text,(188,y),39,bold=True,width=790)
lines(d,'Check the latest employer notice before applying.',(78,1530),29,color=GRAY)
slides.append(im)

im,d=base(4,'Your next move')
lines(d,'Read.\nCheck.\nApply.',(78,365),122,bold=True)
d.rounded_rectangle((78,940,1002,1145),28,fill=MINT)
lines(d,'Full job details +\nofficial application link',(112,970),48,bold=True)
lines(d,'Visit JobVeylo and search\n“AiPrise Frontend”',(78,1210),45,bold=True)
lines(d,'jobveylo.jobveylo.workers.dev',(78,1385),35,color=GRAY)
lines(d,'Independent job information.\nAvailability and eligibility: verify with AiPrise.',(78,1500),29,color=GRAY)
slides.append(im)
for i,im in enumerate(slides):im.save(QA/f'slide-{i+1}.png')
contact=Image.new('RGB',(W*4,H));
for i,im in enumerate(slides):contact.paste(im,(i*W,0))
contact.resize((1080,480)).save(QA/'contact-sheet.png')

# An original low-volume instrumental: Cmaj7 / Am7 / Fmaj7 / G voicings,
# a soft kick and a sparse bell motif. No third-party music recordings.
sr=44100;duration=20;audio=QA/'original-instrumental.wav'
chords=[(130.81,164.81,196,246.94),(110,130.81,164.81,196),(87.31,110,130.81,164.81),(98,123.47,146.83,196)]
with wave.open(str(audio),'wb') as wav:
    wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(sr)
    buf=bytearray()
    for n in range(sr*duration):
        t=n/sr; beat=t%0.625;chord=chords[min(3,int(t//5))]
        pad=sum(math.sin(2*math.pi*f*t) for f in chord)*0.025
        kick=math.sin(2*math.pi*(52*beat+22*(1-math.exp(-25*beat))))*math.exp(-22*beat)*0.14
        note=[523.25,659.25,783.99,659.25][int(t/0.625)%4];bell=math.sin(2*math.pi*note*t)*math.exp(-8*beat)*0.035
        fade=min(1,t/0.5,(duration-t)/1.2);sample=int(max(-1,min(1,(pad+kick+bell)*fade))*32767);buf.extend(struct.pack('<h',sample))
    wav.writeframes(buf)
ffmpeg=imageio_ffmpeg.get_ffmpeg_exe();target=OUT/'aiprise-frontend-2026-10-25.mp4'
cmd=[ffmpeg,'-y','-f','rawvideo','-vcodec','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r','24','-i','-','-i',str(audio),'-c:v','libx264','-preset','fast','-crf','24','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart','-shortest',str(target)]
with (QA/'encode.log').open('wb') as log:
    proc=subprocess.Popen(cmd,stdin=subprocess.PIPE,stdout=log,stderr=log)
    for im in slides:
        data=im.tobytes()
        for frame in range(120):proc.stdin.write(data)
    proc.stdin.close();code=proc.wait()
if code:raise SystemExit('Video encoding failed; inspect local encode log')
print(f'Rendered {target.name}: {target.stat().st_size} bytes, 1080x1920, 20 seconds, original audio')
