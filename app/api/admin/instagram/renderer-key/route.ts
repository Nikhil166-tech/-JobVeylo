import {authorizeWrite} from '../../../../../lib/editor-auth';
import {bindings} from '../../../../../lib/platform';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const headers={'Cache-Control':'no-store'};
 if(!await authorizeWrite(request))return Response.json({error:'Owner access required'},{status:403,headers});
 const env=bindings();if(!env.REEL_MEDIA)return Response.json({error:'Media storage is not connected'},{status:503,headers});
 const bytes=crypto.getRandomValues(new Uint8Array(32)),key=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('Bearer '+key))),b=>b.toString(16).padStart(2,'0')).join('');
 await env.REEL_MEDIA.put('automation/renderer-key-hash',hash);
 return Response.json({key},{headers});
}
