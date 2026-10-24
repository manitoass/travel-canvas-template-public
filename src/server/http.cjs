'use strict';
// Travel Canvas NAS release candidate: explicit LAN and HTTPS origins only.
// The public Funnel must remain DISABLED until installation tests pass.
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const {makeStore,ApiError}=require('./store.cjs');
const {counts}=require('./validation.cjs');
const {migrateAuth,createAuth}=require('./auth.cjs');
const project=path.resolve(__dirname,'../..');
const publicDir=path.resolve(process.env.TRAVEL_CANVAS_WEB_DIR||path.join(project,'public'));
const SEED=JSON.parse(fs.readFileSync(path.join(publicDir,'seed.json'),'utf8'));
const STATIC=new Set(['index.html','styles.css','world.js','seed.json','cities.json','server-mode.js']);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
const isLocalIP=ip=>['127.0.0.1','::1','::ffff:127.0.0.1'].includes(ip);
function json(res,status,data,extra={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra});res.end(JSON.stringify(data));}
function readJSON(req,maxBytes=4*1024*1024){return new Promise((resolve,reject)=>{let size=0,text='',done=false;req.on('data',c=>{if(done)return;size+=c.length;if(size>maxBytes){done=true;reject(new ApiError(413,'Request too large'));req.resume();return;}text+=c;});req.on('end',()=>{if(done)return;try{resolve(JSON.parse(text));}catch{reject(new ApiError(400,'Invalid JSON'));}});req.on('error',e=>{if(!done)reject(e);});});}
function safeFile(url){
 let pathname;try{pathname=decodeURIComponent(new URL(url,'http://localhost').pathname);}catch{return null;}
 if(pathname==='/')pathname='/index.html';
 if(STATIC.has(pathname.slice(1)))return path.join(publicDir,pathname.slice(1));
 if(/^\/assets\/[a-zA-Z0-9/_\-.]+$/.test(pathname)){
  const target=path.resolve(publicDir,'.'+pathname);
  return target.startsWith(publicDir+path.sep)?target:null;
 }
 return null;
}
function cookie(token,secure=false){return `${secure?'__Host-tc_session':'tc_session'}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${secure?'; Secure':''}`;}
function clearCookie(secure=false){return `${secure?'__Host-tc_session':'tc_session'}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure?'; Secure':''}`;}
function createApp({dir=process.env.TRAVEL_CANVAS_DATA_DIR||path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'.local','share'),'TravelCanvas','data'),host=process.env.TRAVEL_CANVAS_HOST||'127.0.0.1',port=Number(process.env.TRAVEL_CANVAS_PORT||3133),backupInterval=24*3600*1000}={}){
 const nasMode=process.env.TRAVEL_CANVAS_NETWORK_MODE==='nas';
 const lanOrigin=process.env.TRAVEL_CANVAS_LAN_ORIGIN||'';
 const publicOrigin=process.env.TRAVEL_CANVAS_PUBLIC_ORIGIN||'';
 const parseOrigin=(value,name)=>{if(!value)return null;let parsed;try{parsed=new URL(value);}catch{throw Error(name+' must be a full URL');}
  if(parsed.pathname!=='/'||parsed.search||parsed.hash||parsed.username||parsed.password)throw Error(name+' must be only a scheme, hostname, and optional port');
  return parsed;
 };
 const lan=parseOrigin(lanOrigin,'TRAVEL_CANVAS_LAN_ORIGIN'),pub=parseOrigin(publicOrigin,'TRAVEL_CANVAS_PUBLIC_ORIGIN');
 if(!nasMode && !['127.0.0.1','::1','localhost'].includes(host))throw Error('Refusing network binding without the NAS deployment opt-in.');
 if(nasMode && (!lan||lan.protocol!=='http:'||host!=='0.0.0.0'))throw Error('NAS mode requires TRAVEL_CANVAS_HOST=0.0.0.0 and a specific http://NAS-IP:port LAN origin.');
 if(pub && (pub.protocol!=='https:'||!nasMode))throw Error('Public origin must be HTTPS and requires NAS mode.');
 const origins=new Set([...(lan?[lan.origin]:[]),...(pub?[pub.origin]:[])]);
 const hosts=new Set([...(lan?[lan.host.toLowerCase()]:[]),...(pub?[pub.host.toLowerCase()]:[])]);

 const store=makeStore(dir,SEED);
 let auth=null,timer=null,ready=false,closed=false;
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy','same-origin');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://nominatim.openstreetmap.org; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  try{
   if(!ready||!auth)throw new ApiError(503,'Application is starting');
   const hostHeader=String(req.headers.host||'');
   let hostName='';try{hostName=new URL('http://'+hostHeader).hostname.toLowerCase();}catch{}
   const isLoopbackHost=['127.0.0.1','localhost','[::1]'].includes(hostName);
   const requestedHost=hostHeader.toLowerCase();
   if(!(isLoopbackHost||hosts.has(requestedHost)))throw new ApiError(403,'Untrusted Host header');
   const publicRequest=!!pub&&requestedHost===pub.host.toLowerCase();
   const secureCookie=publicRequest;
   if(publicRequest)res.setHeader('Strict-Transport-Security','max-age=31536000');
   const u=new URL(req.url||'/',`http://${hostHeader}`),method=req.method||'GET';
   if(method!=='GET'&&method!=='POST'&&method!=='HEAD')throw new ApiError(405,'Unsupported method');
   if(method==='POST'){
    if(req.headers['sec-fetch-site']==='cross-site')throw new ApiError(403,'Cross-site request blocked');
    if(req.headers.origin){let origin;try{origin=new URL(req.headers.origin);}catch{throw new ApiError(403,'Invalid origin');}
      const expected=publicRequest?pub.origin:(lan&&requestedHost===lan.host.toLowerCase()?lan.origin:`http://${hostHeader}`);
      if(origin.origin!==expected)throw new ApiError(403,'Cross-origin request blocked');}
    if(!/^application\/json(?:\s*;|$)/i.test(String(req.headers['content-type']||'')))throw new ApiError(415,'JSON required');
   }
   if(u.pathname.startsWith('/api/')){
    if(method==='GET'&&u.pathname==='/api/health')return json(res,200,{ok:store.checkIntegrity()});
    if(method==='GET'&&u.pathname==='/api/auth/session'){
      const session=auth.readSession(req);
      return json(res,200,{authenticated:!!session,needsSetup:!auth.ownerExists(),username:session?'Owner':null,csrfToken:session?.csrf||null});
    }
    if(method==='POST'&&u.pathname==='/api/auth/setup'){
      // Initial owner creation is permitted via the LAN URL only, and still requires
      // the random token printed inside the app container. Never allow setup via Funnel.
      if(publicRequest||(!isLocalIP(req.socket.remoteAddress)&&!(nasMode&&!!lan&&requestedHost===lan.host.toLowerCase())))throw new ApiError(403,'Owner setup only from the private LAN address');
      const p=await readJSON(req,4096),codes=await auth.setup(p.token,p.password,req.socket.remoteAddress||'');
      const login=await auth.login(p.password,req.socket.remoteAddress||'');
      return json(res,201,{authenticated:true,csrfToken:login.csrf,recoveryCodes:codes},{'Set-Cookie':cookie(login.token,secureCookie)});
    }
    if(method==='POST'&&u.pathname==='/api/auth/login'){
      const p=await readJSON(req,4096),login=await auth.login(p.password,req.socket.remoteAddress||'');
      return json(res,200,{authenticated:true,csrfToken:login.csrf},{'Set-Cookie':cookie(login.token,secureCookie)});
    }
    if(method==='POST'&&u.pathname==='/api/auth/recover'){
      const p=await readJSON(req,4096);await auth.restorePassword(p.code,p.password,req.socket.remoteAddress||'');
      return json(res,200,{ok:true,message:'Password reset. Please sign in.'},{'Set-Cookie':clearCookie(secureCookie)});
    }
    const session=auth.requireSession(req);
    if(method==='POST')auth.requireCSRF(req,session);
    if(method==='POST'&&u.pathname==='/api/auth/logout'){auth.logout(session);return json(res,200,{ok:true},{'Set-Cookie':clearCookie(secureCookie)});}
    if(method==='GET'&&u.pathname==='/api/state')return json(res,200,store.state());
    if(method==='GET'&&u.pathname==='/api/export')return json(res,200,{format:'travel-canvas-prototype',version:1,exportedAt:new Date().toISOString(),state:store.state().state});
    if(method==='GET'&&u.pathname==='/api/backups')return json(res,200,{backups:store.listBackups(),latest:store.latestBackup(),offsite:store.offsiteStatus()});
    if(method==='GET'&&u.pathname==='/api/system/status')return json(res,200,{application:'Travel Canvas NAS RC1',revision:store.state().revision,healthy:store.checkIntegrity(),latestBackup:store.latestBackup(),offsite:store.offsiteStatus(),authenticated:true,publicAccess:!!pub});
    if(method==='POST'&&u.pathname==='/api/import/preview')return json(res,200,store.importPreview(await readJSON(req)));
    if(method==='POST'&&u.pathname==='/api/operations'){
      const p=await readJSON(req);if(p.type==='import')await store.makeBackup('pre-import');return json(res,200,store.applyMutation(p));
    }
    if(method==='POST'&&u.pathname==='/api/backup')return json(res,201,await store.makeBackup('manual'));
    if(method==='POST'&&u.pathname==='/api/restore/preview'){
      const p=await readJSON(req,4096),snapshot=store.snapshot(p.filename);
      return json(res,200,{filename:snapshot.filename,backupRevision:snapshot.revision,createdAt:snapshot.createdAt,counts:counts(snapshot.state),currentRevision:store.state().revision});
    }
    if(method==='POST'&&u.pathname==='/api/restore/commit'){
      const p=await readJSON(req,4096);
      if(!await auth.verifyCurrentPassword(p.password))throw new ApiError(403,'Current password required to restore');
      store.snapshot(p.filename); // verify FIRST; damaged backup never causes a pre-restore overwrite
      if(p.baseRevision!==store.state().revision)throw new ApiError(409,'Plans changed since preview; reload first');
      await store.makeBackup('pre-restore');
      return json(res,200,store.restoreSnapshot(p.filename,p.baseRevision,p.operationId));
    }
    return json(res,404,{error:'API endpoint not found'});
   }
   if(method!=='GET'&&method!=='HEAD')throw new ApiError(405,'Method not allowed');
   const file=safeFile(req.url||'/');if(!file||!fs.existsSync(file)||!fs.statSync(file).isFile())return json(res,404,{error:'File not found'});
   const type=mime[path.extname(file)]||'application/octet-stream';
   res.writeHead(200,{'Content-Type':type,'Cache-Control':type.startsWith('text/html')||file.endsWith('server-mode.js')?'no-store':'public, max-age=3600'});
   if(method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
  }catch(e){
   if(!res.headersSent){const status=Number.isInteger(e.status)?e.status:500;
    if(status>=500)console.error('Server error:',e.stack||e.message);
    json(res,status,{error:status>=500?'An internal error occurred; no changes were saved.':e.message,...(status<500?e.extra||{}:{})});
   }else res.destroy();
  }
 });
 async function listen(){
  if(closed)throw new Error('Application already closed');
  if(!store.checkIntegrity())throw new Error('SQLite integrity check failed');
  const version=store.db.prepare('SELECT MAX(version) AS v FROM schema_migrations').get().v||1;
  if(version<2)await store.makeBackup('pre-m4-upgrade');
  migrateAuth(store.db);auth=createAuth(store,dir);
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
  ready=true;
  if(!auth.ownerExists()){
   const setupPath=auth.setupTokenHint();
   console.log('\nFIRST RUN - Travel Canvas owner setup code: '+fs.readFileSync(setupPath,'utf8').trim()+'\nThis code is only for initial setup on this computer.');
  }
  if(backupInterval>0){
   const last=store.latestBackup();if(!last||Date.now()-new Date(last.createdAt).getTime()>=backupInterval)try{await store.makeBackup('startup');}catch(e){console.error('Startup backup failed:',e.message);}
   timer=setInterval(async()=>{try{await store.makeBackup('daily');}catch(e){console.error('Scheduled backup failed:',e.message);}},backupInterval);timer.unref();
  }
  return server.address();
 }
 async function close(){closed=true;ready=false;if(timer)clearInterval(timer);if(server.listening)await new Promise(r=>server.close(r));store.close();}
 return {listen,close,server,store,get auth(){return auth;}};
}
if(require.main===module){const app=createApp();app.listen().then(a=>console.log(`Travel Canvas ready on ${a.address}:${a.port}; Funnel is separately controlled and must remain OFF until verified.`)).catch(e=>{console.error(e);process.exitCode=1;});}
module.exports={createApp};
