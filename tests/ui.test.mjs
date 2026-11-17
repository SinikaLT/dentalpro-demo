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
  vm.runInNewContext(script+"\nglobalThis.__hooks = {ui,route,render,modal,db};",context,{timeout:8000});
  const hooks=context.__hooks;
  assert.ok(node("page").innerHTML.includes("Darbo vietos apžvalga"));
  assert.equal(hooks.db.clinics.length,2);
  assert.equal(hooks.db.chairs.length,4);
  assert.equal(hooks.db.patients.length,20);
  for(const r of ["calendar","patients","doctors","odontogram","plans","notes","finances","forms","reports","compensation","services","vlk","admin"]){
    hooks.route(r);
    assert.match(node("page").innerHTML,/<h1>/);
    assert.ok(node("page").innerHTML.length>200,r+" should render");
  }
  hooks.route("vlk");
  assert.match(node("page").innerHTML,/Faktinė kompensuojama suma/);
  assert.match(node("page").innerHTML,/PSDF atvejai ir būsenos/);
  hooks.route("finances");
  const finance=node("page").innerHTML;
  for(const phrase of ["Grynaisiais","Kortele","Pavedimu","VLK (baigti atvejai)","Banko pavedimų suderinimas","Pacientų avansai","Dienos kasos uždarymas","Eksportuoti dienos CSV"]){
    assert.ok(finance.includes(phrase),phrase+" must appear in the daily settlement UI");
  }
  hooks.modal("invoice");
  assert.match(node("drawer-root").innerHTML,/usageMaterials/);
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
