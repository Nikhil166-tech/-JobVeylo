import {bindings,sameOrigin} from '../../../../lib/platform';
import {cookieValue,sessionCookie,secureCookie,tokenHash,validSessionToken} from '../../../../lib/auth-crypto';
export async function POST(request:Request){
  if(!sameOrigin(request))return Response.json({error:'Same-origin request required'},{status:403});
  const token=cookieValue(request,sessionCookie);
  if(validSessionToken(token))await bindings().DB.prepare('DELETE FROM owner_sessions WHERE token_hash=?').bind(await tokenHash(token)).run();
  return Response.json({ok:true},{headers:{'Cache-Control':'no-store','Set-Cookie':secureCookie(sessionCookie,'',0)}});
}
