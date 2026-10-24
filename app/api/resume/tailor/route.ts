import {getJob} from '../../../../lib/jobs';
import {resumeRequest,resumeDraft,validateEvidence,draftJsonSchema,resumeSystemPrompt,redactContact,blankContact} from '../../../../lib/resume';
import {reserveResumeRequest,ResumeLimitError} from '../../../../lib/resume-limits';
import {bindings,sameOrigin} from '../../../../lib/platform';
import {resumeJobContext,resumeTarget} from '../../../../lib/resume-job';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const noStore={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
export async function GET(){return Response.json({available:!!bindings().GROQ_API_KEY,provider:'Groq',perConnectionDailyLimit:3},{headers:noStore});}
export async function POST(req:Request){
  if(!sameOrigin(req))return Response.json({error:'Open this form on JobVeylo to continue.'},{status:403,headers:noStore});
  const env=bindings();
  const key=env.GROQ_API_KEY;
  if(!key)return Response.json({error:'AI tailoring is not enabled yet. You can fill, edit and download a resume without AI.'},{status:503,headers:noStore});
  try{
    const reader=req.body?.getReader();if(!reader)return Response.json({error:'Resume text is required.'},{status:400,headers:noStore});
    const chunks:Uint8Array[]=[];let total=0;
    while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>50000){await reader.cancel();return Response.json({error:'Resume text is too long.'},{status:413,headers:noStore});}chunks.push(value);}
    let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return Response.json({error:'The resume request could not be read.'},{status:400,headers:noStore});}
    const parsed=resumeRequest.safeParse(body);
    if(!parsed.success)return Response.json({error:parsed.error.issues[0].message},{status:400,headers:noStore});
    const job=await getJob(parsed.data.jobId);
    if(!job || job.status!=='published')return Response.json({error:'Choose a currently published job before tailoring your resume.'},{status:400,headers:noStore});
    const ip=req.headers.get('cf-connecting-ip') || (new URL(env.SITE_URL).hostname==='localhost'?'local-preview':'');
    if(!ip)return Response.json({error:'The AI service could not verify this connection. Please try again later.'},{status:503,headers:noStore});
    await reserveResumeRequest(ip,key);
    const selectedJob=resumeJobContext(job),target=await resumeTarget(job);
    const candidateResume=redactContact(parsed.data.resumeText,blankContact());
    const result=await fetch('https://api.groq.com/openai/v1/chat/completions',{
      method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(45000),
      body:JSON.stringify({model:env.GROQ_RESUME_MODEL || 'openai/gpt-oss-20b',reasoning_effort:'low',temperature:0.1,max_completion_tokens:5000,response_format:{type:'json_schema',json_schema:{name:'tailored_resume',strict:true,schema:draftJsonSchema}},messages:[{role:'system',content:resumeSystemPrompt},{role:'user',content:JSON.stringify({candidateResume,selectedJob})}]}),
    });
    if(!result.ok){
      if(result.status===429)return Response.json({error:'Groq’s free quota is temporarily busy. Wait a minute before trying again.'},{status:429,headers:{...noStore,'Retry-After':'60'}});
      if(result.status===401||result.status===403)return Response.json({error:'The AI connection needs an update by the site owner. You can still build, edit and download a resume without AI.'},{status:503,headers:noStore});
      return Response.json({error:'The AI service is unavailable. Your source text is still in the form; try again later or edit your resume manually.'},{status:502,headers:noStore});
    }
    const response=await result.json() as {choices?:{finish_reason?:string;message:{content:string}}[]};
    const choice=response.choices?.[0];
    if(choice?.finish_reason!=='stop')return Response.json({error:'The AI draft was incomplete. Try a shorter resume or edit it manually.'},{status:502,headers:noStore});
    let draft;
    try{draft=resumeDraft.parse(JSON.parse(choice.message.content));validateEvidence(draft,candidateResume,selectedJob.company);}catch{return Response.json({error:'The AI draft did not pass the source-evidence checks. Try again later or edit your resume manually.'},{status:502,headers:noStore});}
    return Response.json({draft,target},{headers:noStore});
  }catch(error){
    if(error instanceof ResumeLimitError)return Response.json({error:error.message},{status:429,headers:{...noStore,'Retry-After':String(error.retryAfter)}});
    return Response.json({error:'Resume tailoring is temporarily unavailable. Please try again later. Your text has not been saved to our database.'},{status:503,headers:noStore});
  }
}
