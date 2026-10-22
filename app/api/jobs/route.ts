import { allJobs } from '../../../lib/jobs';export const dynamic='force-dynamic';
export async function GET(){try{return Response.json({jobs:(await allJobs()).filter(j=>j.status==='published')},{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({error:'Job collection is temporarily unavailable'},{status:503})}}
