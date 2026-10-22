'use client';
import {logout} from '@netlify/identity';
export default function SignOut(){return <button className="secondary" onClick={async()=>{await logout();location.href='/admin/login'}}>Sign out</button>}
