import test from 'node:test';
import assert from 'node:assert/strict';
import {extractResumeContact,safeResumeLink,redactResumeContact} from '../lib/resume-contact.ts';
const source=`ALEX MORGAN
Software Engineer
Bengaluru, Karnataka, India
alex.morgan@example.org | +91 98765 43210
linkedin.com/in/alex-morgan | github.com/alex-morgan
PROFESSIONAL SUMMARY
Built Python APIs and tested PostgreSQL integrations.
WORK EXPERIENCE
Engineer | Example Company
Jul 2024 - Jun 2026
- Improved API reliability with automated tests.
EDUCATION
Example Institute | 2020 - 2024`;

test('extracts header contacts and deduplicates embedded social links without losing career dates',()=>{
 const result=extractResumeContact(source,['https://www.linkedin.com/in/alex-morgan/','https://github.com/alex-morgan','https://portfolio.example.org','https://instagram.com/alexmorgan']);
 assert.equal(result.contact.name,'ALEX MORGAN');assert.equal(result.contact.headline,'Software Engineer');assert.equal(result.contact.location,'Bengaluru, Karnataka, India');
 assert.equal(result.contact.email,'alex.morgan@example.org');assert.equal(result.contact.phone,'+91 98765 43210');assert.equal(result.links.length,4);
 assert.ok(!result.bodyText.includes('ALEX MORGAN'));assert.ok(!result.bodyText.includes('alex.morgan@example.org'));assert.ok(result.bodyText.includes('Jul 2024 - Jun 2026'));
 assert.ok(result.bodyText.includes('2020 - 2024'));assert.equal(result.warnings.length,0);
});

test('uses mailto and tel relationships while refusing unsafe external link schemes',()=>{
 const result=extractResumeContact('Name: Zoë van Dijk\nEducation\nExample Institute\n2020 - 2024',['mailto:zoe@example.org?subject=Hello','tel:+12025550147','javascript:alert(1)','file:///private/key','https://example.org/my%20portfolio']);
 assert.equal(result.contact.name,'Zoë van Dijk');assert.equal(result.contact.email,'zoe@example.org');assert.equal(result.contact.phone,'+12025550147');assert.equal(result.links.length,1);
 assert.equal(safeResumeLink('https://user:pass@example.org/profile'),'');assert.equal(safeResumeLink('data:text/plain,secret'),'');assert.equal(safeResumeLink('https://example.org/my%20portfolio'),'https://example.org/my%20portfolio');
});

test('does not invent names, turn years into phones or treat technology names as profile links',()=>{
 const result=extractResumeContact('Built Python services with React.js and ASP.NET.\nExperience\nEngineer | Example Company\n2020 - 2024\nEducation\nGrade: 7.1/10');
 assert.equal(result.contact.name,'');assert.equal(result.contact.phone,'');assert.equal(result.links.length,0);assert.ok(result.warnings.length>0);
});

test('redacts personal contacts and bare social URLs while preserving dates and metrics',()=>{
 const result=extractResumeContact(source);
 const cleaned=redactResumeContact(source,result.contact);
 assert.ok(!cleaned.includes('ALEX MORGAN'));assert.ok(!cleaned.includes('alex.morgan@example.org'));assert.ok(!cleaned.includes('98765'));
 assert.ok(!cleaned.includes('linkedin.com'));assert.ok(!cleaned.includes('github.com'));assert.ok(cleaned.includes('Jul 2024 - Jun 2026'));assert.ok(cleaned.includes('2020 - 2024'));
});

test('does not remove unlabelled career facts as guessed names or locations',()=>{
 const body='Application Tracker\nBuilt Go services, tested Docker deployments and documented APIs.';
 const result=extractResumeContact(body);assert.equal(result.contact.name,'');assert.equal(result.contact.location,'');assert.equal(result.bodyText,body);
 const roles=extractResumeContact('Software Engineer\nExample Company\nJul 2024 - Jun 2026\nBuilt Go services, tested Docker deployments.');assert.equal(roles.contact.name,'');assert.ok(roles.bodyText.includes('Example Company'));
});
