type JobFacts={title?:string;experience?:string;details?:string;requirements?:string[]};
export function experienceBounds(value:string){
 const numbers:Record<string,string>={zero:'0',one:'1',two:'2',three:'3',four:'4',five:'5',six:'6',seven:'7',eight:'8',nine:'9',ten:'10'};
 const normalized=value.replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten)\b/gi,v=>numbers[v.toLowerCase()]);
 return [...normalized.matchAll(/\b(\d+(?:\.\d+)?)(?:\s*(?:[-–—]|to)\s*(\d+(?:\.\d+)?)\+?|\+)?[\s-]*(years?|yrs?|months?)\b/gi)].map(match=>{const divisor=/month/i.test(match[3])?12:1;return {min:Number(match[1])/divisor,max:match[2]?Number(match[2])/divisor:null}});
}
const fresherWords=/\b(?:freshers?|(?:new|recent)[ -]grad(?:uate)?s?)\b/i;
const noExperience=/\b(?:no\s+(?:(?:prior|previous|professional|work|industry)\s+)*experience\s+(?:is\s+)?(?:required|necessary|needed)|(?:(?:prior|previous|professional|work|industry)\s+)*experience\s+(?:is\s+)?not\s+(?:required|necessary|needed))\b/i;
const fresherExclusion=/\b(?:no\s+(?:opportunities\s+for\s+)?freshers?|(?:freshers?|(?:new|recent)[ -]grad(?:uate)?s?)\s+(?:are\s+)?(?:not\s+(?:eligible|accepted|considered|suitable)|need\s+not\s+apply)|not\s+(?:(?:open|suitable)\s+)?(?:to|for)\s+(?:freshers?|(?:new|recent)[ -]grad(?:uate)?s?)|not\s+accepting\s+freshers?|experienced\s+(?:candidates|applicants|professionals)\s+only)\b/i;
const optionalExperience=(line:string)=>/\b(?:preferred|preferably|nice[ -]to[ -]have|bonus|advantage|a plus)\b/i.test(line)&&!/\b(?:required|must|minimum|at least|mandatory)\b/i.test(line);
const clauses=(value:string)=>value.split(/\n|;|(?<=[.!?])\s+(?=[A-Z])/).map(line=>line.trim()).filter(Boolean);
// Ignore degree/program durations and corporate age: only experience clauses are
// evidence. An internship or junior title alone never confirms fresher eligibility.
export function experienceClauses(value:string){
 return clauses(value).filter(line=>!/^(?:topics referenced|education:)/i.test(line)&&(/\bexperience\b|\bprofessional\b|\byears?\s+(?:of|in|as)\b/i.test(line)||fresherWords.test(line)||/^\s*\d+(?:\s*[-–—]\s*\d+|\+)?\s*(?:years?|months?)(?:\s*(?:required|preferred))?[.!]?\s*$/i.test(line)));
}
export function explicitFresherWording(value:string){
 if(fresherExclusion.test(value))return '';
 return value.match(noExperience)?.[0]||value.match(fresherWords)?.[0]||'';
}
export function eligibleEarlyCareer(job:JobFacts){
 if(/\b(?:senior|sr\.?|principal|staff|lead|manager|director|architect)\b/i.test(job.title||''))return false;
 const evidence=[...clauses(job.experience||''),...experienceClauses((job.requirements||[]).join('\n')),...experienceClauses(job.details||'')];
 const all=[job.title||'',job.experience||'',...(job.requirements||[]),job.details||''].join('\n');
 if(fresherExclusion.test(all))return false;
 const mandatory=evidence.filter(line=>!optionalExperience(line));
 const bounds=experienceBounds(mandatory.join('\n'));
 // A range beginning at zero accepts freshers. Any mandatory positive minimum
 // contradicts that evidence, even when the role is labelled fresher/intern.
 if(bounds.some(b=>b.min>0||(b.max!==null&&b.max>3)))return false;
 return bounds.some(b=>b.min===0)||!!explicitFresherWording([job.title||'',...mandatory].join('\n'));
}
export function careerPriority(job:JobFacts){
 if(eligibleEarlyCareer(job))return {rank:0,label:'Fresher',minimum:0};
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
