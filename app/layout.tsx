import {siteOrigin} from '../lib/site';
import type {Metadata} from 'next';
export const metadata:Metadata={metadataBase:new URL(siteOrigin),title:'JobVeylo — Your next opportunity',description:'Source-checked job details, application links and career guides.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><head><link rel="stylesheet" href="/style.css"/></head><body>{children}</body></html>}
