// Demonstracinės sąskaitų ir PSDF priemokų kontrolės taisyklės.
import {roundEuro,salaryEntitlement,invoiceCosts} from "./compensation.mjs";
import {paymentEvents} from "./payments.mjs";
export function sourceInvoice(invoices,source,excludeId=""){
 if(!source)return null;
 const {appointmentId,planItemId,vlkCaseId}=source;
 return (invoices||[]).find(i=>i.id!==excludeId&&(
  (appointmentId&&i.appointmentId===appointmentId)||
  (planItemId&&i.planItemId===planItemId)||
  (vlkCaseId&&i.vlkCaseId===vlkCaseId)
 ))||null;
}
export function duplicateInvoiceIssues(invoices,candidate){
 const existing=sourceInvoice(invoices,candidate,candidate.id);
 return existing?[("Už šį vizitą, gydymo plano procedūrą arba VLK priemoką sąskaita jau sukurta: "+existing.number)]:[];
}
export function planItemBillingState(state,planId,itemId){
 const plan=(state.plans||[]).find(p=>p.id===planId),item=plan?.items.find(x=>x.id===itemId);
 if(!plan||!item)return {status:"Nerasta",invoice:null};
 const invoice=sourceInvoice(state.invoices,{planItemId:itemId});
 const vlkCase=(state.vlkCases||[]).find(c=>c.planId===planId&&c.status!=="Atmestas");
 if(invoice)return {status:"Apmokestinta",invoice};
 if(vlkCase)return {status:"VLK atvejis",invoice:null,vlkCase};
 return {status:item.done?"Paruošta apmokestinti":"Planuojama",invoice:null};
}
export function appointmentIntake(state,appointmentId){
 const a=(state.appointments||[]).find(a=>a.id===appointmentId);
 if(!a)return null;
 const forms=state.forms||[],patient=(state.patients||[]).find(p=>p.id===a.patientId);
 const latest=type=>forms.filter(f=>f.patientId===a.patientId&&f.type===type&&f.signedAt).sort((x,y)=>String(y.signedAt).localeCompare(String(x.signedAt)))[0];
 const documents=[{type:"agreement",label:"Paciento sutartis"},{type:"privacy",label:"BDAR informavimas"},{type:"health",label:"Sveikatos anketa"}].map(x=>({...x,signed:!!latest(x.type)}));
 const review=patient?.healthReviewRequired===true;
 const invoices=(state.invoices||[]).filter(i=>i.appointmentId===a.id);
 const missing=documents.filter(d=>!d.signed);
 return {appointment:a,patient,documents,review,missing,invoices,
   ready:!review&&!missing.length,
   status:a.status};
}
export function labVisitWarnings(state,appointment){
 const orders=(state.labOrders||[]).filter(o=>o.patientId===appointment.patientId&&
 o.clinicId===appointment.clinicId&&o.status!=="Atšaukta"&&
 ((o.appointmentId&&o.appointmentId===appointment.id)||
  (o.planItemId&&o.planItemId===appointment.planItemId)||
  (!o.appointmentId&&!o.planItemId&&o.planId&&o.planId===appointment.planId)));
 return orders.filter(o=>!["Gauta","Atiduota"].includes(o.status)).map(o=>
  "Laboratorijos darbas „"+o.description+"“ dar negautas (būsena: "+o.status+").");
}
export function vlkContributionInvoiceIssues(invoice,caseRecord){
 if(!caseRecord)return ["VLK atvejis nerastas."];
 const expected=roundEuro(Number(caseRecord.patientContribution||0));
 const total=roundEuro((invoice.items||[]).reduce((n,x)=>n+Number(x.price||0)*Number(x.qty||1),0));
 const issues=[];
 if(!(expected>0))issues.push("VLK atvejui paciento priemoka nenustatyta.");
 if(Math.abs(total-expected)>0.001)issues.push("Paciento priemokos sąskaita turi sutapti su atvejo priemoka.");
 if(invoice.patientId!==caseRecord.patientId||invoice.clinicId!==caseRecord.clinicId||invoice.doctorId!==caseRecord.doctorId)
  issues.push("Pacientas, klinika arba gydytojas nesutampa su VLK atveju.");
 if((invoice.costs?.laboratory?.length||0)||(invoice.costs?.materials?.length||0)||invoice.usage?.materials||invoice.usage?.surgicalMaterials)
  issues.push("VLK ir priemokos bendra savikaina priskiriama tik VLK atvejui.");
 return issues;
}
/** VLK atlygio įvykiai: savikaina nurašoma vieną kartą.
 * Paciento priemokos įmokos iki VLK užbaigimo atlygio nedidina;
 * vėlesni įvykiai atlyginimą koreguoja gavimo / grąžinimo mėnesį.
 */
export function vlkCombinedAccruals(record,invoices=[]){
 if(record?.status!=="Baigtas"||!record.completedAt)return [];
 const completedDate=String(record.completedAt).slice(0,10);
 const cost=invoiceCosts(record),pct=record.doctorPercent;
 const contributionInvoices=(invoices||[]).filter(i=>i.vlkCaseId===record.id);
 const events=contributionInvoices.flatMap(paymentEvents).sort((a,b)=>a.date.localeCompare(b.date)||String(a.id).localeCompare(String(b.id)));
 const eventsBefore=events.filter(e=>e.date<=completedDate),eventsAfter=events.filter(e=>e.date>completedDate);
 let received=Math.max(0,Number(record.claimedAmount)||0),earned=0;
 for(const e of eventsBefore)received+=e.amount;
 received=Math.max(0,roundEuro(received));
 const initial=salaryEntitlement(received,cost,pct);earned=initial;
 const rows=[{id:record.id,date:completedDate,kind:"vlk-completed",earning:initial,received:roundEuro(received),
  claimedAmount:Number(record.claimedAmount),contributionReceived:roundEuro(eventsBefore.reduce((n,e)=>n+e.amount,0))}];
 for(const e of eventsAfter){
  received=Math.max(0,roundEuro(received+e.amount));
  const next=salaryEntitlement(received,cost,pct);
  rows.push({id:e.id,date:e.date,kind:e.kind,earning:roundEuro(next-earned),received,claimedAmount:0,contributionReceived:e.amount});
  earned=next;
 }
 return rows;
}
