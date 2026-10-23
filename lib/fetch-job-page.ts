import {resolve4,resolve6} from 'node:dns/promises';
import ipaddr from 'ipaddr.js';

export function publicAddress(address:string){try{return ipaddr.process(address).range()==='unicast'}catch{return false}}
export function sourceUrl(value:string){
 let url:URL;try{url=new URL(value)}catch{throw Error('Paste a complete HTTPS job link.')}
 if(url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443'))throw Error('Use a public HTTPS job link without login information or a custom port.');
 const host=url.hostname.replace(/^\[|\]$/g,'');
 if(host==='localhost'||/\.(localhost|local|internal|test|invalid|home\.arpa)$/i.test(host)||(ipaddr.isValid(host)&&!publicAddress(host)))throw Error('Use a publicly accessible job website.');
 url.hash='';return url;
}
async function resolvePublic(host:string,remaining:number){
 if(ipaddr.isValid(host)){if(!publicAddress(host))throw Error('Use a publicly accessible job website.');return;}
 let timer:ReturnType<typeof setTimeout>|undefined;
 const records=await Promise.race([
  Promise.allSettled([resolve4(host),resolve6(host)]).then(results=>results.flatMap(r=>r.status==='fulfilled'?r.value:[])),
  new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('The website address could not be resolved in time.')),Math.min(remaining,5000))}),
 ]).finally(()=>clearTimeout(timer));
 if(!records.length||records.some(address=>!publicAddress(address)))throw Error('Use a publicly accessible job website.');
}
export async function fetchJobPage(value:string){
 let url=sourceUrl(value);const end=Date.now()+18000;
 for(let redirect=0;redirect<=4;redirect++){
  const remaining=end-Date.now();if(remaining<=0)throw Error('The job website took too long. Try again or paste the description.');
  await resolvePublic(url.hostname.replace(/^\[|\]$/g,''),remaining);
  // Workers fetch uses Cloudflare's public egress; no private-network/VPC bindings
  // are granted to this Worker. Every redirect is separately URL/DNS checked.
  const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(Math.max(1,end-Date.now())),headers:{'User-Agent':'JobVeylo/1.0 (job-details importer)',Accept:'text/html,application/xhtml+xml'}});
  if(response.status>=300&&response.status<400&&response.headers.get('location')){await response.body?.cancel();url=sourceUrl(new URL(response.headers.get('location')!,url).href);continue;}
  const type=response.headers.get('content-type')||'';
  if(response.status!==200||!/text\/html|application\/xhtml\+xml/i.test(type)){
   await response.body?.cancel();
   throw Error(response.status===403||response.status===429?'This website blocks automatic reading. Paste the job description below.':response.status===200&&!/html/i.test(type)?'This link is not a readable web page. For a PDF notice, paste its job text below.':`The job website returned an error (${response.status}). Check the link or paste the job text.`);
  }
  const reader=response.body?.getReader();if(!reader)throw Error('The job page was empty. Paste the description instead.');
  const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2_000_000)throw Error('The page is too large. Paste the job description instead.');chunks.push(value)}}catch(error){await reader.cancel();throw error;}
  const buffer=new Uint8Array(size);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.length;}
  return {html:new TextDecoder().decode(buffer),url:url.href};
 }
 throw Error('The link redirects too many times. Paste the final job page link.');
}
