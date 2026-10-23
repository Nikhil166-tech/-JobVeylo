import test from 'node:test';
import assert from 'node:assert/strict';
import {randomToken,tokenHash,validSessionToken,cookieValue,secureCookie,sessionCookie} from '../lib/auth-crypto.ts';

test('owner session tokens have 256 bits of randomness and are stored by hash',async()=>{
 const a=randomToken(),b=randomToken();
 assert.ok(validSessionToken(a));assert.ok(validSessionToken(b));assert.notEqual(a,b);
 assert.notEqual(await tokenHash(a),a);assert.equal(await tokenHash(a),await tokenHash(a));
 for(const bad of ['',a+'x',a.toUpperCase(),'a'.repeat(63),'../admin'])assert.equal(validSessionToken(bad),false);
});

test('owner cookies enforce HTTPS and reject malformed or oversized values',()=>{
 const value='{"state":"example"}';
 const cookie=secureCookie(sessionCookie,value,600);
 assert.match(cookie,/^__Host-jv_session=/);assert.match(cookie,/Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=600$/);
 assert.equal(cookieValue(new Request('https://example.org',{headers:{cookie}}),sessionCookie),value);
 for(const raw of ['__Host-jv_session=%zz','__Host-jv_session='+'x'.repeat(4001),'prefix__Host-jv_session=test'])assert.equal(cookieValue(new Request('https://example.org',{headers:{cookie:raw}}),sessionCookie),'');
});
