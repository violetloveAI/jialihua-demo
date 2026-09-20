export const STATIC_DEMO=import.meta.env?.MODE==='pages';
export const ASSET_BASE=import.meta.env?.BASE_URL||'/';
// Canonical record paths stay portable; apply the repository prefix at the I/O edge.
export function assetUrl(path,base=ASSET_BASE){
 if(typeof path!=='string'||!path.startsWith('/')||path.startsWith('//'))return path;
 if(base==='/'||path.startsWith(base))return path;
 return base.replace(/\/$/,'')+path;
}
export function publicPath(path,base=ASSET_BASE){
 return typeof path==='string'&&base!=='/'&&path.startsWith(base)?'/'+path.slice(base.length):path;
}
