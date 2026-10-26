'use client';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';

const measurementId='G-8Z90LMT22T';
const preferenceKey='jobveylo-analytics-choice';
type AnalyticsWindow=Window&{dataLayer?:unknown[];gtag?:(...args:any[])=>void};
function publicPage(path:string){return !/^\/(admin|api|auth)(\/|$)/.test(path)}
function pageLocation(){
 const url=new URL(location.origin+location.pathname),query=new URLSearchParams(location.search);
 for(const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','job']){
  const value=query.get(key);if(value&&/^[a-zA-Z0-9_. -]{1,160}$/.test(value))url.searchParams.set(key,value);
 }
 return url.toString();
}
export default function VisitorAnalytics(){
 const path=usePathname()||'/';const[choice,setChoice]=useState<string|null>(null),[loaded,setLoaded]=useState(false),[settings,setSettings]=useState(false);
 useEffect(()=>{try{setChoice(localStorage.getItem(preferenceKey))}catch{}},[]);
 useEffect(()=>{(window as unknown as Record<string,unknown>)['ga-disable-'+measurementId]=choice!=='accepted'||!publicPage(path)},[choice,path]);
 useEffect(()=>{
  if(choice!=='accepted'||!publicPage(path)||loaded||!/^G-[A-Z0-9]+$/.test(measurementId))return;
  const w=window as AnalyticsWindow;w.dataLayer=w.dataLayer||[];w.gtag=function(){w.dataLayer!.push(arguments)};
  w.gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
  w.gtag('js',new Date());w.gtag('config',measurementId,{send_page_view:false,page_location:pageLocation(),page_referrer:'',allow_google_signals:false,allow_ad_personalization_signals:false,cookie_domain:'none'});
  const script=document.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+measurementId;document.head.appendChild(script);setLoaded(true);
 },[choice,path,loaded]);
 useEffect(()=>{
  if(choice!=='accepted'||!loaded||!publicPage(path))return;
  const w=window as AnalyticsWindow;let referrer='';try{referrer=new URL(document.referrer).origin}catch{}
  w.gtag?.('set',{page_location:pageLocation(),page_referrer:referrer});
  w.gtag?.('event','page_view',{page_location:pageLocation(),page_referrer:referrer,page_title:path==='/'?'JobVeylo':path.startsWith('/jobs/')?'Job opening':path.startsWith('/resume')?'Resume tailor':path});
  function click(event:MouseEvent){
   const target=event.target instanceof Element?event.target.closest<HTMLElement>('[data-analytics-event]'):null;
   const name=target?.dataset.analyticsEvent;if(!name||!['apply_click','resume_tool_click'].includes(name))return;
   w.gtag?.('event',name,{job_id:target?.dataset.jobId||'',page_location:pageLocation()});
  }
  document.addEventListener('click',click);return()=>document.removeEventListener('click',click);
 },[choice,loaded,path]);
 function choose(value:string){
  try{localStorage.setItem(preferenceKey,value)}catch{}setChoice(value);setSettings(false);
  if(value==='accepted'&&loaded)(window as AnalyticsWindow).gtag?.('consent','update',{analytics_storage:'granted'});
  if(value==='declined'){
   (window as AnalyticsWindow).gtag?.('consent','update',{analytics_storage:'denied'});
   for(const cookie of document.cookie.split(';')){const name=cookie.split('=')[0].trim();if(/^_ga(?:_|$)/.test(name))document.cookie=name+'=; Max-Age=0; path=/';}
  }
 }
 if(!publicPage(path))return null;
 return <><button type="button" className="analytics-settings" onClick={()=>setSettings(!settings)}>Privacy choices</button>{(choice===null||settings)&&<section className="analytics-choice" aria-label="Optional visitor analytics"><strong>Help us improve JobVeylo</strong><p>Allow Google Analytics to measure visits, traffic sources and job-link clicks? Resume content and contact details are not sent. You can change your choice anytime. <a href="/privacy">Privacy details</a></p><div><button type="button" onClick={()=>choose('declined')}>Decline</button><button type="button" onClick={()=>choose('accepted')}>Allow analytics</button></div></section>}</>;
}
