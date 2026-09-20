import test from 'node:test';
import assert from 'node:assert/strict';
import {findRecords,makePages,validateFiles} from '../src/domain.mjs';
test('历史按用途与来源查询，并能搜原文、不确定信息和解释',()=>{
 const rows=[{id:'a',mode:'self',sourceType:'sms',title:'取件',items:[{text:'取件码7-249'}],explanation:'驿站',uncertainties:['地址未知'],createdAt:'2026-09-20'}, {id:'b',mode:'helper',sourceType:'sms',title:'取件',items:[],explanation:'驿站',createdAt:'2026-09-19'}];
 assert.deepEqual(findRecords(rows,{mode:'self',query:'7-249'}).map(r=>r.id),['a']);
 assert.equal(findRecords(rows,{mode:'self',query:'地址'}).length,1);
 assert.equal(findRecords(rows,{mode:'self',source:'moments'}).length,0);
 assert.equal(findRecords(rows,{mode:'helper'}).length,1);
});
test('视频分页保留全文与金额，不静默截断长内容',()=>{
 const input='周五不回家，改成周日。车票是249元，不是2.49元。'.repeat(9);
 const pages=makePages(input);
 assert.equal(pages.join(''),input);assert.ok(pages.every(p=>Array.from(p).length<=90));
 assert.throws(()=>makePages('太长'.repeat(600)),/太长/);
 assert.throws(()=>makePages('  '),/内容/);
});
test('限制截图的数量、大小、类型',()=>{
 assert.throws(()=>validateFiles([]),/选择/);
 assert.throws(()=>validateFiles([{type:'image/svg+xml',size:100}]),/PNG/);
 assert.throws(()=>validateFiles([{type:'image/png',size:16*1024*1024}]),/15/);
 assert.doesNotThrow(()=>validateFiles([{type:'image/png',size:100}]));
});
