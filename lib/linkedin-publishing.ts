import {activeEmployer,reelHashtags} from './instagram-publishing.ts';
import {careerPriority} from './job-priority.ts';
import {indiaToday} from './collection-sources.ts';
import {campaignLink} from './traffic-links.ts';

export type LinkedInEnv={DB:D1Database;SITE_URL:string;BUFFER_API_KEY?:string;BUFFER_CHANNEL_ID?:string};
type Control={enabled:number;organization_id:string|null;channel_id:string|null;channel_name:string|null;checked_at:number;reconciled_at:number};
const literal=(value:string)=>JSON.stringify(value);
async function buffer(env:LinkedInEnv,query:string,fetcher:typeof fetch){
 const key=String(env.BUFFER_API_KEY||'').trim();
 if(!key||! /^[\x21-\x7e]+$/.test(key))throw Error('Buffer key missing or invalid');
 const response=await fetcher('https://api.buffer.com',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({query}),redirect:'manual',signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('Buffer HTTP '+response.status);
 const result:any=await response.json();
 if(result.errors?.length||!result.data)throw Error('Buffer rejected the query');
 return result.data;
}
export function linkedinCaption(job:any,origin:string){
 const line=(value:unknown,max=160)=>String(value||'').replace(/[\r\n]+/g,' ').slice(0,max).trim();
 const education=line(job.education),salary=line(job.salary);
 return [`💼 ${line(job.company,100)} — ${line(job.title,220)}`,`📍 ${line(job.location)}`,`💻 Experience: ${line(job.experience)}`,
 education&&!/^(not specified|unknown|n\/a)$/i.test(education)?'🎓 '+education:'',
 salary&&!/^(not\b|n\/?a\b|tbd\b|unknown\b|undisclosed\b|competitive\b|negotiable\b|see\b)/i.test(salary)?'💰 Salary: '+salary:''].filter(Boolean).join('\n')+
 `\n\n🔗 Details & application:\n${campaignLink(origin,'/jobs/'+encodeURIComponent(job.id),'linkedin','job_post',job.id)}\n\n📄 Tailor an ATS-friendly resume for this job on JobVeylo.\nUpload → tailor → review & download.\n\nJobVeylo • Check the latest employer notice before applying.\n\n${reelHashtags(job)}`;
}
export async function checkLinkedInConnection(env:LinkedInEnv,options:{fetcher?:typeof fetch;now?:number}={}){
 if(!env.BUFFER_API_KEY||!env.BUFFER_CHANNEL_ID)return {state:'connection_required',message:'Save BUFFER_API_KEY privately on the collector.'};
 const fetcher=options.fetcher||fetch;
 try{
  const data=await buffer(env,'query { account { organizations { id name } } }',fetcher);
  for(const org of (data.account?.organizations||[]).slice(0,3)){
   const result=await buffer(env,`query { channels(input:{organizationId:${literal(org.id)}}) { id name service } }`,fetcher);
   const channel=result.channels?.find((c:any)=>c.id===env.BUFFER_CHANNEL_ID&&c.service==='linkedin');
   if(!channel)continue;
   // Buffer's General settings link this exact channel to linkedin.com/in/jobveylo-68b006447.
   // The live read-only API check returned the same profile slug. Keep both identity checks.
   if(channel.name!=='jobveylo-68b006447')return {state:'wrong_account',message:'Publishing paused: Buffer API profile label is '+String(channel.name||'unknown').slice(0,100)+'. Verify this against the connected profile in Buffer.',channelId:channel.id};
   await env.DB.prepare('UPDATE linkedin_control SET organization_id=?,channel_id=?,channel_name=?,checked_at=? WHERE id=1').bind(org.id,channel.id,channel.name,options.now??Date.now()).run();
   return {state:'connected',message:'Buffer authenticated the LinkedIn profile JobVeylo .',channel:channel.name};
  }
  return {state:'wrong_account',message:'The approved LinkedIn channel was not found in this Buffer account.'};
 }catch{return {state:'connection_failed',message:'Buffer authentication or account lookup failed. Check the key permissions and expiry; no post was attempted.'}}
}
async function reconcile(env:LinkedInEnv,control:Control,now:number,fetcher:typeof fetch){
 if(now-control.reconciled_at<3600000)return;
 // Atomic hourly lease: one batched HTTP request, including across concurrent cron/manual runs.
 const claim=await env.DB.prepare('UPDATE linkedin_control SET reconciled_at=? WHERE id=1 AND reconciled_at=? RETURNING id').bind(now,control.reconciled_at).first();
 if(!claim)return;
 const pending=await env.DB.prepare("SELECT listing_id,buffer_id FROM linkedin_jobs WHERE status='scheduled' AND buffer_id IS NOT NULL LIMIT 10").all<{listing_id:string;buffer_id:string}>();
 if(!pending.results.length)return;
 const query='query { '+pending.results.map((row,i)=>`p${i}:post(input:{id:${literal(row.buffer_id)}}) { id status channelId }`).join(' ')+' }';
 const data=await buffer(env,query,fetcher);
 for(let i=0;i<pending.results.length;i++){
  const post=data['p'+i];if(!post||post.channelId!==control.channel_id)continue;
  const status=String(post.status).toLowerCase();
  if(status==='sent')await env.DB.prepare("UPDATE linkedin_jobs SET status='sent',sent_at=?,last_error=NULL WHERE listing_id=? AND status='scheduled'").bind(new Date(now).toISOString(),pending.results[i].listing_id).run();
  else if(status==='error')await env.DB.prepare("UPDATE linkedin_jobs SET status='held',last_error='Buffer reported a delivery error. Review the post in Buffer before retrying.' WHERE listing_id=? AND status='scheduled'").bind(pending.results[i].listing_id).run();
 }
}
export async function runLinkedInPublishing(env:LinkedInEnv,options:{fetcher?:typeof fetch;now?:number}={}){
 const now=options.now??Date.now(),lease=now+120000;
 const claimed=await env.DB.prepare('UPDATE linkedin_control SET publishing_until=? WHERE id=1 AND publishing_until<? RETURNING id').bind(lease,now).first();
 if(!claimed)return {state:'busy'};
 try{return await publishSlot(env,{...options,now})}finally{await env.DB.prepare('UPDATE linkedin_control SET publishing_until=0 WHERE id=1 AND publishing_until=?').bind(lease).run()}
}
async function publishSlot(env:LinkedInEnv,options:{fetcher?:typeof fetch;now?:number}={}){
 const now=options.now??Date.now(),fetcher=options.fetcher||fetch;
 const control=await env.DB.prepare('SELECT * FROM linkedin_control WHERE id=1').first<Control>();
 if(!control?.enabled)return {state:'paused'};
 if(!env.BUFFER_API_KEY||!env.BUFFER_CHANNEL_ID)return {state:'connection_required'};
 const global=await env.DB.prepare('SELECT enabled FROM publishing_control WHERE id=1').first<{enabled:number}>();
 if(!global?.enabled)return {state:'paused'};
 try{
  if(!control.organization_id||control.channel_id!==env.BUFFER_CHANNEL_ID||now-control.checked_at>86400000){
   const connection=await checkLinkedInConnection(env,{fetcher,now});if(connection.state!=='connected')return connection;
   Object.assign(control,await env.DB.prepare('SELECT * FROM linkedin_control WHERE id=1').first());
  }
  await reconcile(env,control,now,fetcher);
 }catch{return {state:'connection_failed'}}
 await env.DB.prepare("UPDATE linkedin_jobs SET status='held',lease_until=0,last_error='Interrupted Buffer request; inspect Buffer before retrying to avoid duplicates.' WHERE status='creating' AND lease_until<?").bind(now).run();
 const outstanding=await env.DB.prepare("SELECT COUNT(*) AS n FROM linkedin_jobs WHERE status IN ('creating','scheduled')").first<{n:number}>();
 if((outstanding?.n||0)>=8)return {state:'queue_buffered'};
 // Seed public listings only; priority is shared with website/Instagram. Each listing is permanently deduplicated.
 const listings=await env.DB.prepare("SELECT l.id,l.data,l.updated_at FROM listings l LEFT JOIN linkedin_jobs s ON s.listing_id=l.id WHERE l.status='published' AND s.listing_id IS NULL").all<{id:string;data:string;updated_at:string}>();
 for(const row of listings.results){const job=JSON.parse(row.data);await env.DB.prepare('INSERT INTO linkedin_jobs(listing_id,priority,created_at) VALUES(?,?,?) ON CONFLICT DO NOTHING').bind(row.id,careerPriority(job).rank,row.updated_at).run()}
 const latest=await env.DB.prepare("SELECT MAX(due_at) AS latest FROM linkedin_jobs WHERE status IN ('scheduled','sent','creating','held') AND due_at IS NOT NULL").first<{latest:string|null}>();
 // Small cron timing differences should move the due time, not skip every second slot.
 const due=new Date(Math.max(now+120000,latest?.latest?Date.parse(latest.latest)+1800000:0)).toISOString();
 const slot=Math.floor(now/1800000),created=new Date(now).toISOString();
 const reserved=await env.DB.prepare("INSERT INTO linkedin_slots(slot,status,created_at) VALUES(?,'checking',?) ON CONFLICT DO NOTHING RETURNING slot").bind(slot,created).first();
 if(!reserved)return {state:'already_checked'};
 for(let checked=0;checked<8;checked++){
 const row=await env.DB.prepare("UPDATE linkedin_jobs SET status='creating',lease_until=? WHERE listing_id=(SELECT s.listing_id FROM linkedin_jobs s JOIN listings l ON l.id=s.listing_id WHERE s.status='waiting' AND l.status='published' ORDER BY s.priority,s.created_at LIMIT 1) AND status='waiting' RETURNING listing_id").bind(now+120000).first<{listing_id:string}>();
 if(!row){await env.DB.prepare("UPDATE linkedin_slots SET status='empty' WHERE slot=?").bind(slot).run();return {state:'empty'}}
 let attempted=false;
 try{
  const stored=await env.DB.prepare("SELECT data FROM listings WHERE id=? AND status='published'").bind(row.listing_id).first<{data:string}>();if(!stored)throw Error('Unavailable');
  const job={...JSON.parse(stored.data),id:row.listing_id};
  if(job.deadline&&job.deadline!=='Not specified'&&job.deadline<indiaToday())throw Error('Expired');
  if(!await activeEmployer(job,fetcher))throw Error('Source unavailable');
  const allowed=await env.DB.prepare('SELECT enabled FROM linkedin_control WHERE id=1').first<{enabled:number}>();if(!allowed?.enabled)throw Error('Paused');
  await env.DB.prepare('UPDATE linkedin_jobs SET due_at=? WHERE listing_id=?').bind(due,row.listing_id).run();
  attempted=true;
  const data=await buffer(env,`mutation { createPost(input:{text:${literal(linkedinCaption(job,env.SITE_URL))},channelId:${literal(env.BUFFER_CHANNEL_ID)},schedulingType:automatic,mode:customScheduled,dueAt:${literal(due)}}) { ... on PostActionSuccess { post { id dueAt } } ... on MutationError { message } } }`,fetcher);
  const post=data.createPost?.post;
  if(!post?.id)throw Error('Buffer rejected publication');
  await env.DB.batch([
   env.DB.prepare("UPDATE linkedin_jobs SET status='scheduled',buffer_id=?,due_at=?,lease_until=0,last_error=NULL WHERE listing_id=?").bind(post.id,post.dueAt||due,row.listing_id),
   env.DB.prepare("UPDATE linkedin_slots SET status='scheduled',listing_id=? WHERE slot=?").bind(row.listing_id,slot),
  ]);
  return {state:'scheduled',id:row.listing_id,dueAt:post.dueAt||due};
 }catch{
  await env.DB.batch([
   env.DB.prepare("UPDATE linkedin_jobs SET status='held',lease_until=0,last_error=? WHERE listing_id=?").bind(attempted?'Buffer request outcome needs review. No automatic duplicate retry.':'Source verification failed or publishing paused. No post attempted.',row.listing_id),
   env.DB.prepare("UPDATE linkedin_slots SET status='held',listing_id=? WHERE slot=?").bind(row.listing_id,slot),
  ]);if(attempted)return {state:'held'};
 }
 }
 await env.DB.prepare("UPDATE linkedin_slots SET status='empty' WHERE slot=?").bind(slot).run();
 return {state:'empty'};
}
