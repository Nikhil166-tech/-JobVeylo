import {dispatchRenderer,rendererStatus} from '../lib/renderer-dispatch.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {careerPriority,sourcePriorityHint} from '../lib/job-priority.ts';
import {makeCollectedJob,collectionSources} from '../lib/collection-sources.ts';
import {runAutomaticPublishing,locationConflict,expiredDeadline} from '../lib/automatic-publishing.ts';
import {claimReel,automationAuthorized,runInstagramPublishing,checkInstagramConnection,reelHashtags,reelCaption} from '../lib/instagram-publishing.ts';
function database(){
 const sqlite=new DatabaseSync(':memory:');for(const name of ['0001_initial.sql','0002_collection.sql','0004_automatic_publishing.sql','0005_renderer_dispatch.sql'])sqlite.exec(readFileSync('cloudflare/migrations/'+name,'utf8'));
 for(const source of collectionSources)sqlite.prepare('INSERT INTO collection_sources(id) VALUES(?)').run(source.id);
 const db={prepare(sql){let values=[];const q={bind(...args){values=args;return q},async first(){return sqlite.prepare(sql).get(...values)||null},async all(){return {results:sqlite.prepare(sql).all(...values),success:true}},async run(){const r=sqlite.prepare(sql).run(...values);return {success:true,meta:{changes:Number(r.changes)}}}};return q},async batch(queries){sqlite.exec('BEGIN');try{const results=[];for(const q of queries)results.push(await q.run());sqlite.exec('COMMIT');return results}catch(error){sqlite.exec('ROLLBACK');throw error}}};return {db,sqlite};
}
const row=(id,years)=>({id,title:'Software Engineer '+id,isListed:true,location:'Bengaluru, India',jobUrl:'https://jobs.ashbyhq.com/aiprise/'+id,descriptionPlain:`Build reliable backend services, APIs, SQL data workflows and well-tested integrations for customer-facing products. Own production delivery, monitor releases and improve service performance with the engineering team.\nRequirements\n${years} years of professional software engineering experience.`,publishedAt:'2026-10-25'});
function queue(sqlite,posting,suffix){const job=makeCollectedJob(collectionSources[0],{title:posting.title,url:posting.jobUrl,location:posting.location,description:posting.descriptionPlain});const id='col-'+suffix.repeat(64);sqlite.prepare('INSERT INTO collection_items(id,source_id,external_id,dedupe_key,data,content_hash,first_seen,last_seen,changed_at) VALUES(?,?,?,?,?,?,?,?,?)').run(id,'ashby-aiprise',posting.id,suffix,JSON.stringify(job),'hash','2026-10-25','2026-10-25','2026-10-25');return {job,id}}
test('prioritises fresher and 0–3-year eligibility without relabelling senior jobs',()=>{
 assert.equal(careerPriority({experience:'0–2 years'}).rank,0);
 assert.equal(careerPriority({experience:'1-3 years'}).rank,1);
 assert.equal(careerPriority({experience:'3+ years'}).rank,1);
 assert.equal(careerPriority({experience:'6 months'}).rank,1);
 assert.equal(careerPriority({experience:'2-4 years'}).rank,1);
 assert.equal(careerPriority({experience:'7+ years',title:'Junior Developer'}).rank,2);
 assert.equal(careerPriority({experience:'2 years managing people',requirements:['8 years in software engineering']}).rank,2);
 assert.equal(careerPriority({title:'Graduate Trainee',experience:'Not specified'}).rank,0);
 assert.equal(careerPriority({title:'Engineer II',experience:'Not specified'}).rank,3);
 assert.equal(sourcePriorityHint(row('early','1-3')),1);
});
test('recognises explicit conflicting cities and expired application dates',()=>{
 assert.equal(locationConflict('Available Locations\nAustin, US\nRole summary','Seattle, WA · Hybrid'),true);
 assert.equal(locationConflict('Available Location:\nBangalore, India','Bengaluru, India'),false);
 assert.equal(expiredDeadline('Application Deadline: January 15, 2026','2026-10-25'),true);
 assert.equal(expiredDeadline('Application Deadline: ~January 2027','2026-10-25'),false);
});
test('publishes the early-career job first, once per half hour, and enqueues one reel',async()=>{
 const {db,sqlite}=database(),senior=row('senior','8+'),early=row('early','1-3');queue(sqlite,senior,'a');queue(sqlite,early,'b');
 const fetcher=async()=>Response.json({jobs:[senior,early]});const now=Date.now();
 assert.equal((await runAutomaticPublishing(db,{now,fetcher})).state,'published');
 assert.match(sqlite.prepare('SELECT data FROM listings').get().data,/Software Engineer early/);
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM social_jobs').get().n,1);
 assert.equal((await runAutomaticPublishing(db,{now,fetcher})).state,'already_checked');
 assert.equal((await runAutomaticPublishing(db,{now:now+1800000,fetcher})).state,'published');
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM listings').get().n,2);
 sqlite.close();
});
test('does not publish held, paused-source, government-discovery or disappeared jobs',async()=>{
 const {db,sqlite}=database(),posting=row('held','0-2'),held=queue(sqlite,posting,'c');
 sqlite.prepare('INSERT INTO publishing_holds VALUES(?,?,?)').run(held.id,'Conflicting location','now');
 assert.equal((await runAutomaticPublishing(db,{fetcher:async()=>Response.json({jobs:[posting]})})).state,'empty');
 sqlite.prepare('DELETE FROM publishing_slots').run();sqlite.prepare('DELETE FROM publishing_holds').run();sqlite.prepare('UPDATE collection_items SET discovery_only=1').run();
 assert.equal((await runAutomaticPublishing(db,{fetcher:async()=>Response.json({jobs:[posting]})})).state,'empty');
 sqlite.prepare('DELETE FROM publishing_slots').run();sqlite.prepare('UPDATE collection_items SET discovery_only=0').run();
 assert.equal((await runAutomaticPublishing(db,{fetcher:async()=>Response.json({jobs:[]})})).state,'empty');
 sqlite.prepare('DELETE FROM publishing_slots').run();sqlite.prepare('UPDATE collection_sources SET enabled=0').run();
 assert.equal((await runAutomaticPublishing(db,{fetcher:async()=>{throw Error('must not fetch')}})).state,'empty');
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM listings').get().n,0);sqlite.close();
});
test('paused publishing never claims a slot or makes external requests',async()=>{
 const {db,sqlite}=database();sqlite.prepare('UPDATE publishing_control SET enabled=0').run();
 assert.equal((await runAutomaticPublishing(db,{fetcher:async()=>{throw Error('must not fetch')}})).state,'paused');
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM publishing_slots').get().n,0);sqlite.close();
});
function socialFixture(sqlite){const posting=row('social','0-2'),job=makeCollectedJob(collectionSources[0],{title:posting.title,url:posting.jobUrl,location:posting.location,description:posting.descriptionPlain});sqlite.prepare("INSERT INTO listings VALUES(?,?,?,'published',1,?)").run('social-job',JSON.stringify(job),job.url,'now');sqlite.prepare("INSERT INTO social_jobs(listing_id,priority,status,created_at,media_key,media_created_at) VALUES(?,0,'media_ready',?,?,?)").run('social-job','now','reels/social-job.mp4',new Date().toISOString());return {posting,job}}
test('renderer authentication and leases do not expose owner access or duplicate claims',async()=>{
 const key='a'.repeat(40);assert.equal(await automationAuthorized(new Request('https://example.com',{headers:{Authorization:'Bearer '+key}}),key),true);assert.equal(await automationAuthorized(new Request('https://example.com'),key),false);
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('Bearer '+key))),b=>b.toString(16).padStart(2,'0')).join('');assert.equal(await automationAuthorized(new Request('https://example.com',{headers:{Authorization:'Bearer '+key}}),undefined,hash),true);
 const {db,sqlite}=database();socialFixture(sqlite);sqlite.prepare("UPDATE social_jobs SET status='waiting_media'").run();
 assert.equal((await claimReel(db)).id,'social-job');assert.equal(await claimReel(db),null);sqlite.close();
});
test('Instagram is inactive without credentials; ready containers publish only once',async()=>{
 const {db,sqlite}=database(),{posting}=socialFixture(sqlite);let publishes=0,creates=0;
 const fetcher=async(url,request)=>{
  if(url.includes('api.ashbyhq.com'))return Response.json({jobs:[posting]});
  if(url.includes('/123?'))return Response.json({id:'123',username:'jobveylo'});
  if(url.endsWith('/123/media')){creates++;return Response.json({id:'777'})}
  if(url.includes('/777?'))return Response.json({status_code:'FINISHED'});
  if(url.endsWith('/123/media_publish')){publishes++;return Response.json({id:'888'})}
  throw Error('Unexpected endpoint');
 };
 const env={DB:db,SITE_URL:'https://example.com'};
 assert.equal((await runInstagramPublishing(env,{fetcher,startNew:true})).state,'connection_required');
 Object.assign(env,{REEL_MEDIA:{},INSTAGRAM_ACCOUNT_ID:'123',INSTAGRAM_ACCESS_TOKEN:'test-only'});
 const now=Date.now();assert.equal((await runInstagramPublishing(env,{fetcher,startNew:true,now})).state,'processing');
 await runInstagramPublishing(env,{fetcher,now:now+300000});await runInstagramPublishing(env,{fetcher,now:now+600000});
 assert.equal(creates,1);assert.equal(publishes,1);assert.equal(sqlite.prepare('SELECT status FROM social_jobs').get().status,'published');sqlite.close();
});
test('ambiguous Instagram publish outcomes are held rather than posted twice',async()=>{
 const {db,sqlite}=database();socialFixture(sqlite);sqlite.prepare("UPDATE social_jobs SET status='processing',container_id='777'").run();let calls=0;
 const env={DB:db,SITE_URL:'https://example.com',REEL_MEDIA:{},INSTAGRAM_ACCOUNT_ID:'123',INSTAGRAM_ACCESS_TOKEN:'test-only'};
 const fetcher=async(url)=>{if(url.includes('/777?'))return Response.json({status_code:'FINISHED'});calls++;throw Error('Connection lost after request')};
 await runInstagramPublishing(env,{fetcher});await runInstagramPublishing(env,{fetcher});assert.equal(calls,1);assert.equal(sqlite.prepare('SELECT status FROM social_jobs').get().status,'held');sqlite.close();
});

