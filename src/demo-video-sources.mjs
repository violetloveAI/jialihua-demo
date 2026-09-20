import {cases} from './data.mjs';
import {getDemoResult} from './demo.mjs';
import {demoCompositions} from './demo-compositions.mjs';

// Bump when the shared export layout or narration rules change.
export const DEMO_VIDEO_VERSION=1;
export function videoIdentity(record,{title,text},language) {
 return {
  version:DEMO_VIDEO_VERSION,language,title,text,
  origin:record.sourceKind==='composition'?'composition':record.sample&&!record.sampleGenerated?'prepared-screenshot':'custom-screenshot',
  caseId:record.sourceKind==='composition'?null:record.caseId||null,
  pictures:record.sourceKind==='composition'?(record.attachments||record.composeImages||[]).map(image=>image.dataUrl):[],
 };
}
export function demoVideoSources() {
 return ['mandarin','henan'].flatMap(language=>[
  ...cases.map(sample=>{const result=getDemoResult(sample.id,language);return {id:sample.id,language,record:{...result,caseId:sample.id,sample:true,sampleGenerated:false},content:{title:result.title,text:result.explanation}};}),
  ...demoCompositions.map((example,index)=>({id:`C${index+1}`,language,record:{...example,sourceKind:'composition',sample:false,explanation:example.text,language},content:{title:example.title,text:example.text}})),
 ]);
}
