import test from "node:test";
import assert from "node:assert/strict";
import {seedData,openRepository} from "../src/store.mjs";
import {appointmentIssues,invoiceTotal,isoDate} from "../src/domain.mjs";
import {appointmentIntake,labVisitWarnings,sourceInvoice,duplicateInvoiceIssues,planItemBillingState,
 vlkContributionInvoiceIssues,vlkCombinedAccruals,suspectedRepeatInvoices} from "../src/billing.mjs";
import {paidAmount,invoiceOutstanding,invoiceCashRounding,cashDaySummary,settlementDaySummary} from "../src/payments.mjs";
import {salarySummary} from "../src/compensation.mjs";
import {vlkCaseEarning,vlkSalaryRows,vlkSalaryTotal} from "../src/vlk.mjs";

test("visas registratūros ciklas: registracija, dokumentai, laboratorija, procedūra ir viena sąskaita",()=>{
 const state=seedData("2026-11-17");
 const a=state.appointments[0];
 assert.ok(a);
 assert.ok(appointmentIntake(state,a.id).missing.length>0);
 assert.equal(appointmentIntake(state,a.id).ready,false);
 for(const type of ["agreement","privacy","health"])state.forms.push({
   id:"test-"+type,patientId:a.patientId,type,signedAt:"2026-11-17T10:00:00Z",demo:true
 });
 assert.equal(appointmentIntake(state,a.id).ready,true);
 const plan={id:"plan-1",patientId:a.patientId,clinicId:a.clinicId,title:"Protezo gydymas",
   status:"Vykdomas",items:[{id:"stage-1",description:"Cirkonio vainikėlis",done:true,qty:1,price:160}]};
 state.plans.push(plan);
 const invoice={id:"inv1",number:"DP-1",date:"2026-11-17",clinicId:a.clinicId,patientId:a.patientId,
   appointmentId:a.id,planId:plan.id,planItemId:"stage-1",doctorId:a.staffId,doctorPercent:35,
   items:[{description:"Cirkonio vainikėlis",price:160,qty:1}],payments:[],
   costs:{laboratory:[],materials:[]}};
 assert.equal(duplicateInvoiceIssues(state.invoices,invoice).length,0);
 state.invoices.push(invoice);
 assert.equal(planItemBillingState(state,plan.id,"stage-1").status,"Apmokestinta");
 assert.equal(sourceInvoice(state.invoices,{appointmentId:a.id}).id,invoice.id);
 assert.ok(duplicateInvoiceIssues(state.invoices,{...invoice,id:"inv-duplicate"}).length>0);
 assert.equal(appointmentIntake(state,a.id).invoices.length,1);
 const lab={id:"lab1",patientId:a.patientId,clinicId:a.clinicId,planId:plan.id,
   appointmentId:a.id,description:"Cirkonio vainikėlis",status:"Gaminama"};
 state.labOrders.push(lab);
 assert.equal(labVisitWarnings(state,a).length,1);
 lab.status="Gauta";
 assert.deepEqual(labVisitWarnings(state,a),[]);
});
test("grynųjų apvalinimas: sąskaitos skola 0, kasa +12,05 €, gydytojo atlygis nuo faktinių grynųjų",()=>{
 const invoice={id:"cash1",number:"DP-CASH",clinicId:"akm",patientId:"p-0-0",
   doctorId:"dr-akm-1",doctorPercent:35,
   items:[{price:12.03,qty:1,description:"Gydymas"}],
   costs:{laboratory:[],materials:[]},
   payments:[{id:"p1",date:"2026-11-17",confirmedDate:"2026-11-17",status:"confirmed",
     method:"cash",amount:12.03,cashAmount:12.05,roundingAdjustment:0.02}]};
 assert.equal(invoiceTotal(invoice),12.03);
 assert.equal(paidAmount(invoice),12.03);
 assert.equal(invoiceOutstanding(invoice,invoiceTotal(invoice)),0);
 assert.equal(invoiceCashRounding(invoice),0.02);
 assert.equal(cashDaySummary([invoice],[],"2026-11-17","akm").totals.cash,12.05);
 assert.equal(salarySummary([invoice],"2026-11","akm").total,4.22);
});
test("VLK kompensacija ir priemoka turi vieną savikainą, kol nebaigta – atlygis nulis",()=>{
 const claim={id:"vlk-1",caseNumber:"VLK-1",clinicId:"akm",patientId:"p-0-0",doctorId:"dr-akm-1",
   categoryId:"adult-standard",claimedAmount:500,patientContribution:100,doctorPercent:35,
   costs:{laboratory:[{description:"Vainikėlis",price:95,qty:1}],materials:[{description:"Detalė",price:20,qty:1}]},
   usage:{materials:true,surgicalMaterials:false,materialsFee:5,surgicalMaterialsFee:20},
   status:"Vykdomas",completedAt:""};
 const copay={id:"copay",number:"DP-VLK-1",vlkCaseId:claim.id,kind:"vlk-contribution",clinicId:"akm",
   patientId:"p-0-0",doctorId:"dr-akm-1",doctorPercent:35,
   items:[{description:"Priemoka",price:100,qty:1}],costs:{laboratory:[],materials:[]},
   usage:{materials:false,surgicalMaterials:false},payments:[
     {id:"c1",date:"2026-11-17",status:"confirmed",method:"card",amount:40},
     {id:"c2",date:"2026-12-05",status:"confirmed",method:"transfer",amount:60}
   ]};
 assert.deepEqual(vlkContributionInvoiceIssues(copay,claim),[]);
 assert.equal(salarySummary([copay],"").total,0);
 assert.equal(vlkCaseEarning(claim,[copay]),0);
 claim.status="Baigtas";claim.completedAt="2026-11-20T10:00:00Z";
 assert.equal(vlkSalaryTotal([claim],"2026-11","akm",[copay]),147); // (500 + 40 - 120) × 35%
 assert.equal(vlkSalaryTotal([claim],"2026-12","akm",[copay]),21); // additional 60 × 35%
 assert.equal(vlkCaseEarning(claim,[copay]),168);
 assert.equal(vlkSalaryRows([claim],"2026-11","akm",[copay]).length,1);
 assert.equal(vlkSalaryRows([claim],"2026-12","akm",[copay]).length,1);
 assert.equal(settlementDaySummary([],[],[claim],"2026-11-20","akm").vlk,500);
 assert.equal(settlementDaySummary([copay],[],[claim],"2026-11-20","akm").netTotal,0);
 const dup={...copay,id:"copay2"};
 assert.ok(duplicateInvoiceIssues([copay],dup).length>0);
 assert.ok(vlkContributionInvoiceIssues({...copay,costs:{laboratory:[{price:95}],materials:[]}},claim).length>0);
});
test("nėra tyliai išsaugotų duomenų, jei naršyklės saugykla atmeta įrašymą",()=>{
 const data=seedData("2026-11-17");
 const storage={getItem(){return JSON.stringify(data)},setItem(){throw Error("quota")},removeItem(){}};
 const repository=openRepository(storage);
 const initial=repository.get().patients.length;
 assert.throws(()=>repository.transaction("test","p-0-0",state=>state.patients.pop()),/Nepavyko išsaugoti/);
 assert.equal(repository.get().patients.length,initial);
});


