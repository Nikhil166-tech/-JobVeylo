import test from 'node:test';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
import {manualResumeDraft,resumeSections,resumeParagraphs,contactLines} from '../lib/resume-template.ts';
import {buildResumeFile} from '../lib/resume-export.ts';

const contact={name:'Zoë Morgan',email:'zoe@example.org',phone:'+1 202 555 0147',location:'Bengaluru, India',links:'https://example.org/portfolio'};
const source='Professional Summary\nBuilt Python services.\nSkills\nPython, SQL\nWork Experience\nEngineer | Example Company\n2024 - 2026\n- Built APIs.\n\nEducation\nBTech | Example Institute | 2020 - 2024\nProjects\nPortfolio\n• Built an application tracker.';

test('manual import keeps recognised sections and original facts without invented text',()=>{
 const draft=manualResumeDraft(source);
 assert.equal(draft.summary.text,'Built Python services.');assert.deepEqual(draft.skills,['Python','SQL']);
 assert.deepEqual(draft.sections.map(s=>s.title),['Experience','Education','Projects']);
 assert.match(draft.sections[0].content,/2024 - 2026/);assert.match(draft.sections[2].content,/Built an application tracker/);
 const unlabelled='Built a real Python project with a database.';assert.equal(manualResumeDraft(unlabelled).sections[0].content,unlabelled);
});

test('template keeps paragraph order, handles bullet markers and omits empty sections',()=>{
 assert.deepEqual(resumeParagraphs('Role | Company\n2024 - 2026\n- Built APIs.\n• Added tests.\n\nOther role'),[
  {text:'Role | Company',bullet:false,entry:true},{text:'2024 - 2026',bullet:false,entry:false},{text:'Built APIs.',bullet:true,entry:false},{text:'Added tests.',bullet:true,entry:false},{text:'Other role',bullet:false,entry:true},
 ]);
 const draft=manualResumeDraft(source);draft.sections.push({title:'Education',content:'Additional training',sourceQuotes:[]});
 assert.equal(resumeSections(draft).filter(s=>s.title==='Education').length,1);
 assert.deepEqual(contactLines(contact),['zoe@example.org | +1 202 555 0147 | Bengaluru, India','https://example.org/portfolio']);
});

test('Word export uses body text, standard headings and real bullets without tables or images',async()=>{
 const draft=manualResumeDraft(source);draft.missingRequirements=['DO NOT EXPORT THIS GAP'];draft.changes=['DO NOT EXPORT THIS NOTE'];
 const blob=await buildResumeFile('docx',contact,draft,'letter');const zip=unzipSync(new Uint8Array(await blob.arrayBuffer()));
 const xml=strFromU8(zip['word/document.xml']);
 assert.ok(xml.includes('Zoë Morgan'));assert.ok(xml.includes('zoe@example.org'));assert.ok(xml.includes('PROFESSIONAL SUMMARY'));assert.ok(xml.includes('EDUCATION'));
 assert.ok(xml.includes('<w:numPr>'));assert.ok(xml.includes('w:keepNext'));assert.ok(xml.includes('w:w="12240"'));assert.ok(xml.includes('w:h="15840"'));
 assert.ok(!/<w:tbl[ >]|<w:drawing[ >]|<w:pict[ >]/.test(xml));assert.ok(!xml.includes('DO NOT EXPORT'));assert.ok(!Object.keys(zip).some(k=>/^word\/(header|footer)\d/.test(k)));
 const a4=unzipSync(new Uint8Array(await (await buildResumeFile('docx',contact,draft,'a4')).arrayBuffer()));assert.ok(strFromU8(a4['word/document.xml']).includes('w:w="11906"'));
});
