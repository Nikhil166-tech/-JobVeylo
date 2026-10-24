import test from 'node:test';
import assert from 'node:assert/strict';
import {resumeRequest,validateEvidence,redactContact,blankContact} from '../lib/resume.ts';
const source='Built a Python dashboard for a college project in 2024. Analysed 200 records and presented results to the course team.';
const draft=()=>({summary:{text:'Built a Python dashboard in 2024.',sourceQuotes:['Built a Python dashboard for a college project in 2024.']},skills:['Python'],sections:[{title:'Projects',content:'Analysed 200 records.',sourceQuotes:['Analysed 200 records']}],missingRequirements:[],changes:[]});
 test('accepts supported evidence and preserves original metrics',()=>assert.doesNotThrow(()=>validateEvidence(draft(),source)));
 test('rejects invented evidence, skills and metrics',()=>{let d=draft();d.skills=['Java'];assert.throws(()=>validateEvidence(d,source));d=draft();d.sections[0].content='Analysed 500 records.';assert.throws(()=>validateEvidence(d,source));d=draft();d.summary.sourceQuotes=['Worked at Example Inc'];assert.throws(()=>validateEvidence(d,source));});
 test('requires consent, job slug and bounded source text',()=>{assert.equal(resumeRequest.safeParse({jobId:'example-job',resumeText:source.repeat(2),consent:true}).success,true);for(const bad of [{consent:false},{jobId:'../admin'},{resumeText:'x'.repeat(10001)}])assert.equal(resumeRequest.safeParse({jobId:'example-job',resumeText:source.repeat(2),consent:true,...bad}).success,false)});
 test('removes explicit contact fields, emails and web links',()=>{const out=redactContact('Sample Person hello@example.org https://example.org Python',{...blankContact(),name:'Sample Person'});assert.ok(!out.includes('Sample Person'));assert.ok(!out.includes('hello@example.org'));assert.ok(!out.includes('https://'));assert.ok(out.includes('Python'));});

test('does not promote negated skills or mistake JavaScript for Java',()=>{
 let d=draft();d.skills=['AWS'];assert.throws(()=>validateEvidence(d,source+' No experience with AWS.'));
 d=draft();d.skills=['Java'];assert.throws(()=>validateEvidence(d,source+' Built JavaScript applications.'));
});
test('rejects borrowed metrics and unsupported hiring-company claims',()=>{
 let d=draft();d.sections[0].sourceQuotes=['Built a Python dashboard for a college project in 2024.'];assert.throws(()=>validateEvidence(d,source));
 d=draft();d.summary.text='Worked for Hiring Corporation in 2024.';assert.throws(()=>validateEvidence(d,source,'Hiring Corporation'));
});

test('a missing skill on another line does not invalidate a supported skill',()=>assert.doesNotThrow(()=>validateEvidence(draft(),'No AWS experience.\n'+source)));

test('rejects altered calendar months and unsupported seniority',()=>{
 const original='Software Engineer Intern | Example Company | Jan 2024 - Jun 2026. Built Python APIs.';
 const candidate={summary:{text:'Built Python APIs.',sourceQuotes:['Built Python APIs.']},skills:['Python'],sections:[{title:'Experience',content:'Software Engineer Intern | Example Company | Jan 2024 - Jul 2026.',sourceQuotes:[original]}],missingRequirements:[],changes:[]};
 assert.throws(()=>validateEvidence(candidate,original),/month or date/);
 candidate.sections[0].content='Senior Software Engineer | Example Company | Jan 2024 - Jun 2026.';assert.throws(()=>validateEvidence(candidate,original),/seniority/);
});
