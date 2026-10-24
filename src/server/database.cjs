'use strict';
/* Production: better-sqlite3. Local regression testing can explicitly request
   Node's built-in sqlite adapter until the native dependency is installed.
   The fallback is deliberately forbidden in NODE_ENV=production. */
const builtinRequested=process.env.TRAVEL_CANVAS_SQLITE_TEST_DRIVER==='node';
if(builtinRequested && process.env.NODE_ENV==='production')throw Error('Built-in SQLite test driver is forbidden in production');
if(builtinRequested){
 module.exports=require('node:sqlite');
}else{
 const Better=require('better-sqlite3');
 class DatabaseSync {
  constructor(file,options={}){
   this.inner=new Better(file,{readonly:!!options.readOnly,fileMustExist:!!options.readOnly,timeout:5000});
  }
  exec(sql){return this.inner.exec(sql);}
  prepare(sql){return this.inner.prepare(sql);}
  close(){return this.inner.close();}
 }
 async function backup(db,target){return db.inner.backup(target);}
 module.exports={DatabaseSync,backup};
}
