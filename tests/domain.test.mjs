
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {seedData,openRepository,STORAGE_KEY} from "../src/store.mjs";
import {appointmentIssues,minutes,overlaps,validDate,shiftDate,invoiceTotal,planTotal} from "../src/domain.mjs";

function fixture(){
  const state=seedData("2026-11-16");
  state.appointments=[];
  return state;
}
function visit(overrides={}){
  return {
    id:"new",clinicId:"akm",chairId:"akm-1",patientId:"p-0-0",
    staffId:"dr-akm-1",date:"2026-11-16",time:"10:00",duration:30,
    serviceId:"s-cons",status:"Registruotas",notes:"",...overrides
  };
}
test("bazinis laisvas vizitas atitinka visas taisykles",()=>{
  assert.deepEqual(appointmentIssues(fixture(),visit()),[]);
});
test("neleidžiamas kėdės užimtumo persidengimas, kai gydytojai skiriasi",()=>{
  const s=fixture();s.appointments.push(visit({id:"a",staffId:"dr-akm-2",time:"09:45",duration:30}));
  assert.match(appointmentIssues(s,visit()).join(" "),/Kėdė jau užimta/);
});
test("neleidžiamas gydytojo persidengimas skirtingose kėdėse",()=>{
  const s=fixture();s.appointments.push(visit({id:"a",chairId:"akm-2",time:"09:45"}));
  assert.match(appointmentIssues(s,visit()).join(" "),/Gydytojas jau užimtas/);
});
test("gretimos registracijos nesikerta",()=>{
  const s=fixture();s.appointments.push(visit({id:"a",time:"09:30",duration:30}));
  assert.deepEqual(appointmentIssues(s,visit({time:"10:00"})),[]);
  assert.equal(overlaps(570,600,600,630),false);
});
test("skirtingų klinikų ištekliai nekonfliktuoja",()=>{
  const s=fixture();s.appointments.push(visit({id:"a"}));
  const other=visit({clinicId:"kur",chairId:"kur-1",patientId:"p-1-0",staffId:"dr-kur-1"});
  assert.deepEqual(appointmentIssues(s,other),[]);
});
test("vienas bendras gydytojas negali persidengti tarp klinikų",()=>{
  const s=fixture();
  s.staff[0].clinicIds.push("kur");
  s.staff[0].availability.push(...s.staff[2].availability);
  s.staff[0].breaks.push(...s.staff[2].breaks);
  s.appointments.push(visit({id:"a"}));
  const conflicting=visit({clinicId:"kur",chairId:"kur-1",patientId:"p-1-0",staffId:"dr-akm-1"});
  assert.match(appointmentIssues(s,conflicting).join(" "),/Gydytojas jau užimtas/);
});
test("atšauktas vizitas neužblokuoja kėdės ir gydytojo",()=>{
  const s=fixture();s.appointments.push(visit({id:"a",status:"Atšauktas"}));
  assert.deepEqual(appointmentIssues(s,visit()),[]);
  s.appointments[0].status="Registruotas";
  assert.deepEqual(appointmentIssues(s,visit({status:"Atšauktas"})),[]);
});
test("gydytojo pertraukos negalima persidengti",()=>{
  const s=fixture();assert.match(appointmentIssues(s,visit({time:"11:45",duration:30})).join(" "),/pertrauką/);
});
test("vizitas negalimas prieš pamainą, po pamainos ir savaitgalį",()=>{
  const s=fixture();
  assert.match(appointmentIssues(s,visit({time:"07:00"})).join(" "),/nedirba/);
  assert.match(appointmentIssues(s,visit({time:"18:00"})).join(" "),/nedirba/);
  assert.match(appointmentIssues(s,visit({date:"2026-11-22"})).join(" "),/nedirba/);
});
test("valandų ir datų ribos",()=>{
  const s=fixture();
  s.staff[0].availability=[{clinicId:"akm",weekday:1,start:"07:00",end:"22:00"}];
  s.staff[0].breaks=[];
  assert.deepEqual(appointmentIssues(s,visit({time:"21:30",duration:30})),[]);
  assert.match(appointmentIssues(s,visit({time:"21:45",duration:30})).join(" "),/22:00/);
  assert.equal(validDate("2026-02-29"),false);
  assert.equal(validDate("2028-02-29"),true);
  assert.equal(shiftDate("2026-12-31",1),"2027-01-01");
  assert.equal(minutes("24:00"),Number.NaN);
});
test("nurodyta kėdė turi priklausyti tai pačiai klinikai",()=>{
  assert.match(appointmentIssues(fixture(),visit({chairId:"kur-1"})).join(" "),/nepriklauso/);
});
test("finansinės sumos apima eilutes ir kiekius",()=>{
  assert.equal(invoiceTotal({items:[{price:20,qty:2},{price:12,qty:1}]}),52);
  assert.equal(planTotal({items:[{price:10,qty:3}]}),30);
});
test("v3 demo aplinka neperkelia ankstesnių vietinių duomenų",()=>{
  const values=new Map();
  const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
  storage.setItem("dentalpro_demo",JSON.stringify({"0-0":{teeth:{"11":{surface:"M",diagnosis:"Ėduonis"}},
    visits:[{date:"2026-11-12",text:"Asmeniniai duomenys neperkeliami"}]}}));
  storage.setItem("dentalpro_v2_demo",JSON.stringify({version:2,patients:[{firstName:"Nesaugus"}]}));
  const state=openRepository(storage).get();
  assert.equal(state.version,3);
  assert.equal(state.patients.length,20);
  assert.ok(state.patients.every(p=>p.synthetic===true));
  assert.equal(state.clinicalNotes.length,0);
  assert.equal(state.findings.length,0);
  assert.ok(values.has(STORAGE_KEY));
});
test("saugyklos operacijos izoliuotos ir atstatomos",()=>{
  const values=new Map();
  const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
  const r=openRepository(storage);
  const snapshot=r.get();
  snapshot.patients[0].firstName="Modifikuotas";
  assert.notEqual(r.get().patients[0].firstName,"Modifikuotas");
  r.transaction("test","x",state=>state.patients.push({id:"fake",firstName:"Test",lastName:"Demo",clinicIds:["akm"]}));
  assert.equal(r.get().patients.length,21);
  assert.equal(r.reset().patients.length,20);
});
test("pagrindinė demonstracija išlaiko senąją versiją",()=>{
  const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
  const legacy=readFileSync(new URL("../legacy.html",import.meta.url),"utf8");
  assert.match(html,/src\/views.mjs/);
  assert.match(legacy,/DentalCalendar/);
  assert.match(html,/lang="lt"/);
  assert.ok(!html.includes("realūs pacientų duomenys"));
});
 
