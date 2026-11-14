"""Claim one public job, render its public-page reel and upload it privately."""
from pathlib import Path
import json, os, re, sys, tempfile, urllib.request, urllib.error

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT.parents[1]/'.reel-tools'))
from reel_reference import render_reference as render
ORIGIN='https://jobveylo.jobveylo.workers.dev'
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):return None

def api(method,key,data=None,job_id=None):
    url=ORIGIN+'/api/automation/reels'+('?id='+job_id if job_id else '')
    req=urllib.request.Request(url,data=data,method=method,headers={'Authorization':'Bearer '+key,'User-Agent':'JobVeylo-Reel-Renderer/1.0','Content-Type':'video/mp4' if method=='PUT' else 'application/json'})
    try:
        with urllib.request.build_opener(NoRedirect).open(req,timeout=45) as response:return json.load(response)
    except urllib.error.HTTPError as error:raise RuntimeError('Automation endpoint returned HTTP '+str(error.code)) from None

def main():
    if len(sys.argv)==3 and sys.argv[1]=='--public-preview':
        job_id=sys.argv[2]
        if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*',job_id) or len(job_id)>180:raise ValueError('Invalid public job ID')
        # Diagnostic path: public reads and local rendering only. No queue claim,
        # credential, media upload or Instagram publication is performed.
        request=urllib.request.Request(ORIGIN+'/api/jobs',headers={'User-Agent':'JobVeylo-Reel-Preview/1.0'})
        with urllib.request.build_opener(NoRedirect).open(request,timeout=45) as response:jobs=json.load(response)['jobs']
        job=next((item for item in jobs if item.get('id')==job_id),None)
        if not job:raise ValueError('Public job not found')
        work=ROOT/'.wrangler'/'queued-reel-preview';work.mkdir(parents=True,exist_ok=True)
        render(job,work/'preview.mp4',work);print('Public-page preview rendered successfully; nothing claimed, uploaded or published.');return
    if len(sys.argv)==3 and sys.argv[1]=='--preview':
        job=json.loads(Path(sys.argv[2]).read_text(encoding='utf-8-sig'));job['_preview']=True
        work=ROOT/'.wrangler'/'queued-reel-preview';work.mkdir(parents=True,exist_ok=True)
        render(job,work/'preview.mp4',work);print('Preview rendered locally.');return
    key=os.environ.get('JOBVEYLO_AUTOMATION_KEY','')
    if len(key)<32:print('Renderer connection is not configured; no job was claimed.');return
    job=api('POST',key,b'{}').get('job')
    if not job:print('No eligible reel is waiting.');return
    if not isinstance(job.get('id'),str) or not all(c.isascii() and (c.isalnum() or c=='-') for c in job['id']):raise RuntimeError('Invalid job ID')
    with tempfile.TemporaryDirectory() as folder:
        work=Path(folder);target=work/'reel.mp4';render(job,target,work);api('PUT',key,target.read_bytes(),job['id'])
    print('One verified job reel rendered and uploaded. Instagram delivery is handled by the hosted scheduler.')
if __name__=='__main__':main()
