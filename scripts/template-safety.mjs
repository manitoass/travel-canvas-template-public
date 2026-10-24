import {readFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
const base=resolve(import.meta.dirname,'..');
const text=(f)=>readFileSync(join(base,f),'utf8');
const fail=(s)=>{console.error('Template safety FAILED:',s);process.exitCode=1;};
const check=(ok,s)=>{if(!ok)fail(s);};
const pkg=JSON.parse(text('package.json'));
const wrangler=JSON.parse(text('wrangler.jsonc'));
const db=wrangler.d1_databases?.[0];
check(wrangler.d1_databases?.length===1&&db?.binding==='DB','Exactly one D1 DB binding required');
check(db?.database_name==='travel-canvas-personal-db','Use template D1 default name');
check(!db?.database_id,'D1 ID must be unconfigured so Cloudflare auto-provisions, not bound to a prior user database');
check(wrangler.assets?.run_worker_first===true,'All assets must pass Worker authentication');
check(wrangler.assets?.binding==='ASSETS','Authenticated static asset fetch must be available');
check(wrangler.preview_urls===false,'Unmanaged preview URLs must not be enabled');
check(pkg.scripts.build.includes('engine:compile')&&pkg.scripts.build.includes('npm test')&&pkg.scripts.build.includes('check:types')&&pkg.scripts.build.includes('build:assets'),
 'Build must first compile engine then run tests/types before producing public site');
check(pkg.scripts.deploy==='wrangler deploy','Deploy must use Wrangler (do not bypass build gate)');
check(pkg.scripts['engine:compile']==='tsc -p tsconfig.engine.json','Parity engine compiled from source');
check(existsSync(join(base,'dist/package.json'))&&JSON.parse(text('dist/package.json')).type==='commonjs','Legacy Node parity harness requires CJS engine');
check(!existsSync(join(base,'.env'))&&!existsSync(join(base,'.dev.vars')),'Real account secrets cannot be shipped');
check(!existsSync(join(base,'site'))||existsSync(join(base,'site/index.html')),'No half-built production site');
check(!text('src/cloud/access.mjs').includes('const owner="')&&text('src/cloud/access.mjs').includes('ACCESS_OWNER_EMAIL'),
 'A personal email must not be hardcoded into public code');
const doc=text('README.md');
check(!doc.includes('PASTE_YOUR_D1_DATABASE_ID_HERE'),'Old manual database configuration is forbidden');
if(!process.exitCode)console.log('One-click template safety: PASS (source checks, not a live Cloudflare build)');
