const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'ui/panel.html'), 'utf8');
const section = (start, end) => html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start)));
function setup() {
  const pending = [], deleted = [];
  const context = { console, scopeEl: {value:'chat'}, state: {activeCampaign:null},
    imageUrlEl: {value:''}, selectedImportedFile:null, importGeneration:0,
    resolveActiveCampaign:()=>null, setStatus:()=>{}, clearStatus:()=>{}, updatePickedImageUi:()=>{},
    deleteIfExists:async (name,scope)=>deleted.push({name,scope}),
    physicalFileScope:s=>s==='campaign'?'global':s, DEVICE_IMAGE_EXTENSIONS:['jpg'], MAX_IMAGE_BYTES:20*1024*1024,
    tavo:{file:{import:()=>new Promise(resolve=>pending.push(resolve))}}
  };
  vm.createContext(context);
  vm.runInContext(section('  async function discardSelectedImport()', '  function releaseSelectedImport()') +
    section('  async function chooseImageFromDevice()', '  async function saveImageUrl('), context);
  const file = name => [{name,path:`files/chat/${name}`,mimeType:'image/jpeg',size:100}];
  return {context,pending,deleted,file};
}
(async()=>{
  let x=setup(), operation=x.context.chooseImageFromDevice(); await Promise.resolve();
  x.context.scopeEl.value='global'; await x.context.discardSelectedImport();
  x.pending[0](x.file('old.jpg')); await operation;
  assert.strictEqual(x.context.selectedImportedFile,null,'Scope changes must invalidate pending imports.');
  assert.strictEqual(x.deleted[0]?.name,'files/chat/old.jpg','Late imports must be cleaned up in their original storage scope.');
  assert.strictEqual(x.deleted[0]?.scope,'chat');

  x=setup(); const first=x.context.chooseImageFromDevice(); await Promise.resolve();
  const second=x.context.chooseImageFromDevice(); await Promise.resolve();
  x.pending[1](x.file('new.jpg')); await second;
  x.pending[0](x.file('old.jpg')); await first;
  assert.strictEqual(x.context.selectedImportedFile.fileName,'new.jpg','An older picker result must not replace the newer selection.');
  assert.strictEqual(x.deleted[0]?.name,'files/chat/old.jpg');

  x=setup(); operation=x.context.chooseImageFromDevice(); await Promise.resolve();
  await x.context.discardSelectedImport(); x.pending[0](x.file('reset.jpg')); await operation;
  assert.strictEqual(x.context.selectedImportedFile,null,'Form reset must invalidate pending imports.');

  x=setup(); x.context.scopeEl.value='campaign';x.context.state.activeCampaign={id:'one'};
  operation=x.context.chooseImageFromDevice();await Promise.resolve();
  x.context.state.activeCampaign={id:'two'};x.pending[0](x.file('campaign.jpg'));await operation;
  assert.strictEqual(x.context.selectedImportedFile,null,'A result from another campaign must be discarded.');

  x=setup(); operation=x.context.chooseImageFromDevice();await Promise.resolve();
  x.pending[0](x.file('selected.jpg'));await operation;
  assert.strictEqual(x.context.selectedImportedFile.fileName,'selected.jpg');
  assert.strictEqual(x.deleted.length,0,'A current import must stay available for Save.');
  console.log('Visual Library pending image import tests passed.');
})().catch(error=>{console.error(error);process.exit(1);});
