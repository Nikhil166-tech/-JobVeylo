import ShareJob from './share-job';
import type {Job} from '../lib/jobs';
import {jobContent,jobPoints,type JobContentSection} from '../lib/job-content';

function Points({items}:{items:string[]}){
  return <ul className="job-detail-points">{items.map((item,index)=><li key={index}>{item}</li>)}</ul>;
}
function ContentGroups({groups}:{groups:JobContentSection[]}){
  return <>{groups.map((group,index)=><div className="job-detail-group" key={index}>
    {group.title&&<h3>{group.title}</h3>}<Points items={group.points}/>
  </div>)}</>;
}

export default function JobArticle({job:j,preview=false}:{job:Job;preview?:boolean}){
  const closed=j.status==='closed';
  const content=jobContent(j);
  return <>
    <div className="page-head"><div className="wrap">
      <a className="breadcrumb" href="/#jobs">Jobs / {j.company}</a>
      <h1>{j.title}</h1><p className="sub">{j.company} · {j.location}</p>
      <div className="tags" style={{marginTop:18}}>
        <span className="tag">{preview?'Draft preview':closed?'Applications closed':'Published listing'}</span>
        <span className="tag">Source checked {j.checked}</span>
      </div>
    </div></div>
    <div className="wrap detail-layout"><article>
      <p className="job-detail-intro">{j.summary}</p>
      <nav className="job-section-links" aria-label="On this job page">
        <a href="#job-overview">Overview</a><a href="#job-responsibilities">Job details</a>
        <a href="#job-eligibility">Eligibility</a><a href="#job-selection">Selection process</a>
        <a href="#job-apply">How to apply</a>
      </nav>
      <section id="job-overview" className="job-detail-section">
        <h2>Job at a glance</h2>
        <table className="overview"><tbody>{[
          ['Employer',j.company],['Role',j.title],['Location',j.location],
          ['Experience',j.experience],['Education',j.education],
          ['Eligible batch',j.batch||'Not specified'],['Salary',j.salary||'Not disclosed'],
          ['Application fee',j.fees||'Not specified'],['Closing date',j.deadline],
        ].map(([key,value])=><tr key={key}><th scope="row">{key}</th><td>{value}</td></tr>)}</tbody></table>
      </section>
      <section id="job-responsibilities" className="job-detail-section">
        <h2>Job details & responsibilities</h2><ContentGroups groups={content.details}/>
      </section>
      <section id="job-eligibility" className="job-detail-section">
        <h2>Eligibility & qualifications</h2><ContentGroups groups={content.eligibility}/>
      </section>
      <section id="job-selection" className="job-detail-section">
        <h2>Selection process</h2>
        {content.selectionFromDescription&&<p className="job-section-note">As stated in the job description:</p>}
        {content.selection.length?<Points items={content.selection}/>:<div className="job-source-note">
          <strong>Selection details not published in this listing</strong><Points items={jobPoints(content.selectionNote)}/>
        </div>}
      </section>
      <section id="job-apply" className="job-detail-section">
        <h2>How to apply</h2><Points items={jobPoints(j.howToApply)}/>
      </section>
      {!preview&&<ShareJob title={j.title} company={j.company} id={j.id}/>}
      <section className="job-detail-section">
        <h2>Source & important notes</h2>
        <Points items={[...jobPoints(j.note),`Source type: ${j.sourceType}.`,
          'JobVeylo is not the employer or recruiting authority. The current original notification takes priority over this summary.']}/>
        <p><a className="textlink" href="/contact">Report a correction ↗</a></p>
        <p className="job-section-note">Last updated: {j.updatedAt?.slice(0,10)||j.checked}</p>
      </section>
      <a className="textlink" href="/#jobs">Explore other opportunities ↗</a>
    </article><aside className="summary-box">
      <h3 style={{marginTop:0}}>{closed?'This opening is closed':'Ready for your next step?'}</h3>
      <p className="sub">{closed?'Keep this page for reference and browse other opportunities.':'Check the source before submitting your application.'}</p>
      <dl><dt>Closing date</dt><dd>{j.deadline}</dd><dt>Source</dt><dd>{j.sourceType}</dd><dt>Location</dt><dd>{j.location}</dd></dl>
      {closed?<a className="primary" href="/#jobs">Find other jobs ↗</a>:<a className="primary" data-analytics-event={preview?undefined:"apply_click"} data-job-id={j.id} href={j.url} target="_blank" rel="noopener noreferrer">Apply ↗</a>}
      {!closed&&!preview&&<a className="secondary resume-job-link" data-analytics-event="resume_tool_click" data-job-id={j.id} href={'/resume?job='+encodeURIComponent(j.id)}>Tailor resume for this job ↗</a>}
      <small>Application details may change. We do not collect applications or guarantee placement.</small>
      {preview&&<a className="secondary" style={{display:'block',marginTop:18,textAlign:'center'}} href="/admin">Return to dashboard</a>}
    </aside></div>
    <div className="mobile-apply"><a className="primary" data-analytics-event={closed||preview?undefined:'apply_click'} data-job-id={j.id} href={closed?'/#jobs':j.url} target={closed?undefined:'_blank'} rel={closed?undefined:'noopener noreferrer'}>{closed?'Browse open jobs ↗':'Apply ↗'}</a></div>
  </>;
}
