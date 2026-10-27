"""Render one bounded five-role, 20-second JobVeylo roundup."""
from pathlib import Path
import sys,json,subprocess
from PIL import Image,ImageDraw
import imageio_ffmpeg
sys.path.insert(0,str(Path(__file__).resolve().parent))
from reel_design import fit,music,NAVY,LIME,WHITE,MUTED
folder=Path(sys.argv[1]);jobs=json.loads((folder/'jobs.json').read_text(encoding='utf-8'))
assert len(jobs)==5 and len({(j['company'],j['title'],j['city']) for j in jobs})==5
assert all(j['experience']=='0–2 years' for j in jobs)
work=Path('.wrangler/roundup-reel-render');work.mkdir(parents=True,exist_ok=True)
frames=[];layouts=[]
for index in range(7):
 image=Image.new('RGB',(1080,1920),NAVY);draw=ImageDraw.Draw(image);records=[]
 def center(value,box,**opts):fit(draw,value,box,align='center',records=records,**opts)
 center('JobVeylo',(90,360,990,410),size=36,minimum=36,bold=True,color=MUTED)
 if index==0:
  center('0–2 YEARS?',(90,510,990,610),size=72,minimum=64,bold=True,color=LIME)
  center('5 SOFTWARE ROLES',(90,720,990,860),size=92,minimum=72,bold=True)
  center('FIND YOUR FIT',(90,1010,990,1100),size=60,minimum=48,bold=True)
  center('India · Read each role’s eligibility',(90,1240,990,1340),size=36,minimum=32,color=MUTED)
 elif index==6:
  center('SAVE + SHARE',(90,590,990,710),size=82,minimum=64,bold=True,color=LIME)
  center('LINK IN BIO',(90,880,990,1020),size=92,minimum=76,bold=True)
  center('Search company + role on JobVeylo',(90,1180,990,1310),size=42,minimum=34,color=MUTED)
 else:
  job=jobs[index-1]
  center('NOW HIRING',(90,470,990,565),size=68,minimum=60,bold=True,color=LIME)
  center(job['company'].upper(),(90,620,990,700),size=56,minimum=42,bold=True)
  center(job['title'],(90,765,990,1020),size=82,minimum=48,bold=True)
  center(job['city'],(90,1090,990,1170),size=48,minimum=38,bold=True)
  draw.rounded_rectangle((90,1225,990,1340),25,fill=LIME)
  center(job['experience'],(115,1250,965,1320),size=56,minimum=48,bold=True,color=NAVY)
  if job.get('note'):center(job['note'],(90,1400,990,1505),size=34,minimum=28,color=MUTED)
  center(f'{index}/5',(90,1570,990,1620),size=30,minimum=28,color=MUTED)
 assert all(not r['clipped'] for r in records),records
 image.save(work/f'{index}.png');frames.append((image,3 if index<6 else 2));layouts.append(records)
(work/'layout.json').write_text(json.dumps(layouts,indent=2),encoding='utf-8')
audio=work/'original.wav';music(audio,20)
target=Path('public/reels/jobveylo-five-software-roles-0-2-20261027.mp4');target.parent.mkdir(parents=True,exist_ok=True)
command=[imageio_ffmpeg.get_ffmpeg_exe(),'-y','-f','rawvideo','-pix_fmt','rgb24','-s','1080x1920','-r','24','-i','-','-i',str(audio),'-c:v','libx264','-preset','fast','-crf','26','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart','-shortest',str(target)]
with (work/'encode.log').open('wb') as log:
 process=subprocess.Popen(command,stdin=subprocess.PIPE,stdout=log,stderr=log)
 try:
  for image,seconds in frames:
   raw=image.tobytes()
   for _ in range(seconds*24):process.stdin.write(raw)
  process.stdin.close();code=process.wait()
 except BaseException:process.kill();process.wait();raise
assert code==0
reader=imageio_ffmpeg.read_frames(str(target));meta=next(reader);reader.close()
assert meta['size']==(1080,1920) and 19.9<=meta['duration']<=20.1,meta
canvas=Image.new('RGB',(4*270,2*480),NAVY)
for i,(img,_) in enumerate(frames):canvas.paste(img.resize((270,480)),((i%4)*270,(i//4)*480))
canvas.save(folder/'preview.png')
(folder/'render.json').write_text(json.dumps({'duration':meta['duration'],'fps':meta['fps'],'width':1080,'height':1920,'bytes':target.stat().st_size,'segmentsSeconds':[3,3,3,3,3,3,2]},indent=2),encoding='utf-8')
print('Roundup validated: 20 seconds, five distinct jobs, all 0–2 years, no clipped text.')
