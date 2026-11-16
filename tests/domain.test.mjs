
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
test("vietinių demonstracinių duomenų migracija yra vienkartinė",()=>{
  const values=new Map();
  const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
  storage.setItem("dentalpro_demo",JSON.stringify({"0-0":{teeth:{"11":{surface:"M",diagnosis:"Ėduonis",treatment:"Demo"}},
    visits:[{date:"2026-11-12",text:"Bandomasis įrašas"}],plans:["Demo plombavimas"]}}));
  const r=openRepository(storage);
  const a=r.get();
  assert.equal(a.findings.length,1);
  assert.equal(a.clinicalNotes.length,1);
  assert.equal(a.plans.length,1);
  assert.equal(a.patients.length,20);
  assert.equal(openRepository(storage).get().findings.length,1);
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
