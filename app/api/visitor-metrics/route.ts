import {bindings,sameOrigin} from '../../../lib/platform';
import {validMetric} from '../../../lib/visitor-metrics';
export const dynamic='force-dynamic';
const noStore={'Cache-Control':'no-store'};
export async function POST(request:Request){
 if(!sameOrigin(request)||!request.headers.get('content-type')?.startsWith('application/json'))return new Response(null,{status:403,headers:noStore});
 if(Number(request.headers.get('content-length')||0)>700)return new Response(null,{status:413,headers:noStore});
 if(/bot\b|crawler|spider|headless/i.test(request.headers.get('user-agent')||''))return new Response(null,{status:204,headers:noStore});
 try{
  const body=await request.text();if(body.length>700)return new Response(null,{status:413,headers:noStore});
  const metric:unknown=JSON.parse(body);if(!validMetric(metric))return new Response(null,{status:400,headers:noStore});
  const db=bindings().DB;
  if(metric.path.startsWith('/jobs/')){if(!await db.prepare("SELECT id FROM listings WHERE id=? AND status='published'").bind(metric.path.slice(6)).first())return new Response(null,{status:400,headers:noStore})}
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  await db.prepare('INSERT INTO visitor_metrics(day,path,source,campaign,event,total) VALUES(?,?,?,?,?,1) ON CONFLICT(day,path,source,campaign,event) DO UPDATE SET total=MIN(total+1,100000)').bind(day,metric.path,metric.source,metric.campaign,metric.event).run();
  return new Response(null,{status:204,headers:noStore});
 }catch{return new Response(null,{status:503,headers:noStore})}
}
