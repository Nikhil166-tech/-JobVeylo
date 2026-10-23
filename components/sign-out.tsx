'use client';
import {useState} from 'react';
export default function SignOut(){const [busy,setBusy]=useState(false),[error,setError]=useState('');return <><button className="secondary" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const result=await fetch('/api/auth/logout',{method:'POST'});if(!result.ok)throw Error();location.href='/admin/login'}catch{setError('Sign-out failed. Please try again.');setBusy(false)}}}>{busy?'Signing out…':'Sign out'}</button>{error&&<span role="alert">{error}</span>}</>}
