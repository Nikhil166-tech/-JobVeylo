type SectionKind='details'|'eligibility'|'selection';
export type JobContentSection={title:string;points:string[]};

/** Format existing wording only; never summarise or infer hiring stages. */
export function jobPoints(text:string):string[]{
  const segmenter=new Intl.Segmenter('en',{granularity:'sentence'});
  return text.replace(/\r\n?/g,'\n').replace(/[•▪‣]\s*/g,'\n').split('\n')
    .map(line=>line.trim().replace(/^(?:[-*–—◦]\s+|\d+[.)]\s+)/,'').trim())
    .filter(Boolean)
    .flatMap(line=>Array.from(segmenter.segment(line),part=>part.segment.trim()).filter(Boolean));
}

function heading(line:string):SectionKind|undefined{
  const title=line.replace(/[:：]\s*$/,'').replace(/[’‘]/g,"'").trim();
  if(/^(?:(?:about (?:the |our )?|our )?interviews?(?: process)?|selection (?:process|procedure)|hiring process|recruitment process|interview stages|how we hire)$/i.test(title))return 'selection';
  if(/^(?:what (?:we're|we are) looking for|what you(?:'ll| will) bring|(?:basic|minimum|required|preferred|essential|desired)?\s*qualifications|requirements|eligibility(?: criteria)?|must[- ]haves?|nice[- ]to[- ]haves?|(?:required|preferred|essential|desirable) (?:skills|requirements))$/i.test(title))return 'eligibility';
  if(/^(?:about .{1,65}|role overview|(?:key |job )?responsibilities|what you(?:'ll| will) do|why .{1,65}|benefits|what we offer|build & own features end-to-end|drive technical excellence|collaborate|how to apply)$/i.test(title))return 'details';
}

export function jobContent(job:{details:string;requirements:string[];selection?:string}){
  const groups:{kind:SectionKind;title:string;lines:string[]}[]=[];
  let current:{kind:SectionKind;title:string;lines:string[]}={kind:'details',title:'',lines:[]};
  for(const rawLine of job.details.split(/\r?\n/)){
    const line=rawLine.trim();
    const kind=heading(line);
    if(kind){groups.push(current);current={kind,title:line.replace(/[:：]\s*$/,''),lines:[]};}
    else current.lines.push(line);
  }
  groups.push(current);
  const sections=groups.map(group=>({...group,points:jobPoints(group.lines.join('\n'))})).filter(group=>group.points.length);
  const details=sections.filter(s=>s.kind==='details').map(({title,points})=>({title,points}));
  const eligibility=sections.filter(s=>s.kind==='eligibility').map(({title,points})=>({title,points}));
  const normalize=(value:string)=>value.toLowerCase().replace(/\s+/g,' ').replace(/[.!]+$/,'').trim();
  const detailedEligibility=normalize(eligibility.flatMap(s=>s.points).join(' '));
  const extraRequirements=job.requirements.flatMap(jobPoints).filter(point=>!detailedEligibility.includes(normalize(point)));
  if(extraRequirements.length)eligibility.unshift({title:eligibility.length?'Additional requirements':'',points:extraRequirements});
  const selection=job.selection?.trim()||'';
  const statedSelection=selection&&!/^(?:not (?:specified|provided|disclosed|published|stated|available)|selection process (?:is )?not (?:specified|provided|disclosed))/i.test(selection);
  const descriptionSelection=sections.filter(s=>s.kind==='selection').flatMap(s=>s.points);
  return {
    details,eligibility,
    selection:statedSelection?jobPoints(selection):descriptionSelection,
    selectionFromDescription:!statedSelection&&descriptionSelection.length>0,
    selectionNote:selection||'The selection process is not specified in the source. Confirm with the recruiting organisation.',
  };
}