test('interrupted Instagram requests are held without blocking other jobs',async()=>{
 const {db,sqlite}=database();socialFixture(sqlite);sqlite.prepare("UPDATE social_jobs SET status='publishing',lease_until=1").run();
 const env={DB:db,SITE_URL:'https://example.com',REEL_MEDIA:{},INSTAGRAM_ACCOUNT_ID:'123',INSTAGRAM_ACCESS_TOKEN:'test-only'};
 await runInstagramPublishing(env,{fetcher:async()=>{throw Error('must not retry')}});
 assert.equal(sqlite.prepare('SELECT status FROM social_jobs').get().status,'held');sqlite.close();
});

test('Instagram connection diagnostics expose only safe codes and verify the intended account',async()=>{
 const env={REEL_MEDIA:{},INSTAGRAM_ACCOUNT_ID:'123',INSTAGRAM_ACCESS_TOKEN:'private-test-token'};
 const ok=await checkInstagramConnection(env,async(url,options)=>{assert.equal(options.redirect,'manual');return Response.json({id:'123',username:'jobveylo'})});assert.equal(ok.state,'connected');
 assert.equal((await checkInstagramConnection(env,async()=>new Response(null,{status:302,headers:{Location:'https://example.com'}}))).state,'redirect_refused');
 const rejected=await checkInstagramConnection(env,async()=>Response.json({error:{code:190,error_subcode:463,message:'private-test-token'}},{status:400}));assert.equal(rejected.code,190);assert.equal(rejected.subcode,463);assert.equal(JSON.stringify(rejected).includes('private-test-token'),false);
 assert.equal((await checkInstagramConnection(env,async()=>Response.json({username:'another-account'}))).state,'wrong_account');
 assert.equal((await checkInstagramConnection({},async()=>{throw Error('must not fetch')})).state,'connection_required');
 const unreadable=await checkInstagramConnection(env,async()=>new Response('upstream unavailable',{status:502}));assert.equal(unreadable.state,'invalid_response');assert.equal(unreadable.status,502);
 const failed=await checkInstagramConnection(env,async()=>{throw new TypeError('private-test-token')});assert.match(failed.message,/TypeError/);assert.equal(JSON.stringify(failed).includes('private-test-token'),false);
 assert.equal((await checkInstagramConnection({...env,INSTAGRAM_ACCESS_TOKEN:'token\nwith-break'},async()=>{throw Error('must not fetch')})).state,'invalid_token_format');
});

