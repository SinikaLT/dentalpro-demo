// Atsiskaitymų demonstracinė apskaita; be kasos aparato, kortelių terminalo, bankų ar fiskalinės integracijos.
export const PAYMENT_METHODS=[
  {id:"cash",label:"Grynieji (rankinis patvirtinimas)"},
  {id:"card",label:"Kortelė (rankinis terminalo kvito patvirtinimas)"},
  {id:"transfer",label:"Bankinis pavedimas (rankinis išrašo patvirtinimas)"},
  {id:"advance",label:"Paciento avanso panaudojimas"}
];
export const PAYMENT_STATUSES=["pending","confirmed","cancelled"];
export const roundCents=value=>Math.round((Number(value)+Number.EPSILON)*100)/100;
export function paymentMethod(method){return ({"Grynieji (demo)":"cash","Kortelė (demo)":"card","Pavedimas (demo)":"transfer"})[method]||method}
export function isConfirmed(payment){return payment?.status===undefined||payment?.status==="confirmed"}
export function paidAmount(invoice){
  return roundCents((invoice?.payments||[]).filter(isConfirmed).reduce((n,p)=>n+Number(p.amount||0),0)-
    (invoice?.refunds||[]).reduce((n,r)=>n+Number(r.amount||0),0));
}
export function pendingAmount(invoice){
 return roundCents((invoice?.payments||[]).filter(p=>p.status==="pending").reduce((n,p)=>n+Number(p.amount||0),0));
}
export function invoiceCashRounding(invoice){
 const cash=(invoice?.payments||[]).filter(isConfirmed).filter(p=>paymentMethod(p.method)==="cash")
  .reduce((n,p)=>n+Number(p.cashAmount??cashRounded(p.amount))-Number(p.amount||0),0);
 const refunds=(invoice?.refunds||[]).filter(r=>paymentMethod(r.method)==="cash")
  .reduce((n,r)=>n-(Number(r.cashAmount??cashRounded(r.amount))-Number(r.amount||0)),0);
 return roundCents(cash+refunds);
}
export function invoiceOutstanding(invoice,total){
 return Math.max(0,roundCents(Number(total)-paidAmount(invoice)));
}
export function paymentEvents(invoice){
 const events=[];
 for(const p of invoice?.payments||[]){
   if(!isConfirmed(p))continue;
   const date=p.confirmedDate||p.date;
   if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date)))continue;
   events.push({id:p.id,date,amount:paymentMethod(p.method)==="cash"?Number(p.cashAmount??cashRounded(p.amount)):Number(p.amount||0),nominalAmount:Number(p.amount||0),method:paymentMethod(p.method),kind:"payment"});
 }
 for(const r of invoice?.refunds||[]){
   if(!/^\d{4}-\d{2}-\d{2}$/.test(String(r.date)))continue;
   events.push({id:r.id,date:r.date,amount:paymentMethod(r.method)==="cash"?-Number(r.cashAmount??cashRounded(r.amount)):-Number(r.amount||0),nominalAmount:-Number(r.amount||0),method:paymentMethod(r.method),kind:"refund"});
 }
 return events.filter(e=>Number.isFinite(e.amount)&&e.amount!==0)
   .sort((a,b)=>a.date.localeCompare(b.date)||String(a.id).localeCompare(String(b.id)));
}
export function cashRounded(amount){return roundCents(Math.round(Number(amount)*20)/20)}
export function cashDifference(amount){return roundCents(cashRounded(amount)-Number(amount))}
export function advanceRemaining(entry){
 const used=(entry?.allocations||[]).reduce((sum,a)=>sum+Number(a.amount||0),0);
 const returned=(entry?.refunds||[]).reduce((sum,r)=>sum+Number(r.amount||0),0);
 return Math.max(0,roundCents((isConfirmed(entry)?Number(entry.amount||0):0)-used-returned));
}
export function patientAdvanceBalance(advances,patientId,clinicId){
 return roundCents((advances||[]).filter(a=>a.patientId===patientId&&a.clinicId===clinicId).reduce((n,a)=>n+advanceRemaining(a),0));
}
export function cashDaySummary(invoices,advances,date,clinicId="all"){
 const allowed=x=>clinicId==="all"||x.clinicId===clinicId;
 const rows=[];
 for(const invoice of invoices||[]){
   if(!allowed(invoice))continue;
   for(const p of invoice.payments||[]){
     if(!isConfirmed(p)||paymentMethod(p.method)==="advance"||(p.confirmedDate||p.date)!==date)continue;
     const method=paymentMethod(p.method);
     rows.push({kind:"invoice",direction:"in",invoiceNumber:invoice.number,method,amount:Number(p.amount),cashAmount:method==="cash"?Number(p.cashAmount??cashRounded(p.amount)):0,rounding:method==="cash"?roundCents(Number(p.cashAmount??cashRounded(p.amount))-Number(p.amount)):0,reference:p.reference||"",patientId:invoice.patientId});
   }
   for(const r of invoice.refunds||[])if(r.date===date){
     const method=paymentMethod(r.method);
     rows.push({kind:"refund",direction:"out",invoiceNumber:invoice.number,method,amount:-Number(r.amount),cashAmount:method==="cash"?-Number(r.cashAmount??cashRounded(r.amount)):0,reference:r.reference||"",patientId:invoice.patientId});
   }
 }
 for(const advance of advances||[]){
   if(!allowed(advance))continue;
   if(isConfirmed(advance)&&(advance.confirmedDate||advance.date)===date)
     rows.push({kind:"deposit",direction:"in",invoiceNumber:"Avansas",method:paymentMethod(advance.method),amount:Number(advance.amount),cashAmount:paymentMethod(advance.method)==="cash"?Number(advance.cashAmount??cashRounded(advance.amount)):0,reference:advance.reference||"",patientId:advance.patientId});
   for(const refund of advance.refunds||[])if(refund.date===date)
     rows.push({kind:"advance-refund",direction:"out",invoiceNumber:"Avanso grąžinimas",method:paymentMethod(refund.method),amount:-Number(refund.amount),cashAmount:paymentMethod(refund.method)==="cash"?-Number(refund.cashAmount??cashRounded(refund.amount)):0,reference:refund.reference||"",patientId:advance.patientId});
 }
 const totals={cash:0,card:0,transfer:0};
 for(const row of rows)if(Object.hasOwn(totals,row.method))totals[row.method]=roundCents(totals[row.method]+(row.method==="cash"?row.cashAmount:row.amount));
 return {rows,totals,cashNet:totals.cash,netTotal:roundCents(Object.values(totals).reduce((a,b)=>a+b,0))};
}

/** VLK nėra tos dienos kasos įplauka: tik administraciškai baigtos kompensacijos. */
export function settlementDaySummary(invoices,advances,vlkCases,date,clinicId="all"){
 const cash=cashDaySummary(invoices,advances,date,clinicId);
 const vlkCasesForDay=(vlkCases||[]).filter(c=>c.status==="Baigtas"&&String(c.completedAt||"").slice(0,10)===date&&
   (clinicId==="all"||c.clinicId===clinicId));
 const vlk=roundCents(vlkCasesForDay.reduce((n,c)=>n+Number(c.claimedAmount||0),0));
 return {...cash,vlk,vlkCases:vlkCasesForDay,
   financialTotal:roundCents(cash.netTotal+vlk)};
}
