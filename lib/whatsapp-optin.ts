export const whatsappConsentVersion='jobveylo-daily-v1';
export type WhatsAppCategory='ALL'|'GOVERNMENT'|'PRIVATE';
export function whatsappConsentMessage(category:WhatsAppCategory){return `START JOBVEYLO DAILY ${category}\nI agree to receive up to one JobVeylo job alert per day on WhatsApp. I can reply STOP at any time to unsubscribe.`}
export function parseWhatsAppChoice(text:string){
 const value=text.trim();if(/^(?:STOP|STOP ALL|UNSUBSCRIBE)$/i.test(value))return {action:'stop'} as const;
 const category=value.match(/^START JOBVEYLO DAILY (ALL|GOVERNMENT|PRIVATE)\s*\nI agree to receive up to one JobVeylo job alert per day on WhatsApp\. I can reply STOP at any time to unsubscribe\.$/i)?.[1]?.toUpperCase() as WhatsAppCategory|undefined;
 return category?{action:'start',category} as const:null;
}
export async function verifyWhatsAppSignature(body:Uint8Array,signature:string|null,secret:string){
 if(!/^sha256=[a-f\d]{64}$/i.test(signature||'')||!secret)return false;
 const bytes=Uint8Array.from((signature!.slice(7).match(/../g)||[]),pair=>parseInt(pair,16));
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 return crypto.subtle.verify('HMAC',key,bytes,Uint8Array.from(body));
}
export async function processWhatsAppOptIns(db:D1Database,payload:any,phoneNumberId:string){
 if(payload?.object!=='whatsapp_business_account')return 0;let processed=0;
 const now=Date.now();
 for(const entry of (Array.isArray(payload.entry)?payload.entry:[]).slice(0,10))for(const change of (Array.isArray(entry.changes)?entry.changes:[]).slice(0,10)){
  const value=change?.value;if(value?.metadata?.phone_number_id!==phoneNumberId)continue;
  for(const message of (Array.isArray(value.messages)?value.messages:[]).slice(0,10)){
   const phone=message?.from,time=Number(message?.timestamp)*1000,id=message?.id;
   if(!/^\d{9,15}$/.test(phone||'')||typeof id!=='string'||id.length>300||!Number.isFinite(time)||time<now-7*86400000||time>now+300000||message.type!=='text')continue;
   const choice=parseWhatsAppChoice(typeof message.text?.body==='string'?message.text.body:'');if(!choice)continue;
   if(await db.prepare('SELECT message_id FROM whatsapp_inbound WHERE message_id=?').bind(id).first())continue;
   // Event time prevents a delayed START replay from undoing a newer STOP.
   if(choice.action==='start')await db.batch([
    db.prepare('INSERT OR IGNORE INTO whatsapp_inbound(message_id,received_at) VALUES(?,?)').bind(id,now),
    db.prepare("INSERT INTO whatsapp_subscribers(phone,category,status,consent_version,opted_in_at,last_event_time) VALUES(?,?,'active',?,?,?) ON CONFLICT(phone) DO UPDATE SET category=excluded.category,status='active',consent_version=excluded.consent_version,opted_in_at=excluded.opted_in_at,stopped_at=NULL,last_event_time=excluded.last_event_time WHERE excluded.last_event_time>whatsapp_subscribers.last_event_time").bind(phone,choice.category,whatsappConsentVersion,new Date(time).toISOString(),time),
   ]);
   else await db.batch([
    db.prepare('INSERT OR IGNORE INTO whatsapp_inbound(message_id,received_at) VALUES(?,?)').bind(id,now),
    db.prepare("INSERT INTO whatsapp_subscribers(phone,category,status,consent_version,opted_in_at,stopped_at,last_event_time) VALUES(?,'ALL','stopped',?,?,?,?) ON CONFLICT(phone) DO UPDATE SET status='stopped',stopped_at=excluded.stopped_at,last_event_time=excluded.last_event_time WHERE excluded.last_event_time>=whatsapp_subscribers.last_event_time").bind(phone,whatsappConsentVersion,new Date(time).toISOString(),new Date(time).toISOString(),time),
   ]);
   processed++;
  }
 }
 await db.prepare('DELETE FROM whatsapp_inbound WHERE received_at<?').bind(now-30*86400000).run();
 return processed;
}
