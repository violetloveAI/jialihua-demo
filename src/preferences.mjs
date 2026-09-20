export const FONT_SIZES=[28,34,40,48];
export const READING_RATES=[1,.75,.5];
export const SESSION_KEY='jlh-demo-session-v1';
export function normalizeSession(value={}){return {account:'family-demo',loggedIn:value.loggedIn===true,mode:['self','helper'].includes(value.mode)?value.mode:null,languageChosen:value.languageChosen===true,experience:['first','used'].includes(value.experience)?value.experience:null,language:value.language==='henan'?'henan':'mandarin',fontLevel:Number.isInteger(value.fontLevel)&&value.fontLevel>=0&&value.fontLevel<4?value.fontLevel:0,rate:READING_RATES.includes(value.rate)?value.rate:1};}
export function entryStep(session){if(!session.loggedIn)return 'login';if(!session.mode)return 'role';if(!session.languageChosen)return 'language';if(!session.experience)return 'experience';return 'ready';}
export function loadSession(){try{return normalizeSession({...JSON.parse(localStorage.getItem(SESSION_KEY)||'{}'),loggedIn:false,mode:null,languageChosen:false,experience:null,rate:1});}catch{return normalizeSession();}}
export function saveSession(value){const safe=normalizeSession(value);localStorage.setItem(SESSION_KEY,JSON.stringify(safe));return safe;}
export function narratedText(result,language='mandarin'){return result.explanation.trim();}
