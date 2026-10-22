import {Header,Footer} from '../../components/site-shell';
import ResumeBuilder from './resume-builder';
export const metadata={title:'Resume builder & job tailoring | JobVeylo',description:'Upload a resume or fill a form, tailor it to a selected job, review and download PDF or Word.'};
export default function ResumePage(){return <><Header/><main className="wrap resume-page"><div className="resume-intro"><span className="eyebrow">YOUR NEXT CHAPTER</span><h1>A resume for your next move.</h1><p>Bring your experience. Choose a job. Build a clear, relevant resume you can review and download.</p></div><ResumeBuilder/></main><Footer/></>}
