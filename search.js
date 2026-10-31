// Search stays in the browser. No queries are transmitted until an external link is opened.
export const categories = {law:'Законодательство', cbr:'Банк России', ifrs:'МСФО', naufor:'НАУФОР'};
export function normalize(value) {
  return String(value).toLowerCase().replace(/ё/g,'е').replace(/(\d)а(?![a-zа-я0-9])/g,'$1a').replace(/(\d)б(?![a-zа-я0-9])/g,'$1b').replace(/[^a-zа-я0-9.]+/g,' ').trim();
}
const stop = new Set(['как','какой','какая','какие','где','для','при','по','на','и','или','о','об','в','во','с','со','из','это','ли','мне','нужно','необходимо','найти','пункт','пункты','п','статья','статьи','ст','стандарта','стандарт','документ','документы','фонда','фонд','пиф']);
const concepts = [
  ['сча','чист','nav'], ['пду','правил','доверительн'], ['погаш','выкуп','redeem'],
  ['оцен','оценить','стоимост','fair','value'], ['облигац','бонд','bonds'],
  ['пай','паев','паи','паёв','паевый'], ['депозитар','спецдеп'], ['цифров','цфа'],
  ['консолид','дочерн'], ['капитал','equity'], ['обязательств','liabilit'],
  ['мсфо','ifrs','ias'], ['учет','бухгалтер'], ['отчет','раскрыт'], ['изменен','поправк'],
  ['квалифиц','квал','неквал'], ['выплат','компенсац'], ['марж','фьючерс','пфи']
];
function roots(token) {
  const group = concepts.find(g => g.some(r => token.startsWith(r)));
  if (group) return group;
  return [token.length > 6 && /^[а-я]+$/.test(token) ? token.slice(0,-2) : token];
}
function matches(text, token) { return roots(token).some(r => normalize(text).includes(r)); }
export function tokens(query) { return normalize(query).split(/\s+/).filter(x => x && !stop.has(x)); }
export function getStatus(doc, asOf) {
  if (doc.state === 'project') return 'project';
  if (doc.state === 'review') return 'review';
  const applies = doc.application || doc.effective;
  if (applies) return applies > asOf ? 'future' : 'active';
  return 'reference';
}
export function rankDocument(doc, query) {
  const terms = tokens(query);
  if (!terms.length) return {score: 1, clauses: doc.clauses.slice(0,2)};
  const head = `${doc.code} ${doc.title}`;
  const body = `${head} ${doc.summary} ${doc.topics.join(' ')} ${doc.clauses.map(c=>`${c.ref} ${c.title} ${c.text} ${c.keywords}`).join(' ')}`;
  if (!terms.every(t=>matches(body,t))) return null;
  const clauses = doc.clauses.map(c=>({c, score:terms.reduce((s,t)=>s+(matches(`${c.ref} ${c.title}`,t)?7:matches(`${c.text} ${c.keywords}`,t)?4:0),0)})).sort((a,b)=>b.score-a.score);
  let score = terms.reduce((s,t)=>s+(matches(head,t)?5:1),0) + (clauses[0]?.score || 0);
  if (normalize(head).includes(normalize(query))) score += 25;
  return {score, clauses:clauses.filter(x=>x.score>0).slice(0,3).map(x=>x.c)};
}
export function searchDocuments(documents, options) {
  const {query='', category='all', topic='all', fund='all', status='all', asOf, savedOnly=false, saved=[], sort='relevance'}=options;
  const result = documents.filter(d=>(category==='all'||d.category===category)&&(topic==='all'||d.topics.includes(topic))&&(fund==='all'||d.funds.includes(fund))&&(!savedOnly||saved.includes(d.id))&&(status==='all'||getStatus(d,asOf)===status)).map(d=>({doc:d,...rankDocument(d,query)})).filter(d=>d.score>0);
  return result.sort((a,b)=>sort==='newest'?b.doc.published.localeCompare(a.doc.published):sort==='effective'?(a.doc.application||a.doc.effective||'9999').localeCompare(b.doc.application||b.doc.effective||'9999'):b.score-a.score||b.doc.published.localeCompare(a.doc.published));
}
export function getEvents(documents, asOf) {
  return documents.flatMap(doc=>[
    ...(doc.effective?[{date:doc.effective,type:doc.application?'Вступление в силу':'Начало применения',doc}]:[]),
    ...(doc.application?[{date:doc.application,type:'Начало применения',doc}]:[]),
    ...(doc.deadline?[{date:doc.deadline,type:'Срок исполнения',doc}]:[])
  ]).filter(e=>e.date>=asOf).sort((a,b)=>a.date.localeCompare(b.date));
}
