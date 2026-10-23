import test from 'node:test';
import assert from 'node:assert/strict';
import {jobContent,jobPoints} from '../lib/job-content.ts';
test('turns prose and existing bullets into points without changing figures or technology names',()=>{
 assert.deepEqual(jobPoints('Build Node.js services using Python 3.11. Work with the U.S. team.\n• Maintain 99.9% uptime.\n2) Write tests.'),['Build Node.js services using Python 3.11.','Work with the U.S. team.','Maintain 99.9% uptime.','Write tests.']);
});
test('moves labelled qualifications and interviews into their own sections',()=>{
 const content=jobContent({details:'Role Overview\nBuild backend services.\nWhat We’re Looking For\nMust-Have:\n0-2 years of experience building systems\nNice-to-Have:\nPython experience\nAbout the interview\nRemote: Exploratory Discussion\nIn-office\nDSA/Problem Solving 1\nDSA/Problem Solving 2\nSystem Design Interview',requirements:['0-2 years of experience'],selection:'Not specified by the employer'});
 assert.deepEqual(content.details,[{title:'Role Overview',points:['Build backend services.']}]);
 assert.deepEqual(content.eligibility.map(s=>s.title),['Must-Have','Nice-to-Have']);
 assert.equal(content.selectionFromDescription,true);
 assert.deepEqual(content.selection,['Remote: Exploratory Discussion','In-office','DSA/Problem Solving 1','DSA/Problem Solving 2','System Design Interview']);
});
test('keeps employer-provided selection wording and never invents stages',()=>{
 const base={details:'Work with customers.',requirements:['Customer service experience.']};
 assert.deepEqual(jobContent({...base,selection:'Not specified by the employer'}).selection,[]);
 assert.deepEqual(jobContent({...base,selection:'1. Written test\n2. Interview'}).selection,['Written test','Interview']);
});