import {mkCatalog,priceOptions} from "../src/pricelist.mjs";

test("MK kainynas: 130 suskaidytų procedūrų su kategorijomis",()=>{
  const services=mkCatalog();
  assert.ok(services.length>=125);
  assert.ok(new Set(services.map(s=>s.category)).size>=10);
  assert.equal(services.find(s=>s.name.includes("Šviesoje kietėjanti plomba – maža")).priceMin,50);
  assert.equal(services.find(s=>s.name.includes("Šviesoje kietėjanti plomba – maža")).priceMax,60);
  assert.ok(services.some(s=>s.priceMax===null));
});

test("gydymo plano kainų intervalai pateikiami 10 eurų žingsniais",()=>{
  assert.deepEqual(priceOptions({priceMin:50,priceMax:70}),[50,60,70]);
  assert.deepEqual(priceOptions({priceMin:35,priceMax:50}),[35,40,50]);
  assert.deepEqual(priceOptions({priceMin:20,priceMax:25}),[20,25]);
  assert.deepEqual(priceOptions({priceMin:50,priceMax:50}),[50]);
  assert.deepEqual(priceOptions({priceMin:null,priceMax:null}),[]);
});

test("pacientas turi priklausyti klinikai ir negali būti užregistruotas du kartus",()=>{
  const state=fixture();
  assert.match(appointmentIssues(state,visit({patientId:"p-1-0"})).join(" "),/pacientą, priskirtą/);
  state.appointments.push(visit({id:"previous",chairId:"akm-1",staffId:"dr-akm-1"}));
  const other=visit({id:"next",chairId:"akm-2",staffId:"dr-akm-2"});
  assert.match(appointmentIssues(state,other).join(" "),/Pacientas jau turi vizitą/);
});
test("neatvykęs pacientas neužblokuoja naujo laiko",()=>{
 const state=fixture();state.appointments.push(visit({id:"old",status:"Neatvyko"}));
 assert.deepEqual(appointmentIssues(state,visit()),[]);
});

