import type {Contact,ResumeDraft} from './resume.ts';

export type PaperSize='a4'|'letter';
export type ResumeParagraph={text:string;bullet:boolean;entry:boolean};
export const paperSizes={a4:{width:210,height:297,label:'A4'},letter:{width:215.9,height:279.4,label:'US Letter'}} as const;
export const resumeLayout={margin:18,bodySize:11,lineHeight:5.3,sectionSize:11,nameSize:21};
export function resumeParagraphs(content:string):ResumeParagraph[]{
 let startsEntry=true;
 return content.replace(/\r\n?/g,'\n').split('\n').flatMap(line=>{
  const text=line.trim();if(!text){startsEntry=true;return []}
  const bullet=/^(?:[-*•▪◦]\s+|\d+[.)]\s+)/.test(text);
  const result={text:bullet?text.replace(/^(?:[-*•▪◦]\s+|\d+[.)]\s+)/,''):text,bullet,entry:startsEntry&&!bullet};
  startsEntry=false;return [result];
 });
}
export function resumeSections(draft:ResumeDraft){
 const sections:{title:string;paragraphs:ResumeParagraph[]}[]=[];
 if(draft.summary.text.trim())sections.push({title:'Professional Summary',paragraphs:[{text:draft.summary.text.trim(),bullet:false,entry:false}]});
 const skills=draft.skills.map(s=>s.trim()).filter(Boolean);
 if(skills.length)sections.push({title:'Skills',paragraphs:[{text:skills.join(', '),bullet:false,entry:false}]});
 for(const section of draft.sections){
  const paragraphs=resumeParagraphs(section.content);if(!paragraphs.length)continue;
  const existing=sections.find(s=>s.title===section.title);
  if(existing)existing.paragraphs.push(...paragraphs);else sections.push({title:section.title,paragraphs});
 }
 return sections;
}
export const contactLines=(contact:Contact)=>[
 [contact.email.trim(),contact.phone.trim(),contact.location.trim()].filter(Boolean).join(' | '),
 contact.links.trim(),
].filter(Boolean);

const headings:Record<string,string>={summary:'Summary','professional summary':'Summary',profile:'Summary',objective:'Summary',skills:'Skills','technical skills':'Skills',experience:'Experience','work experience':'Experience','professional experience':'Experience','employment history':'Experience',projects:'Projects','personal projects':'Projects','academic projects':'Projects',education:'Education','academic qualifications':'Education',certifications:'Certifications',achievements:'Achievements'};
// Recognise standalone section labels only. Keep every other line for the user to review.
export function manualResumeDraft(source:string):ResumeDraft{
 const groups:{title:string;lines:string[]}[]=[];let current={title:'Summary',lines:[] as string[]};groups.push(current);let labelled=false;
 for(const line of source.replace(/\r\n?/g,'\n').split('\n')){
  const heading=headings[line.trim().replace(/:$/,'').toLowerCase()];
  if(heading){labelled=true;current=groups.find(g=>g.title===heading)||{title:heading,lines:[]};if(!groups.includes(current))groups.push(current)}else current.lines.push(line);
 }
 if(!labelled)return {summary:{text:'',sourceQuotes:[]},skills:[],sections:[{title:'Experience',content:source.trim(),sourceQuotes:[]}],missingRequirements:[],changes:[]};
 const text=(title:string)=>groups.find(g=>g.title===title)?.lines.join('\n').trim()||'';
 return {summary:{text:text('Summary'),sourceQuotes:[]},skills:text('Skills').split(/[,;\n|]/).map(s=>s.trim().replace(/^[-*•]\s*/,'' )).filter(Boolean),sections:groups.filter(g=>!['Summary','Skills'].includes(g.title)&&g.lines.join('').trim()).map(g=>({title:g.title as ResumeDraft['sections'][number]['title'],content:g.lines.join('\n').trim(),sourceQuotes:[]})),missingRequirements:[],changes:[]};
}

export function resumeChecks(contact:Contact,draft:ResumeDraft){
 const checks=[];
 if(!contact.name.trim())checks.push('Add your full name in Contact details.');
 if(!contact.email.trim()&&!contact.phone.trim())checks.push('Add an email address or phone number for recruiters.');
 if(!draft.skills.some(s=>s.trim()))checks.push('Add relevant skills that you can support with your experience.');
 if(!draft.sections.some(s=>s.title==='Education'&&s.content.trim()))checks.push('Check that your education is included.');
 if(!draft.sections.some(s=>['Experience','Projects'].includes(s.title)&&s.content.trim()))checks.push('Include experience or projects relevant to the role.');
 return checks;
}
