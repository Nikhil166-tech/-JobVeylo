'use client';
import {useState} from 'react';
export default function LinkedInControls(){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function run(action:string){setBusy(true);try{const response=await fetch('/api/admin/linkedin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});const data:any=await response.json();setMessage(data.message||data.error||'Outcome: '+data.state+(data.dueAt?' · '+new Date(data.dueAt).toLocaleString():''))}catch{setMessage('Request did not complete. Refresh the page to inspect the latest outcome before retrying.')}finally{setBusy(false)}}
 return <><div className="actions"><button className="secondary" disabled={busy} onClick={()=>run('check')}>Check connection</button><button className="primary" disabled={busy} onClick={()=>run('enable')}>Enable automatic posts</button><button className="secondary" disabled={busy} onClick={()=>run('run')}>Process current slot</button><button className="secondary" disabled={busy} onClick={()=>run('pause')}>Pause LinkedIn</button></div><p role="status">{busy?'Working…':message}</p></>;
}
