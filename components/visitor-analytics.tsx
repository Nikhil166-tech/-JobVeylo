'use client';
import {useEffect,useRef} from 'react';
import {usePathname} from 'next/navigation';
import {publicAnalyticsPath,trafficSource} from '../lib/visitor-metrics';
export default function VisitorAnalytics(){
 const path=usePathname()||'/';
 const attribution=useRef<{source:string;campaign:string}|null>(null),lastPage=useRef('');
 useEffect(()=>{
  if(!publicAnalyticsPath(path))return;
  if(!attribution.current){const q=new URLSearchParams(location.search);attribution.current={source:trafficSource(q.get('utm_source'),document.referrer,location.origin),campaign:['bio','channel','job_reel','job_share','setup_test'].includes(q.get('utm_campaign')||'')?q.get('utm_campaign')!:'none'}}
  function record(event:string){void fetch('/api/visitor-metrics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path,event,...attribution.current}),credentials:'omit',keepalive:true}).catch(()=>{})}
  if(lastPage.current!==path){lastPage.current=path;record('page_view')}
  let lastClick=0;
  function click(e:MouseEvent){const target=e.target instanceof Element?e.target.closest<HTMLElement>('[data-analytics-event]'):null;const name=target?.dataset.analyticsEvent;if(!name||!['apply_click','resume_tool_click'].includes(name)||Date.now()-lastClick<800)return;lastClick=Date.now();record(name)}
  document.addEventListener('click',click);return()=>document.removeEventListener('click',click);
 },[path]);
 return null;
}
