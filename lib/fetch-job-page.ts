import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import ipaddr from 'ipaddr.js';

export function publicAddress(address: string) {
  try { return ipaddr.process(address).range() === 'unicast'; } catch { return false; }
}
export function sourceUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Paste a complete HTTPS job link.'); }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) throw new Error('Use a public HTTPS job link without login information or a custom port.');
  const host = url.hostname.replace(/^\[|\]$/g,'');
  if (host === 'localhost' || /\.(localhost|local|internal|test|invalid)$/i.test(host) || (ipaddr.isValid(host) && !publicAddress(host))) throw new Error('Use a publicly accessible job website.');
  url.hash = '';
  return url;
}
export async function fetchJobPage(value: string) {
  let url = sourceUrl(value);
  const end = Date.now() + 18000;
  for (let redirect = 0; redirect <= 4; redirect++) {
    const remaining = end - Date.now();
    if (remaining <= 0) throw new Error('The job website took too long. Try again or paste the description.');
    let dnsTimer: ReturnType<typeof setTimeout> | undefined;
    const records = await Promise.race([
      lookup(url.hostname.replace(/^\[|\]$/g,''), {all:true}),
      new Promise<never>((_,reject) => {dnsTimer=setTimeout(()=>reject(new Error('The website address could not be resolved in time.')),Math.min(remaining,5000));}),
    ]).finally(()=>clearTimeout(dnsTimer));
    if (!records.length || records.some(r => !publicAddress(r.address))) throw new Error('Use a publicly accessible job website.');
    const selected = records[0];
    const response = await new Promise<{status:number;location?:string;type:string;html:string}>((resolve,reject) => {
      const req = request(url, {
        method:'GET', headers:{'User-Agent':'JobVeylo/1.0 (job-details importer)','Accept':'text/html,application/xhtml+xml','Accept-Encoding':'identity'},
        // Pin the validated address so a DNS change cannot redirect a request into a private network.
        lookup:((_host:any,_options:any,callback:any) => _options?.all ? callback(null,[selected]) : callback(null,selected.address,selected.family)) as any,
      }, res => {
        const status = res.statusCode || 0;
        const type = String(res.headers['content-type'] || '');
        if (status >= 300 && status < 400 && res.headers.location) {res.destroy();resolve({status,location:res.headers.location,type,html:''});return;}
        if (status !== 200 || !/text\/html|application\/xhtml\+xml/i.test(type)) {res.destroy();reject(new Error(status===403 || status===429 ? 'This website blocks automatic reading. Paste the job description below.' : !/html/i.test(type) && status===200 ? 'This link is not a readable web page. For a PDF notice, paste its job text below.' : `The job website returned an error (${status}). Check the link or paste the job text.`));return;}
        const chunks: Buffer[] = []; let size=0;
        res.on('data', chunk => {size += chunk.length;if(size>2_000_000){req.destroy(new Error('The page is too large. Paste the job description instead.'));return;}chunks.push(Buffer.from(chunk));});
        res.on('end',()=>resolve({status,type,html:Buffer.concat(chunks).toString('utf8')}));
        res.on('error',reject);
      });
      const timer=setTimeout(()=>req.destroy(new Error('The job website took too long. Paste the description instead.')),Math.max(1,end-Date.now()));
      req.on('close',()=>clearTimeout(timer));req.on('error',reject);req.end();
    });
    if (response.location) {url=sourceUrl(new URL(response.location,url).href);continue;}
    return {html:response.html,url:url.href};
  }
  throw new Error('The link redirects too many times. Paste the final job page link.');
}
