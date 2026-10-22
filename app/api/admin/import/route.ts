import {authorizeWrite} from '../../../../lib/editor-auth';
import {allJobs} from '../../../../lib/jobs';
import {extractJob} from '../../../../lib/job-import';
import {fetchJobPage,sourceUrl} from '../../../../lib/fetch-job-page';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
export async function POST(req:Request) {
  if (!await authorizeWrite(req)) return Response.json({error:'Owner access required'},{status:403,headers});
  try {
    if (Number(req.headers.get('content-length') || 0)>60000) return Response.json({error:'Job text is too long.'},{status:413,headers});
    const raw=await req.text();
    if (raw.length>60000) return Response.json({error:'Job text is too long.'},{status:413,headers});
    const body=JSON.parse(raw);
    if (typeof body.url!=='string' || body.url.length>2000 || (body.text!=null && (typeof body.text!=='string' || body.text.length>30000))) return Response.json({error:'Enter a job link and optional description (up to 30,000 characters).'},{status:400,headers});
    const url=sourceUrl(body.url).href;
    const jobs=await allJobs();
    const duplicate=jobs.find(j=>j.status!=='archived' && sourceUrl(j.url).href===url);
    if(duplicate)return Response.json({error:'This application link is already in your listings. Open it to edit instead.',existingId:duplicate.id},{status:409,headers});
    const page=body.text?.trim() ? {html:body.text.trim().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'),url} : await fetchJobPage(url);
    const redirectedDuplicate=jobs.find(j=>j.status!=='archived' && sourceUrl(j.url).href===page.url);
    if(redirectedDuplicate)return Response.json({error:'This link redirects to an opening already in your listings.',existingId:redirectedDuplicate.id},{status:409,headers});
    return Response.json(extractJob(page.html,page.url,!!body.text?.trim()),{headers});
  } catch(e) {
    const message=e instanceof Error?e.message:'';
    const expected=/^(Paste|Use |This |The |Enter )/.test(message);
    return Response.json({error:expected?message:'Could not read this opening. Check the link or paste the job description below.'},{status:422,headers});
  }
}
