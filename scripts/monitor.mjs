import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
// Technical change detection only. Never updates legal summaries or checkedAt in catalog.json.
const sources=[
  {name:'Банк России · новости ПИФ',url:'https://cbr.ru/press/event/?id=32864'},
  {name:'Банк России · разъяснения',url:'https://www.cbr.ru/explan/rpd'},
  {name:'НАУФОР · новости ПИФ',url:'https://pif.naufor.ru/tree.asp?n=1558&pg=1'},
  {name:'IFRS Foundation · IFRS 18',url:'https://www.ifrs.org/issued-standards/list-of-standards/ifrs-18-presentation-and-disclosure-in-financial-statements/'},
  {name:'IFRS Foundation · все новости',url:'https://www.ifrs.org/news-and-events/news/'}
];
let previous={};try{previous=JSON.parse(await readFile(resolve(root,'.cache/source-hashes.json'),'utf8'));}catch{}
const next={...previous}, results=[];
for(const source of sources){try{const r=await fetch(source.url,{signal:AbortSignal.timeout(18000),headers:{'User-Agent':'PIF-Navigator-SourceMonitor/1.0','Accept':'text/html'}});if(!r.ok)throw new Error('HTTP '+r.status);const html=await r.text();const clean=html.replace(/<script\b[\s\S]*?<\/script>/gi,'').replace(/<style\b[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();if(clean.length<200||/^(?:\S+\s+){0,8}(?:access denied|checking your browser|just a moment|captcha)\b/i.test(clean))throw new Error('Страница проверки доступа вместо документа');const hash=createHash('sha256').update(clean).digest('hex');const old=previous[source.url];next[source.url]=hash;results.push({...source,status:old?(old===hash?'unchanged':'changed'):'baseline'});}catch(error){results.push({...source,status:'error',error:error.message});}}
await mkdir(resolve(root,'.cache'),{recursive:true});await mkdir(resolve(root,'data'),{recursive:true});
await writeFile(resolve(root,'.cache/source-hashes.json'),JSON.stringify(next,null,2));
await writeFile(resolve(root,'data/monitor.json'),JSON.stringify({checkedAt:new Date().toISOString(),note:'Технические изменения страниц; не подтверждает полноту или актуальность правовых норм.',sources:results},null,2)+'\n');
console.log(`Проверено страниц: ${results.length}; ошибок доступа: ${results.filter(s=>s.status==='error').length}; изменились: ${results.filter(s=>s.status==='changed').length}.`);
