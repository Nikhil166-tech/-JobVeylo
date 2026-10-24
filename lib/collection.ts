import {collectionSources,sourceIndex,candidateFromRow,canonicalJobUrl,readSource,type CollectionSource} from './collection-sources.ts';

export const maxPendingPerSource=40,maxNewPerSource=4;
export async function collectionHash(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),n=>n.toString(16).padStart(2,'0')).join('')}
export async function seedCollection(db:D1Database){
 await db.batch(collectionSources.map(source=>db.prepare('INSERT OR IGNORE INTO collection_sources(id) VALUES(?)').bind(source.id)));
}
export async function runCollection(db:D1Database,options:{fetcher?:typeof fetch;force?:boolean;sourceId?:string}={}){
 await seedCollection(db);
 const now=Date.now(),started=new Date(now).toISOString(),lease=now+240000;
 const locked=await db.prepare('UPDATE collection_control SET lease_until=?,last_started=? WHERE id=1 AND enabled=1 AND lease_until<? RETURNING id').bind(lease,started,now).first();
 if(!locked)return {state:'skipped',message:'Collection is paused or another run is still active.',results:[]};
 const results:{source:string;fetched:number;added:number;updated:number;outcome:string;message:string}[]=[];
 try{
  const states=await db.prepare('SELECT * FROM collection_sources').all<{id:string;enabled:number;next_check:number;failures:number}>();
  const listings=await db.prepare("SELECT id,source_url FROM listings WHERE status<>'archived'").all<{id:string;source_url:string}>();
  const listed=new Map<string,string>();for(const row of listings.results){try{listed.set(canonicalJobUrl(row.source_url),row.id)}catch{}}
  for(const source of collectionSources.filter(source=>!options.sourceId||source.id===options.sourceId)){
   const state=states.results.find(row=>row.id===source.id);if(!state?.enabled||(!options.force&&state.next_check>now))continue;
   let fetched=0,added=0,updated=0,outcome='ok',message='Checked successfully.';
   try{
    const index=sourceIndex(source,await readSource(source.url,options.fetcher));fetched=index.rows.length;
    const existing=await db.prepare('SELECT id,external_id,content_hash,status,listing_id,last_fetched FROM collection_items WHERE source_id=?').bind(source.id).all<{id:string;external_id:string;content_hash:string;status:string;listing_id:string|null;last_fetched:string}>();
    const known=new Map(existing.results.map(row=>[row.external_id,row]));let pending=existing.results.filter(row=>row.status==='pending').length;
    const ordered=[...index.rows.filter(row=>!known.has(String(row.externalId??row.id))),...index.rows.filter(row=>known.has(String(row.externalId??row.id))).sort((a,b)=>(known.get(String(a.externalId??a.id))?.last_fetched||'').localeCompare(known.get(String(b.externalId??b.id))?.last_fetched||''))];
    let processed=0;
    for(const row of ordered){
     const externalId=String(row.externalId??row.id),old=known.get(externalId);
     // Bound storage and requests. Imported/dismissed items are not silently rewritten.
     if(old&&old.status!=='pending')continue;
     if(!old&&(added>=maxNewPerSource||pending>=maxPendingPerSource))continue;
     if(old&&updated>=maxNewPerSource)continue;
     if(!row.discoveryOnly&&source.kind!=='employment'&&source.kind!=='upsc'){
      try{if(listed.has(canonicalJobUrl(row.jobUrl||row.hostedUrl||row.absolute_url)))continue}catch{continue}
     }
     if(processed++>=maxNewPerSource)break;
     let hydrated=row;
     if(source.kind==='greenhouse'){
      if(!/^\d+$/.test(externalId))continue;
      hydrated=JSON.parse(await readSource(source.url+'/'+externalId,options.fetcher));
     }
     const candidate=candidateFromRow(source,hydrated);
     if(!candidate.discoveryOnly&&listed.has(candidate.job.url))continue;
     const hash=await collectionHash(JSON.stringify({...candidate.job,checked:''}));
     if(old?.content_hash===hash){await db.prepare('UPDATE collection_items SET last_fetched=? WHERE id=?').bind(started,old.id).run();continue}
     const id=old?.id||'col-'+await collectionHash(source.id+'|'+externalId);
     const dedupe=await collectionHash(candidate.discoveryOnly?source.id+'|'+externalId:candidate.job.url);
     const saved=await db.prepare(`INSERT INTO collection_items(id,source_id,external_id,dedupe_key,data,content_hash,discovery_only,first_seen,last_seen,changed_at)
      VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(source_id,external_id) DO UPDATE SET data=excluded.data,content_hash=excluded.content_hash,last_seen=excluded.last_seen,changed_at=excluded.changed_at,missing_count=0 WHERE collection_items.status='pending' ON CONFLICT DO NOTHING RETURNING id`)
      .bind(id,source.id,externalId,dedupe,JSON.stringify(candidate.job),hash,candidate.discoveryOnly?1:0,started,started,started).first();
     if(saved){if(old)updated++;else{added++;pending++}}
     if(saved)await db.prepare('UPDATE collection_items SET last_fetched=? WHERE id=?').bind(started,id).run();
    }
    if(index.complete)await db.prepare('UPDATE collection_items SET missing_count=CASE WHEN external_id IN(SELECT value FROM json_each(?)) THEN 0 ELSE MIN(missing_count+1,10) END,last_seen=CASE WHEN external_id IN(SELECT value FROM json_each(?)) THEN ? ELSE last_seen END WHERE source_id=?').bind(JSON.stringify(index.activeIds),JSON.stringify(index.activeIds),started,source.id).run();
    await db.prepare('UPDATE collection_sources SET last_checked=?,last_success=?,last_error=NULL,last_count=?,failures=0,next_check=? WHERE id=?').bind(started,started,fetched,now+25*60000,source.id).run();
    if(pending>=maxPendingPerSource)message='Review inbox is full for this source. New collection resumes when items are reviewed.';
   }catch(error){
    outcome='error';message=error instanceof Error?error.message.slice(0,250):'Collection failed. No publication was attempted.';
    const delay=/blocks|rate.limits/.test(message)?6*3600000:Math.min(12*3600000,1800000*2**Math.min(state.failures,4));
    await db.prepare('UPDATE collection_sources SET last_checked=?,last_error=?,failures=failures+1,next_check=? WHERE id=?').bind(started,message,now+delay,source.id).run();
   }
   await db.prepare('INSERT INTO collection_runs(id,source_id,finished_at,outcome,fetched,added,updated,message) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),source.id,new Date().toISOString(),outcome,fetched,added,updated,message).run();
   results.push({source:source.id,fetched,added,updated,outcome,message});
  }
  await db.prepare('DELETE FROM collection_runs WHERE finished_at<?').bind(new Date(now-14*86400000).toISOString()).run();
  return {state:'completed',message:'Collection finished. New openings require owner review.',results};
 }finally{
  await db.prepare('UPDATE collection_control SET lease_until=0,last_finished=?,last_summary=? WHERE id=1 AND lease_until=?').bind(new Date().toISOString(),JSON.stringify(results),lease).run();
 }
}
export async function collectionDashboard(db:D1Database){
 await seedCollection(db);
 const [control,sources,items,runs]=await Promise.all([
  db.prepare('SELECT enabled,last_started,last_finished,last_summary,lease_until FROM collection_control WHERE id=1').first(),
  db.prepare('SELECT * FROM collection_sources').all<{id:string}>(),
  db.prepare("SELECT * FROM collection_items WHERE status='pending' ORDER BY missing_count,first_seen DESC LIMIT 150").all<{data:string}>(),
  db.prepare('SELECT * FROM collection_runs ORDER BY finished_at DESC LIMIT 15').all(),
 ]);
 return {control,sources:sources.results.map(row=>({...row,...collectionSources.find(source=>source.id===row.id)})),items:items.results.map(row=>({...row,job:JSON.parse(row.data),data:undefined})),runs:runs.results};
}
