import {checkInstagramConnection,type SocialEnv} from './instagram-publishing.ts';

// Read provider evidence only. No container creation, publish request, or retry.
export async function reconcileInstagram(env:SocialEnv,fetcher:typeof fetch=fetch){
 const connection=await checkInstagramConnection(env,fetcher);
 if(connection.state!=='connected')return connection;
 const rows=await env.DB.prepare("SELECT listing_id,container_id FROM social_jobs WHERE status='held' AND container_id IS NOT NULL ORDER BY created_at DESC LIMIT 10").all<{listing_id:string;container_id:string}>();
 if(!rows.results.length)return {message:'No held Instagram containers need reconciliation.',confirmed:0};
 const token=String(env.INSTAGRAM_ACCESS_TOKEN).trim();
 async function read(path:string){
  const response=await fetcher('https://graph.instagram.com/v25.0/'+path,{headers:{Authorization:'Bearer '+token},redirect:'manual',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Provider unavailable');const data:any=await response.json();if(data.error)throw Error('Provider rejected reconciliation');return data;
 }
 try{
  const media=await read(env.INSTAGRAM_ACCOUNT_ID+'/media?fields=id,caption,timestamp&limit=100');
  if(!Array.isArray(media.data))throw Error('Missing media');
  let confirmed=0;const outcomes=[];
  for(const row of rows.results){
   if(!/^\d+$/.test(row.container_id))continue;
   try{
   const state=await read(row.container_id+'?fields=status_code');
   const matches=media.data.filter((item:any)=>{
    if(!/^\d+$/.test(item.id||'')||!Number.isFinite(Date.parse(item.timestamp)))return false;
    return String(item.caption||'').split(/\s+/).some(text=>{
     try{const url=new URL(text);return url.origin===new URL(env.SITE_URL).origin&&url.pathname==='/jobs/'+encodeURIComponent(row.listing_id)}catch{return false}
    });
   });
   if(state.status_code==='PUBLISHED'&&matches.length===1){
    await env.DB.prepare("UPDATE social_jobs SET status='published',instagram_id=?,published_at=?,lease_until=0,last_error=NULL WHERE listing_id=? AND status='held' AND container_id=?").bind(matches[0].id,new Date(matches[0].timestamp).toISOString(),row.listing_id,row.container_id).run();confirmed++;
   }
   outcomes.push({id:row.listing_id,status:String(state.status_code||'UNKNOWN').slice(0,30),confirmed:state.status_code==='PUBLISHED'&&matches.length===1});
   }catch{outcomes.push({id:row.listing_id,status:'UNAVAILABLE',confirmed:false})}
  }
  const statuses=outcomes.reduce<Record<string,number>>((counts,row)=>{counts[row.status]=(counts[row.status]||0)+1;return counts},{});
  return {message:`Confirmed ${confirmed} previously held Instagram posts. Provider states: ${Object.entries(statuses).map(([status,count])=>status+': '+count).join(', ')}. Others remain held; no posts were retried.`,confirmed,outcomes};
 }catch{return {message:'Instagram reconciliation could not finish. Unconfirmed posts remain held; no posts were retried.'}}
}
