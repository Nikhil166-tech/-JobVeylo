import {createHmac} from 'node:crypto';
import {db} from './jobs';
export class ResumeLimitError extends Error {constructor(message:string,public retryAfter:number){super(message)}}
export async function reserveResumeRequest(ip:string,key:string) {
  const now=new Date();
  const day=now.toISOString().slice(0,10);
  const minute=now.toISOString().slice(0,16);
  const tomorrow=new Date(`${day}T00:00:00Z`);tomorrow.setUTCDate(tomorrow.getUTCDate()+1);
  const hash=createHmac('sha256',key).update(`${day}|${ip}`).digest('hex');
  const buckets=[`resume:day:${day}`,`resume:ip:${day}:${hash}`,`resume:minute:${minute}`];
  const limits=[20,3,1];
  const client=await db().pool.connect();
  try{
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('jobveylo-resume-usage'))");
    await client.query('DELETE FROM resume_usage WHERE expires_at < now()');
    for(const bucket of buckets)await client.query('INSERT INTO resume_usage(bucket,uses,expires_at) VALUES($1,0,$2) ON CONFLICT DO NOTHING',[bucket,tomorrow.toISOString()]);
    for(let index=0;index<buckets.length;index++){
      const result=await client.query('SELECT uses FROM resume_usage WHERE bucket=$1 FOR UPDATE',[buckets[index]]);
      if(Number(result.rows[0].uses)>=limits[index])throw new ResumeLimitError(index===2?'The free AI service is busy. Wait one minute and try again.':index===1?'You have reached the limit of 3 AI requests per day for this connection. Try again tomorrow.':'Today’s free AI allowance is used up. You can still fill, edit and download your resume.',index===2?60:Math.max(60,Math.ceil((tomorrow.getTime()-now.getTime())/1000)));
    }
    for(const bucket of buckets)await client.query('UPDATE resume_usage SET uses=uses+1 WHERE bucket=$1',[bucket]);
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
