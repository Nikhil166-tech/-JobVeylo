import type {Contact} from './resume.ts';

const section=/^(?:professional summary|summary|profile|objective|work experience|professional experience|experience|employment history|education|academic qualifications|technical skills|skills|projects|personal projects|academic projects|certifications|achievements)\s*:?(?:\s*)$/i;
const emailPattern=/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9.-]*[A-Z0-9])?\.[A-Z]{2,}/ig;
const phonePattern=/(?<![\p{L}\p{N}])\+?\d[\d ().-]{7,24}\d(?![\p{L}\p{N}])/gu;
const roleWords=/\b(?:engineer|developer|designer|analyst|scientist|manager|consultant|specialist|architect|graduate|intern|student|accountant|associate|administrator|researcher|professional|executive|technician)\b/i;
const notName=/\b(?:resume|curriculum|vitae|summary|profile|education|experience|skills|projects|contact|portfolio|university|college|institute|bachelor|master|address|email|phone|mobile|page|linkedin|github|company|solutions|technologies|corporation|corp|limited|labs|inc|llc)\b/i;
const escape=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function decode(value:string){try{return decodeURIComponent(value)}catch{return value}}
function phone(value:string){const match=value.match(phonePattern)?.[0]?.trim()||'';const digits=match.replace(/\D/g,'');return digits.length>=10&&digits.length<=15&&!/^\d{4}\s*[-–]\s*\d{4}$/.test(match)?match:''}

export function safeResumeLink(raw:string){
 let value=raw.trim().replace(/[.,;]+$/,'');
 while(/[)\]}]$/.test(value)&&((value.match(/[)\]}]/g)||[]).length>(value.match(/[(\[{]/g)||[]).length))value=value.slice(0,-1);
 if(value.length>2048||/^(?:javascript|data|file|vbscript|mailto|tel):/i.test(value)||/[<>\s]/.test(value))return '';
 if(!/^[a-z][a-z\d+.-]*:/i.test(value))value='https://'+value;
 try{const url=new URL(value);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||!url.hostname.includes('.')||/^(?:localhost|127\.|0\.|10\.|192\.168\.)/i.test(url.hostname))return '';return url.href}catch{return ''}
}
function linkKey(value:string){const url=new URL(value);return url.hostname.replace(/^www\./,'')+url.pathname.replace(/\/$/,'')+url.search+url.hash}
function nameCandidate(value:string){
 const cleaned=value.replace(/^(?:full\s+name|name)\s*:\s*/i,'').trim();
 const words=cleaned.split(/\s+/),labelled=/^(?:full\s+name|name)\s*:/i.test(value);
 return cleaned.length<=90&&words.length>=2&&words.length<=7&&/^[\p{L}\p{M}.'’ -]+$/u.test(cleaned)&&!notName.test(cleaned)&&!roleWords.test(cleaned)&&!(/\b(?:built|developed|implemented|worked|proficient|seeking|responsible|experienced)\b/i.test(cleaned))&&(labelled||words.every(word=>/^(?:\p{Lu}[\p{L}\p{M}.'’-]*|de|del|da|dos|van|von|al|bin)$/u.test(word)))?cleaned:'';
}