test('Cloudflare render dispatch is scoped, once per slot, and keeps credentials private',async()=>{
 const {db,sqlite}=database();socialFixture(sqlite);sqlite.prepare("UPDATE social_jobs SET status='waiting_media'").run();let calls=0;
 const env={DB:db,GITHUB_RENDER_TOKEN:'private-test-token'},now=Date.now();
 const fetcher=async(url,options)=>{calls++;assert.equal(url,'https://api.github.com/repos/Nikhil166-tech/-JobVeylo/actions/workflows/render-job-reel.yml/dispatches');assert.equal(options.redirect,'manual');assert.deepEqual(JSON.parse(options.body),{ref:'main'});return Response.json({workflow_run_id:123})};
 assert.equal((await dispatchRenderer(env,{now,fetcher})).state,'dispatched');assert.equal((await dispatchRenderer(env,{now,fetcher})).state,'already_requested');assert.equal(calls,1);
 const status=await rendererStatus(env);assert.equal(status.configured,true);assert.equal(status.last.run_id,'123');assert.equal(JSON.stringify(status).includes(env.GITHUB_RENDER_TOKEN),false);sqlite.close();
});
test('render dispatch respects pause, queue buffers, and expired rendering leases',async()=>{
 const {db,sqlite}=database();socialFixture(sqlite);const now=Date.now(),env={DB:db,GITHUB_RENDER_TOKEN:'private-test-token'};
 assert.equal((await dispatchRenderer({DB:db})).state,'connection_required');
 sqlite.prepare('UPDATE publishing_control SET instagram_enabled=0').run();assert.equal((await dispatchRenderer(env)).state,'paused');sqlite.prepare('UPDATE publishing_control SET instagram_enabled=1').run();
 sqlite.prepare("UPDATE social_jobs SET status='rendering',lease_until=1").run();
 assert.equal((await dispatchRenderer(env,{now,fetcher:async()=>new Response(null,{status:204})})).state,'dispatched');
 sqlite.prepare("INSERT INTO social_jobs(listing_id,priority,status,created_at) VALUES('buffer-a',0,'media_ready','now'),('buffer-b',0,'media_ready','now')").run();
 assert.equal((await dispatchRenderer(env,{now:now+1800000,fetcher:async()=>{throw Error('must not fetch')}})).state,'buffered');sqlite.close();
});
test('render dispatch rejects redirects and never retries an ambiguous request in its slot',async()=>{
 const {db,sqlite}=database();socialFixture(sqlite);sqlite.prepare("UPDATE social_jobs SET status='waiting_media'").run();const env={DB:db,GITHUB_RENDER_TOKEN:'private-test-token'},now=Date.now();
 assert.equal((await dispatchRenderer(env,{now,fetcher:async()=>new Response(null,{status:302,headers:{Location:'https://example.com'}})})).state,'rejected');
 let calls=0;const fetcher=async()=>{calls++;throw Error('private-test-token')};assert.equal((await dispatchRenderer(env,{now:now+1800000,fetcher})).state,'uncertain');assert.equal((await dispatchRenderer(env,{now:now+1800000,fetcher})).state,'already_requested');assert.equal(calls,1);sqlite.close();
});

