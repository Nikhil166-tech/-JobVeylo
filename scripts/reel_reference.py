"""Approved desktop close-up: public job page, gentle motion and one clear CTA."""
from pathlib import Path
import json, re, subprocess
from PIL import Image, ImageDraw
from reel_design import W,H,FPS,DURATION,fit,music

DESIGN_VERSION='desktop-closeup-v2'


def overlay(job, second):
    image=Image.new('RGBA',(W,H),(0,0,0,0))
    draw=ImageDraw.Draw(image);records=[]
    if second>=10:
        draw.rounded_rectangle((110,1350,940,1550),24,fill=(20,24,29,255))
        fit(draw,'Apply + free resume tailoring',(138,1380,912,1440),size=43,minimum=34,bold=True,color='white',align='center',records=records,name='resume')
        fit(draw,'LINK IN BIO',(138,1465,912,1520),size=35,minimum=30,bold=True,color='white',align='center',records=records,name='cta')
    else:
        experience=str(job.get('experience') or '').strip()
        if not experience or experience=='Not specified':
            raise ValueError('Verified fresher eligibility is required before rendering')
        # Eligibility is checked against the full source by the hosted queue.
        # Keep the factual experience range short enough for the approved card.
        amount=re.search(r'\b\d+(?:\.\d+)?(?:\s*[-–—]\s*\d+(?:\.\d+)?\+?|\+)?[\s-]*(?:years?|yrs?|months?)\b',experience,re.I)
        explicit_fresher=re.search(r'freshers?|no\s+(?:(?:prior|previous|professional|work|industry)\s+)*experience|experience\s+(?:is\s+)?not\s+(?:required|necessary|needed)|(?:new|recent)[ -]?grad',experience,re.I)
        if explicit_fresher or (amount and re.match(r'0(?:\s|[-–—+])',amount.group())):experience='Freshers can apply'
        else:raise ValueError('Only source-confirmed fresher opportunities may be rendered')
        location=' · '.join(dict.fromkeys(str(job.get('location') or 'See employer location').split(' · ')))
        draw.rounded_rectangle((155,1330,900,1495),22,fill=(20,24,29,255))
        fit(draw,experience.upper(),(180,1352,875,1415),size=55,minimum=28,bold=True,color='white',align='center',records=records,name='experience')
        fit(draw,location,(180,1430,875,1480),size=33,minimum=24,color='#E0E5E8',align='center',records=records,name='location')
    if any(record['clipped'] for record in records):
        raise ValueError('Overlay text does not fit; do not publish')
    return image


def shading():
    image=Image.new('RGBA',(W,H),(0,0,0,0));draw=ImageDraw.Draw(image)
    for y in range(1511,H):
        draw.line((0,y,W,y),fill=(12,17,21,round(110*(y-1510)/(H-1510))))
    return image


def frame(job, screenshot, second, text_layer=None, shade=None):
    progress=max(0,min(1,second/DURATION));zoom=1.10+0.035*progress
    page=screenshot.resize((round(screenshot.width*zoom),round(screenshot.height*zoom)),Image.Resampling.BILINEAR)
    page=page.rotate(2.4-0.7*progress,resample=Image.Resampling.BICUBIC,expand=False,fillcolor='#181F23')
    image=Image.new('RGB',(W,H),'#181F23')
    image.paste(page,(-160-round(12*progress),20-round(24*progress)))
    shade=shade if shade is not None else shading()
    image.paste(shade,(0,0),shade)
    text_layer=text_layer if text_layer is not None else overlay(job,second)
    image.paste(text_layer,(0,0),text_layer)
    return image


def render_reference(job,target,work,screenshot=None):
    import imageio_ffmpeg
    from reel_page_capture import capture_job_page
    work,target=Path(work),Path(target);work.mkdir(parents=True,exist_ok=True)
    capture=Path(screenshot) if screenshot else capture_job_page(job,work/'public-job-page.png')
    with Image.open(capture) as raw:page=raw.convert('RGB')
    if page.size!=(2160,2400):
        raise ValueError('A 1440×1600 desktop capture at 1.5 scale is required')
    layers=[overlay(job,0),overlay(job,12)];shade=shading()
    for second in [0,7,12]:frame(job,page,second,layers[second>=10],shade).save(work/f'frame-{second}.png')
    audio=work/'original.wav';music(audio)
    command=[imageio_ffmpeg.get_ffmpeg_exe(),'-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-i',str(audio),'-c:v','libx264','-preset','fast','-threads','2','-b:v','580k','-maxrate','620k','-bufsize','620k','-pix_fmt','yuv420p','-c:a','aac','-b:a','64k','-movflags','+faststart','-shortest',str(target)]
    with (work/'encode.log').open('wb') as log:
        process=subprocess.Popen(command,stdin=subprocess.PIPE,stdout=log,stderr=log)
        try:
            current=None
            for n in range(FPS*DURATION):
                # The slow camera changes only a few pixels per second. Reuse
                # each position for half a second to keep cloud renders bounded.
                if n % (FPS//2)==0:current=frame(job,page,n/FPS,layers[n/FPS>=10],shade).tobytes()
                process.stdin.write(current)
            process.stdin.close();code=process.wait()
        except BaseException:
            process.kill();process.wait();raise
    if code or not target.exists() or target.stat().st_size>1500000:raise RuntimeError('Reel encoding failed or exceeded upload limit')
    (work/'render.json').write_text(json.dumps({'design':DESIGN_VERSION,'jobId':job['id'],'duration':DURATION,'desktopViewport':'1440x1600','pageSource':'public JobVeylo listing','audio':'existing original instrumental; no trending song attached','bytes':target.stat().st_size},indent=2),encoding='utf-8')
