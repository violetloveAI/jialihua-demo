export function activeRange(cues, time) {
 return cues.find(cue=>time>=cue.start&&time<cue.end)||null;
}
export function localRange(text, spokenText, cue, context) {
 if(!cue||!spokenText)return null;
 const contextOffset=context?spokenText.indexOf(context):-1;
 const within=contextOffset>=0?context.indexOf(text):-1;
 const offset=within>=0?contextOffset+within:spokenText.indexOf(text);if(offset<0)return null;
 const from=Math.max(0,cue.from-offset),to=Math.min(text.length,cue.to-offset);
 return to>from?{from,to}:null;
}
