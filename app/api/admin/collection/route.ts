import {db} from '../../../../lib/jobs';
import {editorIdentity,authorizeWrite} from '../../../../lib/editor-auth';
import {bindings} from '../../../../lib/platform';
import {collectionDashboard} from '../../../../lib/collection';
import {canonicalJobUrl,indiaToday} from '../../../../lib/collection-sources';
import {sourceUrl} from '../../../../lib/fetch-job-page';
import {input} from '../../../../lib/validation';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
export async function GET(){
 if(!await editorIdentity())return Response.json({error:'Owner access required'},{status:403,headers});
 try{return Response.json(await collectionDashboard(db()),{headers})}catch{return Response.json({error:'Collection database is unavailable.'},{status:503,headers})}
}
export async function POST(request:Request){
 if(!await authorizeWrite(request))return Response.json({error:'Owner access and same-origin request required'},{status:403,headers});
 const raw=await request.text();if(raw.length>5000)return Response.json({error:'Request too large'},{status:413,headers});
 let action:any;try{action=JSON.parse(raw)}catch{return Response.json({error:'Invalid request'},{status:400,headers})}
 try{
  if(action.action==='instagram-check'){
   if(!bindings().COLLECTOR)return Response.json({error:'Collector is not connected.'},{status:503,headers});
   const result=await bindings().COLLECTOR!.fetch('https://collector/instagram-check',{method:'POST'});
   return Response.json(await result.json(),{status:result.status,headers});
  }
  if(action.action==='run'){
   if(!bindings().COLLECTOR)return Response.json({error:'Scheduled collector is not connected.'},{status:503,headers});
   const result=await bindings().COLLECTOR!.fetch('https://collector/run',{method:'POST'});
   if(!result.ok)throw Error('Collector did not complete');
   return Response.json({message:'Due source checks finished. Review new openings below.',result:await result.json()},{headers});
  }
  if(action.action==='pause'||action.action==='resume'){
   await db().prepare('UPDATE collection_control SET enabled=? WHERE id=1').bind(action.action==='resume'?1:0).run();
   return Response.json({message:action.action==='resume'?'Collection resumed.':'Collection paused.'},{headers});
  }
  if(action.action==='publishing'&&typeof action.enabled==='boolean'){
   await db().prepare('UPDATE publishing_control SET enabled=?,instagram_enabled=? WHERE id=1').bind(action.enabled?1:0,action.enabled?1:0).run();
   return Response.json({message:action.enabled?'Automatic publishing enabled: one job per half-hour slot, with 0–3-year roles first.':'Website and Instagram automatic publishing paused.'},{headers});
  }
  if(action.action==='source'&&typeof action.id==='string'&&typeof action.enabled==='boolean'){
   await db().prepare('UPDATE collection_sources SET enabled=? WHERE id=?').bind(action.enabled?1:0,action.id).run();
   return Response.json({message:'Source setting saved.'},{headers});
  }
  if(action.action==='dismiss'&&typeof action.id==='string'){
   await db().prepare("UPDATE collection_items SET status='dismissed' WHERE id=? AND status='pending'").bind(action.id).run();
   return Response.json({message:'Opening dismissed. It will not be imported again automatically.'},{headers});
  }
  if(action.action==='import'&&typeof action.id==='string'){
   const item=await db().prepare('SELECT * FROM collection_items WHERE id=?').bind(action.id).first<{id:string;data:string;status:string;discovery_only:number;missing_count:number;listing_id:string}>();
   if(!item||item.status==='dismissed')return Response.json({error:'This collected opening is no longer available.'},{status:404,headers});
   if(item.missing_count>=2)return Response.json({error:'The source no longer returns this opening. Check the employer before importing.'},{status:409,headers});
   const fields=JSON.parse(item.data);
   if(fields.deadline!=='Not specified'&&fields.deadline<indiaToday())return Response.json({error:'The closing date has passed.'},{status:409,headers});
   if(item.discovery_only){
    if(typeof action.originalUrl!=='string'||!action.originalUrl.trim())return Response.json({error:'Add the original employer recruitment/application URL before creating this draft.'},{status:400,headers});
    fields.url=canonicalJobUrl(sourceUrl(action.originalUrl).href);
    if(fields.url===canonicalJobUrl(JSON.parse(item.data).url))return Response.json({error:'Use the specific original recruitment notice, not the discovery index.'},{status:400,headers});
    fields.note+=' Original notice URL supplied by owner. Complete the missing job details before publishing.';
   }
   const rows=await db().prepare("SELECT id,source_url,data,status,version FROM listings WHERE status<>'archived'").all<{id:string;source_url:string;data:string;status:string;version:number}>();
   const existing=rows.results.find(row=>row.id===item.listing_id||canonicalJobUrl(row.source_url)===canonicalJobUrl(fields.url));
   if(existing){await db().prepare("UPDATE collection_items SET status='imported',listing_id=? WHERE id=?").bind(existing.id,item.id).run();return Response.json({job:{...JSON.parse(existing.data),id:existing.id,version:existing.version,status:existing.status},message:'This source is already listed. Opened the existing listing.'},{headers})}
   const parsed=input.parse({...fields,status:'draft',reviewed:false,version:0});
   const id='collected-'+item.id.slice(4,36),now=new Date().toISOString();
   const {reviewed,...content}=parsed;
   const job={...content,id,version:1,initial:parsed.company[0].toUpperCase(),publishedAt:'',updatedAt:now};
   await db().batch([
    db().prepare("INSERT INTO listings(id,data,source_url,status,version,updated_at) SELECT ?,?,?,'draft',1,? WHERE EXISTS(SELECT 1 FROM collection_items WHERE id=? AND status='pending') ON CONFLICT DO NOTHING").bind(id,JSON.stringify(job),job.url,now,item.id),
    db().prepare("UPDATE collection_items SET status='imported',listing_id=? WHERE id=? AND EXISTS(SELECT 1 FROM listings WHERE id=?)").bind(id,item.id,id),
   ]);
   const saved=await db().prepare('SELECT id FROM listings WHERE id=?').bind(id).first();if(!saved)throw Error('Draft not saved');
   return Response.json({job,message:'Saved as a draft. Check all fields and the original source before publishing.'},{headers});
  }
  return Response.json({error:'Unsupported collection action'},{status:400,headers});
 }catch{return Response.json({error:'The collection action could not be completed. Refresh and try again.'},{status:503,headers})}
}
