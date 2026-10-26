export const metricEvents=['page_view','apply_click','resume_tool_click'] as const;
export const metricSources=['direct','instagram','whatsapp','google','bing','linkedin','facebook','share','referral','internal','other'] as const;
export const metricCampaigns=['none','bio','channel','job_reel','job_post','job_share','setup_test'] as const;
const pages=new Set(['/','/resume','/about','/contact','/privacy','/editorial','/disclaimer','/alerts']);
export function publicAnalyticsPath(path:string){return pages.has(path)||/^\/jobs\/[a-zA-Z0-9_-]{1,180}$/.test(path)||/^\/guides\/[a-zA-Z0-9_-]{1,100}$/.test(path)}
export function trafficSource(tag:string|null,referrer:string,origin:string){
 if(tag?.toLowerCase()==='ig')return 'instagram';
 if(tag&&metricSources.includes(tag.toLowerCase() as typeof metricSources[number]))return tag.toLowerCase();
 if(!referrer)return 'direct';
 try{const url=new URL(referrer);if(url.origin===origin)return 'internal';const host=url.hostname.toLowerCase();
  for(const [source,domain] of [['instagram','instagram.com'],['whatsapp','whatsapp.com'],['google','google.com'],['bing','bing.com'],['linkedin','linkedin.com'],['facebook','facebook.com']])if(host===domain||host.endsWith('.'+domain))return source;
 }catch{return 'direct'}return 'referral';
}
export function validMetric(value:unknown):value is {path:string;event:typeof metricEvents[number];source:typeof metricSources[number];campaign:typeof metricCampaigns[number]}{
 if(!value||typeof value!=='object')return false;const v=value as Record<string,unknown>;
 return Object.keys(v).every(key=>['path','event','source','campaign'].includes(key))&&typeof v.path==='string'&&publicAnalyticsPath(v.path)&&metricEvents.includes(v.event as typeof metricEvents[number])&&metricSources.includes(v.source as typeof metricSources[number])&&metricCampaigns.includes(v.campaign as typeof metricCampaigns[number]);
}
