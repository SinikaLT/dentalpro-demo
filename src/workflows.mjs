import {registrationChecklist} from "./forms.mjs";
import {paidAmount,invoiceOutstanding} from "./payments.mjs";
import {invoiceTotal} from "./domain.mjs";
export const fold=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
export const phoneDigits=value=>String(value||"").replace(/\D/g,"");
export function searchPatients(patients,term){
 const q=fold(term),digits=phoneDigits(term);
 if(!q)return patients;
 return (patients||[]).filter(p=>
  fold(p.firstName+" "+p.lastName).includes(q)||
  fold(p.lastName+" "+p.firstName).includes(q)||
  (digits.length>=3&&phoneDigits(p.phone).includes(digits))||
  fold(p.email).includes(q));
}
export function duplicatePatients(patients,candidate,excludeId=""){
 const phone=phoneDigits(candidate.phone);
 return (patients||[]).filter(p=>p.id!==excludeId&&(
   (phone.length>=7&&phoneDigits(p.phone)===phone)||
   (fold(p.firstName)===fold(candidate.firstName)&&fold(p.lastName)===fold(candidate.lastName)&&
    !!p.birthDate&&p.birthDate===candidate.birthDate)
 ));
}
export function receptionistDashboard(state,date,clinicId="all"){
 const scope=cid=>clinicId==="all"||cid===clinicId;
 const appointments=(state.appointments||[]).filter(a=>a.date===date&&scope(a.clinicId)&&a.status!=="Atšauktas").sort((a,b)=>a.time.localeCompare(b.time));
 const documents=appointments.filter(a=>registrationChecklist(state.forms,a.patientId).some(x=>!x.signed));
 const awaiting=appointments.filter(a=>a.status==="Registruotas");
 const invoices=(state.invoices||[]).filter(i=>scope(i.clinicId));
 const debts=invoices.filter(i=>invoiceOutstanding(i,invoiceTotal(i))>0.001);
 const overdueTasks=(state.tasks||[]).filter(t=>scope(t.clinicId)&&t.status!=="Atlikta"&&t.dueDate<=date);
 const readyOrders=(state.labOrders||[]).filter(o=>scope(o.clinicId)&&o.status==="Gauta");
 const lateOrders=(state.labOrders||[]).filter(o=>scope(o.clinicId)&&!["Gauta","Atiduota","Atšaukta"].includes(o.status)&&o.dueDate&&o.dueDate<date);
 return {appointments,documents,awaiting,debts,overdueTasks,readyOrders,lateOrders,
  outstanding:Math.round(debts.reduce((sum,i)=>sum+invoiceOutstanding(i,invoiceTotal(i)),0)*100)/100};
}
export const LAB_ORDER_STATUSES=["Užsakyta","Gaminama","Gauta","Atiduota","Atšaukta"];
export const TASK_STATUSES=["Atvira","Atlikta"];
export const WAITLIST_STATUSES=["Laukia","Pasiūlytas laikas","Užregistruotas","Atšaukta"];