test('reel captions promote the selected-job resume tool and use truthful relevant hashtags',()=>{
 const job={id:'test-job',title:'Software Engineer',company:'Example',experience:'0–2 years',education:'B.Tech',location:'Bengaluru, India',region:'India',salary:'Not disclosed',category:'Private'};
 const tags=reelHashtags(job);assert.equal(tags,'#JobVeylo #SoftwareEngineer #JobsInIndia #FreshersJobs #ATSResume');
 const caption=reelCaption(job,'https://example.com');assert.match(caption,/ATS-friendly resume for this job/);assert.match(caption,/https:\/\/example.com\/jobs\/test-job/);assert.equal(caption.includes('💰'),false);
 assert.equal(reelHashtags({...job,experience:'2–4 years'}).includes('#FreshersJobs'),false);assert.match(reelHashtags({...job,experience:'2–4 years'}),/#EarlyCareerJobs/);
 assert.match(reelHashtags({...job,title:'Marketing Manager',experience:'7+ years',remote:true}),/#MarketingJobs #RemoteJobs #ExperiencedJobs/);
 assert.match(reelHashtags({...job,experience:'Not specified'}),/#JobOpenings/);assert.equal(reelHashtags({...job,experience:'Not specified'}).includes('#FreshersJobs'),false);
 assert.match(reelCaption({...job,salary:'INR 30–50 lakh per year'},'https://example.com'),/💰 Salary: INR 30–50/);
});
