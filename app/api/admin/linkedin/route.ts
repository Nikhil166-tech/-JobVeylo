import {authorizeWrite} from '../../../../lib/editor-auth';
import {bindings} from '../../../../lib/platform';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const headers={'Cache-Control':'no-store'};
 if(!await authorizeWrite(request))return Response.json({error:'Owner access and same-origin request required'},{status:403,headers});
 const raw=await request.text();if(raw.length>200)return Response.json({error:'Request too large'},{status:413,headers});
 let action:string;try{action=JSON.parse(raw).action}catch{return Response.json({error:'Invalid request'},{status:400,headers})}
 const env=bindings();if(!env.COLLECTOR)return Response.json({error:'Collector unavailable'},{status:503,headers});
 try{
  if(action==='pause'){await env.DB.prepare('UPDATE linkedin_control SET enabled=0 WHERE id=1').run();return Response.json({message:'LinkedIn automatic publishing paused. Posts already queued in Buffer must be cancelled there.'},{headers})}
  if(action==='check'||action==='enable'){
   const response=await env.COLLECTOR.fetch('https://collector/linkedin-check',{method:'POST'});const data:any=await response.json();
   if(action==='enable'&&data.state==='connected'){await env.DB.prepare('UPDATE linkedin_control SET enabled=1,last_error=NULL WHERE id=1').run();return Response.json({...data,message:'LinkedIn automatic publishing enabled. One source-verified opening per 30-minute slot.'},{headers})}
   return Response.json(data,{headers});
  }
  if(action==='run'){const response=await env.COLLECTOR.fetch('https://collector/linkedin',{method:'POST'});return Response.json(await response.json(),{headers})}
  return Response.json({error:'Unsupported action'},{status:400,headers});
 }catch{return Response.json({error:'LinkedIn action failed. No automatic retry was requested.'},{status:503,headers})}
}
