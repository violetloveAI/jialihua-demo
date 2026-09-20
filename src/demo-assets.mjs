import {assetUrl} from './assets.mjs';
export const DEMO_CASE_IDS=['W1','W2','W3','P1','P2','P3','S1','S2','S3'];
export function caseImage(caseId){return DEMO_CASE_IDS.includes(caseId)?assetUrl(`/demo-cases/${caseId}.png`):null;}
export function preloadDemoCases(){if(typeof Image==='undefined')return;for(const id of DEMO_CASE_IDS){const image=new Image();image.src=caseImage(id);}}
