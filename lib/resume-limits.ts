import {bindings} from './platform';
export class ResumeLimitError extends Error{constructor(message:string,public retryAfter:number){super(message)}}
export async function reserveResumeRequest(ip:string,key:string){
 const now=new Date(),day=now.toISOString().slice(0,10),minute=now.toISOString().slice(0,16);
 const dayStart=Date.parse(day+'T00:00:00Z'),nextDay=dayStart+86400000;
 const signingKey=await crypto.subtle.importKey('raw',new TextEncoder().encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const hash=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',signingKey,new TextEncoder().encode(day+'|'+ip))),byte=>byte.toString(16).padStart(2,'0')).join('');
 const database=bindings().DB;
 // A single conditional INSERT reserves all three quotas atomically in D1.
 const results=await database.batch([
   database.prepare('DELETE FROM resume_requests WHERE created_at<?').bind(dayStart),
   database.prepare(`INSERT INTO resume_requests(id,day,minute,ip_hash,created_at)
     SELECT ?,?,?,?,?
     WHERE (SELECT COUNT(*) FROM resume_requests WHERE day=?)<20
       AND (SELECT COUNT(*) FROM resume_requests WHERE day=? AND ip_hash=?)<3
       AND (SELECT COUNT(*) FROM resume_requests WHERE minute=?)<1
     RETURNING id`).bind(crypto.randomUUID(),day,minute,hash,now.getTime(),day,day,hash,minute),
 ]);
 if(results[1].results.length)return;
 const counts=await database.prepare(`SELECT
   (SELECT COUNT(*) FROM resume_requests WHERE day=?) AS daily,
   (SELECT COUNT(*) FROM resume_requests WHERE day=? AND ip_hash=?) AS connection`).bind(day,day,hash).first<{daily:number;connection:number}>();
 const retry=Math.max(60,Math.ceil((nextDay-now.getTime())/1000));
 if((counts?.daily||0)>=20)throw new ResumeLimitError('Today’s free AI allowance is used up. You can still fill, edit and download your resume.',retry);
 if((counts?.connection||0)>=3)throw new ResumeLimitError('You have reached the limit of 3 AI requests per day for this connection. Try again tomorrow.',retry);
 throw new ResumeLimitError('The free AI service is busy. Wait one minute and try again.',60);
}
