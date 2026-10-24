import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
import {manualResumeDraft,normalizeProjectDraft,projectParagraphs,resumeSections,resumeParagraphs,contactLines,resumeHeaderLinks,parseResumeSkills} from '../lib/resume-template.ts';
import {buildResumeFile} from '../lib/resume-export.ts';

const fonts={regular:new Uint8Array(readFileSync('public/fonts/LibertinusSerif-Regular.ttf')),bold:new Uint8Array(readFileSync('public/fonts/LibertinusSerif-Bold.ttf'))};
const contact={name:'Zoë Morgan',email:'zoe@example.org',phone:'+1 202 555 0147',location:'Bengaluru, India',links:'https://example.org/portfolio'};
const source='Professional Summary\nBuilt Python services.\nSkills\nPython, SQL\nWork Experience\nEngineer | Example Company\n2024 - 2026\n- Built APIs.\n\nEducation\nBTech | Example Institute | 2020 - 2024\nProjects\nPortfolio\n• Built an application tracker.';

test('keeps the fourth bullet, caps each project independently and exports exactly the preview bullets',async()=>{
 const projects='Search Assistant | Python\n'+Array.from({length:6},(_,i)=>'- Search achievement '+(i+1)+'.').join('\n')+'\n\nTracker\n'+Array.from({length:5},(_,i)=>'- Tracker achievement '+(i+1)+'.').join('\n');
 const draft=manualResumeDraft('Projects\n'+projects+'\nExperience\nEngineer | Example\n'+Array.from({length:5},(_,i)=>'- Work achievement '+(i+1)+'.').join('\n'));
 const normalized=normalizeProjectDraft(draft),preview=resumeSections(normalized),projectRows=preview.find(s=>s.title==='Projects').paragraphs;
 assert.deepEqual(projectRows.filter(p=>p.bullet).map(p=>p.text),[...Array.from({length:4},(_,i)=>'Search achievement '+(i+1)+'.'),...Array.from({length:4},(_,i)=>'Tracker achievement '+(i+1)+'.')]);
 assert.ok(draft.sections[0].content.includes('Search achievement 6.'));assert.ok(!normalized.sections[0].content.includes('achievement 5.'));
 assert.equal(preview.find(s=>s.title==='Work Experience').paragraphs.filter(p=>p.bullet).length,5);
 const zip=unzipSync(new Uint8Array(await (await buildResumeFile('docx',contact,normalized,'a4',fonts)).arrayBuffer()));
 const xml=strFromU8(zip['word/document.xml']);
 const exportedBullets=Array.from(xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g),m=>m[0]).filter(p=>p.includes('<w:numPr>')).map(p=>Array.from(p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g),m=>m[1]).join(''));
 assert.deepEqual(exportedBullets,preview.flatMap(s=>s.paragraphs.filter(p=>p.bullet).map(p=>p.text)));
 assert.deepEqual(normalizeProjectDraft(normalized),normalized);
});

test('does not pad short projects and keeps wrapped fourth bullets intact',()=>{
 const rows=projectParagraphs('Project | Python\n- First point.\n- Second point.\n- Third point.\n- Fourth point starts here and\ncontinues on the next line.\n- Fifth point.\n\nShort Project\n- Only one supported point.');
 assert.equal(rows.filter(p=>p.bullet).length,5);assert.ok(rows.some(p=>p.text==='Fourth point starts here and continues on the next line.'));assert.ok(!rows.some(p=>p.text==='Fifth point.'));
});

test('manual import keeps recognised sections and original facts without invented text',()=>{
 const draft=manualResumeDraft(source);
 assert.equal(draft.summary.text,'Built Python services.');assert.deepEqual(draft.skills,['Python','SQL']);
 assert.deepEqual(draft.sections.map(s=>s.title),['Experience','Education','Projects']);
 assert.match(draft.sections[0].content,/2024 - 2026/);assert.match(draft.sections[2].content,/Built an application tracker/);
 const unlabelled='Built a real Python project with a database.';assert.equal(manualResumeDraft(unlabelled).sections[0].content,unlabelled);
});

test('template keeps paragraph order, handles bullet markers and omits empty sections',()=>{
 assert.deepEqual(resumeParagraphs('Role | Company\n2024 - 2026\n- Built APIs.\n• Added tests.\n\nOther role'),[
  {text:'Role | Company',bullet:false,entry:true,right:'2024 - 2026'},{text:'Built APIs.',bullet:true,entry:false},{text:'Added tests.',bullet:true,entry:false},{text:'Other role',bullet:false,entry:true},
 ]);
 const draft=manualResumeDraft(source);draft.sections.push({title:'Education',content:'Additional training',sourceQuotes:[]});
 assert.equal(resumeSections(draft).filter(s=>s.title==='Education').length,1);
 assert.deepEqual(contactLines(contact),['Bengaluru, India','zoe@example.org | +1 202 555 0147']);
 assert.deepEqual(resumeHeaderLinks(contact),[{url:'https://example.org/portfolio',label:'example.org/portfolio'}]);
});

