import test from 'node:test';
import assert from 'node:assert/strict';
import {resumeJobContext,resumeTarget} from '../lib/resume-job.ts';
const job={id:'example-engineer',title:'Software Engineer',company:'Example Company',location:'India',experience:'2 years',education:'Degree',requirements:['Python','PostgreSQL'],details:'Opening details. '.repeat(400)+'Unique requirement at the end: production retrieval pipelines.',summary:'Build reliable services.',checked:'2026-10-24',version:3};
test('passes the full selected JD, including requirements beyond the former 4500-character cutoff',()=>{
 const context=resumeJobContext(job);assert.equal(context.description,job.details);assert.ok(context.description.endsWith('production retrieval pipelines.'));assert.deepEqual(context.requirements,job.requirements);assert.equal(context.id,job.id);
});
test('binds a tailored draft to the selected job and its description snapshot',async()=>{
 const original=await resumeTarget(job),same=await resumeTarget(job),changed=await resumeTarget({...job,details:job.details+' Additional requirement.'}),other=await resumeTarget({...job,id:'example-support',title:'Customer Support'});
 assert.equal(original.descriptionHash,same.descriptionHash);assert.notEqual(original.descriptionHash,changed.descriptionHash);assert.notEqual(original.descriptionHash,other.descriptionHash);assert.equal(original.version,3);assert.equal(original.id,job.id);
});
