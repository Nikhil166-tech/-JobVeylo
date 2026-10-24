import type {Contact,ResumeDraft} from '../lib/resume';
import {contactLines,resumeSections,type PaperSize} from '../lib/resume-template';

const sampleContact:Contact={name:'Alex Morgan',email:'alex.morgan@example.com',phone:'+1 202 555 0147',location:'Bengaluru, India',links:'github.com/alexmorgan | linkedin.com/in/alexmorgan'};
const sampleDraft:ResumeDraft={summary:{text:'Software engineer with experience building Python services, REST APIs and reliable data workflows. Collaborates with product teams to deliver tested, maintainable applications.',sourceQuotes:[]},skills:['Python','SQL','PostgreSQL','REST APIs','Git','Docker','Automated testing'],sections:[
 {title:'Experience',content:'Software Engineer | Example Company\nJul 2024 - Present\n- Built Python services and REST APIs for customer-facing applications.\n- Added automated tests and documented deployment procedures.\n- Collaborated with product and support teams to resolve production issues.',sourceQuotes:[]},
 {title:'Projects',content:'Application Tracker | Python, PostgreSQL\n- Built a searchable dashboard to organise applications and follow-up tasks.\n- Implemented input validation, database queries and automated tests.',sourceQuotes:[]},
 {title:'Education',content:'Bachelor of Technology in Computer Science\nExample Institute | 2020 - 2024',sourceQuotes:[]},
],missingRequirements:[],changes:[]};
export default function ResumePreview({contact,draft,paper}:{contact:Contact;draft:ResumeDraft|null;paper:PaperSize}){
 const person=draft?contact:sampleContact,document=draft||sampleDraft;
 return <div className="resume-preview-wrap"><p className="resume-preview-caption">{draft?'Your resume preview':'Template preview · fictional sample content'}</p><article className={'resume-paper resume-paper-'+paper} aria-label={draft?'Resume preview':'ATS Classic sample template'}>
  <div className="resume-paper-name">{person.name.trim()||'Your full name'}</div>
  {contactLines(person).map((line,i)=><p className="resume-paper-contact" key={i}>{line}</p>)}
  {resumeSections(document).map(section=><section key={section.title}><h3>{section.title}</h3>{section.paragraphs.map((p,i)=>p.bullet?<ul className="resume-paper-bullets" key={i}><li>{p.text}</li></ul>:<p key={i} className={p.entry?'resume-paper-entry':''}>{p.text}</p>)}</section>)}
 </article><p className="resume-hint">Single column · Text-based PDF and Word · No photos or layout tables. Page breaks can vary between formats.</p></div>;
}
