// Cloudflare Access JWT verification: fail closed if Access is not configured.
// Static Assets currently do not expose ctx.access, even when a Worker runs first.
// Verify the signed assertion rather than trusting unverified email headers/cookies.
export class AccessError extends Error {
  constructor(status,message){super(message);this.status=status;}
}
const encoder=new TextEncoder();
const keys=new Map();
function decode64url(value){
  if(typeof value!=='string'||!value||!/^[-_A-Za-z0-9]+$/.test(value))throw new AccessError(401,'Invalid identity token');
  const binary=atob(value.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(value.length/4)*4,'='));
  return Uint8Array.from(binary,c=>c.charCodeAt(0));
}
function claimJSON(encoded){
  let parsed;try{parsed=JSON.parse(new TextDecoder().decode(decode64url(encoded)));}catch{throw new AccessError(401,'Invalid identity token');}
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new AccessError(401,'Invalid identity token');
  return parsed;
}
function settings(env){
  const host=String(env.ACCESS_TEAM_DOMAIN||'').trim().toLowerCase();
  const aud=String(env.ACCESS_AUD||'').trim();
  const owner=String(env.ACCESS_OWNER_EMAIL||'').trim().toLowerCase();
  if(!/^[a-z0-9][a-z0-9-]*\.cloudflareaccess\.com$/.test(host)||aud.length<8||aud.length>256||!owner.includes('@'))
    throw new AccessError(503,'Access is not fully configured; this workspace is locked.');
  return {host,aud,owner,issuer:'https://'+host};
}
async function keyFor(host,kid,fetchFn){
  const cached=keys.get(host);
  if(cached&&cached.expires>Date.now()&&cached.keys.has(kid))return cached.keys.get(kid);
  const response=await fetchFn(`https://${host}/cdn-cgi/access/certs`,{headers:{Accept:'application/json'}});
  if(!response.ok)throw new AccessError(503,'Cannot verify Cloudflare Access identity right now.');
  const body=await response.json();
  if(!Array.isArray(body.keys)||body.keys.length>40)throw new AccessError(503,'Cloudflare Access keys were unavailable.');
  const all=new Map();
  for(const jwk of body.keys){
    if(jwk.kty!=='RSA'||jwk.alg&&jwk.alg!=='RS256'||!jwk.kid||!jwk.n||!jwk.e)continue;
    all.set(jwk.kid,await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']));
  }
  keys.set(host,{keys:all,expires:Date.now()+10*60*1000});
  if(!all.has(kid))throw new AccessError(401,'Identity signing key not recognized.');
  return all.get(kid);
}
export async function verifiedOwner(request,env,fetchFn=fetch){
  const cfg=settings(env);
  const token=request.headers.get('Cf-Access-Jwt-Assertion')||'';
  if(token.length>12000||token.length<30)throw new AccessError(401,'Cloudflare Access sign-in required.');
  const parts=token.split('.');
  if(parts.length!==3)throw new AccessError(401,'Invalid identity token');
  const header=claimJSON(parts[0]);
  if(header.alg!=='RS256'||typeof header.kid!=='string'||header.kid.length>256)throw new AccessError(401,'Unsupported identity token');
  const claims=claimJSON(parts[1]);
  const now=Math.floor(Date.now()/1000);
  if(claims.iss!==cfg.issuer||!(Array.isArray(claims.aud)?claims.aud:[claims.aud]).includes(cfg.aud)||
    !Number.isFinite(claims.exp)||claims.exp<=now||
    claims.nbf!==undefined&&(!Number.isFinite(claims.nbf)||claims.nbf>now+30)||
    claims.iat!==undefined&&(!Number.isFinite(claims.iat)||claims.iat>now+30))
    throw new AccessError(401,'Identity token expired or belongs to another application.');
  const key=await keyFor(cfg.host,header.kid,fetchFn);
  const signed=encoder.encode(parts[0]+'.'+parts[1]);
  const valid=await crypto.subtle.verify({name:'RSASSA-PKCS1-v1_5'},key,decode64url(parts[2]),signed);
  if(!valid)throw new AccessError(401,'Identity signature invalid.');
  if(String(claims.email||'').toLowerCase()!==cfg.owner)throw new AccessError(403,'This account has not been added as the Travel Canvas owner.');
  return {email:cfg.owner};
}
export function resetAccessKeyCache(){keys.clear();}
