import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {collectionSources,sourceIndex,candidateFromRow,canonicalJobUrl,readSource,employmentCandidates} from '../lib/collection-sources.ts';
import {runCollection} from '../lib/collection.ts';
const source=collectionSources[0];
const posting=(id='one')=>({id,title:'Software Engineer '+id,isListed:true,descriptionPlain:'Build production Python APIs and tested data workflows.\nRequirements\n2 years of professional software engineering experience.\nBachelor degree in computer science.',location:'Bengaluru, India',jobUrl:'https://jobs.ashbyhq.com/aiprise/'+id,isRemote:false,publishedAt:'2026-10-24'});
const feed=(rows)=>async()=>new Response(JSON.stringify({jobs:rows}),{headers:{'Content-Type':'application/json'}});
function database(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync('cloudflare/migrations/0001_initial.sql','utf8'));sqlite.exec(readFileSync('cloudflare/migrations/0002_collection.sql','utf8'));
 const db={prepare(sql){let values=[];const query={bind(...args){values=args;return query},async first(){return sqlite.prepare(sql).get(...values)||null},async all(){return {results:sqlite.prepare(sql).all(...values),success:true}},async run(){const r=sqlite.prepare(sql).run(...values);return {success:true,meta:{changes:Number(r.changes)}}}};return query},async batch(queries){sqlite.exec('BEGIN');try{const r=[];for(const q of queries)r.push(await q.run());sqlite.exec('COMMIT');return r}catch(e){sqlite.exec('ROLLBACK');throw e}}};return {db,sqlite};
}
test('uses only listed employer openings and preserves known facts without inventing missing eligibility',()=>{
 const index=sourceIndex(source,JSON.stringify({jobs:[posting(),{...posting('hidden'),isListed:false}]}));assert.equal(index.rows.length,1);
 const candidate=candidateFromRow(source,index.rows[0]);assert.equal(candidate.job.status,'draft');assert.equal(candidate.job.reviewed,false);assert.equal(candidate.job.company,'AiPrise');assert.equal(candidate.job.region,'India');assert.equal(candidate.job.deadline,'Not specified');assert.match(candidate.job.experience,/2 years/);assert.equal(candidate.job.salary,'Not disclosed');
 assert.equal(canonicalJobUrl('https://example.org/job?utm_source=x#top'),'https://example.org/job');
 assert.throws(()=>canonicalJobUrl('http://example.org/job'));
});
test('refuses non-allowlisted collection requests and does not follow blocked redirects',async()=>{
 let called=false;await assert.rejects(()=>readSource('https://127.0.0.1/private',async()=>{called=true;return new Response('')}));assert.equal(called,false);
 await assert.rejects(()=>readSource(source.url,async()=>new Response('',{status:302,headers:{location:'http://localhost/private'}})),/302/);
 await assert.rejects(()=>readSource(source.url,async()=>new Response('',{status:403})),/blocks/);
});
test('government discovery skips expired notices and never treats advertising PDFs as jobs',()=>{
 const govt=collectionSources.find(s=>s.kind==='employment');
 const html='<table><tr><td>01/01/2026</td><td>Example Authority</td><td>Engineer</td><td>Recruitment</td><td>31/12/2099</td></tr><tr><td>01/01/2020</td><td>Old Authority</td><td>Clerk</td><td>Recruitment</td><td>01/01/2020</td></tr></table><a href="ratecard.pdf">Rate Card</a>';
 const index=employmentCandidates(govt,html);assert.equal(index.rows.length,1);assert.equal(index.rows[0].discoveryOnly,true);assert.equal(index.rows[0].job.deadline,'2099-12-31');assert.match(index.rows[0].job.details,/original recruitment/);
});
test('collection is idempotent, skips existing published links and never publishes jobs',async()=>{
 const {db,sqlite}=database();sqlite.prepare("INSERT INTO listings VALUES(?,? ,?,'published',1,?)").run('existing','{}',posting().jobUrl+'?utm_source=old','2026-10-24');
 const result=await runCollection(db,{sourceId:source.id,fetcher:feed([posting(),posting('two')]),force:true});assert.equal(result.results[0].added,1);
 await runCollection(db,{sourceId:source.id,fetcher:feed([posting(),posting('two')]),force:true});assert.equal(sqlite.prepare('SELECT count(*) AS n FROM collection_items').get().n,1);assert.equal(sqlite.prepare('SELECT count(*) AS n FROM listings').get().n,1);
 assert.equal(JSON.parse(sqlite.prepare('SELECT data FROM collection_items').get().data).status,'draft');
});
test('caps each run and inbox, honours pause and uses a lease to prevent overlapping writes',async()=>{
 const {db,sqlite}=database(),rows=Array.from({length:50},(_,i)=>posting(String(i)));
 for(let i=0;i<11;i++)await runCollection(db,{sourceId:source.id,fetcher:feed(rows),force:true});assert.equal(sqlite.prepare('SELECT count(*) AS n FROM collection_items').get().n,40);
 sqlite.prepare('UPDATE collection_control SET enabled=0').run();let calls=0;const r=await runCollection(db,{fetcher:async()=>{calls++;return new Response('')}});assert.equal(r.state,'skipped');assert.equal(calls,0);
 sqlite.prepare('UPDATE collection_control SET enabled=1,lease_until=?').run(Date.now()+60000);assert.equal((await runCollection(db,{fetcher:feed(rows)})).state,'skipped');
});
test('source errors back off and two successful missing checks flag an opening without deleting listings',async()=>{
 const {db,sqlite}=database();await runCollection(db,{sourceId:source.id,fetcher:feed([posting()]),force:true});
 await runCollection(db,{sourceId:source.id,fetcher:feed([]),force:true});assert.equal(sqlite.prepare('SELECT missing_count FROM collection_items').get().missing_count,1);
 await runCollection(db,{sourceId:source.id,fetcher:feed([]),force:true});assert.equal(sqlite.prepare('SELECT missing_count FROM collection_items').get().missing_count,2);
 await runCollection(db,{sourceId:source.id,fetcher:async()=>new Response('',{status:403}),force:true});
 const state=sqlite.prepare('SELECT failures,next_check,last_error FROM collection_sources WHERE id=?').get(source.id);assert.equal(state.failures,1);assert.ok(state.next_check>Date.now()+5*3600000);assert.match(state.last_error,/403/);
 let calls=0;await runCollection(db,{sourceId:source.id,fetcher:async()=>{calls++;return new Response('')}});assert.equal(calls,0);
});
