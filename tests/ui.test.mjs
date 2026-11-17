import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

test("standalone demonstracija paleidžiama ir atveria pagrindinius modulius be išorinių bibliotekų",()=>{
  const html=readFileSync(new URL("../demo-standalone.html",import.meta.url),"utf8");
  const script=html.match(/<script>\n([\s\S]*?)\n<\/script>/)?.[1];
  assert.ok(script?.includes("start();"),"Bundled app must contain startup");
  const elements=new Map(),listeners=new Map(),saved=new Map();
  function node(id){
    if(!elements.has(id))elements.set(id,{
      id,innerHTML:"",value:"",textContent:"",
      addEventListener(type,callback){listeners.set(id+":"+type,callback)},
      focus(){},setSelectionRange(){},querySelector(){return null}
    });
    return elements.get(id);
  }
  const document={
    getElementById:node,querySelectorAll(){return []},querySelector(){return null},
    addEventListener(type,handler){listeners.set(type,handler)},
    body:{appendChild(){}},createElement(){return {remove(){}}}
  };
  const localStorage={
    getItem:key=>saved.get(key)??null,setItem:(key,v)=>saved.set(key,v),removeItem:key=>saved.delete(key)
  };
  const context={document,localStorage,setTimeout(){return 1},clearTimeout(){},URL,Date,console};
  vm.runInNewContext(script+"\nglobalThis.__hooks = {ui,route,render,modal,handleAction,handleChange,update,get db(){return db}};",context,{timeout:8000});
  const hooks=context.__hooks;
  assert.ok(node("page").innerHTML.includes("Registratūros darbo vieta"));
  assert.equal(hooks.db.clinics.length,2);
  assert.equal(hooks.db.chairs.length,4);
  assert.equal(hooks.db.patients.length,20);
  for(const r of ["calendar","patients","laborders","doctors","odontogram","plans","notes","finances","forms","reports","compensation","services","vlk","admin"]){
    hooks.route(r);
    assert.match(node("page").innerHTML,/<h1>/);
    assert.ok(node("page").innerHTML.length>200,r+" should render");
  }
  hooks.route("vlk");
  assert.match(node("page").innerHTML,/Faktinė kompensuojama suma/);
  assert.match(node("page").innerHTML,/PSDF atvejai ir būsenos/);
  hooks.route("overview");
  assert.match(node("page").innerHTML,/Neatliktos užduotys/);
  assert.match(node("page").innerHTML,/Pridėti užduotį/);
  assert.match(node("page").innerHTML,/add-waitlist/);
  assert.match(node("page").innerHTML,/work-payment/);
  assert.match(node("page").innerHTML,/Laukiančiųjų sąrašas/);
  hooks.route("laborders");
  assert.match(node("page").innerHTML,/Pridėti laboratorijos užsakymą/);
  assert.match(node("page").innerHTML,/lab-order-form/);
  hooks.route("finances");
  const finance=node("page").innerHTML;
  for(const phrase of ["Grynaisiais","Kortele","Pavedimu","VLK (baigti atvejai)","Banko pavedimų suderinimas","Pacientų avansai","Dienos kasos uždarymas","Eksportuoti dienos CSV"]){
    assert.ok(finance.includes(phrase),phrase+" must appear in the daily settlement UI");
  }
  hooks.modal("invoice");
  assert.match(node("drawer-root").innerHTML,/usageMaterials/);
  hooks.modal("appointment");
  assert.match(node("drawer-root").innerHTML,/suggest-appt-slot/);
  assert.match(node("drawer-root").innerHTML,/new-patient-from-appt/);
  assert.match(node("drawer-root").innerHTML,/reminderStatus/);
  hooks.modal("intake",hooks.db.appointments[0].id);
  const intake=node("drawer-root").innerHTML;
  assert.match(intake,/Paciento priėmimas/);
  assert.match(intake,/Registracijos dokumentai/);
  assert.match(intake,/Laboratorijos darbų parengtis/);
  assert.match(intake,/intake-arrived/);
  hooks.handleAction({dataset:{action:"intake-arrived",id:hooks.db.appointments[0].id}},{});
  assert.equal(hooks.db.appointments[0].status,"Atvykęs");
  hooks.route("vlk");
  const vlkForm=node("page").innerHTML;
  assert.ok(vlkForm.indexOf('id="vlk-laboratory"')<vlkForm.indexOf('id="vlk-lab-choice"'),"VLK laboratory selection should precede its works");
  hooks.db.invoices.push({id:"test-invoice",number:"DP-TEST",date:"2026-11-17",clinicId:"akm",patientId:"p-0-0",
    doctorId:"",doctorPercent:null,items:[{id:"t",price:100,qty:1,description:"Demo"}],payments:[],costs:{laboratory:[],materials:[]}});
  hooks.modal("invoice","test-invoice");
  const invoiceDrawer=node("drawer-root").innerHTML;
  assert.ok(invoiceDrawer.indexOf('id="invoice-laboratory"')<invoiceDrawer.indexOf('id="invoice-lab-work"'),
    "Laboratory selection should precede work selection");
  assert.match(invoiceDrawer,/id="payment-method"/);
  assert.match(invoiceDrawer,/option value="cash" selected/);
  hooks.update("test VLK","vlk-ui",state=>state.vlkCases.push({id:"vlk-ui",caseNumber:"VLK-DEMO-UI",status:"Vykdomas",
    clinicId:"akm",patientId:"p-0-0",doctorId:"dr-akm-1",
    patientContribution:75,claimedAmount:300,doctorPercent:35,categoryId:"adult-standard"}));
  hooks.modal("vlk-copay","vlk-ui");
  assert.match(node("drawer-root").innerHTML,/Paciento VLK priemoka/);
  assert.match(node("drawer-root").innerHTML,/save-vlk-copay/);
  hooks.route("vlk");
  assert.match(node("page").innerHTML,/new-vlk-copay/);
  hooks.route("laborders");
  assert.match(node("page").innerHTML,/id="order-appointment"/);
  hooks.update("test plan","plan-ui",state=>state.plans.push({id:"plan-ui",patientId:"p-0-0",clinicId:"akm",title:"Etapų planas",status:"Vykdomas",
    items:[{id:"line-ui",serviceId:"s-cons",description:"Procedūra A",price:60,qty:1,
      stage:"Gydymas",targetDate:"2026-11-17",done:false}]}));
  hooks.ui.patient="p-0-0";hooks.ui.selectedPlan="plan-ui";
  hooks.route("plans");
  hooks.handleChange({dataset:{change:"plan-done",plan:"plan-ui",id:"line-ui"},checked:true});
  assert.equal(hooks.db.plans.find(p=>p.id==="plan-ui").items[0].done,true);
  const task=hooks.db.tasks.find(t=>t.planItemId==="line-ui");
  assert.ok(task,"Completed procedure should queue a receptionist billing task");
  hooks.handleAction({dataset:{action:"billing-task",id:task.id}},{});
  assert.match(node("drawer-root").innerHTML,/id="invoice-form"/);
  assert.equal(hooks.ui.modal.planItemId,"line-ui");

  for(const view of ["day","week","month","list"]){
    hooks.ui.view=view;hooks.route("calendar");
    assert.ok(node("page").innerHTML.length>800,view+" should render");
  }
  for(const kind of ["appointment","patient","doctor","plan","service","invoice"]){
    hooks.modal(kind);
    assert.ok(node("drawer-root").innerHTML.includes('role="dialog"'),kind+" drawer should render");
  }
  hooks.route("forms");
  assert.match(node("page").innerHTML,/Paciento aptarnavimo sutartis/);
  for(const type of ["agreement","privacy","health","invasive"]){
    hooks.modal("registration-form","",{formType:type});
    assert.ok(node("drawer-root").innerHTML.includes('id="form-signature"'),type+" includes draw-to-sign canvas");
    assert.ok(node("drawer-root").innerHTML.includes('id="registration-form"'),type+" fields render");
  }

});