test('places each project link at its own title and preserves unmatched links for review',async()=>{
 const draft=manualResumeDraft('Projects\nSearch Assistant | Python Live Demo | Git Repo\n- Built retrieval APIs.\nTracker | React Live Demo | Git Repo\n- Built a dashboard.');
 const person={...contact,links:'https://github.com/example | https://example.org/search | https://github.com/example/search | https://example.org/tracker',linkPlacements:[{url:'https://example.org/tracker',label:'Live Demo',entry:'Tracker | React',section:'Projects'},{url:'https://example.org/search',label:'Live Demo',entry:'Search Assistant | Python',section:'Projects'},{url:'https://github.com/example/search',label:'Git Repo',entry:'Search Assistant | Python',section:'Projects'}]};
 const sections=resumeSections(draft,person),projects=sections.find(s=>s.title==='Projects').paragraphs;
 assert.equal(projects[0].text,'Search Assistant | Python');assert.deepEqual(projects[0].links.map(l=>l.url),['https://example.org/search','https://github.com/example/search']);
 assert.equal(projects[2].links[0].url,'https://example.org/tracker');assert.equal(resumeHeaderLinks(person,draft).length,1);
 assert.equal(resumeHeaderLinks(person,manualResumeDraft('Projects\nDifferent Project\n- Built APIs.')).length,4);
 const zip=unzipSync(new Uint8Array(await (await buildResumeFile('docx',person,draft,'a4',fonts)).arrayBuffer()));
 const xml=strFromU8(zip['word/document.xml']),rels=strFromU8(zip['word/_rels/document.xml.rels']);
 assert.ok(xml.includes('Live Demo'));assert.ok(xml.includes('<w:hyperlink'));assert.ok(rels.includes('https://example.org/search'));assert.ok(xml.indexOf('Live Demo')>xml.indexOf('PROJECTS'));
});

test('reference rows align inline dates and keep wrapped bullet text together',()=>{
 const rows=resumeParagraphs('Example Company | Intern   Bengaluru | Dec 2025 - Jan 2026\n- Streamed responses through Server-Sent\nEvents (SSE).\nOther Project | React Live Demo | Git Repo\n- Built an app.');
 assert.equal(rows[0].text,'Example Company | Intern');assert.equal(rows[0].right,'Bengaluru | Dec 2025 - Jan 2026');
 assert.equal(rows[1].text,'Streamed responses through Server-Sent Events (SSE).');assert.equal(rows[2].entry,true);
});

test('Word export uses body text, standard headings and real bullets without tables or images',async()=>{
 const draft=manualResumeDraft(source);draft.missingRequirements=['DO NOT EXPORT THIS GAP'];draft.changes=['DO NOT EXPORT THIS NOTE'];
 const blob=await buildResumeFile('docx',contact,draft,'letter',fonts);const zip=unzipSync(new Uint8Array(await blob.arrayBuffer()));
 const xml=strFromU8(zip['word/document.xml']);
 assert.ok(xml.includes('ZOË MORGAN'));assert.ok(xml.includes('zoe@example.org'));assert.ok(xml.includes('PROFESSIONAL SUMMARY'));assert.ok(xml.includes('EDUCATION'));
 assert.equal(Object.keys(zip).filter(k=>/^word\/fonts\/.*\.odttf$/.test(k)).length,2);assert.ok(strFromU8(zip['word/fontTable.xml']).includes('embedBold'));assert.ok(xml.includes('<w:numPr>'));assert.ok(xml.includes('Libertinus Serif'));assert.ok(xml.includes('w:val="center"'));assert.ok(xml.includes('<w:pBdr>'));assert.ok(xml.includes('WORK EXPERIENCE'));assert.ok(xml.includes('TECHNICAL SKILLS'));assert.ok(xml.includes('w:keepNext'));assert.ok(xml.includes('w:w="12240"'));assert.ok(xml.includes('w:h="15840"'));
 assert.ok(!/<w:tbl[ >]|<w:drawing[ >]|<w:pict[ >]/.test(xml));assert.ok(!xml.includes('DO NOT EXPORT'));assert.ok(!Object.keys(zip).some(k=>/^word\/(header|footer)\d/.test(k)));
 const a4=unzipSync(new Uint8Array(await (await buildResumeFile('docx',contact,draft,'a4',fonts)).arrayBuffer()));assert.ok(strFromU8(a4['word/document.xml']).includes('w:w="11906"'));
});

test('reference layout keeps categories intact and places technical skills after education',()=>{
 const draft=manualResumeDraft('Technical Skills\nProgramming: Python, JavaScript\nBackend: FastAPI, PostgreSQL\nEducation\nExample Institute\n2020 - 2024\nBTech in Computer Science\nWork Experience\nEngineer | Example Company\n2024 - Present\n- Built tested APIs.');
 assert.deepEqual(parseResumeSkills('Programming: Python, JavaScript\nBackend: FastAPI, PostgreSQL'),['Programming: Python, JavaScript','Backend: FastAPI, PostgreSQL']);
 assert.deepEqual(resumeSections(draft).map(s=>s.title),['Work Experience','Education','Technical Skills']);
 assert.equal(resumeSections(draft)[1].paragraphs[0].right,'2020 - 2024');
});
