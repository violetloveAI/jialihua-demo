import React from 'react';
import {LoaderCircle,Pause,Play,X} from 'lucide-react';
import {t} from './i18n.mjs';

// Keep the essential playback action reachable while reading a long explanation.
export default function NarratorDock({narrator,language}){
 if(!['loading','ready','playing','paused','error'].includes(narrator.status))return null;
 const loading=narrator.status==='loading',playing=narrator.status==='playing';
 return <aside className="narrator-dock" aria-label={t('voiceInfo',language)}>
  {narrator.error&&<p role="alert">{narrator.error}</p>}
  <span aria-live="polite">{t(loading?'preparing':playing?'playing':'ready',language)}</span>
  <button disabled={loading} onClick={narrator.status==='error'?narrator.retry:playing?narrator.pause:narrator.resume}>
   {loading?<LoaderCircle/>:playing?<Pause/>:<Play/>}{narrator.status==='error'?'再试一次':t(playing?'pause':'play',language)}
  </button>
  <button className="reader-close" onClick={narrator.stop} aria-label={t('cancel',language)}><X/></button>
 </aside>;
}
