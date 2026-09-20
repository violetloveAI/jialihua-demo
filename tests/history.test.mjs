import {IDBFactory} from 'fake-indexeddb';
import test from 'node:test';import assert from 'node:assert/strict';
let run=0;
async function freshHistory(){globalThis.indexedDB=new IDBFactory();return import('../src/history.mjs?history-test='+run++);}
async function createLegacy(rows,{installed=false,withMeta=true}={}){
 const legacy=await new Promise((resolve,reject)=>{const r=indexedDB.open('jialihua-translate-v2',1);r.onupgradeneeded=()=>{r.result.createObjectStore('records',{keyPath:'id'});if(withMeta)r.result.createObjectStore('meta');};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 await new Promise((resolve,reject)=>{const tx=legacy.transaction(withMeta?['records','meta']:['records'],'readwrite');for(const row of rows)tx.objectStore('records').put(row);if(installed)tx.objectStore('meta').put(true,'demo-v3-installed');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
 return legacy;
}
async function installedFlag(){const database=await new Promise((resolve,reject)=>{const r=indexedDB.open('jialihua-translate-v3');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});try{return await new Promise((resolve,reject)=>{const tx=database.transaction('meta'),r=tx.objectStore('meta').get('demo-v3-installed');tx.oncomplete=()=>resolve(r.result);tx.onerror=()=>reject(tx.error);});}finally{database.close();}}
test('演示账号种子只安装一次，不覆盖用户修改、不复活已删除记录',async(t)=>{const {allRecords,saveRecord,removeRecord,seedDemoRecords}=await freshHistory();const legacy=await createLegacy([{id:'legacy-user-record',title:'原来的记录',mode:'self'}],{withMeta:false});t.after(()=>legacy.close());await seedDemoRecords();const rows=await allRecords();assert.equal(rows.length,19);assert.ok(rows.some(r=>r.id==='legacy-user-record'));const first={...rows[0],exportText:'人工改好的文字'};await saveRecord(first);await removeRecord(rows[1].id);await Promise.all([seedDemoRecords(),seedDemoRecords()]);const next=await allRecords();assert.equal(next.length,18);assert.equal(next.find(r=>r.id===first.id).exportText,'人工改好的文字');assert.equal(next.find(r=>r.id===rows[1].id),undefined);await saveRecord(rows[1]);assert.equal((await allRecords()).length,19);});
test('旧库已有安装标记时只迁移剩余记录，全部删除后也不补回演示案例',async(t)=>{
 for(const rows of [[{id:'demo-v3-self-P3',title:'用户修改后的案例',mode:'self'},{id:'legacy-user-record',title:'自己的原记录',mode:'helper'}],[]]){
  await t.test(rows.length?'部分删除':'全部删除',async()=>{const {allRecords,seedDemoRecords}=await freshHistory();const legacy=await createLegacy(rows,{installed:true});try{await seedDemoRecords();const migrated=(await allRecords()).sort((a,b)=>a.id.localeCompare(b.id));assert.deepEqual(migrated.map(row=>row.id),rows.map(row=>row.id));assert.deepEqual(migrated,rows);assert.equal(await installedFlag(),true);}finally{legacy.close();}});
 }
});
test('旧库读取排在被阻塞的升级后会有界失败，保留记录与未完成标记，关闭旧页后可重试',async()=>{
 const {allRecords,saveRecord,seedDemoRecords}=await freshHistory();const oldRow={id:'legacy-user-record',title:'不可丢失的旧记录',mode:'self'};const legacy=await createLegacy([oldRow],{installed:true});
 let upgradeDone;const blocked=new Promise(resolve=>{const r=indexedDB.open('jialihua-translate-v2',2);r.onblocked=resolve;upgradeDone=new Promise((done,reject)=>{r.onsuccess=()=>{r.result.close();done();};r.onerror=()=>reject(r.error);});});await blocked;
 const newRow={id:'new-user-record',title:'新版已有记录',mode:'helper'};await saveRecord(newRow);
 const pending=seedDemoRecords().then(()=>({success:true}),error=>({error}));let timeout;
 try{const outcome=await Promise.race([pending,new Promise(resolve=>{timeout=setTimeout(()=>resolve({timedOut:true}),3000);})]);assert.equal(outcome.timedOut,undefined,'旧库排队不能无限阻塞初始化');assert.match(outcome.error?.message||'',/关闭旧.*重试/);assert.deepEqual(await allRecords(),[newRow]);assert.equal(await installedFlag(),undefined);}finally{clearTimeout(timeout);legacy.close();await upgradeDone;await pending;}
 await seedDemoRecords();assert.deepEqual((await allRecords()).sort((a,b)=>a.id.localeCompare(b.id)),[oldRow,newRow]);assert.equal(await installedFlag(),true);
 await new Promise((resolve,reject)=>{const r=indexedDB.open('jialihua-translate-v2',3);r.onsuccess=()=>{r.result.close();resolve();};r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('超时后迟到的旧库连接没有关闭'));});
});
test('新版已经安装完成时，不再等待旧库的阻塞升级',async()=>{
 const {allRecords,seedDemoRecords}=await freshHistory();await seedDemoRecords();const legacy=await createLegacy([],{installed:true});let upgradeDone;await new Promise(resolve=>{const r=indexedDB.open('jialihua-translate-v2',2);r.onblocked=resolve;upgradeDone=new Promise((done,reject)=>{r.onsuccess=()=>{r.result.close();done();};r.onerror=()=>reject(r.error);});});let timeout;const pending=seedDemoRecords();try{const outcome=await Promise.race([pending.then(()=>true),new Promise(resolve=>{timeout=setTimeout(()=>resolve(false),200);})]);assert.equal(outcome,true,'已经完成迁移的新版不应重新访问旧库');assert.equal((await allRecords()).length,18);}finally{clearTimeout(timeout);legacy.close();await upgradeDone;await pending;}
});
