const caseSuggestions={
 W1:['可以先把“答辩通过”说成“毕业论文这关过了”，再告诉姥姥你很开心。','回家的具体日期确定后再补上，方便姥姥安排；不用替原消息猜日期。'],
 W2:['把“emo”换成“这两天心情有点低落”，连同“没生病、想休息”一起说，减少爸妈的担心。','想好下周哪天方便后，再和爸妈约视频时间；不必勉强自己交代不想说的细节。'],
 W3:['把“周五不回、改成周日”放在开头，避免爸妈只记住旧时间。','“不用转钱”和“别来车站接”分开写，到达时间确定后再补充。'],
 P1:['先解释“转正”是通过试用期，再分享这份开心。','把自己的近况和朋友的评论分开说，避免把奶茶邀约当成工作安排。'],
 P2:['把“PB”说成“比自己上次跑得更快”，强调这次进步。','保留“800米”和“快了12秒”，没有写名次就不要补成“拿了第一”。'],
 P3:['把“破防了”换成“看到饺子很感动，突然想家了”，姥姥更容易理解。','想表达感谢时，可以亲口告诉姥姥饺子收到了；是否已经打过电话，要按实际情况写。'],
 S1:['把取件码、地点和保管期限分行写，让爸妈一眼就能找到。','需要补充取件信息时先核实；不要把“尾号2816”自行解释成手机号或运单号。'],
 S2:['突出新的日期、时间和楼层，把原来的日期单独说明。','先确认通知来源和活动安排，再提醒爸妈出发。'],
 S3:['先说明这是流量使用提醒，再解释“流量”是手机上网的额度。','爸妈问到超出套餐怎么收费时，核实套餐信息后再补充。'],
};

// This is advice to the child, never part of the explanation/narration payload.
export function helperGuidance(result={},record={}){
 const uncertainties=(result.uncertainties||[]).filter(item=>typeof item==='string'&&item.trim());
 if(record.sourceKind==='composition')return {uncertainties:[],suggestions:[
  '一段只说一件事，先写最想让爸妈知道的那一句。',
  '把网络词换成日常说法；涉及约定时，确认后补上时间、地点和要做的事。',
 ]};
 const prepared=record.sample&&!record.sampleGenerated&&caseSuggestions[record.caseId];
 const suggestions=prepared||[
  ...(result.glossary?.length?[`可以把${result.glossary.slice(0,3).map(item=>'“'+item.term+'”').join('、')}换成上面的日常说法。`]:['把最重要的事放在第一句，长消息分成几个短段落。']),
  ...(uncertainties.length?['原文没有交代清楚的细节，确认后再补进给爸妈的文字；暂时不清楚的先不写。']:[]),
  result.sourceType==='moments'?'朋友圈正文和评论要分开说明，让爸妈知道每句话是谁说的。':result.sourceType==='sms'?'说明这是短信里的说法，涉及办事或费用时先核实来源。':'说清楚希望爸妈做什么；不需要他们操心的事，也可以直接说明。',
 ];
 return {uncertainties,suggestions};
}
