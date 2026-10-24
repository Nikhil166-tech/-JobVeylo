import {runCollection} from '../lib/collection';
import {collectionSources} from '../lib/collection-sources';
type Env={DB:D1Database;SELF:Fetcher};
async function dispatch(env:Env){
 const results=[];
 for(const source of collectionSources){
  try{const response=await env.SELF.fetch('https://collector/source/'+source.id,{method:'POST'});results.push(response.ok?await response.json():{source:source.id,error:'Source worker returned HTTP '+response.status})}
  catch{results.push({source:source.id,error:'Source check did not complete. Other sources continue.'})}
 }
 return {results};
}
export default {
 async scheduled(_controller:ScheduledController,env:Env,context:ExecutionContext){
  context.waitUntil(dispatch(env));
 },
 async fetch(request:Request,env:Env){
  // No public routes, workers.dev URL, or preview URL: service bindings only.
  if(request.method!=='POST')return new Response('Not found',{status:404});
  const path=new URL(request.url).pathname;
  if(path==='/run')return Response.json(await dispatch(env));
  const sourceId=path.replace(/^\/source\//,'');
  if(!collectionSources.some(source=>source.id===sourceId))return new Response('Not found',{status:404});
  return Response.json(await runCollection(env.DB,{sourceId}));
 },
};