import {FORM_TYPES,FORM_VERSION,HEALTH_QUESTIONS,validateForm} from "../src/forms.mjs";

test("keturi skirtingi pacientų dokumentai ir atskiri parašai",()=>{
 assert.equal(FORM_TYPES.length,4);
 assert.ok(FORM_VERSION.includes("demo"));
 for(const form of FORM_TYPES){
   assert.ok(validateForm(form.id,{},null).length>0,form.id+" requires patient fields and signature");
 }
});
test("BDAR informavimas nereiškia privalomo sutikimo rinkodarai",()=>{
 const answers={representative:"Testas Demonstracinis",notice:"Susipažinau",controller:"Demo",contact:"Demo",marketing:"Nesutinku"};
 const signature="data:image/png;base64,"+"A".repeat(200);
 assert.deepEqual(validateForm("privacy",answers,signature),[]);
});
test("sveikatos anketoje privalomi visi klausimai, tačiau ne tikri medicininiai duomenys",()=>{
 const answers={representative:"Demo",...Object.fromEntries(HEALTH_QUESTIONS.map(([id])=>["q_"+id,"Ne"]))};
 const signature="data:image/png;base64,"+"A".repeat(200);
 assert.deepEqual(validateForm("health",answers,signature),[]);
 delete answers.q_allergies;
 assert.ok(validateForm("health",answers,signature).length>0);
});
test("invazinių procedūrų sutikimui būtina individuali procedūros informacija",()=>{
 const answers={representative:"Demo",procedure:"Išgalvota procedūra",purpose:"Demo",alternatives:"Demo",
 risksCommon:"Demo",risksRare:"Demo",risksIndividual:"Demo",anesthesia:"Demo",anesthesiaRisks:"Demo",
 refusalRisks:"Demo",scope:"Demo",clinician:"Demo gydytojas",decision:"Sutinku"};
 const signature="data:image/png;base64,"+"A".repeat(200);
 assert.deepEqual(validateForm("invasive",answers,signature),[]);
 assert.ok(validateForm("invasive",{...answers,alternatives:""},signature).length>0);
 assert.ok(validateForm("invasive",answers,null).length>0);
});

import {registrationChecklist,invasiveConsentForItem,FORM_DISCLOSURES} from "../src/forms.mjs";

test("registracijai skaičiuojamos 3 atskiros pasirašytos formos, ne invazinis sutikimas",()=>{
 const records=[
  {id:"a",type:"agreement",patientId:"p1",signedAt:"2026-11-17T12:00:00Z",demo:true},
  {id:"h",type:"health",patientId:"p1",signedAt:"2026-11-17T12:01:00Z",demo:true},
  {id:"x",type:"invasive",patientId:"p1",signedAt:"2026-11-17T12:02:00Z",demo:true}
 ];
 const checks=registrationChecklist(records,"p1");
 assert.equal(checks.length,3);
 assert.deepEqual(checks.map(x=>x.signed),[true,false,true]);
 assert.ok(registrationChecklist(records,"p2").every(x=>!x.signed));
});
test("invazinis sutikimas susiejamas tik su paciento plano konkrečia procedūra",()=>{
 const records=[
  {id:"a",type:"invasive",patientId:"p1",planId:"plan-a",planItemId:"item-a",signedAt:"2026-11-17T12:00:00Z",demo:true,answers:{decision:"Sutinku"}},
  {id:"b",type:"invasive",patientId:"p1",planId:"plan-b",planItemId:"item-b",signedAt:"2026-11-17T13:00:00Z",demo:true,answers:{decision:"Atsisakau"}}
 ];
 assert.equal(invasiveConsentForItem(records,"p1","plan-a","item-a").id,"a");
 assert.equal(invasiveConsentForItem(records,"p1","plan-a","item-b"),null);
 assert.equal(invasiveConsentForItem(records,"p2","plan-a","item-a"),null);
 assert.ok(Object.values(FORM_DISCLOSURES).every(text=>text.length>100));
});

