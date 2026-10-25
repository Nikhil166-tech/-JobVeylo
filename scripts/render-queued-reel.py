"""Claim one public job, render its reel and upload it to the scoped media endpoint."""
from pathlib import Path
import json, math, os, struct, subprocess, sys, tempfile, urllib.request, urllib.error, wave
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT.parents[1]/'.reel-tools'))
import imageio_ffmpeg
ORIGIN='https://jobveylo.jobveylo.workers.dev'
W,H=1080,1920
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):return None
def api(method,key,data=None,job_id=None):
    url=ORIGIN+'/api/automation/reels'+('?id='+job_id if job_id else '')
    req=urllib.request.Request(url,data=data,method=method,headers={'Authorization':'Bearer '+key,'Content-Type':'video/mp4' if method=='PUT' else 'application/json'})
    try:
        with urllib.request.build_opener(NoRedirect).open(req,timeout=45) as response:return json.load(response)
    except urllib.error.HTTPError as error:raise RuntimeError('Automation endpoint returned HTTP '+str(error.code)) from None
def font(size,bold=False):
    paths=[Path('C:/Windows/Fonts')/('segoeuib.ttf' if bold else 'segoeui.ttf'),Path('/usr/share/fonts/truetype/dejavu')/('DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf')]
    for path in paths:
        if path.exists():return ImageFont.truetype(str(path),size)
    raise RuntimeError('A supported font is not installed')
def text(draw,value,x,y,size=42,width=880,max_lines=5,bold=False,color='#112C36'):
    words=str(value).replace('\n',' ').split();lines=[];line='';f=font(size,bold)
    for word in words:
        candidate=(line+' '+word).strip()
        if draw.textlength(candidate,font=f)>width and line:lines.append(line);line=word
        else:line=candidate
    if line:lines.append(line)
    if len(lines)>max_lines:lines=lines[:max_lines];lines[-1]=lines[-1].rstrip('.,;')+'…'
    for line in lines:draw.text((x,y),line,font=f,fill=color);y+=int(size*1.3)
    return y
def slide(index,label):
    image=Image.new('RGB',(W,H),'#F4F4EC');draw=ImageDraw.Draw(image)
    draw.rounded_rectangle((76,130,363,201),35,fill='#112C36');draw.text((102,137),'JobVeylo',font=font(39,True),fill='#F4F4EC')
    text(draw,label.upper(),78,264,28,max_lines=2,color='#4A626B')
    for n in range(4):draw.rounded_rectangle((78+n*234,1630,292+n*234,1638),4,fill='#112C36' if n<index else '#D8DDD2')
    draw.line((78,1690,1002,1690),fill='#112C36',width=2);text(draw,'@jobveylo',78,1728,31,bold=True);text(draw,f'0{index} / 04',875,1728,26)
    return image,draw
