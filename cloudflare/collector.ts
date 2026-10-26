import {runCollection} from '../lib/collection';
import {collectionSources} from '../lib/collection-sources';
import {runAutomaticPublishing} from '../lib/automatic-publishing';
import {runInstagramPublishing,checkInstagramConnection,type SocialEnv} from '../lib/instagram-publishing';
import {dispatchRenderer,rendererStatus,type RendererEnv} from '../lib/renderer-dispatch';
import {checkLinkedInConnection,runLinkedInPublishing,type LinkedInEnv} from '../lib/linkedin-publishing';
import {collectReelTestInsights,checkReelInsightsAccess} from '../lib/reel-experiment';
type Env=SocialEnv&RendererEnv&LinkedInEnv&{SELF:Fetcher};
async function dispatch(env:Env){
 const results=[];
 for(const source of collectionSources){
  try{const response=await env.SELF.fetch('https://collector/source/'+source.id,{method:'POST'});results.push(response.ok?await response.json():{source:source.id,error:'Source worker returned HTTP '+response.status})}
  catch{results.push({source:source.id,error:'Source check did not complete. Other sources continue.'})}
 }
 try{const response=await env.SELF.fetch('https://collector/publish',{method:'POST'});results.push({publishing:response.ok?await response.json():{state:'failed'}})}catch{results.push({publishing:{state:'failed'}})}
 try{const response=await env.SELF.fetch('https://collector/render',{method:'POST'});results.push({renderer:response.ok?await response.json():{state:'failed'}})}catch{results.push({renderer:{state:'failed'}})}
 try{const response=await env.SELF.fetch('https://collector/instagram',{method:'POST'});results.push({instagram:response.ok?await response.json():{state:'failed'}})}catch{results.push({instagram:{state:'failed'}})}
 try{const response=await env.SELF.fetch('https://collector/linkedin',{method:'POST'});results.push({linkedin:response.ok?await response.json():{state:'failed'}})}catch{results.push({linkedin:{state:'failed'}})}
 try{await env.SELF.fetch('https://collector/reel-insights',{method:'POST'})}catch{/* A read-only metrics failure cannot block publishing. */}
 return {results};
}
export default {
 async scheduled(controller:ScheduledController,env:Env,context:ExecutionContext){
  context.waitUntil(controller.cron==='*/30 * * * *'?dispatch(env):env.SELF.fetch('https://collector/instagram-poll',{method:'POST'}));
 },
 async fetch(request:Request,env:Env){
  // No public routes, workers.dev URL, or preview URL: service bindings only.
  if(request.method!=='POST')return new Response('Not found',{status:404});
  const path=new URL(request.url).pathname;
  if(path==='/run')return Response.json(await dispatch(env));
  if(path==='/publish')return Response.json(await runAutomaticPublishing(env.DB));
  if(path==='/instagram')return Response.json(await runInstagramPublishing(env,{startNew:true}));
  if(path==='/instagram-poll')return Response.json(await runInstagramPublishing(env,{startNew:true}));
  if(path==='/instagram-check')return Response.json(await checkInstagramConnection(env));
  if(path==='/linkedin')return Response.json(await runLinkedInPublishing(env));
  if(path==='/linkedin-check')return Response.json(await checkLinkedInConnection(env));
  if(path==='/reel-insights')return Response.json(await collectReelTestInsights(env));
  if(path==='/reel-insights-check')return Response.json(await checkReelInsightsAccess(env));
  if(path==='/render')return Response.json(await dispatchRenderer(env));
  if(path==='/renderer-status')return Response.json(await rendererStatus(env));
  const sourceId=path.replace(/^\/source\//,'');
  if(!collectionSources.some(source=>source.id===sourceId))return new Response('Not found',{status:404});
  return Response.json(await runCollection(env.DB,{sourceId}));
 },
};
