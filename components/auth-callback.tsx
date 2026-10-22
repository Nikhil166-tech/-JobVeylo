'use client';
import {useEffect} from 'react';
export default function AuthCallback(){
  useEffect(()=>{
    if(location.pathname==='/admin/login')return;
    const hash=new URLSearchParams(location.hash.slice(1));
    if(['invite_token','confirmation_token','recovery_token','access_token'].some(key=>hash.has(key))){
      location.replace('/admin/login'+location.hash);
    }
  },[]);
  return null;
}
