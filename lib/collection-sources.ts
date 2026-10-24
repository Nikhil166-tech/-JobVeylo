import {load} from 'cheerio';
import {plain} from './job-import.ts';
import {input} from './validation.ts';

export const collectionSources=[
 {id:'ashby-aiprise',label:'AiPrise · Ashby',kind:'ashby',url:'https://api.ashbyhq.com/posting-api/job-board/aiprise?includeCompensation=true',company:'AiPrise'},
 {id:'lever-safe',label:'Safe Security · Lever',kind:'lever',url:'https://api.lever.co/v0/postings/safe?mode=json',company:'Safe Security'},
 {id:'greenhouse-cloudflare',label:'Cloudflare · Greenhouse',kind:'greenhouse',url:'https://boards-api.greenhouse.io/v1/boards/cloudflare/jobs',company:'Cloudflare'},
 {id:'employment-news',label:'Employment News · Government discovery',kind:'employment',url:'https://employmentnews.gov.in/newemp/AllJobs.aspx?k=All',company:'Employment News'},
 {id:'upsc-notices',label:'UPSC · Official recruitment notices',kind:'upsc',url:'https://upsc.gov.in/recruitment/recruitment-advertisement',company:'UPSC'},
] as const;
export type CollectionSource=typeof collectionSources[number];
export type CollectedJob=ReturnType<typeof input.parse>;
export type Candidate={externalId:string;job:CollectedJob;discoveryOnly:boolean};
export type Feed={items:Candidate[];activeIds:string[];complete:boolean;total:number};
export const indiaToday=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
export function canonicalJobUrl(value:string){
 const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443'))throw Error('Source returned an unsupported job URL');
 url.hash='';for(const key of [...url.searchParams.keys()])if(/^utm_|^(?:ref|source)$/i.test(key))url.searchParams.delete(key);
 return url.href.replace(/\/$/,'');
}
const clean=(v:unknown,max=10000)=>typeof v!=='string'?'':(/<\/?[a-z][^>]*>|&lt;/i.test(v)?plain(plain(v)):v.replace(/\r/g,'').replace(/[ \t]+/g,' ').trim()).slice(0,max);
export function makeCollectedJob(source:CollectionSource,raw:{title:string;url:string;description:string;company?:string;location?:string;remote?:boolean;salary?:string;deadline?:string;requirements?:string[];government?:boolean}):CollectedJob{
 const description=clean(raw.description),government=!!raw.government;
 const experience=description.match(/\b\d+(?:\s*[-–]\s*\d+|\+)?\s*(?:years?|months?)[^\n.!?]{0,100}\bexperience\b/i)?.[0]?.slice(0,100)||'Not specified';
 const education=description.split('\n').find(line=>/\b(?:bachelor|master|degree|diploma|B\.?Tech)\b/i.test(line)&&line.length<500)||'Not specified';
 const location=clean(raw.location||'Not specified',150);
 const region=government||/\b(?:India|Bengaluru|Bangalore|Hyderabad|Mumbai|Delhi|Pune|Chennai)\b/i.test(location)?'India':/\b(?:US|USA|United States|Canada|Americas|Brazil|Mexico)\b/i.test(location)?'Americas':/\b(?:Europe|UK|United Kingdom|Germany|France|London|Ireland|Netherlands)\b/i.test(location)?'Europe':/\b(?:Singapore|Australia|Japan|Asia|New Zealand)\b/i.test(location)?'Asia Pacific':/\b(?:worldwide|anywhere|global)\b/i.test(location)?'Worldwide':'Other';
 const requirements=(raw.requirements||[]).map(s=>clean(s,1000)).filter(Boolean).slice(0,30);
 if(!requirements.length)requirements.push(...[experience,education].filter(v=>v!=='Not specified'));
 if(!requirements.length)requirements.push('Confirm eligibility in the original recruitment notice before applying.');
 return input.parse({version:0,title:clean(raw.title,150),company:clean(raw.company||source.company,100),location,region,category:government?'Government':'Private',level:/\bintern(?:ship)?\b/i.test(raw.title)?'Internship':/\b(?:fresher|entry.level)\b/i.test(raw.title)?'Fresher':'Experienced',experience,education,batch:'Not specified',salary:raw.salary?.slice(0,150)||'Not disclosed',fees:'Not specified',deadline:raw.deadline||'Not specified',checked:indiaToday(),remote:!!raw.remote,url:canonicalJobUrl(raw.url),sourceType:government?'Government authority':'Employer',summary:description.slice(0,900),details:description,requirements,selection:'Not specified by the employer',howToApply:'Read the original recruitment notice, confirm eligibility and availability, and follow the employer’s application instructions.',note:'Collected automatically from '+source.label+'. Review the original source, eligibility, application link and deadline before publishing.',tags:[],status:'draft',reviewed:false});
}
export async function readSource(url:string,fetcher:typeof fetch=fetch):Promise<string>{
 const allowed=new Set(['api.ashbyhq.com','api.lever.co','boards-api.greenhouse.io','employmentnews.gov.in','upsc.gov.in']);
 if(!allowed.has(new URL(url).hostname)||new URL(url).protocol!=='https:')throw Error('Source is not on the approved collection allowlist');
 const response=await fetcher(url,{redirect:'manual',signal:AbortSignal.timeout(12000),headers:{'User-Agent':'JobVeylo/1.0 (public job feed monitor; https://jobveylo.jobveylo.workers.dev)',Accept:'application/json,text/html'}});
 if(response.status!==200){await response.body?.cancel();throw Error(response.status===403||response.status===429?'Source blocks or rate-limits collection (HTTP '+response.status+'). No bypass attempted.':'Source returned HTTP '+response.status)}
 const reader=response.body?.getReader();if(!reader)throw Error('Source returned no body');let size=0;const chunks:Uint8Array[]=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1800000){await reader.cancel();throw Error('Source exceeds the bounded collection size')}chunks.push(value)}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}return new TextDecoder().decode(bytes);
}
const list=(v:unknown):any[]=>{if(!Array.isArray(v))throw Error('Source response is not a supported job list');if(v.length>1500)throw Error('Source needs pagination before collection');return v};
export function sourceIndex(source:CollectionSource,text:string){
 if(source.kind==='employment')return employmentCandidates(source,text);
 if(source.kind==='upsc')return upscCandidates(source,text);
 const data=JSON.parse(text);const rows=list(source.kind==='lever'?data:data.jobs).filter(row=>source.kind!=='ashby'||row.isListed===true);
 if(rows.some(row=>!row||typeof row.id!=='string'&&typeof row.id!=='number'))throw Error('Source returned a job without a stable identifier');
 const sorted=rows.sort((a,b)=>String(b.publishedAt||b.first_published||b.createdAt||'').localeCompare(String(a.publishedAt||a.first_published||a.createdAt||'')));
 return {rows:sorted,activeIds:rows.map(row=>String(row.id)),complete:true};
}
export function candidateFromRow(source:CollectionSource,row:any):Candidate{
 if(source.kind==='employment'||source.kind==='upsc')return row;
 let description='',requirements:string[]=[],salary='',location='',title='',url='';
 if(source.kind==='ashby'){
  description=row.descriptionPlain||row.descriptionHtml||'';location=row.location||'';title=row.title;url=row.jobUrl;
  const comp=row.shouldDisplayCompensationOnJobPostings!==false?row.compensation?.summaryComponents?.find((c:any)=>c.compensationType==='Salary'):null;
  if(comp?.currencyCode&&comp.minValue!=null&&comp.maxValue!=null)salary=`${comp.currencyCode} ${comp.minValue}–${comp.maxValue}${comp.interval?' / '+comp.interval:''}`;
 }else if(source.kind==='lever'){
  title=row.text;url=row.hostedUrl;location=row.categories?.location||'';
  const lists=(row.lists||[]).map((entry:any)=>({title:clean(entry.text),content:clean(entry.content)}));
  description=[row.descriptionPlain||row.description,...lists.flatMap((entry:any)=>[entry.title,entry.content]),row.additionalPlain||row.additional].filter(Boolean).join('\n\n');
  requirements=lists.filter((entry:any)=>/qualif|require|essential|must.have/i.test(entry.title)).flatMap((entry:any)=>entry.content.split('\n'));
 }else{title=row.title;url=row.absolute_url;location=row.location?.name||'';description=row.content||''}
 return {externalId:String(row.id),discoveryOnly:false,job:makeCollectedJob(source,{title,url,location,description,requirements,salary,remote:row.isRemote===true||row.workplaceType==='remote'||/^remote\b/i.test(location)})};
}
export function employmentCandidates(source:CollectionSource,text:string){
 const $=load(text),rows:Candidate[]=[];
 $('tr').each((_,tr)=>{
  const cells=$(tr).children('td').toArray().map(td=>$(td).text().replace(/\s+/g,' ').trim());
  if(cells.length!==5||cells[3]!=='Recruitment')return;
  const match=cells[4].match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(!match)return;
  const deadline=`${match[3]}-${match[2]}-${match[1]}`;if(deadline<indiaToday())return;
  const externalId=[cells[1],cells[2],deadline].join('|');
  rows.push({externalId,discoveryOnly:true,job:makeCollectedJob(source,{company:cells[1],title:cells[2],url:source.url,location:'India — see official notice',government:true,deadline,description:`Employment News lists ${cells[2]} at ${cells[1]} with a closing date of ${deadline}. This is a discovery record, not a complete employer notice. Find the original recruitment/application URL and confirm all eligibility requirements, fees, vacancies and selection stages before publishing.`})});
 });
 if(!rows.length&&!/RepDetails|Recruitment/.test(text))throw Error('Government notice table format changed; manual source review required');
 return {rows,activeIds:rows.map(row=>row.externalId),complete:true};
}
export function upscCandidates(source:CollectionSource,text:string){
 const $=load(text),rows:Candidate[]=[];
 $('main a[href],#content a[href],.view-content a[href]').each((_,a)=>{
  const title=$(a).text().replace(/\s+/g,' ').trim();if(!/advertisement\s+(?:no|number)/i.test(title))return;
  const url=new URL($(a).attr('href')||'',source.url);if(url.protocol!=='https:'||!/^(?:www\.)?upsc\.gov\.in$/.test(url.hostname)||!/\.pdf$/i.test(url.pathname))return;
  rows.push({externalId:url.pathname,discoveryOnly:true,job:makeCollectedJob(source,{title,url:url.href,government:true,location:'India — see official notice',description:`UPSC published ${title}. This advertisement may contain multiple vacancies. Review the official PDF and create one opening per post with its exact eligibility and application link. The collector has not extracted or verified the PDF contents.`})});
 });
 if(!rows.length)throw Error('No supported recruitment-notice links found; manual source review required');
 return {rows,activeIds:rows.map(row=>row.externalId),complete:false};
}