test("rankiniu būdu rašomos tokios pačios paslaugos sąskaitos perspėjamos, tačiau nėra aklai draudžiamos",()=>{
 const old={id:"a",patientId:"p-0-0",clinicId:"akm",date:"2026-11-17",
   items:[{serviceId:"s-cons",price:35,qty:1}]};
 const duplicate={...old,id:"b"};
 assert.equal(suspectedRepeatInvoices([old],duplicate).length,1);
 assert.equal(suspectedRepeatInvoices([old],{...duplicate,date:"2026-11-18"}).length,0);
 assert.equal(suspectedRepeatInvoices([old],{...duplicate,items:[{serviceId:"s-cons",price:35,qty:2}]}).length,0);
});
test("grynųjų grąžinimų ir avansų apvalinimo skirtumai matomi dienos uždaryme",()=>{
 const invoice={clinicId:"akm",patientId:"p-0-0",number:"DP-R",payments:[
  {id:"payment",date:"2026-11-17",confirmedDate:"2026-11-17",status:"confirmed",method:"cash",amount:12.03,cashAmount:12.05}],
 refunds:[{id:"refund",date:"2026-11-17",method:"cash",amount:2.03,cashAmount:2.05}]};
 const advances=[{id:"advance",clinicId:"akm",patientId:"p-0-0",date:"2026-11-17",
  status:"confirmed",method:"cash",amount:5.03,cashAmount:5.05,allocations:[],refunds:[]}];
 const day=cashDaySummary([invoice],advances,"2026-11-17","akm");
 assert.equal(day.totals.cash,15.05);
 assert.equal(day.roundingTotal,0.02);
 assert.equal(day.rows.find(r=>r.kind==="refund").rounding,-0.02);
});
test("VLK vienos plano procedūros ryšys neturi blokuoti kitų to paties plano etapų",()=>{
 const state=seedData("2026-11-17");
 state.plans.push({id:"plan-2",patientId:"p-0-0",clinicId:"akm",items:[
  {id:"line-1",description:"Protezas",done:true},
  {id:"line-2",description:"Privati konsultacija",done:true}
 ]});
 state.vlkCases.push({id:"vlk-1",planId:"plan-2",planItemId:"line-1",status:"Vykdomas"});
 assert.equal(planItemBillingState(state,"plan-2","line-1").status,"VLK atvejis");
 assert.equal(planItemBillingState(state,"plan-2","line-2").status,"Paruošta apmokestinti");
});
