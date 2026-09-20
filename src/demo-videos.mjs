import {assetUrl} from './assets.mjs';
import manifest from '../public/demo/exports/manifest.json';
import {videoIdentity} from './demo-video-sources.mjs';

export function preparedVideo(record,content,language) {
 const identity=JSON.stringify(videoIdentity(record,content,language));
 const match=manifest.videos.find(video=>JSON.stringify(video.identity)===identity);
 return match?{...match,url:assetUrl(match.url),frames:match.frames?.map(frame=>({...frame,dataUrl:assetUrl(frame.dataUrl)}))}:null;
}
export async function loadPreparedVideo(video) {
 const response=await fetch(assetUrl(video.url));
 if(!response.ok||!response.headers.get('content-type')?.includes('video/mp4'))throw new Error('演示视频未能打开，请刷新后重试，或先保存长图。');
 const blob=await response.blob();
 if(!blob.size)throw new Error('演示视频未能打开，请刷新后重试，或先保存长图。');
 return blob;
}
