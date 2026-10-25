export type RendererEnv={DB:D1Database;GITHUB_RENDER_TOKEN?:string};
const endpoint='https://api.github.com/repos/Nikhil166-tech/-JobVeylo/actions/workflows/render-job-reel.yml/dispatches';
export async function rendererStatus(env:RendererEnv){
 const last=await env.DB.prepare('SELECT status,created_at,finished_at,run_id,message FROM renderer_dispatches ORDER BY slot DESC LIMIT 1').first();
 const latest=await env.DB.prepare('SELECT MAX(media_created_at) AS created_at FROM social_jobs').first();
 return {configured:!!env.GITHUB_RENDER_TOKEN,last,latest};
}
export async function dispatchRenderer(env:RendererEnv,options:{now?:number;fetcher?:typeof fetch}={}){
 if(!env.GITHUB_RENDER_TOKEN)return {state:'connection_required',message:'Save the restricted GitHub Actions token on jobveylo-collector to enable Cloudflare-driven rendering.'};
 const control=await env.DB.prepare('SELECT instagram_enabled FROM publishing_control WHERE id=1').first<{instagram_enabled:number}>();
 if(!control?.instagram_enabled)return {state:'paused',message:'Instagram publishing is paused.'};
 const now=options.now??Date.now(),slot=Math.floor(now/1800000),time=new Date(now).toISOString();
 await env.DB.prepare("UPDATE social_jobs SET status='waiting_media',lease_until=0 WHERE status='rendering' AND lease_until<?").bind(now).run();
 const waiting=await env.DB.prepare("SELECT s.listing_id FROM social_jobs s JOIN listings l ON l.id=s.listing_id WHERE s.status='waiting_media' AND l.status='published' LIMIT 1").first();
 if(!waiting)return {state:'empty',message:'No public reel job is waiting.'};
 const buffer=await env.DB.prepare("SELECT COUNT(*) AS total FROM social_jobs WHERE status IN ('rendering','media_ready','creating','processing','publishing')").first<{total:number}>();
 if((buffer?.total||0)>=2)return {state:'buffered',message:'Two videos are already ready or in progress.'};
 const claimed=await env.DB.prepare("INSERT INTO renderer_dispatches(slot,status,created_at) VALUES(?,'requesting',?) ON CONFLICT DO NOTHING RETURNING slot").bind(slot,time).first();
 if(!claimed)return {state:'already_requested',message:'This half-hour render slot has already been requested.'};
 try{
  const response=await (options.fetcher||fetch)(endpoint,{method:'POST',headers:{Authorization:'Bearer '+env.GITHUB_RENDER_TOKEN.trim(),Accept:'application/vnd.github+json','Content-Type':'application/json','User-Agent':'JobVeylo-Renderer-Scheduler/1.0','X-GitHub-Api-Version':'2026-03-10'},body:JSON.stringify({ref:'main'}),redirect:'manual',signal:AbortSignal.timeout(15000)});
  if(response.status!==200&&response.status!==204){
   const message='GitHub rejected the render request (HTTP '+response.status+'). Check the token and repository Actions permission.';
   await env.DB.prepare("UPDATE renderer_dispatches SET status='rejected',finished_at=?,message=? WHERE slot=?").bind(new Date().toISOString(),message,slot).run();return {state:'rejected',message};
  }
  const data:any=response.status===200?await response.json().catch(()=>null):null;
  const id=/^\d+$/.test(String(data?.workflow_run_id||''))?String(data.workflow_run_id):null;
  await env.DB.prepare("UPDATE renderer_dispatches SET status='dispatched',finished_at=?,run_id=?,message='GitHub accepted the render request.' WHERE slot=?").bind(new Date().toISOString(),id,slot).run();
  return {state:'dispatched',message:'GitHub accepted one render request.',runId:id};
 }catch{
  await env.DB.prepare("UPDATE renderer_dispatches SET status='uncertain',finished_at=?,message='Request outcome is uncertain; no duplicate retry in this slot.' WHERE slot=?").bind(new Date().toISOString(),slot).run();
  return {state:'uncertain',message:'The request outcome is uncertain. This slot will not be retried automatically.'};
 }
}
