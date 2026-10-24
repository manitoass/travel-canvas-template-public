import {copyFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
mkdirSync('site',{recursive:true});
for(const file of ['styles.css','world.js','cities.json']){
 const source=join('public',file);
 if(!existsSync(source))throw Error('Missing production asset: '+file);
 copyFileSync(source,join('site',file));
}
console.log('Copied required data and static assets; legacy React 16 is NOT part of the cloud build.');
