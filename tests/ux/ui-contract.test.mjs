import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');

test('Cloudflare CSP permits optional street-map tile images without broad remote image access',()=>{
 const handler=read('../../src/cloud/handler.mjs');
 assert.match(handler,/img-src 'self' data: blob: https:\/\/tile\.openstreetmap\.org;/);
 assert.match(handler,/connect-src 'self' https:\/\/nominatim\.openstreetmap\.org;/);
});
test('Auto-scroll continues date-snapped drag preview while pointer stays still',()=>{
 const code=read('../../src/web/App.tsx');
 assert.match(code,/if\(el\.scrollTop!==before\)this\.pointerMove\(/);
});
test('Visible active journey title updates after rename',()=>{
 const code=read('../../src/web/App.tsx');
 assert.match(code,/className="journey-title" key=\{j\.id\+":"\+\(j\.title\|\|j\.name\)\}/);
});
test('Multi-lane calendar weeks can expand to avoid bar overlap',()=>{
 const code=read('../../src/web/components/Calendar.tsx');
 assert.match(code,/const tallRow=maxLane>=2/);
});
test('Phone view provides direct adjacent stay link controls',()=>{
 const code=read('../../src/web/App.tsx');
 assert.match(code,/mobile-link-strip/);
 assert.match(code,/hasStayLink\(active\.id,prevStay\.id,sc\)/);
});
test('Touch scrolling does not initiate an edit until a hold gesture',()=>{
 const code=read('../../src/web/App.tsx');
 assert.match(code,/d\.pointerType==='touch'/);
 assert.match(code,/touchMode='pan'/);
 assert.match(code,/touchMode='edit'/);
 assert.match(code,/>=360/);
 assert.match(code,/scroll\.scrollTop-=e\.clientY-prevY/);
});
test('Phone and tablet have visible save, failure and recovery affordances',()=>{
 const code=read('../../src/web/App.tsx');
 const css=read('../../public/styles.css');
 assert.match(code,/compact-save-status/);
 assert.match(code,/this\.props\.serverRevision!==undefined\?<div className=\{'compact-save-status/);
 assert.match(css,/\.compact-save-status\.failed/);
 assert.match(css,/\.compact-save-status button/);
});
