import test from 'node:test';
import assert from 'node:assert/strict';
import {projectLinkPlacement} from '../lib/resume-link-layout.ts';
test('uses the original project row to bind demo and repository destinations',()=>{
 const row='Search Assistant | Python, FastAPI   Live Demo | Git Repo';
 assert.deepEqual(projectLinkPlacement(row,'https://example.org/demo','Live Demo',true),{url:'https://example.org/demo',label:'Live Demo',entry:'Search Assistant | Python, FastAPI',section:'Projects'});
 assert.equal(projectLinkPlacement(row,'https://example.org/demo','Live Demo',false),undefined);
 assert.equal(projectLinkPlacement('Unrelated paragraph','https://example.org/demo','Live Demo',true),undefined);
 assert.equal(projectLinkPlacement(row,'javascript:alert(1)','Live Demo',true),undefined);
});
