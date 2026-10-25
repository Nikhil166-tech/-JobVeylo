import {careerPriority} from './job-priority.ts';
import {collectionSources,sourceIndex,readSource,canonicalJobUrl,indiaToday} from './collection-sources.ts';

export type SocialEnv={DB:D1Database;REEL_MEDIA?:KVNamespace;SITE_URL:string;JOBVEYLO_AUTOMATION_KEY?:string;INSTAGRAM_ACCESS_TOKEN?:string;INSTAGRAM_ACCOUNT_ID?:string};
export function instagramReady(env:SocialEnv){return !!env.REEL_MEDIA&&!!env.INSTAGRAM_ACCESS_TOKEN&&/^\d+$/.test(env.INSTAGRAM_ACCOUNT_ID||'')}
const instagramToken=(env:SocialEnv)=>String(env.INSTAGRAM_ACCESS_TOKEN||'').trim();
export async function checkInstagramConnection(env:SocialEnv,fetcher:typeof fetch=fetch){
 if(!instagramReady(env))return {state:'connection_required',message:'The collector needs Instagram credentials and media storage.'};
 const token=instagramToken(env);
 if(!/^[\x21-\x7e]+$/.test(token))return {state:'invalid_token_format',message:'The saved token contains spaces, line breaks or non-ASCII characters. Save only the complete token string copied from Meta.'};
 try{
  const response=await fetcher('https://graph.instagram.com/v25.0/'+env.INSTAGRAM_ACCOUNT_ID+'?fields=id,username',{headers:{Authorization:'Bearer '+token,'User-Agent':'JobVeylo-Publisher/1.0'},redirect:'manual',signal:AbortSignal.timeout(15000)});
  if(response.status>=300&&response.status<400)return {state:'redirect_refused',message:'Instagram returned a redirect. Credentials were not forwarded.',status:response.status};
  const data:any=await response.json().catch(()=>null);
  if(!data)return {state:'invalid_response',message:'Instagram returned an unreadable response (HTTP '+response.status+').',status:response.status};
  if(!response.ok||data.error)return {state:'rejected',message:'Instagram rejected the profile check.',status:response.status,code:Number(data.error?.code)||null,subcode:Number(data.error?.error_subcode)||null};
  if(String(data.username).toLowerCase()!=='jobveylo')return {state:'wrong_account',message:'The token does not identify @jobveylo.'};
  return {state:'connected',message:'Instagram authenticated @jobveylo successfully.'};
 }catch(error){const kind=['TypeError','AbortError','TimeoutError'].includes((error as Error)?.name)?(error as Error).name:'request error';const detail=String((error as Error)?.message||'').split(token).join('[redacted]').replace(/Bearer\s+\S+/gi,'Bearer [redacted]').replace(/IG[A-Za-z0-9_-]{15,}/g,'[redacted]').slice(0,240);return {state:'unreachable',message:'Instagram request failed ('+kind+'): '+detail+'. No post was attempted.'}}
}
export async function automationAuthorized(request:Request,key?:string,fallbackHash?:string|null){
 if((!key||key.length<32)&&!/^\p{ASCII_Hex_Digit}{64}$/u.test(fallbackHash||''))return false;
 const supplied=request.headers.get('authorization')||'';
 const a=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(supplied)));
 const b=key&&key.length>=32?new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('Bearer '+key))):Uint8Array.from((fallbackHash!.match(/../g)||[]),value=>parseInt(value,16));
 let difference=0;for(let i=0;i<a.length;i++)difference|=a[i]^b[i];return difference===0;
}
export async function seedSocialQueue(db:D1Database){
 const rows=await db.prepare("SELECT id,data FROM listings WHERE status='published'").all<{id:string;data:string}>();
 const now=new Date().toISOString();
 for(const row of rows.results){
  const job=JSON.parse(row.data);if(job.deadline!=='Not specified'&&job.deadline<indiaToday())continue;
  // This job already has a reel scheduled through Metricool. Never publish it twice.
  const state=row.id==='aiprise-frontend-engineer-bengaluru'?'external':'waiting_media';
  await db.prepare('INSERT INTO social_jobs(listing_id,priority,status,created_at) VALUES(?,?,?,?) ON CONFLICT DO NOTHING').bind(row.id,careerPriority(job).rank,state,now).run();
 }
}
export async function claimReel(db:D1Database,now=Date.now()){
 const control=await db.prepare('SELECT instagram_enabled FROM publishing_control WHERE id=1').first<{instagram_enabled:number}>();
 if(!control?.instagram_enabled)return null;
 await db.prepare("UPDATE social_jobs SET status='waiting_media',lease_until=0 WHERE status='rendering' AND lease_until<?").bind(now).run();
 const row=await db.prepare("UPDATE social_jobs SET status='rendering',lease_until=? WHERE listing_id=(SELECT s.listing_id FROM social_jobs s JOIN listings l ON l.id=s.listing_id WHERE s.status='waiting_media' AND l.status='published' ORDER BY s.priority,s.created_at LIMIT 1) AND status='waiting_media' RETURNING listing_id").bind(now+15*60000).first<{listing_id:string}>();
 if(!row)return null;
 const listing=await db.prepare("SELECT data FROM listings WHERE id=? AND status='published'").bind(row.listing_id).first<{data:string}>();
 if(!listing)return null;
 const job=JSON.parse(listing.data);
 if(job.deadline!=='Not specified'&&job.deadline<indiaToday()){
  await db.prepare("UPDATE social_jobs SET status='held',last_error='The application deadline has passed.' WHERE listing_id=?").bind(row.listing_id).run();return null;
 }
 return {...job,id:row.listing_id,career:careerPriority(job).label};
}
export function reelHashtags(job:any){
 const title=String(job.title||'');
 const role=job.category==='Government'?'GovernmentJobs':[
  [/front[ -]?end/i,'FrontendDeveloper'],[/back[ -]?end/i,'BackendDeveloper'],[/full[ -]?stack/i,'FullStackDeveloper'],
  [/software|developer/i,'SoftwareEngineer'],[/data scientist/i,'DataScienceJobs'],[/data analyst/i,'DataAnalyst'],
  [/devops|site reliability/i,'DevOpsJobs'],[/quality assurance|\bQA\b|\bSDET\b|test engineer/i,'TestingJobs'],
  [/sales|account executive/i,'SalesJobs'],[/marketing/i,'MarketingJobs'],[/human resources|recruiter|\bHR\b/i,'HRJobs'],
  [/design/i,'DesignJobs'],[/engineer/i,'EngineeringJobs'],
 ].find(([pattern])=>(pattern as RegExp).test(title))?.[1]||'JobOpenings';
 const location=String(job.location||'');
 const place=job.remote?'RemoteJobs':job.region==='India'||/\bIndia\b/i.test(location)?'JobsInIndia':/\bUnited States\b|\bUSA\b/i.test(location)?'JobsInUSA':job.region==='Europe'?'JobsInEurope':'Hiring';
 const priority=careerPriority(job).rank,career=priority===0?'FreshersJobs':priority===1?'EarlyCareerJobs':priority===2?'ExperiencedJobs':'JobOpenings';
 return [...new Set(['JobVeylo',String(role),place,career,'ATSResume'])].map(tag=>'#'+tag).join(' ');
}
export function reelCaption(job:any,origin:string){
 const salary=String(job.salary||'').trim();
 const pay=salary&&!/^(?:not\b|n\/?a\b|tbd\b|unknown\b|undisclosed\b|competitive\b|negotiable\b|see\b)/i.test(salary)?'\n💰 Salary: '+salary.slice(0,150):'';
 return `💼 ${job.company} — ${job.title}\n📍 ${job.location}\n💻 Experience: ${String(job.experience).slice(0,120)}\n🎓 ${String(job.education).slice(0,160)}${pay}\n\n📄 Tailor an ATS-friendly resume for this job on JobVeylo.\nUpload → tailor → review & download.\n\n🔗 Job details + resume tool:\n${origin}/jobs/${job.id}\n\nOpen “Tailor resume for this job” on the job page.\nJobVeylo • Check the latest employer notice before applying.\n\n${reelHashtags(job)}`;
}
async function activeEmployer(job:any,fetcher:typeof fetch){
 const source=collectionSources.find(s=>s.company===job.company&&['ashby','lever','greenhouse'].includes(s.kind));
 if(!source)return false;
 const index=sourceIndex(source,await readSource(source.url,fetcher));
 return index.rows.some((row:any)=>canonicalJobUrl(row.jobUrl||row.hostedUrl||row.absolute_url)===canonicalJobUrl(job.url));
}
export async function runInstagramPublishing(env:SocialEnv,options:{now?:number;fetcher?:typeof fetch;startNew?:boolean}={}){
 if(!instagramReady(env))return {state:'connection_required'};
 const now=options.now??Date.now(),fetcher=options.fetcher||fetch;
 const control=await env.DB.prepare('SELECT instagram_enabled FROM publishing_control WHERE id=1').first<{instagram_enabled:number}>();
 if(!control?.instagram_enabled)return {state:'paused'};
 // A terminated request may have reached Meta. Hold it for reconciliation instead of retrying or blocking the entire queue.
 await env.DB.prepare("UPDATE social_jobs SET status='held',last_error='Interrupted Instagram request; reconcile before retrying.',lease_until=0 WHERE status IN ('creating','publishing') AND lease_until<?").bind(now).run();
 const token=instagramToken(env),account=env.INSTAGRAM_ACCOUNT_ID!;
 async function graph(path:string,body?:Record<string,string>){
  const response=await fetcher('https://graph.instagram.com/v25.0/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'User-Agent':'JobVeylo-Publisher/1.0',...(body?{'Content-Type':'application/x-www-form-urlencoded'}:{})},body:body?new URLSearchParams(body):undefined,signal:AbortSignal.timeout(15000),redirect:'manual'});
  if(response.status>=300&&response.status<400)throw Error('Instagram redirect refused');
  const data:any=await response.json();if(!response.ok||data.error)throw Error('Instagram API request failed'+(data.error?.code?' (code '+Number(data.error.code)+')':''));return data;
 }
 // Only one invocation may process a particular container at a time.
 const processing=await env.DB.prepare("UPDATE social_jobs SET lease_until=? WHERE listing_id=(SELECT listing_id FROM social_jobs WHERE status='processing' AND lease_until<? ORDER BY created_at LIMIT 1) AND status='processing' AND lease_until<? RETURNING listing_id,container_id").bind(now+120000,now,now).first<{listing_id:string;container_id:string}>();
 if(processing){
  try{
   const state=await graph(processing.container_id+'?fields=status_code');
   if(state.status_code==='FINISHED'){
    const latest=await env.DB.prepare("SELECT MAX(published_at) AS latest FROM social_jobs WHERE status='published'").first<{latest:string|null}>();
    if(latest?.latest&&now-Date.parse(latest.latest)<1800000){await env.DB.prepare('UPDATE social_jobs SET lease_until=0 WHERE listing_id=?').bind(processing.listing_id).run();return {state:'spacing_guard'}}
    const allowed=await env.DB.prepare("UPDATE social_jobs SET status='publishing' WHERE listing_id=? AND status='processing' RETURNING listing_id").bind(processing.listing_id).first();
    if(allowed){
     // An ambiguous publish result is held, never blindly retried.
     const published=await graph(account+'/media_publish',{creation_id:processing.container_id});
     if(!/^\d+$/.test(published.id||''))throw Error('Instagram did not return a media ID');
     await env.DB.prepare("UPDATE social_jobs SET status='published',instagram_id=?,published_at=?,lease_until=0,last_error=NULL WHERE listing_id=?").bind(published.id,new Date(now).toISOString(),processing.listing_id).run();
    }
   }else if(['ERROR','EXPIRED','PUBLISHED'].includes(state.status_code)){
    await env.DB.prepare("UPDATE social_jobs SET status='held',last_error=?,lease_until=0 WHERE listing_id=?").bind(state.status_code==='PUBLISHED'?'Container already published; reconciliation required.':'Instagram could not process the media.',processing.listing_id).run();
   }else await env.DB.prepare('UPDATE social_jobs SET lease_until=0 WHERE listing_id=?').bind(processing.listing_id).run();
  }catch{
   await env.DB.prepare("UPDATE social_jobs SET status='held',last_error='Instagram processing or publication outcome needs reconciliation; no automatic duplicate retry.',lease_until=0 WHERE listing_id=?").bind(processing.listing_id).run();
  }
 }
 if(!options.startNew)return {state:'polled'};
 const inFlight=await env.DB.prepare("SELECT listing_id FROM social_jobs WHERE status IN ('processing','creating','publishing') LIMIT 1").first();
 if(inFlight)return {state:'processing'};
 const ready=await env.DB.prepare("SELECT s.listing_id FROM social_jobs s JOIN listings l ON l.id=s.listing_id WHERE s.status='media_ready' AND l.status='published' LIMIT 1").first();
 if(!ready)return {state:'waiting_for_media'};
 const slot=Math.floor(now/1800000);
 const reserved=await env.DB.prepare("INSERT INTO instagram_slots(slot,status,created_at) VALUES(?,'checking',?) ON CONFLICT DO NOTHING RETURNING slot").bind(slot,new Date(now).toISOString()).first();
 if(!reserved)return {state:'already_checked'};
 const row=await env.DB.prepare("UPDATE social_jobs SET status='creating',lease_until=? WHERE listing_id=(SELECT s.listing_id FROM social_jobs s JOIN listings l ON l.id=s.listing_id WHERE s.status='media_ready' AND l.status='published' ORDER BY s.priority,s.created_at LIMIT 1) AND status='media_ready' RETURNING listing_id,media_key,media_created_at").bind(now+120000).first<{listing_id:string;media_key:string;media_created_at:string}>();
 if(!row)return {state:'waiting_for_media'};
 let stage='profile authentication';
 try{
  const profile=await graph(account+'?fields=id,username');if(String(profile.username).toLowerCase()!=='jobveylo')throw Error('Connected Instagram account is not JobVeylo');
  stage='source verification';
  const stored=await env.DB.prepare("SELECT data FROM listings WHERE id=? AND status='published'").bind(row.listing_id).first<{data:string}>();if(!stored)throw Error('Listing is unavailable');
  const job={...JSON.parse(stored.data),id:row.listing_id};
  if((job.deadline!=='Not specified'&&job.deadline<indiaToday())||!await activeEmployer(job,fetcher))throw Error('Employer opening could not be reverified');
  if(!row.media_created_at||now-Date.parse(row.media_created_at)>6*86400000)throw Error('Reel media has expired');
  stage='media creation';
  const media=await graph(account+'/media',{media_type:'REELS',video_url:env.SITE_URL+'/api/reel-media/'+row.listing_id+'.mp4',caption:reelCaption(job,env.SITE_URL),share_to_feed:'true'});
  if(!/^\d+$/.test(media.id||''))throw Error('Instagram did not return a container ID');
  await env.DB.batch([
   env.DB.prepare("UPDATE social_jobs SET status='processing',container_id=?,lease_until=0,attempts=attempts+1,last_error=NULL WHERE listing_id=?").bind(media.id,row.listing_id),
   env.DB.prepare("UPDATE instagram_slots SET listing_id=?,status='processing' WHERE slot=?").bind(row.listing_id,slot),
  ]);
  return {state:'processing',id:row.listing_id};
 }catch(error){
  const code=/^Instagram API request failed \(code (\d+)\)$/.exec((error as Error)?.message||'')?.[1];
  await env.DB.prepare("UPDATE social_jobs SET status='held',last_error=?,lease_until=0 WHERE listing_id=?").bind('Instagram '+stage+' failed'+(code?' (API code '+code+')':'')+'. Inspect configuration before retrying.',row.listing_id).run();
  return {state:'held'};
 }
}
