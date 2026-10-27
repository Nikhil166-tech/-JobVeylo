"""Render a seven-slide JobVeylo roundup from a source-checked jobs manifest."""
import json,sys
from pathlib import Path
from PIL import Image,ImageDraw
sys.path.insert(0,str(Path(__file__).resolve().parent))
from reel_design import fit,NAVY,WHITE,LIME,MUTED
folder=Path(sys.argv[1]);jobs=json.loads((folder/'jobs.json').read_text(encoding='utf-8'))
assert len(jobs)==5 and all(j['experience']=='0–2 years' for j in jobs)
out=Path('public/trials')/folder.name;out.mkdir(parents=True,exist_ok=True)
all_records=[];images=[]
for index in range(7):
 image=Image.new('RGB',(1080,1350),NAVY);draw=ImageDraw.Draw(image);records=[];text=[]
 def line(value,box,**options):
  text.append(value);fit(draw,value,box,align='center',records=records,**options)
 line('JobVeylo',(100,155,980,205),size=34,minimum=34,bold=True,color=MUTED)
 if index==0:
  line('0–2 YEARS',(100,300,980,390),size=68,minimum=60,bold=True,color=LIME)
  line('5 TECH\nJOBS',(100,440,980,755),size=144,minimum=120,bold=True)
  line('BENGALURU',(100,800,980,880),size=54,minimum=48,bold=True)
  line('Swipe to find your fit',(100,1000,980,1070),size=43,minimum=36,color=MUTED)
 elif index==6:
  line('SAVE + SHARE',(100,320,980,420),size=72,minimum=60,bold=True,color=LIME)
  line('APPLY',(100,490,980,625),size=108,minimum=90,bold=True)
  draw.rounded_rectangle((90,710,990,840),26,fill=LIME)
  line('LINK IN BIO',(115,745,965,820),size=66,minimum=56,bold=True,color=NAVY)
  line('Search company + role',(100,930,980,1020),size=42,minimum=34,color=MUTED)
 else:
  job=jobs[index-1]
  line('NOW HIRING',(100,275,980,365),size=68,minimum=60,bold=True,color=LIME)
  line(job['company'],(100,410,980,495),size=54,minimum=42,bold=True)
  line(job['title'],(100,540,980,775),size=78,minimum=48,bold=True)
  draw.rounded_rectangle((90,825,990,1030),26,fill='#102342')
  line(job['city'],(115,855,965,925),size=48,minimum=40,bold=True)
  line(job['experience'],(115,950,965,1015),size=48,minimum=40,bold=True,color=LIME)
 line(f'{index+1}/7',(100,1160,980,1205),size=28,minimum=28,color=MUTED)
 assert all(not r['clipped'] for r in records),records
 assert len(' '.join(text).split())<15,(index,text)
 image.save(out/f'{index+1}.jpg',quality=93,optimize=True);images.append(image);all_records.append(records)
(folder/'layout-records.json').write_text(json.dumps(all_records,indent=2),encoding='utf-8')
canvas=Image.new('RGB',(4*270,2*338),NAVY)
for i,img in enumerate(images):canvas.paste(img.resize((270,338)),((i%4)*270,(i//4)*338))
canvas.save(folder/'preview.png')
print('Rendered 7 centered slides; every slide under 15 words, no clipped text.')
