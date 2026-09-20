import {t} from './i18n.mjs';

// Keep the same text for visible content, local audio preparation and live TTS.
export function contentNarrations(result,language='mandarin'){
 const terms=result.glossary?.length?[t('terms',language),...result.glossary.map(item=>item.term+'。'+item.explanation)].join('\n'):'';
 return {all:[result.title,result.explanation,terms].filter(Boolean).join('\n'),terms};
}

// Read the original wording separately from its explanation, including who said it.
export function originalNarrations(items=[]){
 const kinds={post:'朋友圈',comment:'评论',reply:'回复'};
 const rows=items.map(item=>({...item,kindLabel:kinds[item.kind]||'',speech:[item.speaker+(kinds[item.kind]?'的'+kinds[item.kind]:''),item.text].filter(Boolean).join('。')}));
 return {rows,all:rows.map(item=>item.speech).join('\n')};
}