import {DEFAULT_LAB_WORK,invoiceCosts,salaryEntitlement,salaryAccruals,salarySummary,parseLaboratoryCsv,validCost} from "../src/compensation.mjs";

test("atlyginimas: gauta suma minus laboratorija minus medžiagos kart gydytojo procentas",()=>{
 assert.equal(salaryEntitlement(600,{lab:120,materials:40},35),154);
 assert.equal(salaryEntitlement(100,{lab:120,materials:40},35),0);
 assert.equal(salaryEntitlement(600,{lab:120,materials:40},101),0);
});
test("mokėjimų dalimis apskaita išskaido atlyginimą pagal mokėjimo mėnesį be dubliavimo",()=>{
 const invoice={id:"demo-invoice",number:"DP-1",doctorId:"dr-akm-1",doctorPercent:35,
   clinicId:"akm",patientId:"p-0-0",items:[{description:"Protezavimas",price:600,qty:1}],
   costs:{laboratory:[{description:"Cirkonio vainikėlis",price:120,qty:1}],materials:[{description:"Multiunitas",price:40,qty:1}]},
   payments:[{id:"p1",date:"2026-11-10",amount:100},{id:"p2",date:"2026-11-21",amount:300},{id:"p3",date:"2026-12-04",amount:200}]};
 assert.deepEqual(invoiceCosts(invoice),{lab:120,materials:40,standard:0,surgical:0});
 const entries=salaryAccruals([invoice]);
 assert.deepEqual(entries.map(e=>e.earning),[0,84,70]);
 assert.equal(salarySummary([invoice],"2026-11").total,84);
 assert.equal(salarySummary([invoice],"2026-12").total,70);
 assert.equal(salarySummary([invoice],"2026-12","kur").total,0);
 assert.equal(salarySummary([invoice],"").total,154);
});
test("laboratorijos įkainiai į sąskaitą perkeliami kaip fiksuotos kopijos",()=>{
 const source=DEFAULT_LAB_WORK[0],cost={description:source.name,price:source.price,qty:1};
 const invoice={costs:{laboratory:[cost],materials:[]}};
 assert.equal(invoiceCosts(invoice).lab,95);
 source.price=95; // pakeistas kainynas neturėtų reikšmės esamai sąskaitai
 assert.equal(invoiceCosts(invoice).lab,95);
 assert.ok(validCost("Stiklo pluošto kaištis",20,2));
 assert.equal(validCost("Multiunitas",-1,1),false);
 assert.equal(validCost("Multiunitas",20,0),false);
});
test("CSV laboratorijos kainynas skaito Excel eksportą ir atmeta klaidas",()=>{
 const parsed=parseLaboratoryCsv("Laboratorija;Darbas;Kaina\nDemo A;Cirkonio vainikėlis;95,50\nDemo B;E-MAX;110");
 assert.equal(parsed.length,2);
 assert.equal(parsed[0].price,95.5);
 assert.equal(parsed[1].laboratory,"Demo B");
 assert.throws(()=>parseLaboratoryCsv("Laboratorija;Darbas;Kaina\nDemo A;Testas;-5"));
});


