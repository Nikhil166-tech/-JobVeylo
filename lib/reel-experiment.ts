import {careerPriority,experienceBounds} from './job-priority.ts';
export type ReelExperiment={starts_at:number;ends_at:number;version:string;enabled:number};
export const experiment=(db:D1Database)=>db.prepare('SELECT * FROM reel_experiment WHERE id=1').first<ReelExperiment>();
export function reelWindow(now:number,render=false){
 const local=now+330*60000,day=Math.floor(local/86400000),minute=Math.floor(local%86400000/60000);
 for(const hour of [9,13,19])if(minute>=hour*60-(render?60:0)&&minute<hour*60+30)return {slot:Math.floor((day*86400000+hour*3600000-330*60000)/1800000),label:hour+':00 IST'};
 return null;
}
export function eligibleReel(job:any){
 const p=careerPriority(job);
 const bounds=experienceBounds([job.experience||'',...(job.requirements||[]).filter((line:string)=>!/^topics referenced/i.test(line))].join('\n'));
 // Instagram is strictly 0–2 years; website collection keeps its broader audience.
 if(p.minimum===null||p.minimum>2||bounds.some(b=>b.min>2||(b.max!==null&&b.max>2)))return false;
 // Unknown experience does not become fresher eligibility. Internships are labelled as internships.
 return p.rank<=1&&(!/\b(?:senior|principal|staff|lead|manager|director|architect)\b/i.test(job.title||''))&&!(job.deadline&&job.deadline!=='Not specified'&&job.deadline<new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'}));
}
export function experienceHook(job:any){
 return /\bintern(?:ship)?\b/i.test(job.title||'')?'INTERNSHIP':String(job.experience||'').replace(/—.*$/,'').trim().slice(0,70);
}
export async function prepareReelTest(db:D1Database,test:ReelExperiment,now=Date.now()){
 const rows=await db.prepare("SELECT s.listing_id,l.data,t.listing_id AS assigned FROM social_jobs s JOIN listings l ON l.id=s.listing_id LEFT JOIN reel_test_jobs t ON t.listing_id=s.listing_id WHERE s.status IN ('waiting_media','rendering','media_ready','creating','processing') AND l.status='published' ORDER BY s.priority,s.created_at LIMIT 300").all<{listing_id:string;data:string;assigned:string|null}>();
 for(const row of rows.results){
  const job=JSON.parse(row.data);
  if(!eligibleReel(job)){await db.prepare("UPDATE social_jobs SET status='excluded',last_error='Outside the 0–2-year / internship Instagram test audience.',lease_until=0 WHERE listing_id=? AND status NOT IN ('published','publishing')").bind(row.listing_id).run();continue}
  if(row.assigned)continue;
  const stratum=(job.region==='India'?'India':'Overseas')+(/\bintern(?:ship)?\b/i.test(job.title)?' internship':' early career');
  const count=await db.prepare('SELECT COUNT(*) AS n FROM reel_test_jobs WHERE version=? AND stratum=?').bind(test.version,stratum).first<{n:number}>();
  await db.batch([
   db.prepare('INSERT INTO reel_test_jobs(listing_id,variant,stratum,version,assigned_at) VALUES(?,?,?,?,?) ON CONFLICT DO NOTHING').bind(row.listing_id,(count?.n||0)%2?'B':'A',stratum,test.version,now),
   // Old videos cannot leak into the new experiment. An already published reel is never requeued.
   db.prepare("UPDATE social_jobs SET status='waiting_media',lease_until=0,media_key=NULL,media_created_at=NULL,container_id=NULL,last_error=NULL WHERE listing_id=? AND status IN ('waiting_media','rendering','media_ready','creating','processing')").bind(row.listing_id),
  ]);
 }
}
export async function collectReelTestInsights(env:{DB:D1Database;INSTAGRAM_ACCESS_TOKEN?:string},options:{now?:number;fetcher?:typeof fetch}={}){
 const test=await experiment(env.DB);if(!test||!env.INSTAGRAM_ACCESS_TOKEN)return {state:'not_configured'};
 const now=options.now??Date.now();
 // Continue measuring final posts for 72 hours after the publishing test ends.
 if(now>test.ends_at+4*86400000)return {state:'complete'};
 const due=await env.DB.prepare("SELECT t.listing_id,s.instagram_id,s.published_at FROM reel_test_jobs t JOIN social_jobs s ON s.listing_id=t.listing_id WHERE s.status='published' AND t.version=?").bind(test.version).all<{listing_id:string;instagram_id:string;published_at:string}>();
 let checked=0;
 for(const row of due.results)for(const age of [24,72]){
  const ageMs=now-Date.parse(row.published_at);if(ageMs<age*3600000||checked>=4)continue;
  if(ageMs>(age+3)*3600000){await env.DB.prepare("INSERT INTO reel_test_insights(listing_id,age_hours,status) VALUES(?,?,'missed_window') ON CONFLICT DO NOTHING").bind(row.listing_id,age).run();continue}
  await env.DB.prepare("INSERT INTO reel_test_insights(listing_id,age_hours,status) VALUES(?,?,'pending') ON CONFLICT DO NOTHING").bind(row.listing_id,age).run();
  const claim=await env.DB.prepare("UPDATE reel_test_insights SET next_attempt=?,attempts=attempts+1 WHERE listing_id=? AND age_hours=? AND status='pending' AND next_attempt<=? AND attempts<4 RETURNING attempts").bind(now+6*3600000,row.listing_id,age,now).first();if(!claim)continue;
  checked++;
  try{
   const response=await (options.fetcher||fetch)('https://graph.instagram.com/v25.0/'+row.instagram_id+'/insights?metric=views,reach,likes,comments,saved,shares,ig_reels_avg_watch_time',{headers:{Authorization:'Bearer '+env.INSTAGRAM_ACCESS_TOKEN.trim()},redirect:'manual',signal:AbortSignal.timeout(15000)});
   const data:any=await response.json();if(!response.ok||data.error){await env.DB.prepare("UPDATE reel_test_insights SET status=?,error_code=? WHERE listing_id=? AND age_hours=?").bind([10,190,200].includes(Number(data.error?.code))?'access_required':'pending',Number(data.error?.code)||response.status,row.listing_id,age).run();continue}
   const metrics:Record<string,number>={};for(const item of data.data||[]){const value=item.values?.[0]?.value??item.total_value?.value;if(typeof value==='number'&&Number.isFinite(value)&&value>=0)metrics[item.name]=value}
   if(typeof metrics.ig_reels_avg_watch_time==='number')metrics.average_watch_seconds=metrics.ig_reels_avg_watch_time/1000;
   // Empty/unsupported data is unavailable, never a fabricated zero.
   await env.DB.prepare('UPDATE reel_test_insights SET status=?,measured_at=?,metrics=? WHERE listing_id=? AND age_hours=?').bind(Object.keys(metrics).length?'measured':'unavailable',now,JSON.stringify(metrics),row.listing_id,age).run();
  }catch{/* Bounded read-only retry at the next attempt time. No token/error text is stored. */}
 }
 return {state:'checked',count:checked};
}
export async function checkReelInsightsAccess(env:{DB:D1Database;INSTAGRAM_ACCESS_TOKEN?:string}){
 const row=await env.DB.prepare("SELECT instagram_id FROM social_jobs WHERE status='published' AND instagram_id IS NOT NULL ORDER BY published_at DESC LIMIT 1").first<{instagram_id:string}>();
 if(!row||!env.INSTAGRAM_ACCESS_TOKEN)return {state:'unavailable'};
 try{
  const response=await fetch('https://graph.instagram.com/v25.0/'+row.instagram_id+'/insights?metric=views,reach,likes,comments,saved,shares,ig_reels_avg_watch_time',{headers:{Authorization:'Bearer '+env.INSTAGRAM_ACCESS_TOKEN.trim()},redirect:'manual',signal:AbortSignal.timeout(15000)});
  const data:any=await response.json();return response.ok&&!data.error?{state:'available',message:'Insights access is available for the 24/72-hour snapshots.'}:{state:'access_required',code:Number(data.error?.code)||response.status,message:'Instagram Insights access is not available with the current token. The test can publish; measurement needs an authorised Insights connection.'};
 }catch{return {state:'unavailable',message:'Insights check did not complete. No credentials were exposed.'}}
}
