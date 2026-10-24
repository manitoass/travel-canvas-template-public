'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createApp}=require('../../src/server/http.cjs');const http=require('node:http');
test('NAS LAN origin and public Funnel hostname have separate cookie security',async()=>{
 const envKeys=['TRAVEL_CANVAS_NETWORK_MODE','TRAVEL_CANVAS_LAN_ORIGIN','TRAVEL_CANVAS_PUBLIC_ORIGIN'];
 const env=Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tc-nas-origins-'));let app;
 try{
  process.env.TRAVEL_CANVAS_NETWORK_MODE='nas';
  process.env.TRAVEL_CANVAS_LAN_ORIGIN='http://192.168.88.50:33133';
  process.env.TRAVEL_CANVAS_PUBLIC_ORIGIN='https://travel-canvas.example.ts.net';
  app=createApp({host:'0.0.0.0',port:0,dir,backupInterval:0});
  const address=await app.listen(),url='http://127.0.0.1:'+address.port;
  const fetchAs=async(route,host,origin,body)=>new Promise((resolve,reject)=>{
   const payload=body?JSON.stringify(body):'';
   const r=http.request(url+route,{method:body?'POST':'GET',headers:{Host:host,...(origin?{Origin:origin}:{}),...(body?{'Content-Type':'application/json'}:{})}},response=>{let bytes='';response.on('data',b=>bytes+=b);response.on('end',()=>resolve(new Response(bytes,{status:response.statusCode,headers:response.headers})));});
   r.on('error',reject);r.end(payload);
  });
  const token=fs.readFileSync(path.join(dir,'owner-setup-token.txt'),'utf8').trim();
  const invalid=await fetchAs('/api/auth/setup','travel-canvas.example.ts.net','https://travel-canvas.example.ts.net',{token,password:'A long and secure example passphrase'});
  assert.equal(invalid.status,403,'Funnel must not create owner account');
  const created=await fetchAs('/api/auth/setup','192.168.88.50:33133','http://192.168.88.50:33133',{token,password:'A long and secure example passphrase'});
  assert.equal(created.status,201,await created.text());
  assert.match(created.headers.get('set-cookie'),/^tc_session=[0-9a-f]+;/);
  assert.doesNotMatch(created.headers.get('set-cookie'),/; Secure/);
  const remote=await fetchAs('/api/auth/login','travel-canvas.example.ts.net','https://travel-canvas.example.ts.net',{password:'A long and secure example passphrase'});
  assert.equal(remote.status,200);
  assert.match(remote.headers.get('set-cookie'),/^__Host-tc_session=[0-9a-f]+;/);
  assert.match(remote.headers.get('set-cookie'),/; Secure/);
  assert.equal(remote.headers.get('strict-transport-security'),'max-age=31536000');
  assert.equal((await fetchAs('/api/auth/login','travel-canvas.example.ts.net','http://travel-canvas.example.ts.net',{password:'A long and secure example passphrase'})).status,403);
  assert.equal((await fetchAs('/api/state','evil.example.com')).status,403);
  const who=await fetch(url+'/api/state',{headers:{Host:'travel-canvas.example.ts.net',Cookie:remote.headers.get('set-cookie').split(';')[0]}});
  assert.equal(who.status,200);
 }finally{
  if(app)await app.close();fs.rmSync(dir,{recursive:true,force:true});
  for(const k of envKeys){if(env[k]===undefined)delete process.env[k];else process.env[k]=env[k];}
 }
});
test('network bind cannot be enabled without exact LAN origin',()=>{
 const keys=['TRAVEL_CANVAS_NETWORK_MODE','TRAVEL_CANVAS_LAN_ORIGIN','TRAVEL_CANVAS_PUBLIC_ORIGIN'];const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try{
  process.env.TRAVEL_CANVAS_NETWORK_MODE='nas';delete process.env.TRAVEL_CANVAS_LAN_ORIGIN;
  assert.throws(()=>createApp({host:'0.0.0.0'}),/NAS mode requires/);
 }finally{for(const k of keys){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
});
