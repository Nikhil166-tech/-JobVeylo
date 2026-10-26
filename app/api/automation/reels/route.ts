import {bindings} from '../../../../lib/platform';
import {automationAuthorized,claimReel} from '../../../../lib/instagram-publishing';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
export async function POST(request:Request){
 const env=bindings();if(!await automationAuthorized(request,env.JOBVEYLO_AUTOMATION_KEY,await env.REEL_MEDIA?.get('automation/renderer-key-hash')))return Response.json({error:'Automation access required'},{status:403,headers});
 if(!env.REEL_MEDIA)return Response.json({error:'Reel storage is not connected'},{status:503,headers});
 return Response.json({job:await claimReel(env.DB)},{headers});
}
export async function PUT(request:Request){
 const env=bindings();if(!await automationAuthorized(request,env.JOBVEYLO_AUTOMATION_KEY,await env.REEL_MEDIA?.get('automation/renderer-key-hash')))return Response.json({error:'Automation access required'},{status:403,headers});
 const id=new URL(request.url).searchParams.get('id')||'';
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)||id.length>180)return Response.json({error:'Invalid job ID'},{status:400,headers});
 if(!env.REEL_MEDIA)return Response.json({error:'Reel storage is not connected'},{status:503,headers});
 const claim=await env.DB.prepare("SELECT listing_id FROM social_jobs WHERE listing_id=? AND status='rendering' AND lease_until>?").bind(id,Date.now()).first();
 if(!claim)return Response.json({error:'Render lease is no longer active'},{status:409,headers});
 const reader=request.body?.getReader();if(!reader)return new Response('Empty media',{status:400,headers});
 const chunks:Uint8Array[]=[];let total=0;
 while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>1500000){await reader.cancel();return new Response('Media too large',{status:413,headers})}chunks.push(value)}
 const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
 if(total<1000||new TextDecoder().decode(bytes.slice(4,8))!=='ftyp')return new Response('An MP4 is required',{status:400,headers});
 const key='reels/'+id+'.mp4';await env.REEL_MEDIA.put(key,bytes,{expirationTtl:7*86400});
 await env.DB.prepare("UPDATE social_jobs SET status='media_ready',media_key=?,media_created_at=?,lease_until=0,last_error=NULL WHERE listing_id=? AND status='rendering'").bind(key,new Date().toISOString(),id).run();
 await env.DB.prepare('UPDATE reel_test_jobs SET rendered_at=? WHERE listing_id=?').bind(Date.now(),id).run();
 return Response.json({ready:true},{headers});
}
