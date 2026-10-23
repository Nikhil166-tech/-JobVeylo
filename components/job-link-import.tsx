'use client';
import {useState} from 'react';

export default function JobLinkImport({onImport,onExisting,canReplace}:{onImport:(job:any)=>void;onExisting:(id:string)=>void;canReplace:()=>boolean}) {
  const [url,setUrl]=useState('');
  const [text,setText]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [warnings,setWarnings]=useState<string[]>([]);
  const [method,setMethod]=useState('');
  const [existing,setExisting]=useState('');
  const [fallback,setFallback]=useState(false);
  async function importOpening(e:React.FormEvent) {
    e.preventDefault();
    if(!canReplace())return;
    setBusy(true);setError('');setWarnings([]);setMethod('');setExisting('');
    try {
      const res=await fetch('/api/admin/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url,text:fallback?text:''})});
      const data=await res.json() as {existingId?:string;error?:string;job?:Record<string,unknown>;warnings?:string[];method?:string};
      if(!res.ok){setExisting(data.existingId || '');if(!data.existingId)setFallback(true);throw Error(data.error || 'Could not import this link.');}
      if(!data.job)throw Error('The source did not return a readable opening. Paste the job text instead.');
      onImport(data.job);setWarnings(data.warnings||[]);setMethod(data.method||'source text');
    }catch(err){setError(err instanceof Error?err.message:'Could not import this opening.');}
    finally{setBusy(false);}
  }
  return <section className="job-import" aria-labelledby="import-title">
    <div className="eyebrow">1. PASTE LINK · 2. REVIEW · 3. PUBLISH</div>
    <h2 id="import-title">Add a job from its link</h2>
    <p>Paste the link to one opening. We’ll fill the form below with the details we can read. You choose when to publish.</p>
    <form onSubmit={importOpening}>
      <label className="field">Job opening link<input type="url" required maxLength={2000} placeholder="https://careers.company.com/jobs/…" value={url} onChange={e=>setUrl(e.target.value)} disabled={busy}/></label>
      <details open={fallback} onToggle={e=>setFallback(e.currentTarget.open)}>
        <summary>Link blocked, or using a PDF? Paste the job text</summary>
        <label className="field">Job description<textarea maxLength={30000} rows={7} value={text} onChange={e=>setText(e.target.value)} disabled={busy} placeholder={'Paste the complete opening, including job title, employer, location, eligibility and deadline. For best results use labels such as Company: and Job title:.'}/></label>
        <p className="sub">The link stays attached as the source. Text you paste will be used instead of fetching the page.</p>
      </details>
      <button className="primary" disabled={busy} style={{marginTop:16}}>{busy?'Reading opening…':fallback&&text.trim()?'Fill from pasted text':'Read link & fill details'}</button>
    </form>
    <div aria-live="polite" aria-busy={busy}>
      {busy&&<p>Reading the source. This can take up to 20 seconds.</p>}
      {error&&<p role="alert" className="notice">{error}</p>}
      {existing&&<button className="secondary" onClick={()=>onExisting(existing)}>Open existing listing</button>}
      {method&&<div className="import-review"><strong>Details filled from {method.toLowerCase()}. Review the form below.</strong><ul>{warnings.map((w,i)=><li key={i}>{w}</li>)}</ul><a href="#listing-form" className="secondary">Review details ↓</a></div>}
    </div>
  </section>;
}
