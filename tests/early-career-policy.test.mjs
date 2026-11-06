import test from 'node:test';
import assert from 'node:assert/strict';
import {eligibleEarlyCareer,experienceBounds} from '../lib/job-priority.ts';
import {canPublish} from '../lib/validation.ts';
test('0–3 policy checks decimals, written numbers and full ranges',()=>{
 for(const experience of ['3.5 years','2 to 5 years','four years','4-year experience','48 months','1—4 years'])assert.equal(eligibleEarlyCareer({experience}),false,experience);
 for(const experience of ['0–3 years','3+ years','three years','36 months','1 to 3 yrs'])assert.equal(eligibleEarlyCareer({experience}),true,experience);
 assert.deepEqual(experienceBounds('2.5 years'),[{min:2.5,max:null}]);
});
test('junior label or internship cannot hide contradictory source requirements',()=>{
 assert.equal(eligibleEarlyCareer({title:'Software Intern',experience:'Not specified',details:'Required: five years of software experience.'}),false);
 assert.equal(eligibleEarlyCareer({title:'Junior Developer',experience:'2 years',requirements:['4 years of Java experience']}),false);
 assert.equal(eligibleEarlyCareer({title:'Engineer',experience:'Not specified'}),false);
 assert.equal(eligibleEarlyCareer({title:'Software Intern',experience:'Not specified'}),true);
});
test('manual publishing enforces the same policy while retaining drafts',()=>{
 const job={title:'Software Engineer',experience:'5 years',checked:'2026-01-01',deadline:'Not specified',reviewed:true,status:'published'};
 assert.throws(()=>canPublish(job),/0–3/);
 assert.doesNotThrow(()=>canPublish({...job,status:'draft'}));
 assert.doesNotThrow(()=>canPublish({...job,experience:'0–3 years'}));
});
