import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {checkLinkedInConnection,runLinkedInPublishing,linkedinCaption} from '../lib/linkedin-publishing.ts';
import {validMetric} from '../lib/visitor-metrics.ts';
function setup(){
 const sqlite=new DatabaseSync(':memory:');for(const name of ['0001_initial.sql','0002_collection.sql','0004_automatic_publishing.sql','0007_linkedin_publishing.sql','0009_linkedin_health.sql'])sqlite.exec(readFileSync('cloudflare/migrations/'+name,'utf8'));
 const db={prepare(sql){let values=[];const q={bind(...args){values=args;return q},async first(){return sqlite.prepare(sql).get(...values)||null},async all(){return {results:sqlite.prepare(sql).all(...values)}},async run(){const r=sqlite.prepare(sql).run(...values);return {meta:{changes:Number(r.changes)}}}};return q},async batch(queries){sqlite.exec('BEGIN');try{const r=[];for(const q of queries)r.push(await q.run());sqlite.exec('COMMIT');return r}catch(e){sqlite.exec('ROLLBACK');throw e}}};
 const now=Date.parse('2026-10-26T10:00:00Z');
 sqlite.prepare("UPDATE linkedin_control SET enabled=1,organization_id='org',channel_id='channel',channel_name='JobVeylo .',checked_at=?,reconciled_at=?").run(now,now);
 const env={DB:db,SITE_URL:'https://example.com',BUFFER_API_KEY:'private-test-key',BUFFER_CHANNEL_ID:'channel'};return {sqlite,env,now};
}
function job(id,experience='0–2 years'){return {id,company:'AiPrise',title:'Software Engineer',experience,education:'Not specified',salary:'Not disclosed',location:'Bengaluru, India',region:'India',url:'https://jobs.ashbyhq.com/aiprise/'+id,deadline:'Not specified'}}
function insert(sqlite,j){sqlite.prepare("INSERT INTO listings(id,data,source_url,status,version,updated_at) VALUES(?,?,?,'published',1,'2026-10-26')").run(j.id,JSON.stringify(j),j.url)}
function mock(calls,{active=['junior','senior'],fail=false}={}){return async(url,init)=>{
 if(String(url).includes('api.ashbyhq.com'))return Response.json({jobs:active.map(id=>({id,isListed:true,jobUrl:'https://jobs.ashbyhq.com/aiprise/'+id}))});
 assert.equal(url,'https://api.buffer.com');assert.equal(init.redirect,'manual');const query=JSON.parse(init.body).query;calls.push(query);
 if(query.includes('createPost')){if(fail)throw Error('private-test-key');return Response.json({data:{createPost:{post:{id:'buffer-'+calls.length,dueAt:new Date(Date.parse('2026-10-26T10:00:00Z')+120000).toISOString()}}}})}
 if(query.includes('organizations'))return Response.json({data:{account:{organizations:[{id:'org'}]}}});
 if(query.includes('channels('))return Response.json({data:{channels:[{id:'channel',name:'jobveylo-68b006447',service:'linkedin',isDisconnected:false,isLocked:false,isQueuePaused:false}]}});
 return Response.json({data:{channel:{id:'channel',name:'jobveylo-68b006447',service:'linkedin',isDisconnected:false,isLocked:false,isQueuePaused:false},p0:{id:'buffer-1',status:'sent',channelId:'channel'}}});
}}
test('caption is concise, omits unknown facts, and records LinkedIn attribution',()=>{
 const text=linkedinCaption(job('junior'),'https://example.com');assert.match(text,/ATS-friendly resume/);assert.equal(text.includes('🎓'),false);assert.equal(text.includes('💰'),false);assert.match(text,/utm_source=linkedin/);assert.match(text,/utm_campaign=job_post/);
 assert.equal(validMetric({path:'/jobs/junior',event:'page_view',source:'linkedin',campaign:'job_post'}),true);
});
test('connection authenticates only the selected LinkedIn profile',async()=>{
 const {sqlite,env,now}=setup();assert.equal((await checkLinkedInConnection(env,{now,fetcher:mock([])})).state,'connected');
 const bad=async()=>Response.json({data:{account:{organizations:[{id:'org'}]},channels:[{id:'channel',name:'Someone else',service:'linkedin'}]}});
 assert.equal((await checkLinkedInConnection(env,{now,fetcher:bad})).state,'wrong_account');sqlite.close();
});
test('schedules junior first, one slot once, and never duplicates an already scheduled job',async()=>{
 const {sqlite,env,now}=setup();insert(sqlite,job('senior','8+ years'));insert(sqlite,job('junior'));const calls=[],fetcher=mock(calls);
 const result=await runLinkedInPublishing(env,{now,fetcher});assert.equal(result.state,'scheduled');assert.equal(result.id,'junior');
 assert.match(calls[0],/mode:customScheduled/);assert.equal(sqlite.prepare("SELECT status FROM linkedin_jobs WHERE listing_id='junior'").get().status,'scheduled');
 assert.equal((await runLinkedInPublishing(env,{now,fetcher})).state,'already_checked');assert.equal(calls.length,1);
 sqlite.prepare("UPDATE linkedin_jobs SET status='sent' WHERE listing_id='junior'").run();
 const later=await runLinkedInPublishing(env,{now:now+1800000,fetcher});assert.equal(later.id,'senior');assert.equal(calls.filter(q=>q.includes('createPost')).length,2);sqlite.close();
});
test('missing employer opening is held without a Buffer mutation',async()=>{
 const {sqlite,env,now}=setup();insert(sqlite,job('junior'));const calls=[];assert.equal((await runLinkedInPublishing(env,{now,fetcher:mock(calls,{active:[]})})).state,'empty');assert.equal(calls.length,0);assert.equal(sqlite.prepare('SELECT status FROM linkedin_jobs').get().status,'held');sqlite.close();
});
test('uncertain publish outcomes are held, never retried automatically',async()=>{
 const {sqlite,env,now}=setup();insert(sqlite,job('junior'));const calls=[],fetcher=mock(calls,{fail:true});
 assert.equal((await runLinkedInPublishing(env,{now,fetcher})).state,'held');await runLinkedInPublishing(env,{now:now+1800000,fetcher});assert.equal(calls.filter(q=>q.includes('createPost')).length,1);assert.equal(sqlite.prepare('SELECT last_error FROM linkedin_jobs').get().last_error.includes('private-test-key'),false);sqlite.close();
});
test('hourly batch reconciliation marks confirmed delivery and the global pause blocks publication',async()=>{
 const {sqlite,env,now}=setup();insert(sqlite,job('junior'));const calls=[],fetcher=mock(calls);await runLinkedInPublishing(env,{now,fetcher});
 await runLinkedInPublishing(env,{now:now+3600000,fetcher});assert.equal(sqlite.prepare('SELECT status FROM linkedin_jobs').get().status,'sent');assert.equal(calls.filter(q=>q.includes('p0:post')).length,1);
 sqlite.prepare('UPDATE publishing_control SET enabled=0').run();assert.equal((await runLinkedInPublishing(env,{now:now+5400000,fetcher})).state,'paused');sqlite.close();
});

