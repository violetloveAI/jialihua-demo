// Coordinates are local to the phone screen, including the desktop device preview.
export function tutorialPlacement({target,card,viewport}){
 const margin=12,gap=14,width=Math.min(card.width||390,viewport.width-margin*2);
 const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
 const below=viewport.height-target.bottom-margin-gap,above=target.top-margin-gap;
 const side=below>=above?'below':'above';
 const maxHeight=Math.min(viewport.height-margin*2,Math.max(220,below,above));
 const height=Math.min(card.height||320,maxHeight);
 return {left:clamp(target.left+(target.width-width)/2,margin,viewport.width-width-margin),top:side==='below'?clamp(target.bottom+gap,margin,viewport.height-height-margin):clamp(target.top-height-gap,margin,viewport.height-height-margin),width,side,maxHeight};
}
