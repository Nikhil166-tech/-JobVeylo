type JobFacts={title?:string;experience?:string;details?:string;requirements?:string[]};
export function experienceBounds(value:string){
 return [...value.matchAll(/\b(\d+)(?:\s*[-–]\s*(\d+)\+?|\+)?\s*(years?|yrs|months?)\b/gi)].map(match=>{const divisor=/month/i.test(match[3])?12:1;return {min:Number(match[1])/divisor,max:match[2]?Number(match[2])/divisor:null}});
}
export function careerPriority(job:JobFacts){
 const explicit=job.experience||'';
 const lines=(job.requirements||[]).filter(line=>!/^topics referenced/i.test(line)).join('\n');
 const bounds=experienceBounds(explicit+'\n'+lines);
 const minimum=bounds.length?Math.max(...bounds.map(v=>v.min)):null;
 if(minimum!==null&&minimum>3)return {rank:2,label:'Experienced',minimum};
 if(minimum!==null)return {rank:minimum===0?0:1,label:minimum===0?'Fresher':'0–3 years eligible',minimum};
 if(/\b(?:intern(?:ship)?|new[ -]?grad(?:uate)?|graduate trainee|apprentice|fresher)\b/i.test(job.title||'')||/no (?:prior )?(?:work )?experience required/i.test(explicit))return {rank:0,label:'Fresher / internship',minimum:0};
 return {rank:3,label:'Experience not confirmed',minimum:null};
}
export function sourcePriorityHint(row:any){
 const title=String(row.title||row.text||'');
 const body=String(row.descriptionPlain||'')+'\n'+(row.lists||[]).map((v:any)=>v.content||'').join('\n');
 const facts=careerPriority({title,requirements:body.split(/\n/).filter((line:string)=>/experience|years|yrs/i.test(line))});
 if(facts.rank!==3)return facts.rank;
 return /\b(?:junior|associate|entry[ -]level)\b|engineer\s+I\b(?!I)/i.test(title)?1:3;
}
