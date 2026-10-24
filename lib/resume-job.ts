type ResumeJob={id:string;title:string;company:string;location:string;experience:string;education:string;requirements:string[];details:string;summary?:string;checked:string;version?:number};
export type ResumeTarget={id:string;title:string;company:string;checked:string;version:number;descriptionHash:string};
export function resumeJobContext(job:ResumeJob){
 return {id:job.id,title:job.title,company:job.company,location:job.location,experience:job.experience,education:job.education,requirements:job.requirements,summary:job.summary||'',description:job.details};
}
export async function resumeTarget(job:ResumeJob):Promise<ResumeTarget>{
 const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(resumeJobContext(job)))));
 return {id:job.id,title:job.title,company:job.company,checked:job.checked,version:job.version||1,descriptionHash:Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('')};
}
