import {allJobs,db} from '../../../../lib/jobs';
import {editorIdentity,authorizeWrite} from '../../../../lib/editor-auth';
import {input,canPublish} from '../../../../lib/validation';
export const dynamic='force-dynamic';
const noStore={'Cache-Control':'no-store'};
export async function GET(){
  if(!await editorIdentity())return Response.json({error:'Owner access required'},{status:403,headers:noStore});
  try{return Response.json({jobs:await allJobs()},{headers:noStore})}
  catch{return Response.json({error:'Editorial database is unavailable'},{status:503,headers:noStore})}
}
export async function POST(req:Request){
  if(!await authorizeWrite(req))return Response.json({error:'Owner access and same-origin request required'},{status:403});
  if(Number(req.headers.get('content-length')||0)>50000)return Response.json({error:'Listing is too large'},{status:413});
  const raw=await req.text();
  if(raw.length>50000)return Response.json({error:'Listing is too large'},{status:413});
  let parsed;
  try{parsed=input.safeParse(JSON.parse(raw))}catch{return Response.json({error:'Invalid JSON'},{status:400})}
  if(!parsed.success)return Response.json({error:parsed.error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')},{status:400});
  const d=parsed.data;
  try{canPublish(d)}catch(e){return Response.json({error:(e as Error).message},{status:400})}
  try{
    const existing=await allJobs();
    const old=d.id?existing.find(j=>j.id===d.id):null;
    if(d.id&&!old)return Response.json({error:'Listing no longer exists'},{status:404});
    if(old&&old.version!==d.version)return Response.json({error:'This listing changed. Reload before editing.'},{status:409});
    if(existing.some(j=>j.id!==d.id&&j.status!=='archived'&&j.url===d.url))
      return Response.json({error:'This source URL already belongs to another listing.'},{status:409});
    const id=d.id||`${(d.company+'-'+d.title).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,130)}-${crypto.randomUUID().slice(0,8)}`;
    const now=new Date().toISOString();
    const {reviewed,...fields}=d;
    const data={...fields,id,initial:d.company[0].toUpperCase(),publishedAt:old?.publishedAt||(d.status==='published'?now:''),updatedAt:now,version:d.version+1};
    const sql=db().sql;
    const result=old
      ?await sql`UPDATE listings SET data=${JSON.stringify(data)}::jsonb,status=${d.status},version=version+1,updated_at=${now} WHERE id=${id} AND version=${d.version} RETURNING id`
      :await sql`INSERT INTO listings(id,data,status,version,updated_at) VALUES(${id},${JSON.stringify(data)}::jsonb,${d.status},1,${now}) ON CONFLICT DO NOTHING RETURNING id`;
    if(!result.length)return Response.json({error:'Another update won the save. Reload and try again.'},{status:409});
    return Response.json({job:data,url:'/jobs/'+id},{headers:noStore});
  }catch(e){
    if((e as {code?:string}).code==='23505')return Response.json({error:'This source URL already belongs to another listing.'},{status:409});
    return Response.json({error:'The listing was not saved. Please try again.'},{status:503});
  }
}
