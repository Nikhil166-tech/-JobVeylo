export function campaignLink(origin:string,path:string,source:'instagram'|'whatsapp'|'linkedin'|'share',campaign:string,content?:string){
 const url=new URL(path,origin);
 url.searchParams.set('utm_source',source);url.searchParams.set('utm_medium',source==='share'?'referral':'social');
 url.searchParams.set('utm_campaign',campaign);if(content)url.searchParams.set('utm_content',content);
 return url.toString();
}
