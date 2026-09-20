import {makeDemoRecords} from './demo.mjs';
let connection;
function db(){if(!connection)connection=new Promise((resolve,reject)=>{const request=indexedDB.open('jialihua-translate-v3',1);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('records'))request.result.createObjectStore('records',{keyPath:'id'});if(!request.result.objectStoreNames.contains('meta'))request.result.createObjectStore('meta');};request.onsuccess=()=>{request.result.onversionchange=()=>{request.result.close();connection=null;};resolve(request.result);};request.onerror=()=>{connection=null;reject(new Error('本机记录没有打开，请检查浏览器存储权限。'));};request.onblocked=()=>{connection=null;reject(new Error('请关闭旧的家里话页面，再重新打开本页。'));};});return connection;}
async function operation(mode,work){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('records',mode);const request=work(tx.objectStore('records'));tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(new Error('记录没有保存成功，页面内容还在，请重试。'));tx.onabort=()=>reject(new Error('本机存储空间不足，记录没有保存。'));});}
export const allRecords=()=>operation('readonly',store=>store.getAll());
export const saveRecord=record=>operation('readwrite',store=>store.put(record));
export const removeRecord=id=>operation('readwrite',store=>store.delete(id));
async function demoInstalled(database){return new Promise((resolve,reject)=>{const tx=database.transaction('meta'),request=tx.objectStore('meta').get('demo-v3-installed');tx.oncomplete=()=>resolve(Boolean(request.result));tx.onerror=tx.onabort=()=>reject(new Error('本机记录状态没有读到，请刷新后重试。'));});}
async function legacyRows(){return new Promise((resolve,reject)=>{
 let settled=false,missing=false,legacy;
 const unavailable=()=>new Error('旧的本机记录暂时读不到，请关闭旧的家里话页面，刷新后重试。');
 function finish(error,value){if(settled)return;settled=true;clearTimeout(timer);legacy?.close();if(error)reject(error);else resolve(value);}
 // A versionless open queued behind another tab's blocked upgrade emits no blocked event.
 const timer=setTimeout(()=>finish(unavailable()),2000);
 let request;try{request=indexedDB.open('jialihua-translate-v2');}catch{finish(unavailable());return;}
 request.onupgradeneeded=()=>{missing=true;request.transaction.abort();};
 request.onblocked=()=>finish(unavailable());
 request.onerror=()=>missing?finish(null,{rows:[],installed:false}):finish(unavailable());
 request.onsuccess=()=>{
  if(settled){request.result.close();return;}
  legacy=request.result;
  legacy.onversionchange=()=>{finish(unavailable());legacy.close();};
  const stores=['records','meta'].filter(name=>legacy.objectStoreNames.contains(name));
  if(!stores.length){finish(null,{rows:[],installed:false});return;}
  try{const tx=legacy.transaction(stores),read=stores.includes('records')?tx.objectStore('records').getAll():null,installed=stores.includes('meta')?tx.objectStore('meta').get('demo-v3-installed'):null;
   tx.oncomplete=()=>finish(null,{rows:read?.result||[],installed:Boolean(installed?.result)});
   tx.onerror=tx.onabort=()=>finish(unavailable());
  }catch{finish(unavailable());}
 };
});}
export async function seedDemoRecords(){const database=await db();if(await demoInstalled(database))return;const legacy=await legacyRows();return new Promise((resolve,reject)=>{const tx=database.transaction(['records','meta'],'readwrite'),meta=tx.objectStore('meta'),records=tx.objectStore('records'),request=meta.get('demo-v3-installed');request.onsuccess=()=>{if(request.result)return;const rows=legacy.installed?legacy.rows:[...makeDemoRecords(),...legacy.rows];for(const row of new Map(rows.map(row=>[row.id,row])).values()){const lookup=records.get(row.id);lookup.onsuccess=()=>{if(!lookup.result)records.put(row);};}meta.put(true,'demo-v3-installed');};tx.oncomplete=resolve;tx.onerror=()=>reject(new Error('演示记录没有准备好，请刷新后再试。'));tx.onabort=()=>reject(new Error('演示记录没有保存成功。'));});}