test("standartinių medžiagų 5 € atskaitymas mažina tik gydytojo atlygio bazę",()=>{
 const invoice={items:[{price:100,qty:1}],usage:{materials:true,surgicalMaterials:false},
  costs:{laboratory:[],materials:[]},doctorId:"dr-akm-1",doctorPercent:40,
  clinicId:"akm",patientId:"p-0-0",number:"DP-5",payments:[{id:"pay5",date:"2026-11-10",amount:100}]};
 assert.deepEqual(invoiceCosts(invoice),{lab:0,materials:0,standard:5,surgical:0});
 assert.equal(invoiceTotal(invoice),100);
 assert.equal(salaryAccruals([invoice])[0].earning,38);
});
test("chirurginių medžiagų 20 € atskaitymas ir abiejų žymų sudėtis",()=>{
 const invoice={items:[{price:100,qty:1}],usage:{materials:false,surgicalMaterials:true},
  costs:{laboratory:[],materials:[]},doctorId:"dr-akm-1",doctorPercent:40,
  clinicId:"akm",patientId:"p-0-0",number:"DP-20",payments:[{id:"pay20",date:"2026-11-10",amount:100}]};
 assert.equal(invoiceCosts(invoice).surgical,20);
 assert.equal(salaryAccruals([invoice])[0].earning,32);
 invoice.usage.materials=true;
 assert.equal(salaryAccruals([invoice])[0].earning,30);
 assert.equal(invoiceTotal(invoice),100);
});
test("daliniuose mokėjimuose fiksuotos medžiagos atskaitomos vieną kartą",()=>{
 const invoice={id:"partial-usage",items:[{price:100,qty:1}],usage:{materials:true,surgicalMaterials:true},
  costs:{laboratory:[],materials:[]},doctorId:"dr-akm-1",doctorPercent:40,
  clinicId:"akm",patientId:"p-0-0",number:"DP-25",
  payments:[{id:"a",date:"2026-11-10",amount:20},{id:"b",date:"2026-12-10",amount:80}]};
 assert.deepEqual(salaryAccruals([invoice]).map(x=>x.earning),[0,30]);
 assert.equal(salarySummary([invoice],"2026-11").total,0);
 assert.equal(salarySummary([invoice],"2026-12").total,30);
});

import {DEFAULT_USAGE_FEES,usageFeeSnapshot,validUsageFee} from "../src/compensation.mjs";

test("medžiagų ir chirurginių medžiagų tarifai keičiami, tačiau išsaugoti sąskaitoje lieka tie patys",()=>{
 const configured={materials:7.5,surgicalMaterials:27};
 const snapshot=usageFeeSnapshot({materials:true,surgicalMaterials:true},configured);
 assert.deepEqual(snapshot,{materials:true,surgicalMaterials:true,materialsFee:7.5,surgicalMaterialsFee:27});
 const invoice={items:[{price:150,qty:1}],usage:snapshot,
   doctorId:"dr-akm-1",doctorPercent:40,clinicId:"akm",number:"DP-NEW",
   payments:[{id:"p-new",date:"2026-11-17",amount:150}]};
 assert.deepEqual(invoiceCosts(invoice),{lab:0,materials:0,standard:7.5,surgical:27});
 assert.equal(salaryAccruals([invoice])[0].earning,46.2);
 configured.materials=10;configured.surgicalMaterials=40;
 assert.equal(salaryAccruals([invoice])[0].earning,46.2);
 assert.equal(invoiceTotal(invoice),150);
 assert.deepEqual(DEFAULT_USAGE_FEES,{materials:5,surgicalMaterials:20});
});
test("nepažymėti atskaitymai netaikomi, naujam tarifui galioja įvesties patikra",()=>{
 const usage=usageFeeSnapshot({materials:false,surgicalMaterials:true},{materials:9,surgicalMaterials:32});
 assert.equal(invoiceCosts({usage}).standard,0);
 assert.equal(invoiceCosts({usage}).surgical,32);
 assert.equal(validUsageFee(""),false);
 assert.equal(validUsageFee(-1),false);
 assert.equal(validUsageFee(1001),false);
 assert.equal(validUsageFee("15,00"),false);
 assert.equal(validUsageFee("7.50"),true);
});

