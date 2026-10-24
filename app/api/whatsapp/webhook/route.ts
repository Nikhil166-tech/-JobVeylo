import {bindings} from '../../../../lib/platform';
import {verifyWhatsAppSignature,processWhatsAppOptIns} from '../../../../lib/whatsapp-optin';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
export async function GET(request:Request){
 const env=bindings(),query=new URL(request.url).searchParams;
 if(!env.WHATSAPP_VERIFY_TOKEN)return new Response('WhatsApp setup is not configured',{status:503,headers});
 if(query.get('hub.mode')==='subscribe'&&query.get('hub.verify_token')===env.WHATSAPP_VERIFY_TOKEN&&/^\d{1,100}$/.test(query.get('hub.challenge')||''))return new Response(query.get('hub.challenge'),{headers});
 return new Response('Verification failed',{status:403,headers});
}
export async function POST(request:Request){
 const env=bindings();if(!env.WHATSAPP_APP_SECRET||!env.WHATSAPP_PHONE_NUMBER_ID)return new Response('WhatsApp setup is not configured',{status:503,headers});
 const reader=request.body?.getReader();if(!reader)return new Response('Empty request',{status:400,headers});
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>100000){await reader.cancel();return new Response('Payload too large',{status:413,headers})}chunks.push(value)}
 const body=new Uint8Array(size);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length}
 if(!await verifyWhatsAppSignature(body,request.headers.get('x-hub-signature-256'),env.WHATSAPP_APP_SECRET))return new Response('Invalid signature',{status:401,headers});
 try{await processWhatsAppOptIns(env.DB,JSON.parse(new TextDecoder().decode(body)),env.WHATSAPP_PHONE_NUMBER_ID);return new Response('EVENT_RECEIVED',{headers})}
 catch{return new Response('Webhook could not be processed',{status:503,headers})}
}
