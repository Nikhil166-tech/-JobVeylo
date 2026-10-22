'use client';
import {useEffect, useState} from 'react';
import {login, handleAuthCallback, acceptInvite, logout, recoverPassword, requestPasswordRecovery} from '@netlify/identity';
import {Header, Footer} from '../../../components/site-shell';
export default function Login() {
  const [email,setEmail]=useState('itharajunikhil61@gmail.com');
  const [password,setPassword]=useState('');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [invite,setInvite]=useState('');
  const [recovery,setRecovery]=useState('');
  useEffect(()=>{
    const hash = new URLSearchParams(location.hash.slice(1));
    const token = hash.get('invite_token');
    if (token) { setInvite(token); history.replaceState(null,'','/admin/login'); }
    else if(hash.get('recovery_token')) {setRecovery(hash.get('recovery_token')!);history.replaceState(null,'','/admin/login');}
    else handleAuthCallback().then(result=>{if(result?.user) location.href='/admin'}).catch(()=>setMessage('This sign-in link could not be verified. Please sign in again.'));
  },[]);
  return <><Header/><main className="wrap section" style={{maxWidth:520}}>
    <h1>{invite?'Activate owner account':recovery?'Reset password':'Owner sign in'}</h1>
    <p>Sign in to manage JobVeylo openings. Job seekers do not need an account.</p>
    <form className="editor-form" onSubmit={async e=>{
      e.preventDefault();setBusy(true);setMessage('');
      try {
        const user=invite?await acceptInvite(invite,password):recovery?await recoverPassword(recovery,password):await login(email,password);
        if(user.email?.toLowerCase()!=='itharajunikhil61@gmail.com'){
          await logout();throw Error('This account is not a JobVeylo editor.');
        }
        location.href='/admin';
      } catch {setMessage('Sign-in failed. Check your credentials or request a fresh owner invitation.');}
      finally{setBusy(false);setPassword('');}
    }}>
      <label className="field">Email<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required readOnly={!!invite}/></label>
      <label className="field">{invite||recovery?'Choose a password':'Password'}<input type="password" autoComplete={invite||recovery?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} minLength={invite||recovery?12:1} required/></label>
      <button className="primary" disabled={busy}>{busy?'Signing in…':invite?'Activate account':'Sign in'}</button>
      <p role="status">{message}</p>
      {!invite&&!recovery&&<button type="button" className="reset" disabled={busy} onClick={async()=>{
        setBusy(true);
        try{await requestPasswordRecovery(email);setMessage('If the account exists, a recovery email has been sent.');}
        catch{setMessage('Could not request recovery. Please try again later.');}
        finally{setBusy(false);}
      }}>Forgot password?</button>}
    </form></main><Footer/></>;
}
