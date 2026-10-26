import test from 'node:test';
import assert from 'node:assert/strict';
import {campaignLink} from '../lib/traffic-links.ts';
test('campaign links retain the job route and distinguish source and content',()=>{
 const instagram=new URL(campaignLink('https://jobveylo.jobveylo.workers.dev','/jobs/example','instagram','job_reel','example'));
 assert.equal(instagram.pathname,'/jobs/example');assert.equal(instagram.searchParams.get('utm_source'),'instagram');assert.equal(instagram.searchParams.get('utm_medium'),'social');assert.equal(instagram.searchParams.get('utm_content'),'example');
 const shared=new URL(campaignLink(instagram.origin,'/jobs/example','share','job_share','example'));assert.equal(shared.searchParams.get('utm_medium'),'referral');
 assert.equal(new URL(campaignLink(instagram.origin,'/','whatsapp','channel')).searchParams.get('utm_source'),'whatsapp');
});
