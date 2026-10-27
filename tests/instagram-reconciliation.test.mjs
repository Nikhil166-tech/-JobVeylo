import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileInstagram} from '../lib/instagram-reconciliation.ts';

function fixture({state='PUBLISHED',caption='https://example.com/jobs/role?utm_source=instagram',duplicates=false,fail=false}={}){
 const writes=[],requests=[];
 const env={SITE_URL:'https://example.com',INSTAGRAM_ACCESS_TOKEN:'private-token',INSTAGRAM_ACCOUNT_ID:'123',REEL_MEDIA:{},DB:{prepare(sql){let values;return {bind(...v){values=v;return this},async all(){return {results:[{listing_id:'role',container_id:'456'}]}},async run(){writes.push({sql,values})}}}}};
 const fetcher=async(url,init)=>{
  requests.push(url);assert.notEqual(init.method,'POST');assert.equal(init.redirect,'manual');
  if(url.includes('fields=id,username'))return Response.json({id:'123',username:'jobveylo'});
  if(fail)throw Error('private-token');
  if(url.includes('/media?')){const item={id:'789',caption,timestamp:'2026-10-27T07:35:00Z'};return Response.json({data:duplicates?[item,{...item,id:'790'}]:[item]})}
  return Response.json({status_code:state});
 };return {env,writes,requests,fetcher};
}
test('only published container plus one exact own-job URL confirms a held post',async()=>{
 const f=fixture();const result=await reconcileInstagram(f.env,f.fetcher);assert.equal(result.confirmed,1);assert.equal(f.writes.length,1);assert.equal(f.writes[0].values[0],'789');assert.equal(f.requests.length,3);
});
test('unfinished, expired or failed containers are never republished or marked sent',async()=>{
 for(const state of ['FINISHED','IN_PROGRESS','ERROR','EXPIRED']){const f=fixture({state});assert.equal((await reconcileInstagram(f.env,f.fetcher)).confirmed,0);assert.equal(f.writes.length,0)}
});
test('wrong host, partial job ID and duplicate matches cannot confirm delivery',async()=>{
 for(const options of [{caption:'https://wrong.example/jobs/role'},{caption:'https://example.com/jobs/role-extra'},{duplicates:true}]){const f=fixture(options);assert.equal((await reconcileInstagram(f.env,f.fetcher)).confirmed,0);assert.equal(f.writes.length,0)}
});
test('read failures leave holds intact and do not disclose provider errors or credentials',async()=>{
 const f=fixture({fail:true});const result=await reconcileInstagram(f.env,f.fetcher);assert.equal(f.writes.length,0);assert.equal(JSON.stringify(result).includes('private-token'),false);
});
