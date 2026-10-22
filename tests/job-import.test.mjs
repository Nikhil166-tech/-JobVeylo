import test from 'node:test';
import assert from 'node:assert/strict';
import {extractJob} from '../lib/job-import.ts';
import {publicAddress,sourceUrl,fetchJobPage} from '../lib/fetch-job-page.ts';
import {input,canPublish} from '../lib/validation.ts';
const url='https://careers.example.org/opening/123';
const record={
 '@context':'https://schema.org','@type':'JobPosting',title:'Software Engineer',hiringOrganization:{name:'Example Ltd'},
 jobLocation:{address:{addressLocality:'Bengaluru',addressCountry:'IN'}},
 description:'<p>Build reliable services with the engineering team and maintain production applications.</p><h2>Requirements</h2><ul><li>2 years of experience</li><li>Bachelor degree in computer science</li></ul>',
 experienceRequirements:'2 years',educationRequirements:'Bachelor degree',validThrough:'2099-01-30T23:59:00+05:30',
 baseSalary:{currency:'INR',value:{minValue:500000,maxValue:900000,unitText:'YEAR'}},
};
const html=j=>`<html><script type="application/ld+json">${JSON.stringify(j)}</script><body><h1>Careers</h1></body></html>`;
test('imports structured data, preserving source and review requirement',()=>{
 const {job}=extractJob(html({'@graph':[record]}),url);
 assert.equal(job.title,'Software Engineer');assert.equal(job.company,'Example Ltd');assert.equal(job.region,'India');
 assert.equal(job.salary,'INR 500000–900000 / YEAR');assert.equal(job.deadline,'2099-01-30');
 assert.equal(job.status,'draft');assert.equal(job.reviewed,false);assert.equal(job.url,url);assert.equal(job.requirements.length,2);
 assert.equal(input.safeParse(job).success,true);
 assert.throws(()=>canPublish({...job,status:'published'}),/Confirm/);
});
test('flags expired openings and preserves remote eligibility',()=>{
 const {job,warnings}=extractJob(html({...record,validThrough:'2000-01-01',jobLocationType:'TELECOMMUTE',applicantLocationRequirements:{name:'Canada'}}),url);
 assert.equal(job.location,'Remote — Canada');assert.equal(job.region,'Americas');assert.ok(warnings.some(w=>w.includes('deadline has passed')));
});
test('rejects multiple distinct jobs instead of picking one silently',()=>{
 assert.throws(()=>extractJob(html([record,{...record,title:'Different job'}]),url),/multiple openings/);
});
test('supports labeled pasted descriptions without inventing salary or eligibility',()=>{
 const result=extractJob('Job title: Analyst\nCompany: Example\nLocation: Hyderabad, India\nWork with the operations team to analyze reports and prepare accurate performance summaries every week.',url,true);
 assert.equal(result.job.company,'Example');assert.equal(result.job.title,'Analyst');assert.equal(result.job.salary,'Not disclosed');
 assert.equal(result.job.education,'Not specified');assert.equal(result.job.requirements.length,0);assert.ok(result.warnings.some(w=>w.includes('eligibility')));
});
test('removes script contents and treats external instructions as text',()=>{
 const {job}=extractJob(html({...record,description:record.description+'<script>alert("secret")</script>'}),url);
 assert.ok(!job.details.includes('alert'));assert.ok(!job.details.includes('<script'));
});
test('rejects blocked pages with actionable fallback',()=>{
 assert.throws(()=>extractJob('<body>Access denied. Verify you are human. This website requires a browser and is currently blocking automated access to this job.</body>',url),/blocks automatic/);
});
test('rejects non-public and credential-bearing targets, including mapped IPv6',()=>{
 for(const address of ['127.0.0.1','10.0.0.1','169.254.169.254','192.168.1.1','::1','::ffff:127.0.0.1','fc00::1','fe80::1','0.0.0.0'])assert.equal(publicAddress(address),false,address);
 assert.equal(publicAddress('8.8.8.8'),true);
 for(const target of ['http://example.org','https://localhost','https://127.1','https://[::1]','https://example.org:444/','https://user:pass@example.org'])assert.throws(()=>sourceUrl(target),target);
});
test('network fetch refuses local IP without making a request',async()=>{
 await assert.rejects(fetchJobPage('https://169.254.169.254/'),/publicly accessible/);
});
