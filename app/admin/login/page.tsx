import {Header,Footer} from '../../../components/site-shell';
import {bindings} from '../../../lib/platform';
export const dynamic='force-dynamic';
export const metadata={title:'Owner sign in | JobVeylo',robots:{index:false,follow:false}};
export default async function Login({searchParams}:{searchParams:Promise<{error?:string}>}){
 const {error}=await searchParams;
 const configured=!!bindings().GITHUB_CLIENT_ID&&!!bindings().GITHUB_CLIENT_SECRET;
 return <><Header/><main className="wrap section" style={{maxWidth:560}}><h1>Owner sign in</h1>
 <p>Manage JobVeylo openings with your GitHub account. Job seekers do not need an account.</p>
 <div className="editor-form"><h2 style={{fontSize:21,marginTop:0}}>JobVeylo editorial workspace</h2>
 <p>Access is restricted to the authorised owner account, Nikhil166-tech.</p>
 {configured?<a className="primary" href="/api/auth/github">Sign in with GitHub ↗</a>:<p role="status">Owner sign-in is being configured. Please check back shortly.</p>}
 {error&&<p role="alert">Sign-in could not be verified. Use the authorised GitHub account and try again.</p>}
 <p className="sub" style={{fontSize:13,marginTop:18}}>We use your public GitHub identity for sign-in. Repository access is not requested.</p>
 </div></main><Footer/></>;
}
