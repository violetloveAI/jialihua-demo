const step=(id,target,title,body,extra={})=>({id,target,mandarin:{title,body},henan:{title,body:body.replaceAll('这里','这儿').replaceAll('帮我讲明白','帮俺讲明白')},...extra});
const invite=target=>step('invite',target,'要继续学主功能吗？','用预览案例练一遍；也可以先开始使用。',{invite:true});
export const tutorialSteps={
 self:[
  step('role','.app-toolbar','从顶部开始认识','右上角能切换老人版和子女版。下面三个按钮，帮您调到用着舒服。'),
  step('language','[data-tour="language"]','先选熟悉的声音','普通话、河南话，点这里切换。教程和页面会用您选的声音。'),
  step('font','[data-tour="font"]','字小了，就在这里调','点这里选更大的字。下次打开，也会记住您的字号。'),
  step('rate','[data-tour="rate"]','说得快，就让它慢一点','听不清，就选慢一点。还可以再慢一点。'),
  step('speaker','[data-tour="speaker"]','小喇叭，点一下就能听','标题旁的喇叭能读标题。功能旁的喇叭，会讲这个功能怎么用。'),
  step('history','[data-tour="history"]','底部能找以前看过的','看过的话都在这里，可以再看、再听。'),
  step('upload','[data-tour="upload"] .hero-content','主要用这个按钮选图','选一张看不懂的截图，就能看大字、听解释。接下来可以跟着案例试。'),
  invite('[data-tour="upload"] .hero-content')
 ],
 helper:[
  step('role','.app-toolbar','顶部：切换身份','这里切换老人版和子女版，方便查看家人使用的界面。'),
  step('history','[data-tour="history"]','底部：我的作品','做过的图文和截图解释都在这里，方便继续查看、编辑和导出。'),
  step('settings','[data-tour="settings"]','底部：偏好设置','给家人选普通话或河南话。这个选择用于内容和视频，子女教程只显示文字。'),
  step('create','[data-tour="create"]','主功能一：写给家人的话','写文字、加照片，再制作大字长图或有声视频。'),
  step('cases','[data-tour="cases"]','主功能二：解释发过的消息','导入微信、朋友圈或短信截图，整理成爸妈容易理解的话，也能继续导出。'),
  step('video','[data-tour="video"]','先看一个完整成片','这里可以预览准备好的视频，了解大字画面和内容配音的效果。'),
  invite('[data-tour="create"]')
 ]
};
const practice=(id,scene,target,title,body,extra={})=>step(id,target,title,body,{scene,...extra});
const captureStart=[
 practice('pick','upload','.upload-area strong','第一步，打开相册','点亮着的按钮，打开演示相册。这次先用准备好的截图练习。',{next:'打开演示相册'}),
 practice('choose','album','.case-card:first-child .case-select .screenshot-image','第二步，选这张截图','这是孩子说答辩通过的聊天截图。点亮着的这张图，把它选进来。',{next:'选这张截图'}),
 practice('preview','preview','.source-pictures-heading','第三步，看看选对没有','这里能查看选中的原图。选错了可以重新选；确认好，再往下看。'),
 practice('analyze','preview','[data-tour="practice-analyze"]','选好以后，点这里解读','点“帮我讲明白”，就会把截图里的话，换成容易懂的解释。',{next:'帮我讲明白',henan:{title:'选好以后，点这儿解读',body:'点“帮俺讲明白”，就会把截图里的话，换成容易懂的解释。'}})
];
export const tutorialPracticeSteps={
 self:[
  ...captureStart,
  practice('result','read','.reading-card h2','解释就在这里','这张图说的是：孩子答辩通过了，周六想回家吃饺子。'),
  practice('listen','read','.content-title-button','点这个标题，听完整解释','不想看字，就点亮着的标题。现在也可以先听听这段案例讲解。',{example:true}),
  practice('terms','read','.glossary h2','不熟悉的词，单独讲明白','“答辩”“上岸”这些词，下面都有解释。点标题，也能听这一部分。'),
  practice('original','read','.original summary','想核对，就展开原话','这里保留孩子原来发的话，方便对照着看。'),
  practice('save','read','[data-tour="practice-save"]','看过的解释，会留在本机','正式使用时会保留解读，也能点这里再保存。练习不会新增记录。'),
  practice('finish','read','[data-tour="history"]','学会了，下次就这样用','以后点底部“以前看过的”，还能找到。现在回首页，选您自己的截图吧。')
 ],
 helper:[
  practice('compose-import','compose-blank','.demo-import-card button','导入案例，开始练习','用“周日回家吃饺子”的文案和照片，练习制作长图和视频。',{next:'导入演示文案'}),
  practice('compose-edit','compose-filled','.compose-field textarea','写文字，配上照片','正文可输入或粘贴，标题可留空，最多配 3 张照片。准备好后，一起进入导出预览。',{next:'预览并选择导出'}),
  practice('export-image','export-image','.export-format-tabs','检查并保存长图','选“纯长图”，向下检查完整预览；可直接改文字，再点“保存完整长图”，从微信发给家人。',{next:'再看视频怎么做'}),
  practice('export-video','export-video','.language-picker','选择声音，制作视频','选普通话或河南话，预览分页。原样案例可直接打开演示视频；改过内容后，点制作并等待完成。',{next:'查看视频保存位置'}),
  practice('export-ready','export-ready','.download-ready > button','预览成片，再保存','视频做好后可播放检查，保存到手机，再从微信发送。接着练习另一个主功能：截图解释。',{next:'继续学截图解释'}),
  practice('screenshot-pick','upload','.upload-area','打开截图相册','从“解释发过的消息”进入，选择已有截图。这次先用演示图片练习。',{next:'打开演示相册'}),
  practice('screenshot-choose','album','.case-card:first-child .case-select .screenshot-image','选一张已发出的消息','选这张微信聊天截图。朋友圈和短信也用同样的方法。',{next:'选这张截图'}),
  practice('screenshot-analyze','preview','[data-tour="practice-analyze"]','核对截图，开始解释','先查看原图，选错可重新选择；确认后点“整理给爸妈看”，把消息变成容易理解的话。',{next:'整理给爸妈看'}),
  practice('screenshot-result','read','.reading-card h2','看解释，也能对照原话','下方有词语解释和原话。沟通提醒只给你看，不会导出给家人。确认内容后，进入导出。',{next:'进入导出预览'}),
  practice('screenshot-formats','screenshot-export','.export-format-tabs','同样导出，两个功能都学会了','截图解释也能改文字、选声音，保存长图或视频。首页的“先看一个成片”可随时重看效果。')
 ]
};
export const entryNarrations={
 question:{mandarin:'更想听的语言。您可以先听听普通话和河南话，再选一个喜欢的声音。',henan:'更想听的语言。您可以先听听普通话跟河南话，再挑个喜欢的声音。'},
 sample:{mandarin:'您好，我用普通话为您讲解。选好以后，教程和页面里的声音，都会用普通话。',henan:'您好，咱用河南话给您慢慢说。选好以后，教程跟页面里的声音，都用河南话。'},
 experience:{mandarin:'以前用过家里话吗？第一次用，可以选“第一次用”，我会带您一步一步学。已经用过，就直接进入。',henan:'以前用过家里话没？头一回用，可以选“头一回用”，咱一步一步学。用过了，就直接进去。'}
};
export function tutorialCopy(item,language){return item[language==='henan'?'henan':'mandarin'];}
export function tutorialAudio(role,id,language){return `/tutorial/${role}-${id}-${language==='henan'?'henan':'mandarin'}.mp3`;}
export function entryAudio(id,language){return tutorialAudio('entry',id,language);}
export function allTutorialNarrations(){const items=[];for(const language of ['mandarin','henan']){for(const [id,lines] of Object.entries(entryNarrations))items.push({id:`entry-${id}`,language,text:lines[language],file:entryAudio(id,language)});for(const item of [...tutorialSteps.self,...tutorialPracticeSteps.self]){const copy=tutorialCopy(item,language);const id=item.scene?'practice-'+item.id:item.id;items.push({id:`self-${id}`,language,text:copy.title+'。'+copy.body,file:tutorialAudio('self',id,language)});}}return items;}
