import {collectionSources,sourceIndex,candidateFromRow,canonicalJobUrl,readSource,indiaToday,type CollectedJob} from './collection-sources.ts';
import {careerPriority} from './job-priority.ts';
import {input,canPublish} from './validation.ts';

const knownTopics=['JavaScript','TypeScript','React','Python','Go','Node.js','SQL','NoSQL','AWS','Azure','GCP','Kubernetes','Docker','Kotlin','Flutter','Java','Salesforce','HubSpot','BigQuery','Linux','Windows','HTTP','DNS','TLS'];
export function locationConflict(description:string,location:string){
 const stated=description.match(/Available Locations?\s*:?\s*\n+([^\n]+)/i)?.[1]?.trim();
 if(!stated||!/^[A-Za-z ]+,/.test(stated))return false;
 const city=stated.split(',')[0].toLowerCase().replace('bangalore','bengaluru');
 return !location.toLowerCase().replace('bangalore','bengaluru').includes(city);
}
export function expiredDeadline(description:string,today=indiaToday()){
 const value=description.match(/(?:Application deadline|Closing date|Apply by|Last date)\s*:?\s*([^\n]{1,100})/i)?.[1];
 if(!value)return false;
 const iso=value.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1];if(iso)return iso<today;
 const date=value.match(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+20\d{2}\b/i)?.[0];
 if(!date)return false;const parsed=Date.parse(date+' 12:00:00 GMT');return Number.isFinite(parsed)&&new Date(parsed).toISOString().slice(0,10)<today;
}
export function automaticJob(raw:CollectedJob){
 const job={...raw},body=job.details;
 const topics=knownTopics.filter(term=>new RegExp('(?<![A-Za-z])'+term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![A-Za-z])','i').test(body)).slice(0,10);
 const p=careerPriority(job);
 job.level=p.rank===0?/intern/i.test(job.title)?'Internship':'Fresher':'Experienced';
 job.summary=`${job.company} has an active ${job.title} opening in ${job.location}. This is an automatically checked summary of employer-provided facts, with the original notice and application destination linked below.`;
 job.details=[`Position: ${job.title}.`,`Location stated by the employer: ${job.location}.`,`Experience wording found in the notice: ${job.experience}.`,topics.length?'Technologies and work areas mentioned: '+topics.join(', ')+'. Mention does not mean every item is mandatory.':'Read the full employer notice for responsibilities and role-specific skills.','Required and preferred qualifications, location eligibility and employment terms must be checked in the original notice.'].join('\n');
 job.requirements=[`Experience: ${job.experience}.`,`Education: ${job.education}.`,'Check the original notice for the complete mandatory and preferred criteria, language requirements and work-authorisation conditions.'];
 job.selection='A complete selection sequence has not been automatically verified. Follow the employer’s current notice and recruiter instructions.';
 job.howToApply='Open Apply to reach the original employer listing.\nCheck eligibility, employment location and current availability.\nComplete the employer’s application form and provide the documents requested there.';
 job.note='Published automatically under the owner’s standing instruction after a live employer-feed check. This is a brief factual summary, not a complete reproduction of the employer notice. Unknown details and selection rounds have not been inferred.';
 job.checked=indiaToday();job.status='published';job.reviewed=true;job.tags=topics.slice(0,6);
 return input.parse(job);
}
export async function runAutomaticPublishing(db:D1Database,options:{now?:number;fetcher?:typeof fetch}={}){
 const now=options.now??Date.now(),slot=Math.floor(now/1800000),time=new Date(now).toISOString();
 const control=await db.prepare('SELECT enabled FROM publishing_control WHERE id=1').first<{enabled:number}>();
 if(!control?.enabled)return {state:'paused'};
 const claimed=await db.prepare("INSERT INTO publishing_slots(slot,status,created_at) VALUES(?,'checking',?) ON CONFLICT DO NOTHING RETURNING slot").bind(slot,time).first();
 if(!claimed)return {state:'already_checked'};
 try{
  const pending=await db.prepare("SELECT c.* FROM collection_items c LEFT JOIN publishing_holds h ON h.collection_id=c.id WHERE c.status='pending' AND c.discovery_only=0 AND c.missing_count<2 AND h.collection_id IS NULL AND EXISTS(SELECT 1 FROM collection_sources s WHERE s.id=c.source_id AND s.enabled=1)").all<{id:string;source_id:string;external_id:string;data:string;first_seen:string}>();
  const ranked=pending.results.map(row=>({...row,job:JSON.parse(row.data)})).sort((a,b)=>careerPriority(a.job).rank-careerPriority(b.job).rank||a.first_seen.localeCompare(b.first_seen));
  const current=await db.prepare("SELECT id,source_url FROM listings WHERE status<>'archived'").all<{id:string;source_url:string}>();
  const listed=new Set(current.results.map(row=>canonicalJobUrl(row.source_url)));
  const indexes=new Map<string,any>();let checked=0;
  for(const row of ranked){
   if(checked++>=8)break;
   const source=collectionSources.find(s=>s.id===row.source_id);if(!source||!['ashby','lever','greenhouse'].includes(source.kind))continue;
   if(!indexes.has(source.id)){try{indexes.set(source.id,sourceIndex(source,await readSource(source.url,options.fetcher)))}catch{indexes.set(source.id,null)}}
   const index=indexes.get(source.id);if(!index)continue;
   const found=index.rows.find((entry:any)=>String(entry.id)===row.external_id);if(!found)continue;
   const hydrated=source.kind==='greenhouse'?JSON.parse(await readSource(source.url+'/'+row.external_id,options.fetcher)):found;
   const candidate=candidateFromRow(source,hydrated);if(candidate.discoveryOnly||listed.has(canonicalJobUrl(candidate.job.url)))continue;
   if(locationConflict(candidate.job.details,candidate.job.location)||expiredDeadline(candidate.job.details)){
    await db.prepare('INSERT INTO publishing_holds(collection_id,reason,updated_at) VALUES(?,?,?) ON CONFLICT(collection_id) DO UPDATE SET reason=excluded.reason,updated_at=excluded.updated_at').bind(row.id,'Employer location conflict or expired deadline needs correction.',time).run();continue;
   }
   const job=automaticJob(candidate.job);
   if(job.location==='Not specified'||/^(?:Hybrid|Distributed|In-Office)$/i.test(job.location)||candidate.job.details.length<200)continue;
   if(job.deadline!=='Not specified'&&job.deadline<indiaToday())continue;
   canPublish(job);
   const id='collected-'+row.id.slice(4,36),{reviewed,...fields}=job;
   const data={...fields,id,initial:job.company[0].toUpperCase(),version:1,publishedAt:time,updatedAt:time};
   await db.batch([
    db.prepare("INSERT INTO listings(id,data,source_url,status,version,updated_at) SELECT ?,?,?,'published',1,? WHERE EXISTS(SELECT 1 FROM collection_items WHERE id=? AND status='pending') ON CONFLICT DO NOTHING").bind(id,JSON.stringify(data),job.url,time,row.id),
    db.prepare("UPDATE collection_items SET status='imported',listing_id=? WHERE id=? AND status='pending' AND EXISTS(SELECT 1 FROM listings WHERE id=? AND status='published')").bind(id,row.id,id),
    db.prepare("INSERT INTO social_jobs(listing_id,priority,created_at) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM listings WHERE id=? AND status='published') ON CONFLICT DO NOTHING").bind(id,careerPriority(job).rank,time,id),
    db.prepare("UPDATE publishing_slots SET status='published',listing_id=?,message='Live employer feed checked; automatic publication.' WHERE slot=? AND EXISTS(SELECT 1 FROM listings WHERE id=? AND status='published')").bind(id,slot,id),
   ]);
   const result=await db.prepare('SELECT status,listing_id FROM publishing_slots WHERE slot=?').bind(slot).first<{status:string;listing_id:string}>();
   if(result?.status==='published')return {state:'published',id:result.listing_id,priority:careerPriority(job).label};
  }
  await db.prepare("UPDATE publishing_slots SET status='empty',message='No eligible source-verified opening was available.' WHERE slot=?").bind(slot).run();
  return {state:'empty'};
 }catch{
  await db.prepare("UPDATE publishing_slots SET status='failed',message='Source verification or publication failed; no catch-up burst will run.' WHERE slot=? AND status='checking'").bind(slot).run();
  return {state:'failed'};
 }
}