export function extractResumeContact(text:string,embeddedLinks:string[]=[]){
 const contact:Contact={name:'',headline:'',email:'',phone:'',location:'',links:''};
 const lines=text.replace(/\r\n?/g,'\n').split('\n'),firstSection=lines.findIndex(line=>section.test(line.trim()));
 const headerEnd=firstSection<0?Math.min(lines.length,12):Math.min(firstSection,20);
 const header=lines.slice(0,headerEnd).map(line=>line.trim()).filter(Boolean);
 const warnings:string[]=[],links:string[]=[],keys=new Set<string>();
 const addLink=(raw:string)=>{const url=safeResumeLink(raw);if(!url)return;const key=linkKey(url);if(keys.has(key))return;keys.add(key);links.push(url)};
 for(const value of embeddedLinks){
  if(/^mailto:/i.test(value)){const email=decode(value.slice(7).split('?')[0]).match(emailPattern)?.[0];if(!contact.email&&email)contact.email=email}
  else if(/^tel:/i.test(value)){if(!contact.phone)contact.phone=phone(decode(value.slice(4)))}
  else addLink(value);
 }
 contact.email=header.join('\n').match(emailPattern)?.[0]||contact.email||text.match(emailPattern)?.[0]||'';
 for(const line of header){const found=phone(line);if(found){contact.phone=found;break}}
 if(!contact.phone){const labelled=lines.find(line=>/\b(?:phone|mobile|tel|contact)\s*:/i.test(line));if(labelled)contact.phone=phone(labelled)}
 const urls=text.match(/https?:\/\/[^\s<>"|]+|(?:www\.)?(?:[\p{L}\d-]+\.)+(?:com|org|net|io|dev|app|ai|me|co|in|tech|site|xyz|edu)(?:\/[^\s<>"|]*)?/giu)||[];
 for(const value of urls){if(text.includes('@'+value)||/^(?:asp\.net|vb\.net)$/i.test(value))continue;addLink(value)}
 const labelledName=header.find(line=>/^(?:full\s+name|name)\s*:/i.test(line));
 const hasHeaderSignals=header.some(line=>!!line.match(emailPattern)||!!phone(line)||roleWords.test(line)||/\b(?:linkedin|github)\.com\//i.test(line));
 contact.name=nameCandidate(labelledName||'')||(hasHeaderSignals?header.slice(0,5).map(nameCandidate).find(Boolean):'')||'';
 const nameAt=header.findIndex(line=>line===contact.name||/^(?:full\s+name|name)\s*:/i.test(line));
 if(nameAt>=0){const possible=header[nameAt+1]||'';if(possible.length<=120&&roleWords.test(possible)&&!possible.includes('@')&&!section.test(possible))contact.headline=possible}
 const location=header.find(line=>/^(?:location|address|based in)\s*:/i.test(line))||(nameAt>=0?header.slice(nameAt+1,nameAt+5).find(line=>line.length<=150&&line.split(/\s+/).length<=10&&line.includes(',')&&!line.includes('@')&&!/https?:|www\.|\d{7}|\b(?:skills|python|javascript|sql|react|built|developed|worked|experience|services|applications|proficient)\b/i.test(line)&&!roleWords.test(line)):undefined);
 if(location)contact.location=location.replace(/^(?:location|address|based in)\s*:\s*/i,'').trim();
 const bounded=links.slice(0,24);let combined='';
 for(const url of bounded){if((combined?combined+' | ':'').length+url.length>8192)break;combined+=(combined?' | ':'')+url}
 contact.links=combined;
 if(!contact.name)warnings.push('Your name could not be identified confidently. Check the contact fields.');
 if(!contact.email&&!contact.phone)warnings.push('No email or phone number was found. Add a contact method before downloading.');
 if(links.length>24||combined.split(' | ').length<bounded.length)warnings.push('Some links exceed the contact-field limit. Review your important profile and project links.');
 const headerValues=new Set([contact.name,contact.headline,contact.location].filter(Boolean));
 const bodyLines=lines.filter((line,index)=>{
  const value=line.trim();if(index<headerEnd&&(headerValues.has(value)||(contact.name&&nameCandidate(value)===contact.name)))return false;
  let remainder=value.replace(emailPattern,'').replace(/https?:\/\/[^\s|]+/gi,'');
  for(const item of [contact.phone,...urls])if(item)remainder=remainder.replace(new RegExp(escape(item),'gi'),'');
  return !value||!!remainder.replace(/\b(?:email|e-mail|phone|mobile|tel|contact|linkedin|github|portfolio|website|links|name)\b\s*:?/gi,'').replace(/[\s|:;,/()\-+]+/g,'');
 });
 return {contact,bodyText:bodyLines.join('\n').trim(),links:bounded,warnings};
}

export function redactResumeContact(text:string,provided:Contact){
 const detected=extractResumeContact(text),aliases=detected.links.flatMap(link=>{const bare=link.replace(/^https?:\/\//i,'').replace(/\/$/,'');return [bare,bare.replace(/^www\./i,'')]});
 const values=[provided.name,provided.email,provided.phone,provided.links,...Object.values(detected.contact).filter(v=>typeof v==='string'),...detected.links,...aliases].filter((v):v is string=>typeof v==='string'&&v.trim().length>2);
 let result=text;
 for(const value of values)result=result.replace(new RegExp(escape(value),'gi'),'[contact detail removed]');
 result=result.replace(emailPattern,'[email removed]').replace(/https?:\/\/[^\s<>|]+/gi,'[link removed]');
 return result;
}
