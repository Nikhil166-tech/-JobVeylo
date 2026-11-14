import test from 'node:test';
import assert from 'node:assert/strict';
import {eligibleEarlyCareer,experienceBounds} from '../lib/job-priority.ts';
import {canPublish} from '../lib/validation.ts';
import {makeCollectedJob,collectionSources} from '../lib/collection-sources.ts';
import {automaticJob} from '../lib/automatic-publishing.ts';
test('fresher policy requires a zero minimum and keeps the three-year range cap',()=>{
 for(const experience of ['1+ years','6 months','one year','3.5 years','2 to 5 years','four years','4-year experience','48 months','1—4 years','0–4 years','3+ years','three years','36 months','1 to 3 yrs'])assert.equal(eligibleEarlyCareer({experience}),false,experience);
 for(const experience of ['0–3 years','0–2 years','zero years','0 months','0 to 1 yrs'])assert.equal(eligibleEarlyCareer({experience}),true,experience);
 assert.deepEqual(experienceBounds('2.5 years'),[{min:2.5,max:null}]);
});
test('junior label or internship cannot hide contradictory source requirements',()=>{
 assert.equal(eligibleEarlyCareer({title:'Software Intern',experience:'Not specified',details:'Required: five years of software experience.'}),false);
 assert.equal(eligibleEarlyCareer({title:'Junior Developer',experience:'2 years',requirements:['4 years of Java experience']}),false);
 assert.equal(eligibleEarlyCareer({title:'Engineer',experience:'Not specified'}),false);
 assert.equal(eligibleEarlyCareer({title:'Software Intern',experience:'Not specified'}),false);
 assert.equal(eligibleEarlyCareer({title:'Junior Developer',experience:'Not specified'}),false);
 assert.equal(eligibleEarlyCareer({title:'New Graduate Engineer',experience:'Not specified'}),true);
 assert.equal(eligibleEarlyCareer({title:'Software Intern',experience:'No prior experience required',requirements:['1 year of work experience required']}),false);
});

test('fresher wording excludes negation and mandatory contradictions but allows optional experience',()=>{
 for(const details of ['Freshers are not eligible.','No opportunities for freshers.','Not accepting freshers.','Experienced candidates only.','Freshers need not apply.'])assert.equal(eligibleEarlyCareer({experience:'0–2 years',details}),false,details);
 assert.equal(eligibleEarlyCareer({experience:'0–2 years',requirements:['1 year of work experience preferred.']}),true);
 assert.equal(eligibleEarlyCareer({experience:'0–2 years',requirements:['At least 1 year of work experience required; Python preferred.']}),false);
 assert.equal(eligibleEarlyCareer({experience:'No experience required',requirements:['A four-year bachelor degree.']}),true);
 assert.equal(eligibleEarlyCareer({experience:'No prior experience required',details:'Complete a 4 year undergraduate degree.'}),true);
});

test('collected fresher evidence survives the concise automatic publication summary',()=>{
 for(const wording of ['No prior experience required','Experience is not necessary','Freshers welcome','Recent graduates may apply']){
  const raw=makeCollectedJob(collectionSources[0],{title:'Software Engineer',url:'https://jobs.ashbyhq.com/aiprise/test',description:'Build customer software.\n'+wording+'.\nA four-year bachelor degree.',location:'Bengaluru, India'});
  assert.notEqual(raw.experience,'Not specified',wording);
  assert.equal(eligibleEarlyCareer(raw),true,wording);
  assert.equal(eligibleEarlyCareer(automaticJob(raw)),true,wording);
 }
 const raw=makeCollectedJob(collectionSources[0],{title:'Software Engineer',url:'https://jobs.ashbyhq.com/aiprise/test',description:'Freshers welcome.\n1 year of work experience preferred.',location:'Bengaluru, India'});
 assert.equal(eligibleEarlyCareer(raw),true);assert.equal(eligibleEarlyCareer(automaticJob(raw)),true);
});
test('manual publishing enforces the same policy while retaining drafts',()=>{
 const job={title:'Software Engineer',experience:'5 years',checked:'2026-01-01',deadline:'Not specified',reviewed:true,status:'published'};
 assert.throws(()=>canPublish(job),/fresher/i);
 assert.doesNotThrow(()=>canPublish({...job,status:'draft'}));
 assert.doesNotThrow(()=>canPublish({...job,experience:'0–3 years'}));
});
