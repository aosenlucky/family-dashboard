import {getRequiredLoanPayment} from '../../utils/loanTools.js';
const day=(date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export function paymentSchedule(data,month){
 const [y,m]=month.split('-').map(Number),last=new Date(y,m,0).getDate();
 const dueDate=n=>`${month}-${String(Math.min(last,Math.max(1,Number(n)||1))).padStart(2,'0')}`;
 return [...(data.loans||[]).filter(l=>Number(l.day)>0).map((l,i)=>({id:`loan:${l.id||i}:${month}`,date:dueDate(l.day),type:'还款计划',name:`${l.bank} · ${l.type}`,amount:getRequiredLoanPayment(l),owner:l.owner||'共同'})),...(data.transfers||[]).filter(t=>Number(t.day)>0&&(!/^\d{4}-\d{2}-\d{2}$/.test(t.expire||'')||t.expire>=dueDate(t.day))).map((t,i)=>({id:`transfer:${t.id||i}:${month}`,date:dueDate(t.day),type:'转账计划',name:`${t.from} → ${t.to}`,amount:Number(t.amount)||0,owner:t.owner||'共同'}))].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
}
export function nextPayments(data,date=new Date()){
 const end=new Date(date.getFullYear(),date.getMonth(),date.getDate()+6),months=[day(date).slice(0,7),day(end).slice(0,7)];
 return [...new Set(months)].flatMap(m=>paymentSchedule(data,m)).filter(p=>p.date>=day(date)&&p.date<=day(end));
}
