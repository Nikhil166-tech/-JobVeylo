"""Reference-inspired page footage: real public page, slow zoom, concise overlays."""
from pathlib import Path
import json, math, subprocess
from PIL import Image, ImageDraw
from reel_design import W,H,FPS,DURATION,fit,music,short_salary,disclosed_pay

DESIGN_VERSION='reference-screen-v1'

def overlay(job, second):
    image=Image.new('RGBA',(W,H),(0,0,0,0))
    draw=ImageDraw.Draw(image);records=[]
    def label(text,box,size=48,bold=True):
        draw.rounded_rectangle(box,20,fill='#111315')
        x,y,r,b=box
        fit(draw,text,(x+24,y+14,r-24,b-10),size=size,minimum=28,bold=bold,color='#FFFFFF',align='center',records=records,name='overlay')
    # Identity, role and true experience remain legible throughout.
    label(str(job['company'])+' IS HIRING',(100,170,950,265),48)
    salary=short_salary(job.get('salary'))
    experience=str(job.get('experience') or 'See employer eligibility')
    if experience=='Not specified' and 'intern' in str(job['title']).lower():experience='Internship'
    label(str(job['title']),(100,1160,950,1280),42)
    line=('Salary: '+salary) if second<5 and disclosed_pay(salary) else experience
    label(line,(130,1285,920,1385),48)
    label(' · '.join(dict.fromkeys(str(job.get('location') or 'See employer location').split(' · '))),(100,1400,950,1500),32)
    draw.rounded_rectangle((90,1520,960,1750),20,fill='#111315')
    label('Apply • Link in bio' if second<10 else 'Free ATS-friendly resume tailoring',(100,1530,950,1620),40)
    if second>=10:
        fit(draw,'Find this job + tailor your resume\nLink in bio',(110,1620,940,1740),size=34,minimum=28,color='#FFFFFF',align='center')
    else:
        fit(draw,'Shared by JobVeylo • Save & share',(110,1620,940,1700),size=32,minimum=26,color='#FFFFFF',align='center')
    if any(r['clipped'] for r in records):raise ValueError('Overlay text does not fit; do not publish')
    return image

def frame(job, screenshot, second, text_layer=None):
    image=Image.new('RGB',(W,H),'#171A1D')
    draw=ImageDraw.Draw(image)
    progress=max(0,min(1,second/DURATION))
    # A landscape desktop monitor in the portrait reel; never a mobile viewport.
    width=int(1000*(1.0+0.025*progress));height=int(width*screenshot.height/screenshot.width)
    x=(W-width)//2;y=350-int(8*progress)
    draw.rounded_rectangle((x-16,y-50,x+width+16,y+height+35),22,fill='#373C42',outline='#68717C',width=3)
    draw.rounded_rectangle((x,y-35,x+width,y-3),6,fill='#E3E6E9')
    fit(draw,'jobveylo.jobveylo.workers.dev',(x+100,y-31,x+width-40,y-4),size=18,minimum=18,color='#30343B')
    for i,color in enumerate(['#8B9299','#8B9299','#8B9299']):draw.ellipse((x+14+i*23,y-26,x+25+i*23,y-15),fill=color)
    page=screenshot.resize((width,height),Image.Resampling.BILINEAR)
    image.paste(page,(x,y))
    draw.polygon([(490,y+height+35),(590,y+height+35),(615,y+height+90),(465,y+height+90)],fill='#555D67')
    draw.rounded_rectangle((390,y+height+87,690,y+height+103),8,fill='#747D86')
    text_layer=text_layer if text_layer is not None else overlay(job,second)
    image.paste(text_layer,(0,0),text_layer)
    return image


def render_reference(job,target,work,screenshot=None):
    import imageio_ffmpeg
    from reel_page_capture import capture_job_page
    work,target=Path(work),Path(target);work.mkdir(parents=True,exist_ok=True)
    capture=Path(screenshot) if screenshot else capture_job_page(job,work/'public-job-page.png')
    with Image.open(capture) as raw:page=raw.convert('RGB')
    overlays=[overlay(job,t) for t in [0,7,12]]
    for second,layer in zip([0,7,12],overlays):frame(job,page,second,layer).save(work/f'frame-{second}.png')
    audio=work/'original.wav';music(audio)
    # Bounded bitrate preserves the existing 1.5 MB upload limit even with page motion.
    command=[imageio_ffmpeg.get_ffmpeg_exe(),'-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-i',str(audio),'-c:v','libx264','-preset','fast','-threads','2','-b:v','580k','-maxrate','620k','-bufsize','620k','-pix_fmt','yuv420p','-c:a','aac','-b:a','64k','-movflags','+faststart','-shortest',str(target)]
    with (work/'encode.log').open('wb') as log:
        process=subprocess.Popen(command,stdin=subprocess.PIPE,stdout=log,stderr=log)
        try:
            for n in range(FPS*DURATION):process.stdin.write(frame(job,page,n/FPS,overlays[min(2,int(n/FPS//5))]).tobytes())
            process.stdin.close();code=process.wait()
        except BaseException:
            process.kill();process.wait();raise
    if code or not target.exists() or target.stat().st_size>1500000:raise RuntimeError('Reel encoding failed or exceeded upload limit')
    (work/'render.json').write_text(json.dumps({'design':DESIGN_VERSION,'jobId':job['id'],'duration':DURATION,'pageSource':'public JobVeylo listing','audio':'existing original instrumental; no trending song attached','bytes':target.stat().st_size},indent=2),encoding='utf-8')
