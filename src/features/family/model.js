export const clone = (value) => JSON.parse(JSON.stringify(value));
export const wealthKeys = ['salaryBank','salaryDay','usdRate','loans','transfers','assets','stocks','equity','paymentChecks','wealthSettings'];
export function blankFamily() {
  return { salaryBank:'',salaryDay:15,usdRate:7,loans:[],transfers:[],assets:[],stocks:[],equity:{pricePerShare:1,dividendRate:0,members:[]},paymentChecks:{},wealthSettings:{},photoTypes:['日常记录','自然风景','人物写真'],photos:[],goals:[],dates:[],todos:[],milestones:[],habits:[],books:[],moments:[],coupons:[],foodPlaces:[],trash:[],lifeLayout:[],appearance:{},notificationSettings:{enabled:false,quietStart:'22:00',quietEnd:'08:00'},llmApiKey:'' };
}
export function sharedOnly(data) {
  const result=clone(data);
  for (const key of [...wealthKeys,'llmApiKey']) delete result[key];
  const financialTodo=t=>t?.sourceType==='loan-transfer'||String(t?.sourceKey||'').startsWith('loan-transfer:');
  if(result.todos)result.todos=result.todos.filter(t=>!financialTodo(t));
  if(result.trash)result.trash=result.trash.filter(t=>!wealthKeys.includes(t.collection)&&!(t.collection==='todos'&&financialTodo(t.item)));
  return result;
}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function changedKeys(base,draft) {
  return [...new Set([...Object.keys(base),...Object.keys(draft)])].filter(k=>!same(base[k],draft[k]));
}
export function mergeChanges(base,draft,latest,choices={}) {
  const result=clone(latest), conflicts=[];
  for(const key of changedKeys(base,draft)) {
    const idArray=value=>Array.isArray(value)&&value.every(item=>item&&typeof item==='object'&&item.id!==undefined)&&new Set(value.map(item=>String(item.id))).size===value.length;
    if(key!=='lifeLayout'&&[base[key],draft[key],latest[key]].every(idArray)) {
      const before=new Map(base[key].map(item=>[String(item.id),item])),local=new Map(draft[key].map(item=>[String(item.id),item])),remote=new Map(latest[key].map(item=>[String(item.id),clone(item)]));
      for(const id of new Set([...before.keys(),...local.keys()])) {
        if(same(before.get(id),local.get(id)))continue;
        if(!same(before.get(id),remote.get(id))&&!same(local.get(id),remote.get(id))) {
          if(!choices[key]){if(!conflicts.includes(key))conflicts.push(key);continue;}
          if(choices[key]==='remote')continue;
        }
        if(local.has(id))remote.set(id,clone(local.get(id)));else remote.delete(id);
      }
      result[key]=[...remote.values()];continue;
    }
    if(!same(base[key],latest[key])&&!same(draft[key],latest[key])&&!choices[key]) { conflicts.push(key); continue; }
    if(choices[key]==='remote') continue;
    if(draft[key]===undefined) delete result[key]; else result[key]=clone(draft[key]);
  }
  return {record:result,conflicts};
}
export function safeQuietTime(now,start='22:00',end='08:00') {
  const time=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false}).format(now);
  return start===end ? false : start<end ? time>=start&&time<end : time>=start||time<end;
}
