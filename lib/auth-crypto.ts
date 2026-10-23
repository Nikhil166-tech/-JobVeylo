export const sessionCookie='__Host-jv_session';
export const oauthCookie='__Host-jv_oauth';
export function randomToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,'0')).join('');}
export async function tokenHash(token:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),byte=>byte.toString(16).padStart(2,'0')).join('');}
export function cookieValue(request:Request,name:string){
  const raw=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1);
  if(!raw||raw.length>4000)return '';
  try{return decodeURIComponent(raw)}catch{return ''}
}
export const secureCookie=(name:string,value:string,seconds:number)=>`${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${seconds}`;
export const validSessionToken=(token:string)=>/^[a-f0-9]{64}$/.test(token);
