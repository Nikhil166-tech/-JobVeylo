'use client';
import { useEffect } from 'react';import shell from '../lib/shell.json';
export default function Legacy(){useEffect(()=>{if(document.getElementById('jobveylo-app'))return;const s=document.createElement('script');s.id='jobveylo-app';s.src='/app.js';document.body.appendChild(s)},[]);return <div suppressHydrationWarning dangerouslySetInnerHTML={{__html:shell}}/>}
