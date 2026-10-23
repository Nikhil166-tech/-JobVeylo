import {bindings,requestOrigin} from '../../../../lib/platform';
import {cookieValue,oauthCookie,sessionCookie,secureCookie,randomToken,tokenHash} from '../../../../lib/auth-crypto';
export const dynamic='force-dynamic';
const clearOAuth=()=>secureCookie(oauthCookie,'',0);
export async function GET(request:Request){
  const env=bindings(),origin=requestOrigin();
  const fail=()=>new Response(null,{status:302,headers:{Location:origin+'/admin/login?error=signin_failed','Cache-Control':'no-store','Set-Cookie':clearOAuth()}});
  try{
    const url=new URL(request.url),code=url.searchParams.get('code'),state=url.searchParams.get('state');
    const stored=JSON.parse(cookieValue(request,oauthCookie)||'{}');
    if(!env.GITHUB_CLIENT_ID||!env.GITHUB_CLIENT_SECRET||!code||code.length>2000||!state||state!==stored.state||!stored.verifier||!Number.isFinite(stored.created)||Date.now()-stored.created>600000||stored.created>Date.now())return fail();
    const exchange=await fetch('https://github.com/login/oauth/access_token',{
      method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},signal:AbortSignal.timeout(12000),
      body:JSON.stringify({client_id:env.GITHUB_CLIENT_ID,client_secret:env.GITHUB_CLIENT_SECRET,code,redirect_uri:origin+'/api/auth/callback',code_verifier:stored.verifier}),
    });
    if(!exchange.ok)return fail();
    const token=await exchange.json() as {access_token?:string;scope?:string};
    if(!token.access_token||token.scope?.trim())return fail();
    // Only a verified, immutable GitHub user ID can obtain an owner session.
    const profile=await fetch('https://api.github.com/user',{headers:{Authorization:'Bearer '+token.access_token,Accept:'application/vnd.github+json','User-Agent':'JobVeylo'},signal:AbortSignal.timeout(10000)});
    if(!profile.ok)return fail();
    const user=await profile.json() as {id?:number};
    if(String(user.id)!==env.OWNER_GITHUB_ID)return fail();
    const session=randomToken();
    await env.DB.batch([
      env.DB.prepare('DELETE FROM owner_sessions WHERE expires_at<=?').bind(Date.now()),
      env.DB.prepare('INSERT INTO owner_sessions(token_hash,owner_id,expires_at) VALUES(?,?,?)').bind(await tokenHash(session),env.OWNER_GITHUB_ID,Date.now()+8*60*60*1000),
    ]);
    const headers=new Headers({Location:origin+'/admin','Cache-Control':'no-store'});
    headers.append('Set-Cookie',clearOAuth());headers.append('Set-Cookie',secureCookie(sessionCookie,session,28800));
    return new Response(null,{status:302,headers});
  }catch{return fail();}
}