import {VLK_CATEGORIES,vlkAmountIssues,vlkCaseIssues,vlkCaseEarning,vlkSalaryRows,vlkSalaryTotal} from "../src/vlk.mjs";

test("VLK kompensacija turi tik faktiškai suteiktų paslaugų sumą, ne visą maksimalią ribą",()=>{
 assert.ok(VLK_CATEGORIES.some(c=>c.id==="child-primary"&&c.limit===342.13));
 assert.ok(VLK_CATEGORIES.some(c=>c.id==="adult-standard"&&c.limit===670.39));
 assert.ok(VLK_CATEGORIES.some(c=>c.id==="adult-complex"&&c.limit===2062.70));
 assert.deepEqual(vlkAmountIssues("adult-standard",500,0),[]);
 assert.ok(vlkAmountIssues("adult-standard",671,0).length>0);
 assert.ok(vlkAmountIssues("child-primary",400,0).length>0);
 assert.deepEqual(vlkAmountIssues("referral-consultation",42,0),[]);
});
test("VLK atlygis tik užbaigus atvejį ir tik nuo faktinės sumos su savikaina",()=>{
 const sample={id:"vlk-demo",caseNumber:"VLK-DEMO-1",categoryId:"adult-standard",
 clinicId:"akm",patientId:"p-0-0",doctorId:"dr-akm-1",doctorPercent:40,
 claimedAmount:500,patientContribution:100,status:"Vykdomas",completedAt:"",
 costs:{laboratory:[{price:100,qty:1}],materials:[{price:20,qty:1}]},
 usage:{materials:true,surgicalMaterials:false,materialsFee:5,surgicalMaterialsFee:20},demo:true};
 assert.equal(vlkCaseEarning(sample),0);
 assert.equal(vlkSalaryTotal([sample],"2026-11"),0);
 sample.status="Baigtas";sample.completedAt="2026-11-17T12:00:00.000Z";
 assert.equal(vlkCaseEarning(sample),150);
 assert.equal(vlkSalaryTotal([sample],"2026-11"),150);
 assert.equal(vlkSalaryRows([sample],"2026-12").length,0);
 assert.equal(vlkSalaryRows([sample],"2026-11","kur").length,0);
 assert.equal(vlkSalaryRows([sample],"2026-11","akm").length,1);
 assert.equal(vlkCaseEarning({...sample,claimedAmount:750}),0);
});
test("VLK konsultacijai reikalingas siuntimas ir atskira klinikos sutartis",()=>{
 const state=seedData("2026-11-17");
 const sample={id:"vlk-a",categoryId:"referral-consultation",clinicId:"akm",patientId:"p-0-0",
 doctorId:"dr-akm-1",doctorPercent:35,claimedAmount:35,patientContribution:0,
 referralReference:"",status:"Planuojamas"};
 const contracts={akm:{consultation:true,prosthetics:false}};
 assert.ok(vlkCaseIssues(sample,contracts,state.patients,state.staff).some(x=>x.includes("siuntimo")));
 sample.referralReference="SIUNTIMAS-DEMO";
 assert.deepEqual(vlkCaseIssues(sample,contracts,state.patients,state.staff),[]);
 assert.ok(vlkCaseIssues({...sample,categoryId:"adult-standard"},contracts,state.patients,state.staff).some(x=>x.includes("sutartis")));
});
test("nauja VLK demo saugykla nekeičia ankstesnių pacientų duomenų ir sutartys iš pradžių nepatvirtintos",()=>{
 const data=seedData("2026-11-17");
 assert.deepEqual(data.vlkCases,[]);
 assert.equal(data.vlkContracts.akm.prosthetics,false);
 assert.equal(data.vlkContracts.kur.consultation,false);
});
