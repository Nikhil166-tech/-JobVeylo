import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {bindings} from './platform';
import {sessionCookie,tokenHash,validSessionToken} from './auth-crypto';
import {sameOrigin} from './platform';
export async function editorIdentity(){
  const token=(await cookies()).get(sessionCookie)?.value||'';
  if(!validSessionToken(token))return null;
  const env=bindings();
  const session=await env.DB.prepare('SELECT owner_id FROM owner_sessions WHERE token_hash=? AND expires_at>?').bind(await tokenHash(token),Date.now()).first<{owner_id:string}>();
  return session&&session.owner_id===env.OWNER_GITHUB_ID?{id:session.owner_id,email:'itharajunikhil61@gmail.com'}:null;
}
export async function requireEditor(){const user=await editorIdentity();if(!user)redirect('/admin/login');return user;}
export async function authorizeWrite(request:Request){return sameOrigin(request)&&!!(await editorIdentity());}
