import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';
import {publicAnalyticsPath,trafficSource,validMetric} from '../lib/visitor-metrics.ts';
test('metrics exclude private routes, queries and arbitrary fields',()=>{
 for(const path of ['/admin','/admin/login','/api/jobs','/auth/callback','/resume?email=private','https://other.test/','/jobs/../../admin'])assert.equal(publicAnalyticsPath(path),false);
 assert.equal(validMetric({path:'/resume',event:'page_view',source:'instagram',campaign:'bio'}),true);
 for(const bad of [{path:'/admin'},{source:'someone@example.com'},{campaign:'private text'},{email:'private@example.com'}])assert.equal(validMetric({path:'/resume',event:'page_view',source:'direct',campaign:'none',...bad}),false);
});
test('attribution strips private referrer details and respects tagged app links',()=>{
 assert.equal(trafficSource('whatsapp','','https://jobveylo.test'),'whatsapp');assert.equal(trafficSource(null,'https://l.instagram.com/path?private=yes','https://jobveylo.test'),'instagram');assert.equal(trafficSource(null,'https://jobveylo.test/jobs/example','https://jobveylo.test'),'internal');assert.equal(trafficSource(null,'https://google.com.evil.test/private','https://jobveylo.test'),'referral');
});
test('daily counters aggregate instead of saving individual visitor records',()=>{
 const db=new DatabaseSync(':memory:');db.exec(readFileSync('cloudflare/migrations/0006_visitor_metrics.sql','utf8'));const sql='INSERT INTO visitor_metrics(day,path,source,campaign,event,total) VALUES(?,?,?,?,?,1) ON CONFLICT(day,path,source,campaign,event) DO UPDATE SET total=MIN(total+1,100000)';
 for(let i=0;i<3;i++)db.prepare(sql).run('2026-10-26','/resume','instagram','bio','page_view');assert.equal(db.prepare('SELECT COUNT(*) AS n FROM visitor_metrics').get().n,1);assert.equal(db.prepare('SELECT total FROM visitor_metrics').get().total,3);db.close();
});
