'use strict';
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const sourcePath=path.join(__dirname,'../legacy/app.js');
const startup="setupEvents();renderAll();renderSearchResults();fitMap('leg');";
/** Executes the ACTUAL frozen v0.9 app.js inside its original closure with
 * only the DOM bootstrap disabled. Does not transcribe/reimplement its rules.
 */
function createLegacy(state=null){
  let source=fs.readFileSync(sourcePath,'utf8');
  if(source.split(startup).length!==2)throw Error('v0.9 startup changed; abort fixture extraction');
  source=source.replace(startup,'');
  const closing=/\}\)\(\);\s*$/;
  if(!closing.test(source))throw Error('Missing v0.9 source wrapper');
  source=source.replace(closing,`window.LegacyBridge={
    getState:()=>clone(state),
    setState:(s)=>{state=clone(s);ensureStayColors();},
    seedState, ensureStayColors, currentJourney, currentLeg, currentScenario,
    analyzeEdit, analyzeLegMove, computeOperation, overlapPairs,
    hasStayLink, linkedComponent, epoch,add,days,
    moveStayToIdeas, attemptInsertStay
  };})();`);
  const ctx={window:{},localStorage:{getItem:()=>null},console,Date,Math};
  vm.runInNewContext(source,ctx,{filename:'legacy/v0.9/app.js',timeout:5000});
  const bridge=ctx.window.LegacyBridge;
  if(state)bridge.setState(state);
  return bridge;
}
/** Normalize cross-realm arrays/prototypes, leave the actual values intact. */
const native =obj=>JSON.parse(JSON.stringify(obj));
module.exports={createLegacy,native,sourcePath};
