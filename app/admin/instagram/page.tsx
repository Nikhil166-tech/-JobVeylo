import {requireEditor} from '../../../lib/editor-auth';
import {bindings} from '../../../lib/platform';
import {instagramReady} from '../../../lib/instagram-publishing';
import {Header,Footer} from '../../../components/site-shell';
import RendererConnection,{InstagramConnectionCheck,HostedRenderStatus} from '../../../components/renderer-connection';
export const dynamic='force-dynamic';
export const metadata={title:'Instagram automation | JobVeylo',robots:{index:false,follow:false}};
export default async function InstagramSetup(){
 await requireEditor();const env=bindings();
 const rows=await env.DB.prepare('SELECT status,COUNT(*) AS total FROM social_jobs GROUP BY status').all<{status:string;total:number}>();
 const recent=await env.DB.prepare('SELECT listing_id,status,last_error,published_at FROM social_jobs ORDER BY COALESCE(published_at,created_at) DESC LIMIT 12').all<{listing_id:string;status:string;last_error:string|null;published_at:string|null}>();
 const configured=[['REEL_MEDIA storage',!!env.REEL_MEDIA],['Renderer connection',!!env.JOBVEYLO_AUTOMATION_KEY||!!await env.REEL_MEDIA?.get('automation/renderer-key-hash')],['INSTAGRAM_ACCESS_TOKEN',!!env.INSTAGRAM_ACCESS_TOKEN],['INSTAGRAM_ACCOUNT_ID',!!env.INSTAGRAM_ACCOUNT_ID]];
 return <><Header/><main><div className="page-head"><div className="wrap"><a className="breadcrumb" href="/admin">Owner dashboard /</a><h1>Instagram publishing</h1><p className="sub">One job per reel. Freshers and roles accepting 0–3 years first. At most two reels per hour.</p></div></div><article className="article">
  <h2>{instagramReady(env)?'Publishing credentials configured':'One-time connection required'}</h2>
  <p>Website publishing works independently. Direct Instagram delivery needs a professional @jobveylo account, its authorised publishing token and the hosted renderer. The Metricool chat connection does not supply those server credentials.</p>
  <ul>{configured.map(([name,ready])=><li key={String(name)}>{String(name)}: <b>{ready?'Configured':'Not configured'}</b></li>)}</ul>
  <InstagramConnectionCheck/>
  <HostedRenderStatus/>
  <h2>Connect once</h2><ol><li>In the Meta app, configure Instagram API with Instagram Login for your own professional @jobveylo account. Grant the basic identity and content-publishing permissions requested by Meta.</li><li>Save the Instagram account ID and long-lived access token privately in both the website Worker and jobveylo-collector Worker, using INSTAGRAM_ACCOUNT_ID and encrypted INSTAGRAM_ACCESS_TOKEN. Never paste tokens in chat or commit them.</li><li>Bind the same private Cloudflare KV namespace as REEL_MEDIA to both Workers. Only generated public videos are served by the media endpoint; videos expire after seven days.</li><li>Create a renderer connection key below and save it as the GitHub Actions repository secret JOBVEYLO_AUTOMATION_KEY. It grants only reel-job claiming and video uploads, not owner-dashboard access.</li><li>Enable the hosted renderer workflow on the repository’s default branch. It renders one 15-second single-screen MP4 every 30 minutes and uploads it to JobVeylo. No local computer is needed. GitHub scheduling and Instagram processing can introduce delays.</li></ol>
  <h2>Hosted renderer connection</h2><RendererConnection/>
  <p>The key created here is stored only as a hash in the private namespace. You only need to save the actual key in GitHub. This replaces the manual Worker-secret step above when using this connection button.</p>
  <p>There is no per-job approval prompt. Authentication failures, source conflicts and uncertain publish outcomes are held rather than retried blindly. An expired or revoked Instagram token requires reconnection.</p>
  <h2>Queue</h2><ul>{rows.results.map(row=><li key={row.status}>{row.status}: {row.total}</li>)}</ul>
  <h2>Recent outcomes</h2>{recent.results.map(row=><p key={row.listing_id}><a href={'/jobs/'+row.listing_id}>{row.listing_id}</a> — {row.status}{row.last_error?' · '+row.last_error:''}</p>)}
 </article></main><Footer/></>;
}
