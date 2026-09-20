import {cases} from './data.mjs';
const henan={
 W1:{title:'姥姥，俺答辩过啦',explanation:'晓晓说，她今儿毕业论文答辩过了。\n她说“这关上岸了”，就是说，盼着办成的这件事，总算办成了。\n她打算周六回家，想吃姥姥包的饺子。',glossary:[{term:'答辩',explanation:'就是给老师讲讲自个儿写的论文，再回答老师的问题。'},{term:'上岸',explanation:'这儿说的是答辩通过了，可不是去水边。'}],uncertainties:['图里没写周六到底是几月几号。']},
 W2:{title:'孩子说emo，是咋了',explanation:'晓晓说，这两天事儿没做好，心里有点不得劲儿。\n她明说了，自个儿没生病。周末想安安静静歇歇，下周再跟您视频。',glossary:[{term:'emo',explanation:'这儿就是说心情有点低落，光凭这词儿，可不能说是得了啥病。'}],uncertainties:['没说是哪件事没做好，也没定下啥时候视频。']},
 W3:{title:'周五不回，改周日了',explanation:'小军把回家的日子改了：周五不回来，改成周日。\n249元的车票，他已经买好了，不用给他转钱。\n他说到家前会打电话，让妈妈别去车站接。',glossary:[],uncertainties:['没写周日具体几点到。']},
 P1:{title:'转正了，评论也得分清',explanation:'晓晓说，她上班三个月，今儿试用期过了，成正式员工了。\n朋友阿圆在评论里恭喜她，还约她请喝奶茶。晓晓回了一句，说周末约。',glossary:[{term:'转正',explanation:'这儿说的是工作试用期过了，成正式员工了。'}],uncertainties:['没写在哪儿上班，也没说在哪儿聚。']},
 P2:{title:'孩子拿了PB，是啥奖',explanation:'小满在校运会跑800米，比自个儿上回快了12秒。\n“PB”是他自个儿跑得最好的一回，可不是说得了全校第一。\n妈妈在评论里夸他一直坚持训练。',glossary:[{term:'PB',explanation:'就是自个儿到现在最好的成绩。'}],uncertainties:['没写比赛排第几，也没写一共跑了多长时间。']},
 P3:{title:'一盒饺子，孩子想家了',explanation:'晓晓收到姥姥寄的饺子，一瞧见，心里就很受触动，一下子特别想家。\n她说“破防了”，这儿是在说心里的情绪被触动了。\n妈妈在评论里提醒她，吃完给姥姥打个电话。',glossary:[{term:'破防',explanation:'就是原先压着的情绪一下子涌出来了。这儿要连着“想家”一块儿看。'}],uncertainties:['图里没说晓晓到底打过电话没有。']},
 S1:{title:'取件码，不用到处翻了',explanation:'短信上说，尾号2816的包裹到了春风驿站。\n取件码是7-249，保管到9月22日18:00。\n短信上写着，这回取件不收钱，别给不认识的人转账。',glossary:[{term:'取件码',explanation:'就是取包裹时，用来核对的那串号码。'}],uncertainties:['短信上显示的号码，不代表已经核实过身份。','“尾号2816”是哪种号码的尾号，短信没说清。']},
 S2:{title:'活动改日子了，别白跑',explanation:'这条通知说，手工活动改到9月24日上午9:30。\n地方在社区服务中心2楼。\n别按原先的9月23日去。通知说活动不收报名费。',glossary:[],uncertainties:['这儿只是转述短信，还没核实发短信的人和活动。']},
 S3:{title:'流量提醒，可不是欠费',explanation:'短信说，这个月套餐里的上网流量用了8GB，还剩2GB。\n短信明说了，没替您买额外的流量包。\n这条短信没说您欠费，也没让您交钱。',glossary:[{term:'流量',explanation:'这儿说的是手机用运营商网络上网时，能用的额度。'},{term:'加油包',explanation:'这儿说的是额外的流量套餐，可不是给车加油。'}],uncertainties:['短信没写套餐用完以后咋收费。']}
};
export function getDemoResult(caseId,language='mandarin'){const sample=cases.find(c=>c.id===caseId);if(!sample)throw new Error('找不到这个示例');return {...sample,...(language==='henan'?henan[caseId]:{}),language};}
export function makeDemoRecords(){return ['self','helper'].flatMap(mode=>cases.map((sample,i)=>({...sample,id:`demo-v3-${mode}-${sample.id}`,caseId:sample.id,mode,account:'family-demo',images:[],sample:true,sampleGenerated:false,language:'mandarin',createdAt:new Date(Date.UTC(2026,8,20,1,i)).toISOString(),translations:{mandarin:getDemoResult(sample.id),henan:getDemoResult(sample.id,'henan')}})));}
export function localResult(record,language){if(record.translations?.[language])return record.translations[language];if((record.language||'mandarin')===language)return record;return null;}
