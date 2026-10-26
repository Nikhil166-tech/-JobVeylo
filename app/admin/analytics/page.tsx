import {requireEditor} from '../../../lib/editor-auth';
import {bindings} from '../../../lib/platform';
import {Header,Footer} from '../../../components/site-shell';
import {campaignLink} from '../../../lib/traffic-links';
import {siteOrigin} from '../../../lib/site';
export const dynamic='force-dynamic';
export const metadata={title:'Visitor analytics | JobVeylo',robots:{index:false,follow:false}};
function Table({rows,first}:{rows:{label:string;total:number}[];first:string}){return <table className="overview"><thead><tr><th>{first}</th><th>Count</th></tr></thead><tbody>{rows.length?rows.map(row=><tr key={row.label}><td style={{overflowWrap:'anywhere'}}>{row.label}</td><td>{row.total.toLocaleString()}</td></tr>):<tr><td colSpan={2}>No activity recorded yet.</td></tr>}</tbody></table>}
export default async function Analytics(){
 await requireEditor();const db=bindings().DB;
 const since=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()-29*86400000));
 async function rows(sql:string){return (await db.prepare(sql).bind(since).all<{label:string;total:number}>()).results}
 const [events,pages,sources,campaigns,days]=await Promise.all([
  rows('SELECT event AS label,SUM(total) AS total FROM visitor_metrics WHERE day>=? GROUP BY event ORDER BY total DESC'),
  rows("SELECT path AS label,SUM(total) AS total FROM visitor_metrics WHERE day>=? AND event='page_view' GROUP BY path ORDER BY total DESC LIMIT 25"),
  rows("SELECT source AS label,SUM(total) AS total FROM visitor_metrics WHERE day>=? AND event='page_view' GROUP BY source ORDER BY total DESC"),
  rows("SELECT source || ' / ' || campaign AS label,SUM(total) AS total FROM visitor_metrics WHERE day>=? AND event='page_view' GROUP BY source,campaign ORDER BY total DESC LIMIT 25"),
  rows("SELECT day AS label,SUM(total) AS total FROM visitor_metrics WHERE day>=? AND event='page_view' GROUP BY day ORDER BY day DESC")
 ]);
 return <><Header/><main><div className="page-head"><div className="wrap"><a href="/admin">Owner dashboard /</a><h1>Visitor analytics</h1><p>Last 30 days · India time · visible only to the owner</p></div></div><article className="article"><p>Automatic aggregate tracking. Refresh this page for the latest counts.</p><Table rows={events} first="Activity"/><h2>Most viewed pages</h2><Table rows={pages} first="Page"/><h2>Traffic sources</h2><Table rows={sources} first="Source"/><h2>Shared links and campaigns</h2><Table rows={campaigns} first="Source / campaign"/><h2>Daily page views</h2><Table rows={days} first="Date"/><h2>How to read these numbers</h2><p>Views include repeat visits. These are not unique-person counts: no visitor IDs, analytics cookies or tracking storage are used. Known bots are filtered, but automated traffic and browser blocking can affect counts. We record public page paths, fixed source/campaign labels and button counters, without storing IP addresses, complete referrers, URL queries, resume content or contact fields in analytics. Direct traffic can include apps that hide referrers. Source labels carry through the current page session in memory. A reload may appear as internal traffic.</p><h2>Your Instagram bio link</h2><p style={{overflowWrap:'anywhere'}}>{campaignLink(siteOrigin,'/','instagram','bio')}</p><h2>Your WhatsApp channel link</h2><p style={{overflowWrap:'anywhere'}}>{campaignLink(siteOrigin,'/','whatsapp','channel')}</p><p>New reel captions include Instagram tags. Generic Share buttons use share/referral because the destination app is unknown. Earlier Google Analytics test data stays in Google and is not mixed into these counters.</p><p><a href="/privacy">Privacy notice</a></p></article></main><Footer/></>;
}
