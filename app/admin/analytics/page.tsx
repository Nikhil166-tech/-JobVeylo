import {requireEditor} from '../../../lib/editor-auth';
import {Header,Footer} from '../../../components/site-shell';
import {campaignLink} from '../../../lib/traffic-links';
import {siteOrigin} from '../../../lib/site';
export const dynamic='force-dynamic';
export const metadata={title:'Visitor analytics | JobVeylo',robots:{index:false,follow:false}};
const reports='https://analytics.google.com/analytics/web/#/a363752189p560747702/reports/';
export default async function Analytics(){
 await requireEditor();
 return <><Header/><main><div className="page-head"><div className="wrap"><a href="/admin">Owner dashboard /</a><h1>Visitor analytics</h1><p>See how readers find JobVeylo and which job pages they visit.</p></div></div><article className="article"><a className="primary" href={reports+'intelligenthome'} target="_blank" rel="noopener noreferrer">Open Google Analytics ↗</a><h2>Where to find your numbers</h2><ul><li>Realtime: recent visitors and events.</li><li>Reports → Acquisition → Traffic acquisition: Instagram, WhatsApp, Google and tagged campaigns.</li><li>Reports → Engagement → Pages and screens: most visited job pages.</li><li>Reports → Engagement → Events: apply_click and resume_tool_click.</li></ul><p>Users are estimated unique users. Views count repeat page visits. Only visitors who allow analytics and are not blocked by their browser are measured. Admin pages, resume content and form fields are excluded. Detailed reports may take 24–48 hours. Earlier traffic cannot be reconstructed.</p><h2>Your Instagram bio link</h2><p style={{overflowWrap:'anywhere'}}><a href={campaignLink(siteOrigin,'/','instagram','bio')}>{campaignLink(siteOrigin,'/','instagram','bio')}</a></p><h2>Your WhatsApp channel link</h2><p style={{overflowWrap:'anywhere'}}><a href={campaignLink(siteOrigin,'/','whatsapp','channel')}>{campaignLink(siteOrigin,'/','whatsapp','channel')}</a></p><p>Use these links in the relevant profiles to distinguish visits. New reel captions include per-job Instagram tags. Generic Share buttons use share/referral because the destination app is not known.</p><p><a href="/privacy">Privacy notice</a></p></article></main><Footer/></>;
}
