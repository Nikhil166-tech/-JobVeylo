import { requireEditor } from '../../lib/editor-auth';import Admin from './workspace';import { Header,Footer } from '../../components/site-shell';
export const dynamic='force-dynamic';export const metadata={title:'Owner dashboard | JobVeylo',robots:{index:false,follow:false}};
export default async function Page(){await requireEditor();return <><Header/><main><Admin/></main><Footer/></>}
