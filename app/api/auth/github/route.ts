import {bindings,requestOrigin} from '../../../../lib/platform';
import {oauthCookie,randomToken,secureCookie} from '../../../../lib/auth-crypto';
export const dynamic='force-dynamic';
export async function GET(){
  const env=bindings(),origin=requestOrigin();
  if(!env.GITHUB_CLIENT_ID||!env.GITHUB_CLIENT_SECRET)return Response.json({error:'Owner sign-in has not been configured yet.'},{status:503,headers:{'Cache-Control':'no-store'}});
  const state=randomToken(),verifier=randomToken();
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
  const challenge=btoa(String.fromCharCode(...digest)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const url=new URL('https://github.com/login/oauth/authorize');
  url.search=new URLSearchParams({client_id:env.GITHUB_CLIENT_ID,redirect_uri:origin+'/api/auth/callback',scope:'',state,code_challenge:challenge,code_challenge_method:'S256',allow_signup:'false'}).toString();
  // No repository or private-email scopes are requested.
  return new Response(null,{status:302,headers:{Location:url.href,'Cache-Control':'no-store','Set-Cookie':secureCookie(oauthCookie,JSON.stringify({state,verifier,created:Date.now()}),600)}});
}
