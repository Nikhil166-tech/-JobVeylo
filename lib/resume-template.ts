import type {Contact,ResumeDraft} from './resume.ts';
import {safeResumeLink} from './resume-contact.ts';

export type PaperSize='a4'|'letter';
export type ResumeParagraph={text:string;bullet:boolean;entry:boolean;right?:string;links?:{url:string;label:string}[]};
export const paperSizes={a4:{width:210,height:297,label:'A4'},letter:{width:215.9,height:279.4,label:'US Letter'}} as const;
export const resumeLayout={margin:12.7,topMargin:9,bodySize:9,lineHeight:4.2,sectionSize:11.2,nameSize:18};
export function resumeParagraphs(content:string):ResumeParagraph[]{
 let startsEntry=true;
 const paragraphs:ResumeParagraph[]=content.replace(/\r\n?/g,'\n').split('\n').flatMap(line=>{
  const text=line.trim();if(!text){startsEntry=true;return []}
  const bullet=/^(?:[-*•▪◦]\s+|\d+[.)]\s+)/.test(text);
  const result={text:bullet?text.replace(/^(?:[-*•▪◦]\s+|\d+[.)]\s+)/,''):text,bullet,entry:startsEntry&&!bullet};
  startsEntry=false;return [result];
 });
 const dateRange=/(?:\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+)?\b\d{4}\s*[-–—]\s*(?:Present|Current|(?:[A-Za-z]+\s+)?\d{4})$/i;
 for(let i=0;i<paragraphs.length;i++){
  const p=paragraphs[i],next=paragraphs[i+1];
  const inline=p.text.match(dateRange);
  if(!p.bullet&&inline&&inline.index){const before=p.text.slice(0,inline.index).trim();const parts=before.split(/\s{2,}/);p.text=parts[0].replace(/[\s|]+$/,'');p.right=[...parts.slice(1).map(part=>part.replace(/[\s|]+$/,'')),inline[0]].filter(Boolean).join(' | ');p.entry=true}
  if(!p.bullet&&/\s\|\s/.test(p.text)&&!/^\s*(?:B\.?Tech|Diploma|Bachelor|Master)/i.test(p.text))p.entry=true;
  if(p.entry&&next&&!next.entry&&!next.bullet&&dateRange.test(next.text)&&next.text.length<100){p.right=next.text;paragraphs.splice(i+1,1)}
 }
 for(let i=1;i<paragraphs.length;i++)if(!paragraphs[i].bullet&&!paragraphs[i].entry&&paragraphs[i-1].bullet){paragraphs[i-1].text+=' '+paragraphs[i].text;paragraphs.splice(i--,1)}
 return paragraphs;
}
export const maxProjectBullets=4;
export function projectParagraphs(content:string){
 let bullets=0;
 return resumeParagraphs(content).filter(p=>{if(!p.bullet){if(p.entry)bullets=0;return true}return ++bullets<=maxProjectBullets});
}
// Apply the same project policy before review, preview and either export format.
export function normalizeProjectDraft(draft:ResumeDraft):ResumeDraft{
 return {...draft,sections:draft.sections.map(section=>{
  if(section.title!=='Projects')return section;
  const original=resumeParagraphs(section.content),limited=projectParagraphs(section.content);
  if(original.length===limited.length)return section;
  return {...section,content:limited.map((p,i)=>(p.entry&&i?'\n':'')+(p.bullet?'- ':'')+p.text+(p.right?'\n'+p.right:'')).join('\n')};
 })};
}
const entryKey=(text:string)=>text.split('|')[0].toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const urlKey=(url:string)=>safeResumeLink(url).replace(/^https?:\/\/(?:www\.)?/,'').replace(/\/$/,'');
export function resumeHeaderLinks(contact:Contact,draft?:ResumeDraft){
 const projects=draft?.sections.filter(s=>s.title==='Projects').flatMap(s=>resumeParagraphs(s.content))||[];
 return contact.links.split(/[|\n]/).map(url=>safeResumeLink(url)).filter(Boolean).filter(url=>!contact.linkPlacements?.some(p=>urlKey(p.url)===urlKey(url)&&projects.some(row=>!row.bullet&&entryKey(row.text)===entryKey(p.entry)))).map(url=>({url,label:url.replace(/^https?:\/\/(?:www\.)?/,'').replace(/\/$/,'')}));
}
export function resumeSections(draft:ResumeDraft,contact?:Contact){
 const sections:{title:string;paragraphs:ResumeParagraph[]}[]=[];
 if(draft.summary.text.trim())sections.push({title:'Professional Summary',paragraphs:[{text:draft.summary.text.trim(),bullet:false,entry:false}]});
 const skills=draft.skills.map(s=>s.trim()).filter(Boolean);
 for(const section of draft.sections){
  const paragraphs=section.title==='Projects'?projectParagraphs(section.content):resumeParagraphs(section.content);if(!paragraphs.length)continue;
  if(section.title==='Projects'&&contact)for(const p of paragraphs){
   if(p.bullet)continue;
   const links=contact.linkPlacements?.filter(link=>entryKey(link.entry)===entryKey(p.text)&&contact.links.split(/[|\n]/).some(url=>urlKey(url.trim())===urlKey(link.url))).map(link=>({url:safeResumeLink(link.url),label:link.label})).filter(link=>link.url);
   if(links?.length){p.links=links;p.entry=true;p.text=p.text.replace(/\s*\|?\s*\b(?:Live Demo|Git Repo|Source Code|Repository)\b.*$/i,'').trim()}
  }
  const existing=sections.find(s=>s.title===section.title);
  if(existing)existing.paragraphs.push(...paragraphs);else sections.push({title:section.title,paragraphs});
 }
 const order=['Professional Summary','Experience','Projects','Education','Certifications','Achievements'];
 sections.sort((a,b)=>order.indexOf(a.title)-order.indexOf(b.title));
 for(const section of sections)if(section.title==='Experience')section.title='Work Experience';
 if(skills.length)sections.push({title:'Technical Skills',paragraphs:(skills.some(s=>s.includes(':'))?skills:[skills.join(', ')]).map(text=>({text,bullet:false,entry:false}))});
 return sections;
}
export const contactLines=(contact:Contact)=>[
 contact.location.trim(),
 [contact.email.trim(),contact.phone.trim()].filter(Boolean).join(' | '),
].filter(Boolean);

export function parseResumeSkills(text:string){
 const labelled=text.split(/[\n;]/).some(line=>/^\s*[\w /&+.-]+:/.test(line));
 return text.split(labelled?/\n|;\s*(?=[\w /&+.-]+:)/:/[,;\n|]/).map(s=>s.trim().replace(/^[-*•]\s*/,'' )).filter(Boolean);
}

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
 return {summary:{text:text('Summary').replace(/\s*\n\s*/g,' '),sourceQuotes:[]},skills:parseResumeSkills(text('Skills')),sections:groups.filter(g=>!['Summary','Skills'].includes(g.title)&&g.lines.join('').trim()).map(g=>({title:g.title as ResumeDraft['sections'][number]['title'],content:g.lines.join('\n').trim(),sourceQuotes:[]})),missingRequirements:[],changes:[]};
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