def render(job,target,work):
    slides=[]
    im,d=slide(1,'Job opening · '+job.get('career','Careers'))
    text(d,job['company'],78,365,54,max_lines=2,bold=True);text(d,job['title'],78,520,74,max_lines=4,bold=True)
    d.rounded_rectangle((78,990,1002,1260),28,fill='#B9F16D');text(d,job['location'],112,1025,40,width=820,max_lines=4,bold=True)
    text(d,'Experience: '+job['experience'],78,1340,37,max_lines=3);text(d,'Check eligibility in the employer notice.',78,1540,28,color='#4A626B');slides.append(im)
    im,d=slide(2,'Eligibility and details');text(d,'Know the role.',78,365,78,bold=True)
    text(d,'Experience',78,600,33,bold=True);text(d,job['experience'],78,670,40,max_lines=3)
    text(d,'Education',78,890,33,bold=True);text(d,job['education'],78,960,38,max_lines=4)
    text(d,'Pay / compensation',78,1260,33,bold=True);text(d,job['salary'],78,1330,36,max_lines=4);slides.append(im)
    im,d=slide(3,'Before you apply');text(d,'Read the\nfull notice.',78,365,78,max_lines=3,bold=True)
    for n,copy in enumerate(['Confirm required skills and location eligibility.','Review the employer’s current selection process.','Apply only through the official destination.']):
        y=740+n*240;d.ellipse((78,y,145,y+67),fill='#B9F16D');text(d,str(n+1),99,y+7,33,bold=True);text(d,copy,188,y,39,width=780,max_lines=3)
    text(d,'Closing date: '+job['deadline'],78,1510,30,max_lines=2,color='#4A626B');slides.append(im)
    im,d=slide(4,'Your next move');text(d,'Read. Check. Apply.',78,365,94,max_lines=3,bold=True)
    d.rounded_rectangle((78,870,1002,1100),28,fill='#B9F16D');text(d,'Full details + official application link',112,910,48,width=820,max_lines=3,bold=True)
    text(d,'Visit JobVeylo and search this role.',78,1190,43,max_lines=3,bold=True);text(d,'jobveylo.jobveylo.workers.dev',78,1400,35,color='#4A626B');text(d,'Independent job information. Check the latest employer notice.',78,1510,29,max_lines=2,color='#4A626B');slides.append(im)
    audio=work/'original.wav';sr=44100;duration=20;chords=[(130.81,164.81,196,246.94),(110,130.81,164.81,196),(87.31,110,130.81,164.81),(98,123.47,146.83,196)]
    with wave.open(str(audio),'wb') as wav:
        wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(sr);data=bytearray()
        for n in range(sr*duration):
            t=n/sr;beat=t%0.625;pad=sum(math.sin(2*math.pi*f*t) for f in chords[min(3,int(t//5))])*0.025;kick=math.sin(2*math.pi*(52*beat+22*(1-math.exp(-25*beat))))*math.exp(-22*beat)*0.14;note=[523.25,659.25,783.99,659.25][int(t/0.625)%4];bell=math.sin(2*math.pi*note*t)*math.exp(-8*beat)*0.035;fade=min(1,t/0.5,(duration-t)/1.2);data.extend(struct.pack('<h',int(max(-1,min(1,(pad+kick+bell)*fade))*32767)))
        wav.writeframes(data)
    command=[imageio_ffmpeg.get_ffmpeg_exe(),'-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r','24','-i','-','-i',str(audio),'-c:v','libx264','-preset','fast','-crf','26','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart','-shortest',str(target)]
    with (work/'encode.log').open('wb') as log:
        process=subprocess.Popen(command,stdin=subprocess.PIPE,stdout=log,stderr=log)
        for im in slides:
            pixels=im.tobytes()
            for _ in range(120):process.stdin.write(pixels)
        process.stdin.close();result=process.wait()
    if result or not target.exists() or target.stat().st_size>1500000:raise RuntimeError('Reel encoding failed or exceeded the upload limit')
    contact=Image.new('RGB',(W*4,H))
    for n,im in enumerate(slides):contact.paste(im,(n*W,0))
    contact.resize((1080,480)).save(work/'contact-sheet.png')
def main():
    if len(sys.argv)==3 and sys.argv[1]=='--preview':
        job=json.loads(Path(sys.argv[2]).read_text(encoding='utf-8-sig'));work=ROOT/'.wrangler'/'queued-reel-preview';work.mkdir(parents=True,exist_ok=True);render(job,work/'preview.mp4',work);print('Preview rendered locally.');return
    key=os.environ.get('JOBVEYLO_AUTOMATION_KEY','')
    if len(key)<32:print('Renderer connection is not configured; no job was claimed.');return
    job=api('POST',key,b'{}').get('job')
    if not job:print('No eligible reel is waiting.');return
    if not isinstance(job.get('id'),str) or not all(c.isascii() and (c.isalnum() or c=='-') for c in job['id']):raise RuntimeError('Invalid job ID')
    with tempfile.TemporaryDirectory() as folder:
        work=Path(folder);target=work/'reel.mp4';render(job,target,work);api('PUT',key,target.read_bytes(),job['id'])
    print('One verified job reel rendered and uploaded. Instagram delivery is handled by the hosted scheduler.')
if __name__=='__main__':main()