test('disconnected or paused Buffer channel cannot pass the enable check',async()=>{
 for(const flag of ['isDisconnected','isLocked','isQueuePaused']){
  const {sqlite,env,now}=setup();const fetcher=async()=>Response.json({data:{account:{organizations:[{id:'org'}]},channels:[{id:'channel',name:'jobveylo-68b006447',service:'linkedin',isDisconnected:false,isLocked:false,isQueuePaused:false,[flag]:true}]}});
  assert.equal((await checkLinkedInConnection(env,{now,fetcher})).state,'connection_failed');
  assert.equal(sqlite.prepare('SELECT enabled FROM linkedin_control').get().enabled,0);sqlite.close();
 }
});

test('delivery error pauses the entire publisher before another post can be created',async()=>{
 const {sqlite,env,now}=setup();insert(sqlite,job('junior'));insert(sqlite,job('senior'));
 const calls=[],normal=mock(calls);await runLinkedInPublishing(env,{now,fetcher:normal});
 const fetcher=async(url,init)=>{if(String(url)==='https://api.buffer.com'&&JSON.parse(init.body).query.includes('p0:post'))return Response.json({data:{channel:{id:'channel',name:'jobveylo-68b006447',service:'linkedin',isDisconnected:false,isLocked:false,isQueuePaused:false},p0:{id:'buffer-1',status:'error',channelId:'channel'}}});return normal(url,init)};
 assert.equal((await runLinkedInPublishing(env,{now:now+3600000,fetcher})).state,'paused');
 assert.equal(sqlite.prepare('SELECT enabled FROM linkedin_control').get().enabled,0);
 assert.match(sqlite.prepare('SELECT last_error FROM linkedin_control').get().last_error,/delivery error/);
 assert.equal(calls.filter(q=>q.includes('createPost')).length,1);
 assert.equal((await runLinkedInPublishing(env,{now:now+5400000,fetcher})).state,'paused');sqlite.close();
});

test('hourly channel health check also blocks creation when no posts are pending',async()=>{
 const {sqlite,env,now}=setup();insert(sqlite,job('junior'));const calls=[];
 const fetcher=async(url,init)=>{calls.push(JSON.parse(init.body).query);return Response.json({data:{channel:{id:'channel',name:'jobveylo-68b006447',service:'linkedin',isDisconnected:true,isLocked:false,isQueuePaused:false}}})};
 assert.equal((await runLinkedInPublishing(env,{now:now+3600000,fetcher})).state,'paused');
 assert.equal(calls.length,1);assert.equal(calls.some(q=>q.includes('createPost')),false);sqlite.close();
});
