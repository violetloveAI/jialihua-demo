import {publicPath} from './assets.mjs';
// Display bounds checked against the nine prepared 1080 × 2340 screenshots.
// Keep names, every message, photos and comments; omit device chrome/empty tails.
// The original files stay intact, and unknown/user images keep their full bounds.
const bounds={
 W1:{top:90,height:680},W2:{top:90,height:680},W3:{top:90,height:810},
 P1:{top:690,height:920},P2:{top:690,height:920},P3:{top:690,height:920},
 S1:{top:90,height:650},S2:{top:90,height:580},S3:{top:90,height:580},
};
export function screenshotCrop(src){
 const id=typeof src==='string'?/^\/demo-cases\/([WPS][123])\.png$/.exec(publicPath(src))?.[1]:null;
 return id&&bounds[id]?{...bounds[id],width:1080,sourceHeight:2340}:null;
}
