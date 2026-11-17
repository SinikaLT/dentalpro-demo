
import {CLINICS,CHAIRS,STATUSES,PLAN_STATUSES,WEEKDAYS,PERMANENT,PRIMARY,CONDITIONS,SURFACES,uid,isoDate,shiftDate,validDate,weekday,minutes,timeString,overlaps,money,appointmentIssues,patientName,doctorName,serviceName,invoiceTotal,planTotal} from "./domain.mjs";
import {openRepository,defaultAvailability,defaultBreaks} from "./store.mjs";
import {PRICE_SOURCE,PRICE_REVIEWED,priceOptions} from "./pricelist.mjs";
import {FORM_VERSION,FORM_TYPES,HEALTH_QUESTIONS,validateForm,statusOfForm,registrationChecklist,invasiveConsentForItem,FORM_DISCLOSURES} from "./forms.mjs";
import {invoiceCosts,salaryAccruals,salarySummary,validCost,parseLaboratoryCsv,roundEuro,DEFAULT_USAGE_FEES,usageFeeSnapshot,validUsageFee} from "./compensation.mjs";
import {VLK_CATEGORIES,VLK_SOURCE_DATE,vlkCategory,vlkAmountIssues,vlkCaseIssues,vlkCaseEarning,vlkSalaryRows,vlkSalaryTotal} from "./vlk.mjs";

const repository=openRepository();
let db=repository.get();
const ui={salaryMonth:isoDate().slice(0,7),category:"all",route:"overview",clinic:"akm",day:isoDate(),view:"day",doctor:"",chair:"",status:"",service:"",patient:"p-0-0",patientTab:"overview",tooth:11,selectedDoctor:"",selectedPlan:"",search:"",modal:null};
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const opt=(arr,value)=>arr.map(x=>'<option value="'+esc(x[0])+'"'+(String(x[0])===String(value)?' selected':'')+'>'+esc(x[1])+'</option>').join("");
const simple=(arr,value)=>opt(arr.map(x=>[x,x]),value);
const btn=(text,action,cls="btn",data="")=>'<button type="button" class="'+cls+'" data-action="'+action+'" '+data+'>'+text+'</button>';
const fmt=d=>validDate(d)?new Date(d+"T12:00:00").toLocaleDateString("lt-LT",{day:"numeric",month:"short",year:"numeric"}):"—";
const name=id=>patientName(db,id);
const doctor=id=>doctorName(db,id);
const service=id=>serviceName(db,id);
const activeServices=()=>db.services.filter(s=>s.active);
const primaryService=()=>activeServices()[0]||db.services[0];
const planInvoiceItems=(patientId,clinicId)=>db.plans.filter(p=>p.patientId===patientId&&p.clinicId===clinicId).flatMap(p=>p.items.map(i=>({id:i.id,planId:p.id,name:p.title+" – "+i.description,serviceId:i.serviceId,price:i.price,qty:i.qty})));
const serviceChoices=(selected="")=>{const groups=new Map();for(const s of activeServices()){if(!groups.has(s.category))groups.set(s.category,[]);groups.get(s.category).push(s)}const historic=db.services.find(s=>s.id===selected&&!s.active);let html=historic?opt([[historic.id,historic.name+" (archyvinė)"]],selected):"";for(const [label,items] of groups)html+='<optgroup label="'+esc(label)+'">'+opt(items.map(s=>[s.id,s.name+" · "+(s.priceLabel||money(s.price))]),selected)+"</optgroup>";return html};
const pricePicker=(serviceId,selected)=>{const s=db.services.find(x=>x.id===serviceId);const values=priceOptions(s);return values.length?'<select name="price" id="plan-item-price">'+opt(values.map(v=>[v,money(v)]),selected??values[0])+"</select>":'<input name="price" id="plan-item-price" type="number" min="0" step="0.01" value="'+esc(selected??(s?.priceMin==null?"":s?.price??0))+'" required>'};
const clinic=id=>db.clinics.find(x=>x.id===id)?.name||"—";
const chair=id=>db.chairs.find(x=>x.id===id)?.name||"—";
const pill=s=>{let cls="";if(["Atšauktas","Neatvyko"].includes(s))cls="danger";else if(["Atvykęs","Atliekamas"].includes(s))cls="warning";else if(["Registruotas","Juodraštis","Neaktyvi"].includes(s))cls="grey";return '<span class="pill '+cls+'">'+esc(s)+'</span>';};
const listPatients=()=>db.patients.filter(p=>ui.clinic==="all"||p.clinicIds.includes(ui.clinic));
const listDoctors=()=>db.staff.filter(d=>ui.clinic==="all"||d.clinicIds.includes(ui.clinic));
const listChairs=()=>db.chairs.filter(c=>ui.clinic==="all"||c.clinicId===ui.clinic);
const appts=()=>db.appointments.filter(a=>(ui.clinic==="all"||a.clinicId===ui.clinic)&&(!ui.doctor||a.staffId===ui.doctor)&&(!ui.chair||a.chairId===ui.chair)&&(!ui.status||a.status===ui.status)&&(!ui.service||a.serviceId===ui.service)).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
const modal=(kind,id="",extra={})=>{ui.modal={kind,id,...extra};render()};
const update=(action,id,fn)=>{repository.transaction(action,id,fn);db=repository.get();render()};
const notify=(message,error=false)=>{document.querySelector(".toast")?.remove();const n=document.createElement("div");n.className="toast"+(error?" error":"");n.textContent=message;document.body.appendChild(n);setTimeout(()=>n.remove(),4300)};
function page(title,description,action=""){return '<div class="page-lead"><div><h1>'+title+'</h1><p>'+description+'</p></div>'+action+'</div>'}
function empty(title,desc){return '<div class="empty"><strong>'+title+'</strong>'+desc+'</div>'}
function patientPicker(){return '<select aria-label="Pacientas" data-change="patient">'+opt(listPatients().map(p=>[p.id,name(p.id)]),ui.patient)+'</select>'}
function selectClinic(c){ui.clinic=c;ui.doctor="";ui.chair="";ui.selectedDoctor="";ui.selectedPlan="";if(!listPatients().some(p=>p.id===ui.patient))ui.patient=listPatients()[0]?.id||"";render()}
function route(r){ui.route=r;ui.modal=null;render()}
function render(){
  $("global-clinic").value=ui.clinic;
  document.querySelectorAll(".nav-btn").forEach(n=>n.classList.toggle("active",n.dataset.route===ui.route));
  $("section-name").textContent=({overview:"Apžvalga",calendar:"Registracijos kalendorius",patients:"Pacientai",doctors:"Gydytojų grafikai",odontogram:"Odontograma",plans:"Gydymo planai",notes:"Klinikiniai įrašai",finances:"Finansai",compensation:"Laboratorija ir atlygis",reports:"Ataskaitos",forms:"Paciento dokumentai",services:"Paslaugos",vlk:"VLK / PSDF",admin:"Administravimas"})[ui.route];
  $("page").innerHTML=({
    overview:viewOverview,calendar:viewCalendar,patients:viewPatients,doctors:viewDoctors,
    odontogram:viewOdontogram,plans:viewPlans,notes:viewNotes,finances:viewFinances,
    services:viewServices,compensation:viewCompensation,reports:viewReports,forms:viewForms,vlk:viewVlk,admin:viewAdmin
  }[ui.route]||viewOverview)();
  $("drawer-root").innerHTML=ui.modal?((ui.modal.kind==="registration-form"||ui.modal.kind==="signed-form")?formDrawer(ui.modal):viewDrawer()):"";
  if(ui.modal?.kind==="registration-form")setupSignatureCanvas();
}
function eventRows(items){
  if(!items.length)return empty("Vizitų nėra","Pasirinkite kitą datą arba registruokite vizitą.");
  return '<div class="list-events">'+items.map(a=>'<button type="button" class="event-row" data-action="edit-appt" data-id="'+esc(a.id)+'">'+
    '<div><b>'+esc(a.time)+'</b><small style="display:block">'+fmt(a.date)+'</small></div>'+
    '<div><b>'+esc(name(a.patientId))+'</b><small style="display:block">'+esc(service(a.serviceId))+'</small></div>'+
    '<div class="hide-mobile">'+esc(doctor(a.staffId))+'</div><div class="hide-mobile">'+esc(chair(a.chairId))+'</div>'+pill(a.status)+'</button>').join("")+'</div>';
}
function viewOverview(){
  const today=appts().filter(a=>a.date===ui.day&&a.status!=="Atšauktas");
  const invoices=db.invoices.filter(i=>ui.clinic==="all"||i.clinicId===ui.clinic);
  const debt=invoices.reduce((n,i)=>n+Math.max(0,invoiceTotal(i)-(i.payments||[]).reduce((s,p)=>s+Number(p.amount),0)),0);
  const activePlans=db.plans.filter(p=>(ui.clinic==="all"||p.clinicId===ui.clinic)&&!["Užbaigtas","Atšauktas"].includes(p.status));
  return page("Darbo vietos apžvalga","Dvi klinikos · keturios odontologinės kėdės · demonstraciniai duomenys",btn("+ Naujas vizitas","new-appt","btn primary"))+
    '<div class="stat-grid"><div class="stat"><small>Dienos vizitai</small><strong>'+today.length+'</strong><em>'+today.filter(a=>a.status==="Atliktas").length+' atlikti</em></div>'+
    '<div class="stat"><small>Pacientai</small><strong>'+listPatients().length+'</strong><em>Visi duomenys sintetiniai</em></div>'+
    '<div class="stat"><small>Aktyvūs gydymo planai</small><strong>'+activePlans.length+'</strong><em>Planuojamos procedūros</em></div>'+
    '<div class="stat"><small>Neapmokėta (demo)</small><strong>'+money(debt)+'</strong><em>Be realių mokėjimų</em></div></div>'+
    '<div class="two-cols"><section class="panel"><div class="panel-title"><h2>Vizitai</h2>'+btn("Kalendorius","go-calendar","btn small")+'</div>'+
    '<div class="toolbar" style="margin-bottom:14px"><input type="date" data-change="day" value="'+esc(ui.day)+'" aria-label="Apžvalgos data"></div>'+eventRows(today)+'</section>'+
    '<section class="panel"><h2>Kėdžių užimtumas</h2>'+listChairs().map(c=>{
      const filtered=today.filter(a=>a.chairId===c.id),duration=filtered.reduce((n,a)=>n+Number(a.duration),0);
      return '<div class="kpi-bar"><div style="width:150px"><b>'+esc(c.name)+'</b><small class="muted" style="display:block">'+esc(clinic(c.clinicId))+'</small></div><div class="kpi-track"><div class="kpi-fill" style="width:'+Math.round(Math.min(100,duration/600*100))+'%"></div></div><small>'+filtered.length+' viz.</small></div>';
    }).join("")+'<hr class="section-divider"><div class="notice">Ši sistema veikia tik demonstraciniu režimu; duomenys saugomi naršyklėje.</div></section></div>';
}
const doctorPalette=["#07818a","#5f72c4","#a46b39","#26875f","#b55d83","#8b61b5","#317d91","#ab8b24"];
function colorForDoctor(staffId,clinicId){
  const key=clinicId+":"+staffId;
  const stored=db.preferences?.doctorColors?.[key];
  if(typeof stored==="string"&&/^#[0-9a-fA-F]{6}$/.test(stored))return stored;
  const oldClinic=clinicId==="kur"?1:0,staff=db.staff.find(x=>x.id===staffId);
  try{
    const legacy=JSON.parse(localStorage.getItem("dentalpro_doctor_colors_"+oldClinic)||"{}");
    const saved=legacy?.[staff?.name];
    if(typeof saved==="string"&&/^#[0-9a-fA-F]{6}$/.test(saved))return saved;
  }catch{}
  const doctors=db.staff.filter(x=>x.clinicIds.includes(clinicId)),n=doctors.findIndex(x=>x.id===staffId);
  return doctorPalette[Math.max(0,n)%doctorPalette.length];
}
function doctorColorControls(){
  const doctors=listDoctors().flatMap(d=>d.clinicIds.filter(cid=>ui.clinic==="all"||ui.clinic===cid).map(cid=>({d,cid})));
  return '<details class="doctor-colors" style="margin-top:14px"><summary style="cursor:pointer;font-size:13px;font-weight:650">Gydytojų spalvos (keisti)</summary>'+
    '<div class="flex" style="margin-top:12px">'+doctors.map(({d,cid})=>
      '<label style="display:flex;align-items:center;gap:7px;font-weight:500;background:#f5fafb;border:1px solid #e2edef;border-radius:8px;padding:6px 10px">'+
      '<input type="color" value="'+colorForDoctor(d.id,cid)+'" style="width:34px;height:30px;padding:2px;cursor:pointer" data-change="doctor-color" data-doctor="'+esc(d.id)+'" data-clinic="'+esc(cid)+'" aria-label="'+esc(d.name+' · '+clinic(cid))+' spalva">'+esc(d.name)+
      (ui.clinic==="all"?' <small>('+esc(clinic(cid))+')</small>':"")+'</label>').join("")+'</div></details>';
}

function viewCalendar(){
  const viewNames={day:"Diena",week:"Savaitė",month:"Mėnuo",list:"Sąrašas"};
  let out=page("Registracijos kalendorius","Registracijos seka: kėdė → pacientas → gydytojas",btn("+ Registruoti vizitą","new-appt","btn primary"));
  out+='<section class="panel"><div class="toolbar space-between"><div class="toolbar">'+btn("←","cal-prev","btn small")+btn("Šiandien","cal-today","btn small")+btn("→","cal-next","btn small")+
    '<input type="date" aria-label="Kalendoriaus data" data-change="day" value="'+esc(ui.day)+'"><b>'+fmt(ui.day)+'</b></div><div class="view-switch">'+
    Object.entries(viewNames).map(([key,label])=>'<button type="button" class="'+(ui.view===key?"active":"")+'" data-action="set-view" data-view="'+key+'">'+label+'</button>').join("")+'</div></div>'+
    '<div class="calendar-filters"><select data-change="doctor-filter" aria-label="Gydytojų filtras"><option value="">Visi gydytojai</option>'+opt(listDoctors().map(d=>[d.id,d.name]),ui.doctor)+'</select>'+
    '<select data-change="chair-filter" aria-label="Kėdžių filtras"><option value="">Visos kėdės</option>'+opt(listChairs().map(c=>[c.id,clinic(c.clinicId)+" · "+c.name]),ui.chair)+'</select>'+
    '<select data-change="service-filter" aria-label="Paslaugų filtras"><option value="">Visos paslaugos</option>'+opt(db.services.map(s=>[s.id,s.name]),ui.service)+'</select>'+
    '<select data-change="status-filter" aria-label="Būsenų filtras"><option value="">Visos būsenos</option>'+simple(STATUSES,ui.status)+'</select></div>'+doctorColorControls()+'</section>';
  const rows=appts();
  return out+'<section class="panel">'+(ui.view==="day"?calendarDay(rows):ui.view==="week"?calendarWeek(rows):ui.view==="month"?calendarMonth(rows):calendarList(rows))+'</section>';
}
function calendarDay(rows){
  const chairs=listChairs().filter(c=>!ui.chair||c.id===ui.chair);
  let out='<div class="panel-title"><h2>Dienos grafikas · '+fmt(ui.day)+'</h2><span class="muted tiny">07:00–22:00 · 15 min. intervalai</span></div>'+
    '<div class="schedule-scroll"><div class="schedule" style="--columns:'+Math.max(1,chairs.length)+'"><div class="sch-head" style="grid-column:1;grid-row:1">Laikas</div>';
  chairs.forEach((c,i)=>out+='<div class="sch-head" style="grid-column:'+(i+2)+';grid-row:1">'+esc(c.name)+'<small style="display:block;font-weight:400">'+esc(clinic(c.clinicId))+'</small></div>');
  for(let slot=0;slot<60;slot++){
    const t=timeString(420+15*slot),row=slot+2;
    out+='<div class="sch-time" style="grid-column:1;grid-row:'+row+'">'+(slot%2===0?t:"")+'</div>';
    for(let i=0;i<chairs.length;i++)
      out+='<button type="button" class="sch-slot '+(slot%4===0?"hour":"")+'" style="grid-column:'+(i+2)+';grid-row:'+row+'" data-action="slot" data-chair="'+esc(chairs[i].id)+'" data-time="'+t+'" aria-label="Registruoti '+esc(t)+'"></button>';
  }
  for(const a of rows.filter(a=>a.date===ui.day)){
    const i=chairs.findIndex(c=>c.id===a.chairId),start=minutes(a.time);
    if(i<0||start<420||start>=1320||!Number.isFinite(start))continue;
    const row=2+Math.floor((start-420)/15),span=Math.min(62-row,Math.max(1,Math.ceil(a.duration/15)));
    const color=colorForDoctor(a.staffId,a.clinicId);
    out+='<button class="sch-event '+(a.status==="Atšauktas"?"cancelled":"")+'" draggable="true" data-id="'+esc(a.id)+'" data-action="edit-appt" style="--event:'+color+';grid-column:'+(i+2)+';grid-row:'+row+' / span '+span+'"><b>'+esc(a.time)+' · '+esc(name(a.patientId))+'</b><span>'+esc(doctor(a.staffId))+'</span><span>'+esc(service(a.serviceId))+'</span></button>';
  }
  return out+'</div></div><p class="help">Spauskite laisvą intervalą, kad registruotumėte pacientą. Vizitą galima keisti formoje arba nutempti į kitą langelį.</p>';
}
function calendarWeek(rows){
  const start=shiftDate(ui.day,-((weekday(ui.day)+6)%7));
  let out='<h2>Savaitė · '+fmt(start)+' – '+fmt(shiftDate(start,6))+'</h2><div class="week-grid">';
  for(let i=0;i<7;i++){
    const date=shiftDate(start,i);
    const items=rows.filter(a=>a.date===date);
    out+='<div class="week-day '+(date===isoDate()?"today":"")+'"><div class="day-label">'+esc(WEEKDAYS[weekday(date)])+' · '+date.slice(5)+'</div>'+btn("+","new-on-day","btn small","data-date='"+date+"'")+
      items.map(a=>'<button class="compact-appt" data-action="edit-appt" data-id="'+esc(a.id)+'"><b>'+esc(a.time)+'</b> '+esc(name(a.patientId))+'<small style="display:block">'+esc(chair(a.chairId))+'</small></button>').join("")+'</div>';
  }
  return out+'</div>';
}
function calendarMonth(rows){
  const first=ui.day.slice(0,7)+"-01",start=shiftDate(first,-((weekday(first)+6)%7));
  let out='<h2>'+new Date(first+"T12:00:00").toLocaleDateString("lt-LT",{year:"numeric",month:"long"})+'</h2><div class="month-grid">';
  for(const x of ["Pr","An","Tr","Kt","Pn","Št","Sk"])out+='<div class="month-weekday">'+x+'</div>';
  for(let i=0;i<42;i++){
    const date=shiftDate(start,i),items=rows.filter(a=>a.date===date);
    out+='<div class="month-cell '+(date===isoDate()?"today ":"")+(date.slice(0,7)!==first.slice(0,7)?"outside":"")+'"><div class="flex space-between"><b>'+Number(date.slice(-2))+'</b>'+
      btn("+","new-on-day","btn small ghost","data-date='"+date+"'")+'</div>'+items.slice(0,3).map(a=>'<button class="compact-appt" data-action="edit-appt" data-id="'+esc(a.id)+'">'+esc(a.time)+' '+esc(name(a.patientId))+'</button>').join("")+
      (items.length>3?'<small class="muted">+'+(items.length-3)+' daugiau</small>':"")+'</div>';
  }
  return out+'</div>';
}
function calendarList(rows){const items=rows.filter(a=>a.date.startsWith(ui.day.slice(0,7)));return '<div class="panel-title"><h2>Vizitai · '+ui.day.slice(0,7)+'</h2><span class="muted">'+items.length+' įrašų</span></div>'+eventRows(items)}
function viewPatients(){
  const patients=listPatients().filter(p=>(p.firstName+" "+p.lastName).toLocaleLowerCase("lt").includes(ui.search.toLocaleLowerCase("lt")));
  const p=db.patients.find(p=>p.id===ui.patient)||patients[0];
  return page("Pacientai","Pacientų kortelės, vizitų istorija, gydymo eiga",btn("+ Naujas pacientas","new-patient","btn primary"))+
    '<div class="three-cols"><section class="panel"><div class="panel-title"><h2>Pacientų sąrašas</h2><span class="pill grey">'+patients.length+'</span></div>'+
    '<input type="search" id="patient-search" value="'+esc(ui.search)+'" placeholder="Ieškoti paciento…" aria-label="Pacientų paieška"><div class="patient-list" style="margin-top:15px">'+
    patients.map(p=>'<button class="person-card '+(ui.patient===p.id?"selected":"")+'" data-action="select-patient" data-id="'+esc(p.id)+'"><span class="person-dot">'+esc(p.firstName[0]+p.lastName[0])+'</span><span><b>'+esc(name(p.id))+'</b><small>'+esc(p.id)+' · '+esc(p.clinicIds.map(clinic).join(", "))+'</small></span></button>').join("")+'</div></section>'+
    '<section class="panel">'+(p?patientDetail(p):empty("Paciento nėra","Sukurkite naują demonstracinį įrašą."))+'</section></div>';
}
function registrationBanner(patientId){
  const status=registrationChecklist(db.forms,patientId),ready=status.every(x=>x.signed);
  return '<div class="notice '+(ready?"":"warn")+'" style="margin-top:14px"><b>Registracijos dokumentai: '+status.filter(x=>x.signed).length+'/3 (demo)</b>'+
    '<div class="actions" style="margin-top:10px">'+status.map(x=>'<span class="pill '+(x.signed?"":"grey")+'">'+
    esc(FORM_TYPES.find(f=>f.id===x.type)?.short||x.type)+': '+(x.signed?"Pasirašyta":"Trūksta")+'</span>').join("")+'</div>'+
    '<p class="help">Invazinės procedūros sutikimas pildomas atskirai konkrečiai procedūrai; jis nėra būtinas kiekvienai registracijai.</p>'+
    (!ready?btn("Užpildyti dokumentus","patient-documents","btn primary small"):"")+'</div>';
}
function patientDetail(p){
  const items=db.appointments.filter(a=>a.patientId===p.id).sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time));
  let out='<div class="panel-title"><div><h2>'+esc(name(p.id))+'</h2><small class="muted">Nr. '+esc(p.id)+' · Demonstracinis pacientas</small></div>'+btn("Redaguoti","edit-patient","btn small","data-id='"+esc(p.id)+"'")+'</div>'+
    '<div class="tabs">'+[["overview","Apžvalga"],["history","Apsilankymai"],["plans","Gydymo planai"]].map(([id,title])=>'<button class="tab '+(ui.patientTab===id?"active":"")+'" data-action="patient-tab" data-tab="'+id+'">'+title+'</button>').join("")+'</div>';
  if(ui.patientTab==="overview"){
    out+='<div class="detail-grid">'+[["Gimimo data",p.birthDate?fmt(p.birthDate):"Nenurodyta"],["Telefonas",p.phone||"Nenurodyta"],["El. paštas",p.email||"Nenurodyta"],["Klinikos",p.clinicIds.map(clinic).join(", ")]].map(([k,v])=>'<div class="detail-item"><small>'+k+'</small><b>'+esc(v)+'</b></div>').join("")+'</div>'+
      (p.alerts?'<div class="notice warn" style="margin-top:14px">'+esc(p.alerts)+'</div>':"")+
       registrationBanner(p.id)+
      '<hr class="section-divider"><div class="actions">'+btn("Odontograma","patient-odontogram","btn small")+btn("Klinikiniai įrašai","patient-notes","btn small")+btn("Dokumentai ir parašai","patient-documents","btn small")+btn("VLK / PSDF","patient-vlk","btn small")+btn("+ Vizitas","new-appt","btn primary small")+'</div><h3 style="margin-top:24px">Apsilankymų istorija</h3>'+eventRows(items.slice(0,5));
  }else if(ui.patientTab==="history"){
    out+=eventRows(items);
    const notes=db.clinicalNotes.filter(n=>n.patientId===p.id);
    out+='<h3 style="margin-top:24px">Klinikiniai įrašai</h3>'+notes.slice(-6).reverse().map(n=>'<div class="segment"><b>'+fmt(n.date)+'</b><p>'+esc(n.text)+'</p></div>').join("");
  }else{
    const plans=db.plans.filter(x=>x.patientId===p.id);
    out+=plans.map(x=>'<div class="segment"><b>'+esc(x.title)+'</b><small style="display:block">'+esc(x.status)+' · '+money(planTotal(x))+'</small></div>').join("")||empty("Planų nėra","Pridėkite gydymo planą.");
    out+=btn("Atidaryti planus","patient-plans","btn small");
  }
  return out;
}
function viewDoctors(){
  const doctors=listDoctors(),d=doctors.find(d=>d.id===ui.selectedDoctor)||doctors[0];
  const cid=d?.clinicIds.includes(ui.clinic)?ui.clinic:d?.clinicIds[0];
  return page("Gydytojų grafikai","Darbo valandos, savaitės dienos ir pertraukos",btn("+ Pridėti gydytoją","new-doctor","btn primary"))+
    '<div class="three-cols"><section class="panel"><h2>Specialistai</h2>'+doctors.map(x=>'<button class="person-card '+(d?.id===x.id?"selected":"")+'" data-action="select-doctor" data-id="'+esc(x.id)+'"><span class="person-dot">Dr</span><span><b>'+esc(x.name)+'</b><small>'+esc(x.role)+'</small></span></button>').join("")+'</section>'+
    '<section class="panel">'+(d?doctorSchedule(d,cid):empty("Gydytojų nėra","Pridėkite specialistą."))+'</section></div>';
}
function doctorSchedule(d,cid){
  let out='<h2>'+esc(d.name)+'</h2><p class="muted">'+esc(d.role)+' · '+esc(clinic(cid))+'</p>'+
    '<p class="help">Dienomis pažymėkite darbo laiką; pertrauka turi patekti į pamainą. Keitimas neturėtų palikti suplanuotų vizitų be darbo laiko.</p>'+
    '<form id="schedule-form"><input type="hidden" name="doctorId" value="'+esc(d.id)+'"><input type="hidden" name="clinicId" value="'+esc(cid)+'"><div class="table-wrap"><table class="schedule-table"><thead><tr><th>Diena</th><th>Dirba</th><th>Nuo</th><th>Iki</th><th>Pertraukos pradžia</th><th>Pabaiga</th></tr></thead><tbody>';
  for(let i=1;i<=7;i++){
    const wd=i%7,w=d.availability.find(x=>x.weekday===wd&&x.clinicId===cid),b=d.breaks.find(x=>x.weekday===wd&&x.clinicId===cid);
    out+='<tr><td>'+esc(WEEKDAYS[wd])+'</td><td><input type="checkbox" name="active-'+wd+'" '+(w?"checked":"")+' aria-label="'+esc(WEEKDAYS[wd])+'"></td>'+
      '<td><input type="time" name="start-'+wd+'" value="'+esc(w?.start||"08:00")+'"></td><td><input type="time" name="end-'+wd+'" value="'+esc(w?.end||"18:00")+'"></td>'+
      '<td><input type="time" name="breakStart-'+wd+'" value="'+esc(b?.start||"")+'"></td><td><input type="time" name="breakEnd-'+wd+'" value="'+esc(b?.end||"")+'"></td></tr>';
  }
  return out+'</tbody></table></div><p style="margin-top:20px">'+btn("Išsaugoti darbo grafiką","save-schedule","btn primary")+'</p></form>';
}
function viewOdontogram(){
  const p=db.patients.find(p=>p.id===ui.patient)||listPatients()[0];
  if(!p)return page("Odontograma","FDI numeracija")+empty("Pasirinkite pacientą","Pacientų nėra.");
  const f=db.findings.find(f=>f.patientId===p.id&&Number(f.toothNumber)===Number(ui.tooth));
  const teeth=nums=>'<div class="tooth-row">'+nums.map(n=>{
    const record=db.findings.find(f=>f.patientId===p.id&&Number(f.toothNumber)===n);
    return '<button class="tooth '+(record?"issue ":"")+(ui.tooth===n?"selected":"")+'" data-action="tooth" data-tooth="'+n+'" title="'+esc(record?.condition||"Įrašo nėra")+'">'+n+'<small>'+(record?"●":"○")+'</small></button>';
  }).join("")+'</div>';
  return page("Odontograma","FDI dantų žymėjimas · "+name(p.id))+
    '<div class="panel"><div class="search-line">'+patientPicker()+'</div><div class="two-cols"><section><h3>Nuolatiniai dantys · 32</h3><p class="odontogram-label">Viršutinis žandikaulis</p>'+teeth(PERMANENT.slice(0,16))+
    '<p class="odontogram-label">Apatinis žandikaulis</p>'+teeth(PERMANENT.slice(16))+'<h3>Pieniniai dantys · 20</h3>'+teeth(PRIMARY.slice(0,10))+teeth(PRIMARY.slice(10))+
    '<div class="notice">● pažymėti dantys turi radinių. Ši odontograma yra tik demonstracinė.</div></section>'+
    '<section><h3>Dantis '+ui.tooth+'</h3><form id="finding-form"><div class="field-grid"><div class="field"><label>Būklė</label><select name="condition">'+simple(CONDITIONS,f?.condition||"Sveikas")+'</select></div>'+
    '<div class="field"><label>Statusas</label><select name="status">'+simple(["Stebima","Planuojama","Gydoma","Atlikta"],f?.status||"Stebima")+'</select></div>'+
    '<div class="field full"><label>Paviršiai</label><div class="flex">'+SURFACES.map(s=>'<label style="font-weight:400"><input type="checkbox" name="surface" value="'+esc(s)+'" '+((f?.surfaces||["Visas dantis"]).includes(s)?"checked":"")+'>'+esc(s)+'</label>').join("")+'</div></div>'+
    '<div class="field full"><label>Pastabos, procedūros</label><textarea name="note">'+esc(f?.note||"")+'</textarea></div></div>'+
    '<p style="margin-top:15px">'+btn("Išsaugoti įrašą","save-finding","btn primary")+(f?" "+btn("Ištrinti radinį","delete-finding","btn danger"):"")+'</p></form></section></div></div>';
}
function viewPlans(){
  const p=db.patients.find(p=>p.id===ui.patient)||listPatients()[0];
  const plans=db.plans.filter(x=>x.patientId===p?.id);
  const plan=plans.find(x=>x.id===ui.selectedPlan)||plans[0];
  return page("Gydymo planai","Etapai, procedūros, numatomos išlaidos",btn("+ Naujas planas","new-plan","btn primary"))+
    '<div class="panel"><div class="search-line">'+(p?patientPicker():"")+'</div><div class="two-cols"><section><h3>Paciento planai</h3>'+
    plans.map(x=>'<button class="person-card '+(x.id===plan?.id?"selected":"")+'" data-action="select-plan" data-id="'+esc(x.id)+'"><span class="person-dot">☷</span><span><b>'+esc(x.title)+'</b><small>'+esc(x.status)+' · '+money(planTotal(x))+'</small></span></button>').join("")+
    (!plans.length?empty("Gydymo planų nėra","Sukurkite pirmąjį planą."):"")+'</section>'+
    '<section>'+(plan?planDetails(plan):empty("Planas nepasirinktas","Pradėkite nuo naujo gydymo plano."))+'</section></div></div>';
}
function planDetails(p){
  const patientId=p.patientId;
  return '<h3>'+esc(p.title)+'</h3><div class="flex"><label>Būsena</label><select id="plan-status" data-change="plan-status" style="max-width:230px">'+simple(PLAN_STATUSES,p.status)+'</select><span class="pill">Sąmata '+money(planTotal(p))+'</span></div>'+
    '<div class="table-wrap"><table class="data-table"><thead><tr><th>Dantis</th><th>Procedūra</th><th>Suma</th><th>Atlikta</th></tr></thead><tbody>'+
    p.items.map(i=>'<tr><td>'+esc(i.tooth||"—")+'</td><td>'+esc(i.description)+'</td><td>'+money(Number(i.qty||1)*Number(i.price||0))+'</td>'+
    '<td><input type="checkbox" aria-label="Procedūra atlikta" data-change="plan-done" data-plan="'+esc(p.id)+'" data-id="'+esc(i.id)+'" '+(i.done?"checked":"")+'>'+(invasiveConsentForItem(db.forms,patientId,p.id,i.id)
     ?'<span class="pill">Sutikimas (demo): '+esc(invasiveConsentForItem(db.forms,patientId,p.id,i.id).answers?.decision||"")+'</span>'
     :'<span class="pill grey">Invazinis sutikimas (jei taikoma): nesusietas</span>')+
     btn("Sutikimas","consent-plan-item","btn small","data-plan=\'"+esc(p.id)+"\' data-id=\'"+esc(i.id)+"\'")+btn("Pašalinti","delete-plan-item","btn small ghost","data-plan=\'"+esc(p.id)+"\' data-id=\'"+esc(i.id)+"\'")+'</td></tr>').join("")+'</tbody></table></div>'+
    '<h3 style="margin-top:20px">Pridėti procedūrą</h3><form id="plan-item-form"><div class="field-grid"><div class="field"><label>Paslauga</label><select name="serviceId" id="plan-item-service">'+serviceChoices(primaryService()?.id)+'</select></div>'+
    '<div class="field"><label>Dantis</label><input name="tooth" placeholder="Pvz., 16"></div><div class="field"><label>Kiekis</label><input name="qty" type="number" min="1" max="20" value="1"></div>'+
    '<div class="field"><label>Pasirenkama kaina (€)</label><div id="plan-price-container">'+pricePicker(primaryService()?.id)+'</div><small class="help">Intervalai: 10 € žingsniu ir tiksli intervalo pabaiga. „Nuo“ kainos tikslinamos.</small></div>'+
    '<div class="field full"><label>Aprašymas</label><input name="description" placeholder="Papildomas paaiškinimas"></div></div>'+
    '<p style="margin-top:14px">'+btn("+ Pridėti į planą","save-plan-item","btn primary")+'</p></form>';
}
function viewNotes(){
  const p=db.patients.find(p=>p.id===ui.patient)||listPatients()[0];
  if(!p)return page("Klinikiniai įrašai","Vizitų dokumentavimas")+empty("Paciento nėra","Sukurkite pacientą.");
  const notes=db.clinicalNotes.filter(n=>n.patientId===p.id).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  return page("Klinikiniai įrašai","Paciento apsilankymų istorija · "+name(p.id))+
    '<div class="panel"><div class="search-line">'+patientPicker()+'</div><div class="two-cols"><section><h2>Naujas įrašas</h2>'+
    '<form id="note-form"><div class="field-grid"><div class="field"><label>Data</label><input type="date" name="date" value="'+isoDate()+'" required></div>'+
    '<div class="field"><label>Gydytojas</label><select name="authorId"><option value="">Nepasirinktas</option>'+opt(db.staff.map(s=>[s.id,s.name]),"")+'</select></div>'+
    '<div class="field full"><label>Susijęs vizitas</label><select name="appointmentId"><option value="">Nesusietas</option>'+opt(db.appointments.filter(a=>a.patientId===p.id).map(a=>[a.id,a.date+" "+a.time+" · "+service(a.serviceId)]),"")+'</select></div>'+
    '<div class="field full"><label>Klinikinis aprašymas (demo)</label><textarea name="text" required placeholder="Anamnezė, atliktos procedūros, rekomendacijos…"></textarea></div></div>'+
    '<p style="margin-top:15px">'+btn("Išsaugoti įrašą","save-note","btn primary")+'</p></form></section>'+
    '<section><h2>Įrašų istorija</h2><div class="timeline">'+notes.map(n=>'<div class="timeline-entry"><b>'+fmt(n.date)+'</b><small class="muted" style="display:block">'+esc(doctor(n.authorId))+'</small><p style="white-space:pre-wrap">'+esc(n.text)+'</p></div>').join("")+'</div>'+
    (!notes.length?empty("Įrašų nėra","Sukurkite naują klinikinį įrašą."):"")+'</section></div></div>';
}
function viewFinances(){
  const invoices=db.invoices.filter(i=>ui.clinic==="all"||i.clinicId===ui.clinic);
  const total=invoices.reduce((n,i)=>n+invoiceTotal(i),0);
  const paid=invoices.reduce((n,i)=>n+(i.payments||[]).reduce((s,p)=>s+Number(p.amount||0),0),0);
  return page("Finansai","Demonstracinės sąskaitos ir mokėjimų įrašai",btn("+ Nauja sąskaita","new-invoice","btn primary"))+
    '<div class="stat-grid"><div class="stat"><small>Sąskaitų</small><strong>'+invoices.length+'</strong></div><div class="stat"><small>Išrašyta</small><strong>'+money(total)+'</strong></div>'+
    '<div class="stat"><small>Apmokėta (demo)</small><strong>'+money(paid)+'</strong></div><div class="stat"><small>Likutis</small><strong>'+money(Math.max(0,total-paid))+'</strong></div></div>'+
    '<section class="panel"><div class="notice warn">Sąskaitos ir mokėjimai yra demonstraciniai – nėra realių finansinių operacijų, mokesčių skaičiavimo ar integracijos su bankais.</div>'+
    '<div class="table-wrap"><table class="data-table"><thead><tr><th>Numeris</th><th>Data</th><th>Pacientas</th><th>Klinika</th><th>Suma</th><th>Likutis</th><th></th></tr></thead><tbody>'+
    invoices.map(i=>{
      const rem=Math.max(0,invoiceTotal(i)-(i.payments||[]).reduce((n,p)=>n+Number(p.amount),0));
      return '<tr><td>'+esc(i.number)+'</td><td>'+fmt(i.date)+'</td><td>'+esc(name(i.patientId))+'</td><td>'+esc(clinic(i.clinicId))+'</td><td>'+money(invoiceTotal(i))+'</td><td>'+money(rem)+'</td>'+
      '<td>'+btn("Atverti","open-invoice","btn small","data-id='"+esc(i.id)+"'")+'</td></tr>';
    }).join("")+'</tbody></table></div>'+(!invoices.length?empty("Sąskaitų nėra","Sukurkite demonstracinę sąskaitą."):"")+'</section>';
}
function viewServices(){
  const categories=[...new Set(db.services.filter(s=>s.source==="mkodontologija.lt").map(s=>s.category))];
  const rows=db.services.filter(s=>ui.category==="all"?s.source==="mkodontologija.lt":ui.category==="legacy"?s.source!=="mkodontologija.lt":s.category===ui.category);
  return page("Paslaugų katalogas","MK odontologijos kainynas pagal svetainės paslaugų grupes",btn("+ Pridėti paslaugą","new-service","btn primary"))+
    '<section class="panel"><div class="search-line"><label>Paslaugų grupė <select id="service-category-filter"><option value="all">Visos MK grupės</option>'+
    opt(categories.map(c=>[c,c]),ui.category)+opt([["legacy","Ankstesnės demo paslaugos"]],ui.category)+'</select></label></div>'+
    '<p class="help">Šaltinis: <a href="'+PRICE_SOURCE+'" target="_blank" rel="noopener noreferrer">mkodontologija.lt/kainos</a> (peržiūrėta '+PRICE_REVIEWED+'). Intervalai yra orientaciniai, o paslaugų trukmės – demonstracinės.</p>'+
    '<div class="table-wrap"><table class="data-table"><thead><tr><th>Paslauga</th><th>Grupė</th><th>Trukmė</th><th>Kaina pagal kainyną</th><th>Būsena</th><th></th></tr></thead><tbody>'+
    rows.map(s=>'<tr><td><b>'+esc(s.name)+'</b></td><td>'+esc(s.category)+'</td><td>'+s.duration+' min.</td><td>'+esc(s.priceLabel||money(s.price))+'</td><td>'+pill(s.active?"Aktyvi":"Neaktyvi")+'</td>'+
    '<td>'+btn("Redaguoti","edit-service","btn small","data-id=\''+esc(s.id)+'\'")+'</td></tr>').join("")+'</tbody></table></div></section>';
}

function viewForms(){
 const p=db.patients.find(x=>x.id===ui.patient)||listPatients()[0];
 if(!p)return page("Paciento dokumentai","Registravimo formos – demo")+empty("Nėra pacientų","Sukurkite sintetinį pacientą.");
 const rows=(db.forms||[]).filter(f=>f.patientId===p.id).sort((a,b)=>String(b.signedAt).localeCompare(String(a.signedAt)));
 const checklist=registrationChecklist(db.forms,p.id);
 const items=FORM_TYPES.map(form=>{
   const latest=rows.find(x=>x.type===form.id);
   return '<div class="segment" style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap"><div><b>'+esc(form.name)+'</b><small style="display:block">'+(latest?'Paskutinis įrašas: '+esc(new Date(latest.signedAt).toLocaleString("lt-LT")):'Dokumentas dar nepasirašytas')+'</small>'+
     '<small style="display:block">'+pill(statusOfForm(latest))+'</small></div><div class="actions">'+
     btn("Užpildyti ir pasirašyti","new-form","btn primary","data-kind=\'"+form.id+"\'")+
     (latest?btn("Peržiūrėti","view-form","btn small","data-id=\'"+esc(latest.id)+"\'"):"")+'</div></div>';
 });
 return page("Paciento dokumentai","Keturi atskiri dokumentai su demonstraciniu paciento parašu")+
   '<div class="panel"><div class="search-line">'+patientPicker()+'</div><div class="notice">Registracijos dokumentai: <b>'+checklist.filter(x=>x.signed).length+'/3</b> pasirašyti (demo). Invazinės procedūros sutikimas – tik konkrečiam gydymui.</div><p class="help">Pacientas: <b>'+esc(name(p.id))+
   '</b>. Dokumentai išsaugomi tik šios naršyklės demonstracinėje saugykloje. Nėra asmens tapatybės patvirtinimo ar kvalifikuoto elektroninio parašo.</p>'+
   '<div class="notice warn">NEVESTI realių pacientų sveikatos duomenų, tikrus parašus ar tapatybės informaciją. Klinikos vadovas turi patvirtinti realias formas ir jų versijas prieš naudojimą.</div>'+
   items.join("")+'</div><section class="panel"><h2>Pasirašymo istorija</h2>'+
   (rows.length?'<div class="table-wrap"><table class="data-table"><thead><tr><th>Dokumentas</th><th>Data</th><th>Būsena</th><th></th></tr></thead><tbody>'+
   rows.map(x=>'<tr><td>'+esc(FORM_TYPES.find(t=>t.id===x.type)?.short||x.type)+'</td><td>'+esc(new Date(x.signedAt).toLocaleString("lt-LT"))+'</td><td>'+pill("Pasirašyta (demo)")+'</td><td>'+
   btn("Atverti","view-form","btn small","data-id=\'"+esc(x.id)+"\'")+'</td></tr>').join("")+'</tbody></table></div>':empty("Dokumentų dar nėra","Pasirinkite pirmąją formą."))+'</section>';
}
const formInput=(label,name,required=true,placeholder="")=>'<div class="field"><label>'+esc(label)+(required?" *":"")+'</label><textarea rows="2" name="'+esc(name)+'" '+(required?"required":"")+' placeholder="'+esc(placeholder)+'"></textarea></div>';
function formFields(kind,p){
 const rep='<div class="field"><label>Pasirašančiojo vardas, pavardė (demo) *</label><input name="representative" value="'+esc(name(p.id))+'" maxlength="160" required></div>'+
   '<div class="field"><label>Pasirašančiojo vaidmuo *</label><select name="capacity"><option value="pacientas">Pacientas</option><option value="atstovas">Teisėtas atstovas (tik demo)</option></select></div>'+
   '<div class="field"><label>Atstovavimo pagrindas (jei taikoma)</label><input name="representationBasis" maxlength="240" placeholder="Pvz., tėvas, globėjas – demo"></div>';
 if(kind==="agreement")return '<h3>1. Sutarties šalys ir paslaugos</h3><p>Demonstracinė odontologijos klinika teikia pacientui odontologinės apžiūros, diagnostikos, profilaktikos ir gydymo paslaugas pagal atskirai suderintą gydymo planą. Konkrečias paslaugas, gydytoją, prognozuojamą kainą ir vizitų laiką šalys derina atskirai. Tai nėra realios klinikos patvirtinta sutartis.</p>'+
   '<h3>2. Paciento teisės, pareigos ir informavimas</h3><p>Pacientas turi teisę suprantama kalba gauti informaciją apie sveikatos būklę, gydymo metodus, alternatyvas ir galimas rizikas, atsisakyti siūlomos procedūros bei užduoti klausimus. Pacientas pateikia gydymui reikšmingą informaciją apie savo sveikatą ir laikosi suderintų rekomendacijų. Invazinei procedūrai pildomas <b>atskiras</b> informuotas sutikimas.</p>'+
   '<h3>3. Kainos ir apmokėjimas</h3><p>Paslaugų kainos aptariamos prieš gydymą pagal klinikos galiojantį kainyną. Kainų intervalai yra orientaciniai, o galutinė procedūros kaina turi būti paaiškinta pacientui. Mokėjimo būdus, terminus, vizitų atšaukimo tvarką ir ginčų nagrinėjimą nustato realios klinikos vidaus taisyklės bei teisės aktai.</p>'+
   '<h3>4. Asmens duomenų apsauga</h3><p>Duomenų tvarkymas aprašytas atskirame BDAR informavimo dokumente. Šios sutarties pasirašymas nėra privalomas sutikimas gauti rinkodaros pranešimus.</p>'+
   '<div class="field"><label>Klinika *</label><select name="clinicId">'+opt(db.clinics.filter(c=>p.clinicIds.includes(c.id)).map(c=>[c.id,c.name]),p.clinicIds[0])+'</select></div>'+
   '<div class="field"><label>Susipažinimas su vidaus tvarkos taisyklėmis *</label><select name="rules" required><option value="">Pasirinkite</option><option value="Susipažinau">Susipažinau (demo)</option></select></div>'+
   '<div class="field"><label>Informacija apie kainyną ir apmokėjimą *</label><select name="fees" required><option value="">Pasirinkite</option><option value="Informuotas">Esu informuotas (demo)</option></select></div>'+
   formInput("Papildomos sutarties sąlygos (tik demo)","otherTerms",false)+rep;
 if(kind==="privacy")return '<h3>Asmens duomenų tvarkymo informacija</h3><p>Informacinis BDAR pranešimas, <b>ne bendras privalomas sutikimas tvarkyti sveikatos duomenis</b>. Registracijos ir gydymo duomenys realioje įstaigoje gali būti tvarkomi vykdant teisinę prievolę ar teikiant sveikatos priežiūrą (BDAR 6 str. ir 9 str. 2 d. h p., pagal konkrečias aplinkybes). Gydymas negali būti siejamas su privalomu sutikimu rinkodarai.</p>'+
  '<div class="field"><label>Duomenų valdytojas (įstaiga, tik demo) *</label><input name="controller" required value="DentalPro demonstracinė klinika (ne juridinis asmuo)"></div>'+
  '<div class="field"><label>Duomenų apsaugos kontaktas / informavimo būdas (demo) *</label><input name="contact" required value="Demo aplinka – kontaktai nenurodyti"></div>'+
  '<p><b>Tikslai:</b> paciento registracija, sveikatos priežiūros paslaugos, dokumentavimas, atsiskaitymų apskaita. <b>Duomenys:</b> tapatybės, kontaktiniai, sveikatos, vizitų ir mokėjimo duomenys. <b>Teisės:</b> gauti informaciją, susipažinti, reikalauti taisymo, kitais BDAR numatytais atvejais apriboti tvarkymą, pateikti skundą VDAI. <b>Duomenų gavėjai ir terminai:</b> paslaugos teikime dalyvaujantys įgalioti asmenys ir teisės aktuose numatyti gavėjai; konkrečias kategorijas, saugojimo laikotarpius, saugumo priemones ir kreipimosi kontaktus privalo paskelbti tikroji klinika. Šioje demonstracijoje įrašai saugomi tik naršyklėje. <b>Rinkodara:</b> atskira, laisvai pasirenkama valia.</p>'+
  '<div class="field"><label>Susipažinimas su informacija *</label><select name="notice" required><option value="">Pasirinkite</option><option value="Susipažinau">Susipažinau (demo)</option></select></div>'+
  '<div class="field"><label>Atskiras NEPRIVALOMAS rinkodaros pasirinkimas</label><select name="marketing"><option value="Nesutinku">Nesutinku</option><option value="Sutinku">Sutinku</option></select></div>'+rep;
 if(kind==="health")return '<p>Į klausimus atsakykite pagal demonstracinį, išgalvotą atvejį. Gydytojas per realų vizitą privalėtų išsiaiškinti ir įvertinti individualias rizikas.</p>'+
   HEALTH_QUESTIONS.map(([key,label])=>'<div class="field"><label>'+esc(label)+' *</label><select name="q_'+key+'" required><option value="">Pasirinkite</option><option>Ne</option><option>Taip</option><option>Nežinau</option></select></div>').join("")+
   formInput("Paaiškinimai apie vaistus, alergijas, ligas","details",false)+rep;
 if(kind==="invasive")return '<p><b>Konkrečios procedūros sutikimas arba atsisakymas.</b> Gydytojas turi individualiai įvardyti procedūrą, jos alternatyvas, tikslus, komplikacijas ir atsisakymo padarinius. Bendro pobūdžio tekstas negali atstoti gydytojo paaiškinimo.</p>'+
   '<div class="field"><label>Konkreti chirurginė / invazinė / intervencinė procedūra *</label><textarea name="procedure" rows="2" required>'+esc(ui.modal?.procedureName||"")+'</textarea></div>'+
   formInput("Procedūros esmė, pobūdis ir tikslai","purpose")+
   formInput("Alternatyvos ir jų ypatumai","alternatives")+
   formInput("Dažnos komplikacijos","risksCommon")+
   formInput("Retos komplikacijos","risksRare")+
   formInput("Individualios paciento rizikos ir kitos aplinkybės","risksIndividual")+
   formInput("Nuskausminimo metodas arba netaikymo pagrindas","anesthesia")+
   formInput("Nuskausminimo rizikos ir galimos komplikacijos","anesthesiaRisks")+
   formInput("Pasekmės atsisakius procedūros","refusalRisks")+
   formInput("Leistina procedūros apimties keitimo riba","scope")+
   '<div class="field"><label>Informaciją pateikęs sveikatos priežiūros specialistas (demo) *</label><input name="clinician" required placeholder="Išgalvotas gydytojo vardas, pavardė, pareigos"></div>'+
   '<div class="field"><label>Paciento sprendimas *</label><select name="decision" required><option value="">Pasirinkite</option><option value="Sutinku">Sutinku</option><option value="Atsisakau">Atsisakau</option></select></div>'+rep;
 return "";
}
function formDrawer(d){
 if(d.kind==="signed-form"){
  const form=(db.forms||[]).find(x=>x.id===d.id),type=FORM_TYPES.find(t=>t.id===form?.type);
  if(!form)return '<div class="notice warn">Dokumentas nerastas.</div>';
  return '<div class="drawer-shade" data-action="backdrop"><aside role="dialog" aria-modal="true" class="drawer"><div class="drawer-title"><h2>'+esc(type?.name)+'</h2>'+btn("✕","close-modal","btn small ghost")+'</div>'+
  '<section class="panel"><div class="notice">Demonstracinis įrašas. Parašas nepatvirtina tapatybės ir nėra kvalifikuotas e. parašas.</div>'+
  '<p>Pacientas: '+esc(name(form.patientId))+' · Pasirašyta: '+esc(new Date(form.signedAt).toLocaleString("lt-LT"))+'</p>'+
  '<p style="white-space:pre-wrap">'+esc(form.documentText||FORM_DISCLOSURES[form.type]||"")+'</p>'+
  Object.entries(form.answers).map(([k,v])=>'<div class="detail-item"><small>'+esc(k)+'</small><b>'+esc(v)+'</b></div>').join("")+
  '<p>Demo parašas:</p><img alt="Demonstracinis ranka nupieštas parašas" style="max-width:100%;border:1px solid #ddd" src="'+esc(form.signature)+'">'+
  '<div class="drawer-footer">'+btn("Spausdinti / išsaugoti PDF","print-form","btn primary","data-id=\'"+esc(form.id)+"\'")+btn("Uždaryti","close-modal","btn small")+'</div></section></aside></div>';
 }
 const type=FORM_TYPES.find(t=>t.id===d.formType),p=db.patients.find(p=>p.id===ui.patient);
 if(!type||!p)return '<div class="notice warn">Dokumentas nepasiekiamas.</div>';
 return '<div class="drawer-shade" data-action="backdrop"><aside class="drawer" role="dialog" aria-modal="true"><div class="drawer-title"><h2>'+esc(type.name)+'</h2>'+btn("✕","close-modal","btn small ghost")+'</div>'+
   '<div class="drawer-body"><div class="notice warn">Tik demonstracija su išgalvotais duomenimis. Toks pieštas parašas nėra kvalifikuotas elektroninis parašas. Formą realiai klinikai turi patvirtinti vadovas / teisininkas.</div>'+
   '<p><b>Pacientas:</b> '+esc(name(p.id))+' · <b>Forma:</b> '+FORM_VERSION+'</p>'+
   '<form id="registration-form"><div class="field-grid">'+formFields(type.id,p)+'</div>'+
   '<div class="field"><label>Paciento / atstovo parašas pirštu arba pele *</label>'+
   '<canvas id="form-signature" width="600" height="170" aria-label="Demonstracinio parašo laukelis" style="width:100%;height:170px;background:white;border:2px solid #cad5d8;border-radius:8px;touch-action:none"></canvas>'+
   '<small class="help">Brėžkite laukelyje. Parašas išsaugomas tik šios naršyklės demonstracinėje saugykloje.</small>'+
   btn("Išvalyti parašą","clear-signature","btn small ghost")+'</div>'+
   '<div class="drawer-footer">'+btn("Pasirašyti ir išsaugoti (DEMO)","save-registration-form","btn primary")+'</div></form></div></aside></div>';
}
function printSignedForm(id){
 const doc=(db.forms||[]).find(f=>f.id===id&&f.demo===true);
 if(!doc){notify("Dokumentas nerastas.",true);return}
 const title=FORM_TYPES.find(f=>f.id===doc.type)?.name||"Paciento dokumentas";
 // Tik demonstracinė, spausdinimui skirta kopija iš jau išsaugoto įrašo.
 const lines=Object.entries(doc.answers||{}).map(([key,value])=>
   '<div class="answer"><strong>'+esc(key)+'</strong><p>'+esc(value)+'</p></div>').join("");
 const html='<!doctype html><html lang="lt"><head><meta charset="utf-8"><title>'+esc(title)+' – DEMO</title>'+
   '<style>body{font:15px Arial,sans-serif;color:#182d3b;max-width:780px;margin:35px auto;padding:0 18px}'+
   'h1{font-size:24px}.banner{background:#fff2cb;border:1px solid #d6a633;padding:12px;font-weight:bold}'+
   '.answer{border-bottom:1px solid #ddd;padding:8px 0;break-inside:avoid}.answer strong{font-size:12px;color:#527081}'+
   '.answer p{margin:7px 0;white-space:pre-wrap;overflow-wrap:anywhere}.sign{max-width:450px;max-height:140px;object-fit:contain}'+
   '@media print{body{margin:0;max-width:none}.banner{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>'+
   '<div class="banner">TIK DEMONSTRACIJA • NETINKA REALIEMS PACIENTŲ DOKUMENTAMS • PARAŠAS NĖRA TAPATYBĖS PATVIRTINIMAS</div>'+
   '<h1>'+esc(title)+'</h1><p><b>Pacientas (demo):</b> '+esc(name(doc.patientId))+'</p>'+
   '<p><b>Dokumento versija:</b> '+esc(doc.version)+'<br><b>Pasirašyta:</b> '+esc(new Date(doc.signedAt).toLocaleString("lt-LT"))+'</p>'+
   '<h2>Dokumento tekstas</h2><p style="white-space:pre-wrap">'+esc(doc.documentText||FORM_DISCLOSURES[doc.type]||"")+'</p>'+
   (doc.planItemId?'<p><b>Susietas gydymo plano procedūros ID:</b> '+esc(doc.planItemId)+'</p>':"")+
   lines+'<h2>Demonstracinis parašas</h2><img class="sign" alt="Demonstracinis parašas" src="'+esc(doc.signature)+'">'+
   '<p><small>DentalPro 2.0 • tik sintetiniai duomenys • spausdinta kopija</small></p></body></html>';
 const win=window.open("","_blank");
 if(!win){notify("Naršyklė neleido atidaryti spausdinimo lango. Leiskite iššokančius langus.",true);return}
 win.addEventListener("load",()=>{win.focus();win.print()},{once:true});
 win.document.open();win.document.write(html);win.document.close();
}
function setupSignatureCanvas(){
 const canvas=document.querySelector("#form-signature");
 if(!canvas||typeof canvas.getContext!=="function")return;
 const ctx=canvas.getContext("2d");if(!ctx)return;
 ctx.strokeStyle="#0d2c3a";ctx.lineWidth=2.8;ctx.lineJoin="round";ctx.lineCap="round";
 let drawing=false,points=0;
 const locate=e=>{const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height}};
 canvas.addEventListener("pointerdown",e=>{e.preventDefault();drawing=true;canvas.setPointerCapture?.(e.pointerId);const p=locate(e);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+0.1,p.y+0.1);ctx.stroke();points++;});
 canvas.addEventListener("pointermove",e=>{if(!drawing)return;e.preventDefault();const p=locate(e);ctx.lineTo(p.x,p.y);ctx.stroke();points++;});
 const finish=()=>{if(!drawing)return;drawing=false;if(points>=3){ui.modal.signature=canvas.toDataURL("image/png");ui.modal.signatureDrawn=true;}};
 canvas.addEventListener("pointerup",finish);canvas.addEventListener("pointercancel",finish);
 canvas.addEventListener("pointerleave",finish);
 if(ui.modal?.signature){const img=new Image();img.onload=()=>ctx.drawImage(img,0,0);img.src=ui.modal.signature}
}
function saveRegistrationForm(){
 const form=document.querySelector("#registration-form");
 if(!form||!ui.modal?.signatureDrawn){notify("Pacientas turi ranka nupiešti demonstracinį parašą.",true);return}
 const answers=stringValues(new FormData(form));
 const issues=validateForm(ui.modal.formType,answers,ui.modal.signature);
 if(issues.length){notify("Patikrinkite privalomus laukus ir parašą: "+issues.join("; "),true);return}
 const type=ui.modal.formType,patientId=ui.patient;
 const signed={id:uid("form"),version:FORM_VERSION,type,patientId,clinicId:db.patients.find(p=>p.id===patientId)?.clinicIds[0],
 answers,signature:ui.modal.signature,signedAt:new Date().toISOString(),demo:true};
 update("Pasirašytas demo paciento dokumentas",signed.id,s=>{s.forms??=[];s.forms.push(signed)});
 ui.modal=null;ui.route="forms";render();notify("Dokumentas pasirašytas (tik demo).");
}
function viewCompensation(){
 const catalog=db.laboratoryCatalog||[],summary=salarySummary(db.invoices,ui.salaryMonth,ui.clinic);
 const vlkRows=vlkSalaryRows(db.vlkCases||[],ui.salaryMonth,ui.clinic),vlkTotal=vlkSalaryTotal(db.vlkCases||[],ui.salaryMonth,ui.clinic);
 const registered=(db.invoices||[]).filter(i=>i.doctorId&&(ui.clinic==="all"||ui.clinic===i.clinicId));
 const percent=doctor=>Number.isFinite(Number(doctor.salaryPercent))?doctor.salaryPercent:35;
 const doctorTotals=new Map();
 for(const item of summary.doctors)doctorTotals.set(item.doctorId,{doctorId:item.doctorId,private:roundEuro(item.earning),vlk:0});
 for(const item of vlkRows){const entry=doctorTotals.get(item.doctorId)||{doctorId:item.doctorId,private:0,vlk:0};entry.vlk=roundEuro(entry.vlk+item.earning);doctorTotals.set(item.doctorId,entry)}
 return page("Laboratorija ir gydytojų atlygis","Tik sintetinė savininko ataskaitos demonstracija")+
 '<section class="panel"><div class="notice warn"><b>NĖRA saugios prieigos kontrolės.</b> Ši vieša demonstracija neriboja matomumo pagal naudotoją. Toliau naudokite tik išgalvotas sumas ir vardus. Tik savininkui prieinama ataskaita bus galima tik įdiegus serverinį prisijungimą bei teisių tikrinimą.</div>'+
 '<h2>Fiksuoti medžiagų atskaitymai (DEMO)</h2>'+
 '<p class="help">Administratorė ar gydytojas paslaugos sąskaitoje pažymi varneles. Čia galite pakeisti numatytus atskaitymus būsimoms sąskaitoms. Jau išsaugoti įkainiai nekeičiami.</p>'+
 '<form id="usage-fees-form"><div class="field-grid">'+
 '<div class="field"><label>Medžiagos (€)</label><input type="number" name="materials" min="0" max="1000" step="0.01" required value="'+esc(db.usageFees?.materials??DEFAULT_USAGE_FEES.materials)+'"></div>'+
 '<div class="field"><label>Chirurginės medžiagos (€)</label><input type="number" name="surgicalMaterials" min="0" max="1000" step="0.01" required value="'+esc(db.usageFees?.surgicalMaterials??DEFAULT_USAGE_FEES.surgicalMaterials)+'"></div></div>'+
 '<p>'+btn("Išsaugoti fiksuotus įkainius","save-usage-fees","btn primary")+'</p></form>'+
 '<h2>Gydytojų individualūs procentai</h2><div class="table-wrap"><table class="data-table"><thead><tr><th>Gydytojas</th><th>Procentas</th><th></th></tr></thead><tbody>'+
 db.staff.map(d=>'<tr><td>'+esc(d.name)+'</td><td><input aria-label="Atlygio procentas" id="salary-'+esc(d.id)+'" type="number" min="0" max="100" step="0.1" value="'+percent(d)+'" style="max-width:120px"> %</td><td>'+
 btn("Išsaugoti","save-doctor-percent","btn small","data-id=\'"+esc(d.id)+"\'")+'</td></tr>').join("")+'</tbody></table></div>'+
 '<p class="help">Procentas užfiksuojamas naujai sąskaitai jos sukūrimo metu. Vėlesni nustatymų pakeitimai ankstesnių sąskaitų procento nekeičia.</p></section>'+
 '<section class="panel"><h2>Technikų laboratorijos kainynas</h2><p class="help">Pavyzdiniai įkainiai; pasirinkus darbą konkrečioje sąskaitoje jo kaina išsaugoma kaip atskira savikainos kopija.</p>'+
 '<div class="table-wrap"><table class="data-table"><thead><tr><th>Laboratorija</th><th>Darbas</th><th>Įkainis</th><th></th></tr></thead><tbody>'+
 catalog.filter(x=>x.active!==false).map(x=>'<tr><td>'+esc(x.laboratory)+'</td><td>'+esc(x.name)+'</td><td>'+money(x.price)+'</td><td>'+
 btn("Keisti","edit-lab-work","btn small","data-id=\'"+esc(x.id)+"\'")+'</td></tr>').join("")+'</tbody></table></div>'+
 '<h3 style="margin-top:18px">Pridėti ar atnaujinti įkainį</h3><form id="lab-catalog-form"><div class="field-grid">'+
 '<div class="field"><label>Laboratorija</label><input name="laboratory" maxlength="160" required placeholder="Pvz., Laboratorija A (demo)"></div>'+
 '<div class="field"><label>Darbas</label><input name="name" maxlength="160" required placeholder="Pvz., Cirkonio vainikėlis"></div>'+
 '<div class="field"><label>Įkainis (€)</label><input type="number" name="price" min="0" max="100000" step="0.01" required></div></div>'+
 '<p>'+btn("Pridėti į kainyną","save-lab-work","btn primary")+'</p></form>'+
 '<details><summary>Importuoti laboratorijos kainyną iš CSV (taip pat galima išsaugoti iš Excel)</summary>'+
 '<p class="help">Stulpeliai: Laboratorija;Darbas;Kaina. Esami darbai su tuo pačiu laboratorijos ir darbo pavadinimu atnaujinami. Naudokite tik demo sumas.</p>'+
 '<textarea id="lab-csv" rows="5" placeholder="Laboratorija;Darbas;Kaina\nDemo laboratorija;Cirkonio vainikėlis;95"></textarea>'+
 '<p>'+btn("Importuoti CSV","import-lab-csv","btn small")+'</p></details></section>'+
 '<section class="panel"><div class="panel-title"><h2>Mėnesinė gydytojų atlygio ataskaita (DEMO)</h2><label>Mėnuo <input id="salary-month" aria-label="Atlygio mėnuo" type="month" value="'+esc(ui.salaryMonth)+'"></label></div>'+
 '<p class="help">Atlygis = max(0, iki šiol gauta už sąskaitą − laboratorija − atskirai įvestos detalės − fiksuotas medžiagų įkainis (jei pažymėta) − fiksuotas chirurginių medžiagų įkainis (jei pažymėta)) × gydytojo %. Mėnesio atlygis yra padidėjimas nuo šį mėnesį gautų įmokų. Kai savikaina dar nepadengta, atlygis 0 €. Kaina fiksuojama sąskaitoje. Mokesčiai ir realios išmokos neskaičiuojami.</p>'+
 '<div class="stat-grid"><div class="stat"><small>Atlygis per pasirinktą mėnesį</small><strong>'+money(summary.total)+'</strong></div>'+
 '<div class="stat"><small>Gautos įmokos per mėnesį</small><strong>'+money(summary.rows.reduce((n,r)=>n+r.paymentAmount,0))+'</strong></div>'+
 '<div class="stat"><small>Priskirtos sąskaitos</small><strong>'+registered.length+'</strong></div>'+
 '<div class="stat"><small>Įmokų įrašai</small><strong>'+summary.rows.length+'</strong></div></div>'+
 '<h3>Pagal gydytojus</h3><div class="table-wrap"><table class="data-table"><thead><tr><th>Gydytojas</th><th>Pacientų įmokos</th><th>Priskaičiuotas atlygis</th></tr></thead><tbody>'+
 summary.doctors.map(x=>'<tr><td>'+esc(doctor(x.doctorId))+'</td><td>'+money(x.received)+'</td><td><b>'+money(x.earning)+'</b></td></tr>').join("")+'</tbody></table></div>'+
 '<h3 style="margin-top:18px">Įmokų detalizacija</h3><div class="table-wrap"><table class="data-table"><thead><tr><th>Data</th><th>Gydytojas</th><th>Sąskaita</th><th>Gauta</th><th>Laboratorija (viso)</th><th>Detalės (viso)</th><th>Medžiagos (fiks.)</th><th>Chirurginės (fiks.)</th><th>%</th><th>Atlygis nuo įmokos</th></tr></thead><tbody>'+
 summary.rows.map(x=>'<tr><td>'+fmt(x.date)+'</td><td>'+esc(doctor(x.doctorId))+'</td><td>'+esc(x.invoiceNumber)+'</td><td>'+money(x.paymentAmount)+'</td><td>'+money(x.lab)+'</td><td>'+money(x.materials)+'</td><td>'+money(x.standard)+'</td><td>'+money(x.surgical)+'</td><td>'+x.doctorPercent+' %</td><td><b>'+money(x.earning)+'</b></td></tr>').join("")+'</tbody></table></div>'+
 (!summary.rows.length?empty("Nėra įmokų","Sukurkite demo sąskaitą, priskirkite gydytoją ir užregistruokite mokėjimą."):"")+'</section>'+
 '<section class="panel"><h2>VLK / PSDF atlygis – tik BAIGTI atvejai (DEMO)</h2>'+
 '<p class="help">VLK dalies atlygis priskiriamas atvejo užbaigimo mėnesiui. Skaičiuojama nuo faktinės PSDF sumos, ne kompensacijos lubų. Atskaičiuojami laboratorijos darbai, detalės, fiksuotos medžiagos ir taikomas individualus gydytojo procentas. Paciento priemoka atskirai neįskaičiuojama į VLK atlygio dalį. Faktinės VLK įmokos šioje demonstracijoje netikrinamos.</p>'+
 '<div class="stat-grid"><div class="stat"><small>VLK atlygis</small><strong>'+money(vlkTotal)+'</strong></div>'+
 '<div class="stat"><small>Privatus atlygis</small><strong>'+money(summary.total)+'</strong></div>'+
 '<div class="stat"><small>Viso (DEMO)</small><strong>'+money(roundEuro(vlkTotal+summary.total))+'</strong></div>'+
 '<div class="stat"><small>Baigti VLK atvejai</small><strong>'+vlkRows.length+'</strong></div></div>'+
 '<h3>Gydytojų atlygio suvestinė (privatūs + VLK)</h3><div class="table-wrap"><table class="data-table"><thead><tr><th>Gydytojas</th><th>Privatūs mokėjimai</th><th>VLK baigti atvejai</th><th>Iš viso</th></tr></thead><tbody>'+
 [...doctorTotals.values()].map(x=>'<tr><td>'+esc(doctor(x.doctorId))+'</td><td>'+money(x.private)+'</td><td>'+money(x.vlk)+'</td><td><b>'+money(roundEuro(x.private+x.vlk))+'</b></td></tr>').join("")+'</tbody></table></div>'+
 '<h3>Baigtų VLK atvejų detalizacija</h3>'+
 '<div class="table-wrap"><table class="data-table"><thead><tr><th>Užbaigta</th><th>Gydytojas</th><th>Atvejis</th><th>Faktinė PSDF suma</th><th>Laboratorija</th><th>Detalės</th><th>Medžiagos</th><th>Chirurginės</th><th>%</th><th>Atlygis</th></tr></thead><tbody>'+
 vlkRows.map(x=>'<tr><td>'+fmt(x.date)+'</td><td>'+esc(doctor(x.doctorId))+'</td><td>'+esc(x.caseNumber)+'</td><td>'+money(x.claimedAmount)+'</td><td>'+money(x.costs.lab)+'</td><td>'+money(x.costs.materials)+'</td><td>'+money(x.costs.standard)+'</td><td>'+money(x.costs.surgical)+'</td><td>'+x.doctorPercent+' %</td><td><b>'+money(x.earning)+'</b></td></tr>').join("")+'</tbody></table></div>'+
 (!vlkRows.length?empty("Baigtų VLK atvejų nėra","Nebaigti atvejai atlygio nesukuria."):"")+'</section>';
}
function viewReports(){
  const visits=db.appointments.filter(a=>ui.clinic==="all"||a.clinicId===ui.clinic);
  const invoices=db.invoices.filter(i=>ui.clinic==="all"||i.clinicId===ui.clinic);
  const plans=db.plans.filter(p=>ui.clinic==="all"||p.clinicId===ui.clinic);
  const count=status=>visits.filter(a=>a.status===status).length;
  const invoiced=invoices.reduce((n,i)=>n+invoiceTotal(i),0);
  const received=invoices.reduce((n,i)=>n+(i.payments||[]).reduce((sum,p)=>sum+Number(p.amount||0),0),0);
  const doctorVisits=new Map();
  for(const a of visits){const item=doctorVisits.get(a.staffId)||{total:0,completed:0};item.total++;if(a.status==="Atliktas")item.completed++;doctorVisits.set(a.staffId,item)}
  const serviceTotals=new Map();
  for(const a of visits){if(a.status==="Atšauktas")continue;serviceTotals.set(a.serviceId,(serviceTotals.get(a.serviceId)||0)+1)}
  const rows=[...serviceTotals.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12);
  return page("Ataskaitos","Demonstraciniai klinikų veiklos rodikliai",btn("Eksportuoti vizitų CSV","export-appointments","btn primary"))+
    '<div class="stat-grid"><div class="stat"><small>Visi vizitai</small><strong>'+visits.length+'</strong></div>'+
    '<div class="stat"><small>Atlikti vizitai</small><strong>'+count("Atliktas")+'</strong></div>'+
    '<div class="stat"><small>Neatvykimai / atšaukimai</small><strong>'+(count("Neatvyko")+count("Atšauktas"))+'</strong></div>'+
    '<div class="stat"><small>Gydymo planų suma</small><strong>'+money(plans.reduce((n,p)=>n+planTotal(p),0))+'</strong></div></div>'+
    '<div class="two-cols"><section class="panel"><h2>Gydytojų vizitai</h2><div class="table-wrap"><table class="data-table"><thead><tr><th>Gydytojas</th><th>Visi</th><th>Atlikti</th></tr></thead><tbody>'+
    [...doctorVisits].map(([id,value])=>'<tr><td>'+esc(doctor(id))+'</td><td>'+value.total+'</td><td>'+value.completed+'</td></tr>').join("")+
    '</tbody></table></div></section><section class="panel"><h2>Dažniausios paslaugos</h2><div class="table-wrap"><table class="data-table"><thead><tr><th>Paslauga</th><th>Vizitai</th></tr></thead><tbody>'+
    rows.map(([id,n])=>'<tr><td>'+esc(service(id))+'</td><td>'+n+'</td></tr>').join("")+'</tbody></table></div></section></div>'+
    '<section class="panel"><h2>Finansų suvestinė (tik demo)</h2><div class="detail-grid">'+
    [['Išrašyta',money(invoiced)],['Užregistruoti mokėjimai',money(received)],['Likutis',money(Math.max(0,invoiced-received))],['Sąskaitų skaičius',invoices.length]].map(([label,value])=>'<div class="detail-item"><small>'+label+'</small><b>'+value+'</b></div>').join("")+'</div>'+
    '<p class="help">Rodikliai skaičiuojami iš šios naršyklės demonstracinių įrašų. Nėra sinchronizacijos su realiomis klinikomis.</p></section>';
}
function viewVlk(){
 const available=db.vlkCases||[],cases=available.filter(c=>ui.clinic==="all"||c.clinicId===ui.clinic);
 const editing=available.find(c=>c.id===ui.vlkEditingId&&c.status!=="Baigtas")||null;
 const clinicId=editing?.clinicId||(ui.clinic==="all"?"akm":ui.clinic);
 const category=vlkCategory(editing?.categoryId)||VLK_CATEGORIES[0];
 const done=cases.filter(c=>c.status==="Baigtas"),pending=cases.filter(c=>c.status!=="Baigtas"&&c.status!=="Atmestas");
 const paid=cases.filter(c=>c.status==="Baigtas").reduce((sum,c)=>sum+Number(c.claimedAmount||0),0);
 return page("VLK / PSDF","Kompensuojamų paslaugų atvejai ir jų užbaigimo kontrolė – tik DEMO")+
 '<section class="panel"><div class="notice warn"><b>DEMOnstracija, ne VLK integracija.</b> Teisė į kompensaciją, sutarties galiojimas, siuntimas, konsiliumo išvada bei EVIS DP įrašai automatiškai netikrinami. Įveskite tik išgalvotus duomenis. Dantų protezavimo kompensacijos ribos atnaujintos '+VLK_SOURCE_DATE+'. Konsultacijų įkainius būtina patikrinti pagal konkrečios klinikos VLK sutartį.</div>'+
 '<h2>Klinikų PSDF sutarčių žymos (DEMO)</h2><div class="table-wrap"><table class="data-table"><thead><tr><th>Klinika</th><th>Dantų protezavimas</th><th>Specialisto konsultacijos su siuntimu</th></tr></thead><tbody>'+
 db.clinics.map(cl=>'<tr><td>'+esc(cl.name)+'</td><td><label><input type="checkbox" data-change="vlk-contract" data-clinic="'+esc(cl.id)+'" data-kind="prosthetics" '+(db.vlkContracts?.[cl.id]?.prosthetics?"checked":"")+'> Sutartis patvirtinta (demo)</label></td>'+
 '<td><label><input type="checkbox" data-change="vlk-contract" data-clinic="'+esc(cl.id)+'" data-kind="consultation" '+(db.vlkContracts?.[cl.id]?.consultation?"checked":"")+'> Sutartis patvirtinta (demo)</label></td></tr>').join("")+'</tbody></table></div>'+
 '<p class="help">Žymos administracinės ir nepakeičia tikros sutarties su VLK.</p></section>'+
 '<div class="stat-grid"><div class="stat"><small>Vykdomi atvejai</small><strong>'+pending.length+'</strong></div><div class="stat"><small>Baigti atvejai</small><strong>'+done.length+'</strong></div>'+
 '<div class="stat"><small>Baigtų atvejų PSDF suma (demo)</small><strong>'+money(paid)+'</strong></div><div class="stat"><small>Neužbaigtų atlygis</small><strong>0 €</strong></div></div>'+
 '<section class="panel"><div class="panel-title"><h2>'+(editing?"Redaguoti nebaigtą PSDF atvejį":"Registruoti PSDF atvejį")+'</h2>'+(editing?btn("Naujas atvejis","vlk-new","btn small"):"")+'</div>'+
 '<form id="vlk-form"><div class="field-grid">'+
 '<div class="field"><label>Klinika *</label><select name="clinicId" id="vlk-clinic">'+opt(db.clinics.map(c=>[c.id,c.name]),clinicId)+'</select></div>'+
 '<div class="field"><label>Pacientas (tik demo) *</label><select name="patientId" id="vlk-patient">'+opt(db.patients.filter(p=>p.clinicIds.includes(clinicId)).map(p=>[p.id,name(p.id)]),editing?.patientId||db.patients.find(p=>p.clinicIds.includes(clinicId))?.id)+'</select></div>'+
 '<div class="field"><label>Gydytojas *</label><select name="doctorId" id="vlk-doctor">'+opt(db.staff.filter(d=>d.clinicIds.includes(clinicId)).map(d=>[d.id,d.name]),editing?.doctorId||db.staff.find(d=>d.clinicIds.includes(clinicId))?.id)+'</select></div>'+
 '<div class="field full"><label>PSDF paslaugos rūšis / paciento kategorija *</label><select name="categoryId" id="vlk-category">'+opt(VLK_CATEGORIES.map(c=>[c.id,c.label+(c.limit==null?" · pagal sutarties įkainį":" · iki "+money(c.limit))]),category.id)+'</select></div>'+
 '<div class="field"><label>VLK atvejo eiga</label><select name="caseStatus">'+opt([["Planuojamas","Planuojamas"],["Vykdomas","Vykdomas"]],editing?.status||"Planuojamas")+'</select></div>'+
 '<div class="field"><label>Maksimali kompensacija</label><input id="vlk-cap-display" readonly value="'+(category.limit===null?"Pagal konkrečią sutartį":money(category.limit))+'"></div>'+
 '<div class="field"><label>Faktinė kompensuojama suma (€) *</label><input type="number" name="claimedAmount" min="0.01" max="100000" step="0.01" value="'+esc(editing?.claimedAmount??"")+'" required placeholder="Nebūtinai maksimali suma"></div>'+
 '<div class="field"><label>Paciento priemoka (€), jei taikoma</label><input type="number" name="patientContribution" min="0" step="0.01" value="'+esc(editing?.patientContribution??0)+'"></div>'+
 '<div class="field"><label>Siuntimo nuoroda (demo; būtina konsultacijai)</label><input name="referralReference" maxlength="120" value="'+esc(editing?.referralReference||"")+'" placeholder="Tik išgalvotas identifikatorius"></div>'+
 '<div class="field"><label>EVIS DP atvejo nr. / patvirtinimo žyma (demo)</label><input name="evisReference" maxlength="120" value="'+esc(editing?.evisReference||"")+'" placeholder="Tik išgalvotas identifikatorius"></div>'+
 '<div class="field"><label>Gydymo plano sąsaja (nebūtina)</label><select name="planId"><option value="">Nesusieta</option>'+opt(db.plans.filter(p=>p.patientId===(editing?.patientId||db.patients.find(p=>p.clinicIds.includes(clinicId))?.id)&&p.clinicId===clinicId).map(p=>[p.id,p.title]),editing?.planId||"")+'</select></div>'+
 '<div class="field full"><label><input type="checkbox" name="eligibilityChecked" '+(editing?.eligibilityChecked?"checked":"")+'> Atsakingas darbuotojas patikrino teisę, sutarties sąlygas ir privalomus dokumentus (tik demo žyma)</label></div>'+
 '<div class="field full"><h3>Laboratorija ir savikaina šiam atvejui</h3><p class="help">Įkainiai įrašomi ranka arba pasirenkami iš demonstracinio laboratorijos kainyno. VLK atlygis bus skaičiuojamas tik užbaigus atvejį.</p></div>'+
 '<div class="field full"><label>Laboratorijos darbas</label><select name="labCatalogId" id="vlk-lab-choice"><option value="">Rankinis įrašas / netaikoma</option>'+opt((db.laboratoryCatalog||[]).filter(x=>x.active!==false).map(x=>[x.id,x.laboratory+" – "+x.name+" · "+money(x.price)]),editing?.labCatalogId||"")+'</select></div>'+
 '<div class="field"><label>Laboratorijos pavadinimas / darbas</label><input name="labName" maxlength="160" value="'+esc(editing?.costs?.laboratory?.[0]?.description||"")+'" placeholder="Pvz., cirkonio vainikėlis"></div>'+
 '<div class="field"><label>Laboratorijos kaina (€)</label><input type="number" name="labPrice" min="0" step="0.01" value="'+esc(editing?.costs?.laboratory?.[0]?.price??0)+'"></div>'+
 '<div class="field"><label>Detalė / medžiaga (papildoma)</label><input name="materialName" maxlength="160" value="'+esc(editing?.costs?.materials?.[0]?.description||"")+'" placeholder="Pvz., titaninė bazė"></div>'+
 '<div class="field"><label>Detalės / medžiagos kaina (€)</label><input type="number" name="materialPrice" min="0" step="0.01" value="'+esc(editing?.costs?.materials?.[0]?.price??0)+'"></div>'+
 '<div class="field full"><label><input name="usageMaterials" type="checkbox" '+(editing?.usage?.materials?"checked":"")+'> Medžiagos – '+money(editing?.usage?.materialsFee??db.usageFees?.materials??5)+' (standartinis atskaitymas)</label>'+
 '<label><input name="usageSurgical" type="checkbox" '+(editing?.usage?.surgicalMaterials?"checked":"")+'> Chirurginės medžiagos – '+money(editing?.usage?.surgicalMaterialsFee??db.usageFees?.surgicalMaterials??20)+'</label></div>'+
 '</div><p class="help">„Baigtas“ nustatoma atskiru veiksmu. Vėliau faktinės kompensacijos ar savikainos negalima keisti, kad nepasikeistų jau priskaičiuotas atlygis.</p>'+
 '<p>'+btn(editing?"Išsaugoti atvejį":"Sukurti PSDF atvejį","vlk-save","btn primary")+'</p></form></section>'+
 '<section class="panel"><h2>PSDF atvejai ir būsenos</h2><div class="table-wrap"><table class="data-table"><thead><tr><th>Atvejis</th><th>Pacientas</th><th>Gydytojas</th><th>Paslauga</th><th>Faktinė suma</th><th>Būsena</th><th>Veiksmai</th></tr></thead><tbody>'+
 cases.map(c=>'<tr><td>'+esc(c.caseNumber)+'</td><td>'+esc(name(c.patientId))+'</td><td>'+esc(doctor(c.doctorId))+'</td><td>'+esc(vlkCategory(c.categoryId)?.label||"")+'</td><td>'+money(c.claimedAmount)+'</td><td>'+pill(c.status)+'</td><td>'+
 (c.status==="Baigtas"?'<span class="pill">Atvejis užrakintas</span>':c.status==="Atmestas"?'<span class="pill grey">Atmestas</span>':
 btn("Redaguoti","vlk-edit","btn small","data-id=\'"+esc(c.id)+"\'")+
 btn("Baigti atvejį","vlk-complete","btn small primary","data-id=\'"+esc(c.id)+"\'")+
 btn("Atmesti","vlk-reject","btn small ghost","data-id=\'"+esc(c.id)+"\'"))+
 '</td></tr>').join("")+'</tbody></table></div>'+
 (!cases.length?empty("Atvejų nėra","Sukurkite pirmąjį demonstracinį PSDF atvejį."):"")+
 '<p class="help">Baigtos PSDF sumos nėra tikrų VLK gautų mokėjimų patvirtinimas. Šiame demo atlygis priskaičiuojamas tik pažymėjus atvejį „Baigtas“, tačiau VLK faktinio apmokėjimo duomenys negaunami.</p></section>';
}
function viewAdmin(){
  return page("Administravimas","Duomenų eksportas, demonstracijos atkūrimas ir veiksmų istorija")+
    '<div class="two-cols"><section class="panel"><h2>Demonstracinė aplinka</h2><div class="notice warn">Nėra prisijungimo, naudotojų teisių, serverinės duomenų bazės ar saugaus audito. Tai tik sintetinė v3 aplinka; ankstesni naršyklės pacientų įrašai neperkeliami. Neveskite tikrų pacientų duomenų.</div>'+
    '<div class="detail-grid" style="margin:20px 0">'+[["Klinikos",db.clinics.length],["Kėdės",db.chairs.length],["Gydytojai",db.staff.length],["Pacientai",db.patients.length]].map(([k,v])=>'<div class="detail-item"><small>'+k+'</small><b>'+v+'</b></div>').join("")+'</div>'+
    '<div class="actions">'+btn("Eksportuoti demo JSON","export","btn primary")+btn("Eksportuoti vizitų CSV","export-appointments","btn small")+btn("Atkurti demo įrašus","reset","btn danger")+'</div></section>'+
    '<section class="panel"><h2>Veiksmų žurnalas</h2><div class="audit-list">'+db.audit.slice(0,60).map(a=>'<div class="audit-entry"><span><strong>'+esc(a.action)+'</strong><small class="muted" style="display:block">'+esc(a.entity)+'</small></span><span class="muted">'+esc(new Date(a.at).toLocaleString("lt-LT"))+'</span></div>').join("")+'</div></section></div>';
}


function viewDrawer(){
  const d=ui.modal;
  const close=btn("✕","close-modal","btn small ghost","aria-label='Uždaryti'");
  const wrap=(title,content)=>'<div class="drawer-shade" data-action="backdrop"><aside class="drawer" role="dialog" aria-modal="true" aria-label="'+esc(title)+'"><div class="drawer-title"><h2>'+title+'</h2>'+close+'</div>'+content+'</aside></div>';
  if(d.kind==="appointment"){
    const original=db.appointments.find(a=>a.id===d.id);
    const a=Object.assign({clinicId:ui.clinic==="all"?"akm":ui.clinic,chairId:"",patientId:ui.patient,
      staffId:"",date:ui.day,time:"09:00",duration:30,serviceId:primaryService()?.id||"",status:"Registruotas",notes:""},original||{},d.preset||{});
    if(!a.chairId||!db.chairs.some(c=>c.id===a.chairId&&c.clinicId===a.clinicId))a.chairId=a.clinicId+"-1";
    if(!db.patients.some(p=>p.id===a.patientId&&p.clinicIds.includes(a.clinicId)))a.patientId=db.patients.find(p=>p.clinicIds.includes(a.clinicId))?.id||"";
    const doctorOptions=db.staff.filter(s=>s.clinicIds.includes(a.clinicId)).map(s=>[s.id,s.name]);
    const patients=db.patients.filter(p=>p.clinicIds.includes(a.clinicId)).map(p=>[p.id,name(p.id)]);
    return wrap(original?"Redaguoti vizitą":"Registruoti vizitą",
      '<div class="notice">Registracijos seka: <b>kėdė → pacientas → gydytojas</b>. Bus patikrintas grafikas, pertrauka ir užimtumas.</div>'+
      '<form id="appt-form" style="margin-top:17px"><div class="field-grid">'+
      '<div class="field full"><label>1. Klinika</label><select name="clinicId" id="appt-clinic">'+opt(db.clinics.map(c=>[c.id,c.name]),a.clinicId)+'</select></div>'+
      '<div class="field"><label>2. Kėdė</label><select name="chairId" id="appt-chair">'+opt(db.chairs.filter(c=>c.clinicId===a.clinicId).map(c=>[c.id,c.name]),a.chairId)+'</select></div>'+
      '<div class="field"><label>3. Pacientas</label><select name="patientId" id="appt-patient">'+opt(patients,a.patientId)+'</select></div>'+
      '<div class="field full"><label>4. Gydytojas</label><select name="staffId" id="appt-doctor"><option value="">Pasirinkite gydytoją</option>'+opt(doctorOptions,a.staffId)+'</select></div>'+
      '<div class="field"><label>Data</label><input type="date" name="date" value="'+esc(a.date)+'" required></div>'+
      '<div class="field"><label>Laikas</label><input type="time" name="time" value="'+esc(a.time)+'" step="900" required></div>'+
      '<div class="field"><label>Trukmė (min.)</label><select name="duration" id="appt-duration">'+opt([15,30,45,60,75,90,105,120,150,180,210,240].map(x=>[x,x+" min."]),a.duration)+'</select></div>'+
      '<div class="field"><label>Paslauga</label><select name="serviceId" id="appt-service">'+serviceChoices(a.serviceId)+'</select></div>'+
      '<div class="field full"><label>Būsena</label><select name="status">'+simple(STATUSES,a.status)+'</select></div>'+
      '<div class="field full"><label>Pastabos (tik demo)</label><textarea name="notes">'+esc(a.notes||"")+'</textarea></div></div>'+
      '<div class="drawer-footer">'+(original?btn("Paciento kortelė","appointment-patient","btn small")+btn("Ištrinti","delete-appt","btn danger"):"")+
      btn("Išsaugoti vizitą","save-appt","btn primary")+'</div></form>');
  }
  if(d.kind==="patient"){
    const p=db.patients.find(p=>p.id===d.id);
    const a=p||{firstName:"",lastName:"",birthDate:"",phone:"",email:"",alerts:"",clinicIds:[ui.clinic==="all"?"akm":ui.clinic]};
    return wrap(p?"Redaguoti paciento kortelę":"Naujas demonstracinis pacientas",
      '<div class="notice warn">Įveskite tik išgalvoto paciento duomenis, ne tikrą asmeninę ar medicininę informaciją.</div>'+
      '<form id="patient-form" style="margin-top:16px"><div class="field-grid"><div class="field"><label>Vardas</label><input name="firstName" maxlength="90" required value="'+esc(a.firstName)+'"></div>'+
      '<div class="field"><label>Pavardė</label><input name="lastName" maxlength="90" required value="'+esc(a.lastName)+'"></div>'+
      '<div class="field"><label>Gimimo data</label><input type="date" name="birthDate" value="'+esc(a.birthDate||"")+'"></div>'+
      '<div class="field"><label>Telefonas (išgalvotas)</label><input name="phone" maxlength="45" value="'+esc(a.phone||"")+'"></div>'+
      '<div class="field full"><label>El. paštas (išgalvotas)</label><input type="text" name="email" value="'+esc(a.email||"")+'"></div>'+
      '<div class="field full"><label>Klinika</label><div class="flex">'+db.clinics.map(c=>'<label style="font-weight:400"><input name="clinicIds" type="checkbox" value="'+c.id+'" '+(a.clinicIds.includes(c.id)?"checked":"")+'>'+esc(c.name)+'</label>').join("")+'</div></div>'+
      '<div class="field full"><label>Pastabos / įspėjimai (tik demo)</label><textarea name="alerts">'+esc(a.alerts||"")+'</textarea></div></div>'+
      '<div class="drawer-footer">'+btn("Išsaugoti pacientą","save-patient","btn primary")+'</div></form>');
  }
  if(d.kind==="doctor"){
    return wrap("Pridėti gydytoją",'<form id="doctor-form"><div class="field"><label>Vardas ir pavardė</label><input name="name" required maxlength="110" placeholder="Dr. Vardas Pavardė"></div>'+
      '<div class="field" style="margin-top:15px"><label>Specialybė</label><input name="role" value="Gydytojas odontologas"></div>'+
      '<div class="field" style="margin-top:15px"><label>Klinikos</label>'+db.clinics.map(c=>'<label style="font-weight:400"><input type="checkbox" name="clinicIds" value="'+c.id+'" '+((ui.clinic==="all"||ui.clinic===c.id)?"checked":"")+'>'+esc(c.name)+'</label>').join("")+'</div>'+
      '<div class="drawer-footer">'+btn("Pridėti gydytoją","save-doctor","btn primary")+'</div></form>');
  }
  if(d.kind==="plan"){
    return wrap("Naujas gydymo planas",'<form id="plan-form"><div class="field"><label>Pacientas</label><select name="patientId">'+opt(listPatients().map(p=>[p.id,name(p.id)]),ui.patient)+'</select></div>'+
      '<div class="field" style="margin-top:15px"><label>Plano pavadinimas</label><input name="title" required maxlength="160" placeholder="Pvz., Viršutinio žandikaulio gydymas"></div>'+
      '<div class="field" style="margin-top:15px"><label>Būsena</label><select name="status">'+simple(PLAN_STATUSES,"Juodraštis")+'</select></div>'+
      '<div class="drawer-footer">'+btn("Sukurti planą","save-plan","btn primary")+'</div></form>');
  }
  if(d.kind==="service"){
    const s=db.services.find(s=>s.id===d.id);
    return wrap(s?"Redaguoti paslaugą":"Nauja paslauga",'<form id="service-form"><div class="field-grid"><div class="field full"><label>Paslaugos pavadinimas</label><input name="name" value="'+esc(s?.name||"")+'" maxlength="160" required></div>'+
      '<div class="field"><label>Kategorija</label><input name="category" value="'+esc(s?.category||"Kita")+'" required></div>'+
      '<div class="field"><label>Trukmė (min.)</label><input type="number" name="duration" min="15" max="240" step="15" value="'+Number(s?.duration||30)+'"></div>'+
      '<div class="field"><label>Kaina (€)</label><input type="number" name="price" min="0" max="100000" step=".01" value="'+Number(s?.price||0)+'"></div>'+
      '<div class="field"><label>Aktyvi</label><input type="checkbox" name="active" '+(!s||s.active?"checked":"")+'></div></div>'+
      '<div class="drawer-footer">'+btn("Išsaugoti paslaugą","save-service","btn primary")+'</div></form>');
  }
  if(d.kind==="lab-work"){
    const rec=(db.laboratoryCatalog||[]).find(x=>x.id===d.id);
    if(!rec)return wrap("Laboratorija",empty("Įrašas nerastas",""));
    return wrap("Redaguoti laboratorijos įkainį (DEMO)",'<form id="lab-edit-form"><div class="field-grid">'+
      '<div class="field"><label>Laboratorija</label><input name="laboratory" maxlength="160" required value="'+esc(rec.laboratory)+'"></div>'+
      '<div class="field"><label>Darbo pavadinimas</label><input name="name" maxlength="160" required value="'+esc(rec.name)+'"></div>'+
      '<div class="field"><label>Kaina (€)</label><input name="price" type="number" min="0" max="100000" step="0.01" required value="'+Number(rec.price)+'"></div></div>'+
      '<div class="drawer-footer">'+btn("Išsaugoti","save-lab-edit","btn primary")+'</div></form>');
  }
  if(d.kind==="invoice"){
    const invoice=db.invoices.find(i=>i.id===d.id);
    if(invoice){
      const total=invoiceTotal(invoice),paid=(invoice.payments||[]).reduce((s,p)=>s+Number(p.amount||0),0),remaining=Math.max(0,total-paid);
      return wrap("Sąskaita "+invoice.number,'<div class="detail-grid"><div class="detail-item"><small>Pacientas</small><b>'+esc(name(invoice.patientId))+'</b></div>'+
        '<div class="detail-item"><small>Data</small><b>'+fmt(invoice.date)+'</b></div>'+
        '<div class="detail-item"><small>Suma</small><b>'+money(total)+'</b></div><div class="detail-item"><small>Likutis</small><b>'+money(remaining)+'</b></div></div>'+
        '<h3 style="margin-top:24px">Paslaugos</h3>'+(invoice.planItemId?'<p class="help">Susieta su gydymo plano procedūra: '+esc(invoice.planItemId)+'</p>':"")+invoice.items.map(x=>'<div class="segment">'+esc(x.description)+' · '+money(x.price)+'</div>').join("")+
        '<h3 style="margin-top:18px">Vienkartiniai medžiagų atskaitymai nuo gydytojo apyvartos</h3>'+
         '<div class="segment">'+
         '<label style="display:flex;gap:10px;align-items:center"><input type="checkbox" id="invoice-usage-materials" '+(invoice.usage?.materials?"checked":"")+' '+(paid>0?"disabled":"")+'> Medžiagos (sterilūs paketai, autoklavo įrankiai ir kt.) – '+money(invoice.usage?.materialsFee??DEFAULT_USAGE_FEES.materials)+'</label>'+
         '<label style="display:flex;gap:10px;align-items:center;margin-top:10px"><input type="checkbox" id="invoice-usage-surgical" '+(invoice.usage?.surgicalMaterials?"checked":"")+' '+(paid>0?"disabled":"")+'> Chirurginės medžiagos – '+money(invoice.usage?.surgicalMaterialsFee??DEFAULT_USAGE_FEES.surgicalMaterials)+'</label>'+
         '<p class="help">Atskaitoma vieną kartą už šią sąskaitoje esančią paslaugą, ne nuo kiekvieno mokėjimo. Jei pažymėtos abi – atskaitoma abiejų įkainių suma. Paciento mokėtina suma nesikeičia.</p>'+
         (paid===0?btn("Išsaugoti medžiagų žymas","save-invoice-usage","btn small"):'<span class="pill grey">Užrakinta po mokėjimo</span>')+
         '</div>'+
         '<p class="help">Fiksuoti atskaitymai: '+money((invoiceCosts(invoice).standard||0)+(invoiceCosts(invoice).surgical||0))+' · Kitos medžiagos ir laboratorija atskaitomos papildomai.</p>'+'<h3 style="margin-top:18px">Atlikęs gydytojas ir savikaina</h3>'+ 
        (invoice.doctorId?'<div class="notice">Gydytojas: <b>'+esc(doctor(invoice.doctorId))+'</b> · Užfiksuotas atlygio tarifas: <b>'+Number(invoice.doctorPercent)+' %</b></div>':'<div class="notice warn">Sąskaita nepriskirta gydytojui, todėl neįtraukiama į atlygio skaičiavimą.</div>')+
        '<p class="help">Sąskaitos savikaina turi būti suvestinė prieš pirmąjį mokėjimą. Užregistravus mokėjimą savikainos eilutės užrakinamos, kad nekeistų ankstesnių atlygio skaičiavimų.</p>'+
        '<h3>Laboratorijos darbai ('+money(invoiceCosts(invoice).lab)+')</h3>'+
        (invoice.costs?.laboratory||[]).map(x=>'<div class="segment">'+esc(x.description)+' · '+esc(x.laboratory||"")+' · '+Number(x.qty||1)+' × '+money(x.price)+(paid===0?btn("Pašalinti","remove-invoice-cost","btn small ghost","data-type=\'laboratory\' data-id=\'"+esc(x.id)+"\'"):"")+'</div>').join("")+
        (paid===0?'<form id="invoice-lab-cost-form"><div class="field-grid"><div class="field full"><label>Techniko laboratorijos darbas</label><select id="invoice-lab-work" name="labWorkId"><option value="">Rankinis įrašas</option>'+opt((db.laboratoryCatalog||[]).filter(x=>x.active!==false).map(x=>[x.id,x.laboratory+" – "+x.name+" · "+money(x.price)]),"")+'</select></div>'+
        '<div class="field"><label>Laboratorija (demo)</label><input name="laboratory" maxlength="160" placeholder="Laboratorija A"></div><div class="field"><label>Darbo pavadinimas</label><input name="description" maxlength="160" placeholder="Pvz., cirkonio vainikėlis"></div>'+
        '<div class="field"><label>Vieneto įkainis (€)</label><input name="price" type="number" min="0" max="100000" step="0.01" value="0"></div>'+
        '<div class="field"><label>Kiekis</label><input name="qty" type="number" min="1" max="100" value="1"></div></div>'+
        '<p>'+btn("+ Pridėti laboratorijos darbą","add-invoice-lab","btn small")+'</p></form>':"")+
        '<h3>Medžiagos ir detalės ('+money(invoiceCosts(invoice).materials)+')</h3>'+
        (invoice.costs?.materials||[]).map(x=>'<div class="segment">'+esc(x.description)+' · '+Number(x.qty||1)+' × '+money(x.price)+(paid===0?btn("Pašalinti","remove-invoice-cost","btn small ghost","data-type=\'materials\' data-id=\'"+esc(x.id)+"\'"):"")+'</div>').join("")+
        (paid===0?'<form id="invoice-material-form"><div class="field-grid"><div class="field"><label>Detalė / medžiaga</label><input name="description" maxlength="160" required placeholder="Pvz., multiunitas, stiklo pluošto kaištis"></div>'+
        '<div class="field"><label>Kaina (€)</label><input name="price" type="number" min="0" max="100000" step="0.01" required></div>'+
        '<div class="field"><label>Kiekis</label><input name="qty" type="number" min="1" max="100" value="1"></div></div>'+
        '<p>'+btn("+ Pridėti detalę / medžiagą","add-invoice-material","btn small")+'</p></form>':"")+
        '<h3 style="margin-top:22px">Demonstraciniai mokėjimai</h3>'+(invoice.payments||[]).map(p=>'<div class="segment">'+fmt(p.date)+' · '+esc(p.method)+' · '+money(p.amount)+'</div>').join("")+
        (remaining>0?'<form id="payment-form" style="margin-top:18px"><div class="field-grid"><div class="field"><label>Suma (€)</label><input type="number" name="amount" min=".01" max="'+remaining.toFixed(2)+'" step=".01" value="'+remaining.toFixed(2)+'"></div>'+
        '<div class="field"><label>Būdas</label><select name="method">'+simple(["Grynieji (demo)","Kortelė (demo)","Pavedimas (demo)"],"Kortelė (demo)")+'</select></div></div>'+
        '<div class="drawer-footer">'+btn("Registruoti mokėjimą","save-payment","btn primary")+'</div></form>':'<div class="notice">Sąskaita apmokėta (demonstracinis įrašas).</div>'));
    }
    const clinicId=ui.clinic==="all"?"akm":ui.clinic;
    return wrap("Nauja demonstracinė sąskaita",'<form id="invoice-form"><div class="field-grid"><div class="field full"><label>Klinika</label><select name="clinicId" id="invoice-clinic">'+opt(db.clinics.map(c=>[c.id,c.name]),clinicId)+'</select></div>'+
      '<div class="field full"><label>Pacientas</label><select name="patientId" id="invoice-patient">'+opt(db.patients.filter(p=>p.clinicIds.includes(clinicId)).map(p=>[p.id,name(p.id)]),ui.patient)+'</select></div>'+
      '<div class="field full"><label>Gydymo plano procedūra (nebūtina)</label><select name="planItemId" id="invoice-plan-item"><option value="">Nesusieta</option>'+opt(planInvoiceItems(db.patients.some(p=>p.id===ui.patient&&p.clinicIds.includes(clinicId))?ui.patient:db.patients.find(p=>p.clinicIds.includes(clinicId))?.id,clinicId).map(x=>[x.id,x.name]),"")+'</select></div>'+'<div class="field full"><label>Paslauga</label><select name="serviceId" id="invoice-service">'+serviceChoices(primaryService()?.id)+'</select></div>'+
      '<div class="field"><label>Kiekis</label><input name="qty" type="number" min="1" max="100" value="1"></div>'+
      '<div class="field"><label>Kaina (€)</label><input name="price" id="invoice-price" type="number" min="0" step=".01" value="'+Number(primaryService()?.price||0)+'"></div>'+
      '<div class="field full"><label>Gydytojas, kuriam priskiriama procedūra</label><select name="doctorId" id="invoice-doctor"><option value="">Nepriskirti (atlygis nebus skaičiuojamas)</option>'+opt(db.staff.filter(d=>d.clinicIds.includes(clinicId)).map(d=>[d.id,d.name]),"")+'</select></div>'+'<div class="field full"><label>Medžiagų naudojimas šiai paslaugai (atskaitymas tik nuo gydytojo atlygio bazės)</label>'+
       '<label style="display:flex;gap:10px;align-items:center"><input type="checkbox" name="usageMaterials"> Medžiagos – '+money(db.usageFees?.materials??DEFAULT_USAGE_FEES.materials)+'</label>'+
       '<label style="display:flex;gap:10px;align-items:center"><input type="checkbox" name="usageSurgical"> Chirurginės medžiagos – '+money(db.usageFees?.surgicalMaterials??DEFAULT_USAGE_FEES.surgicalMaterials)+'</label>'+
       '<small class="help">Pažymėjus abi, iš atlygio bazės išskaičiuojama jų įkainių suma. Šie įkainiai fiksuojami sąskaitoje. Paciento sąskaita nepadidinama.</small></div>'+
       '<div class="field full"><label>Data</label><input name="date" type="date" value="'+isoDate()+'"></div></div>'+
      '<div class="drawer-footer">'+btn("Sukurti sąskaitą","save-invoice","btn primary")+'</div></form>');
  }
  return wrap("Veiksmas",empty("Nepasiekiama","Pabandykite dar kartą."));
}
function formData(id){return new FormData($(id))}
function stringValues(form){return Object.fromEntries(form.entries())}
function calendarMove(direction){
  if(ui.view==="month"||ui.view==="list"){
    const d=new Date(ui.day+"T12:00:00");d.setMonth(d.getMonth()+direction);ui.day=isoDate(d);
  }else ui.day=shiftDate(ui.day,direction*(ui.view==="week"?7:1));
  render();
}
function saveAppointment(){
  const f=stringValues(formData("appt-form"));
  const a={
    id:ui.modal.id||uid("a"),clinicId:f.clinicId,chairId:f.chairId,patientId:f.patientId,
    staffId:f.staffId,date:f.date,time:f.time,duration:Number(f.duration),serviceId:f.serviceId,
    status:f.status,notes:String(f.notes||"").trim()
  };
  const issues=appointmentIssues(db,a);
  if(issues.length){notify(issues.join(" "),true);return}
  update(ui.modal.id?"Redaguotas vizitas":"Sukurtas vizitas",a.id,s=>{
    const i=s.appointments.findIndex(x=>x.id===a.id);
    if(i>=0)s.appointments[i]=a;else s.appointments.push(a);
  });
  ui.modal=null;ui.day=a.date;
  render();notify("Vizitas išsaugotas.");
}
function savePatient(){
  const f=formData("patient-form"),v=stringValues(f),ids=f.getAll("clinicIds"),old=db.patients.find(p=>p.id===ui.modal.id);
  if(!v.firstName?.trim()||!v.lastName?.trim()||!ids.length){notify("Nurodykite vardą, pavardę ir kliniką.",true);return}
  if(v.birthDate&&!validDate(v.birthDate)){notify("Neteisinga gimimo data.",true);return}
  if(old){
    const hasAppts=db.appointments.some(a=>a.patientId===old.id&&!ids.includes(a.clinicId));
    if(hasAppts){notify("Negalima pašalinti klinikos, kurioje pacientas turi vizitų.",true);return}
  }
  const p={id:old?.id||uid("p"),firstName:v.firstName.trim(),lastName:v.lastName.trim(),birthDate:v.birthDate||"",
    phone:v.phone?.trim()||"",email:v.email?.trim()||"",alerts:v.alerts?.trim()||"",clinicIds:ids,createdAt:old?.createdAt||isoDate(),synthetic:true};
  update(old?"Atnaujinta paciento kortelė":"Sukurtas demo pacientas",p.id,s=>{
    const i=s.patients.findIndex(x=>x.id===p.id);if(i>=0)s.patients[i]=p;else s.patients.push(p);
  });
  ui.patient=p.id;ui.modal=null;ui.route="patients";render();notify("Paciento kortelė išsaugota.");
}
function saveDoctor(){
  const f=formData("doctor-form"),v=stringValues(f),clinics=f.getAll("clinicIds");
  if(!v.name?.trim()||!clinics.length){notify("Įrašykite gydytoją ir pasirinkite kliniką.",true);return}
  if(db.staff.some(s=>s.name.trim().toLowerCase()===v.name.trim().toLowerCase())){notify("Toks gydytojas jau yra.",true);return}
  const staff={id:uid("dr"),name:v.name.trim(),role:v.role?.trim()||"Gydytojas odontologas",clinicIds:clinics,
    availability:clinics.flatMap(defaultAvailability),breaks:clinics.flatMap(defaultBreaks)};
  update("Pridėtas demonstracinis gydytojas",staff.id,s=>s.staff.push(staff));
  ui.selectedDoctor=staff.id;ui.modal=null;ui.route="doctors";render();notify("Gydytojas pridėtas.");
}
function saveSchedule(){
  const f=formData("schedule-form"),id=f.get("doctorId"),cid=f.get("clinicId");
  const doctorRecord=db.staff.find(d=>d.id===id);if(!doctorRecord)return;
  const work=[],breaks=[];
  for(let wd=0;wd<7;wd++){
    if(!f.get("active-"+wd))continue;
    const start=f.get("start-"+wd),end=f.get("end-"+wd),bs=f.get("breakStart-"+wd),be=f.get("breakEnd-"+wd);
    if(!Number.isFinite(minutes(start))||!Number.isFinite(minutes(end))||minutes(start)<420||minutes(end)>1320||minutes(end)<=minutes(start)){
      notify("Netinkamas darbo laikas: "+WEEKDAYS[wd]+".",true);return
    }
    work.push({clinicId:cid,weekday:wd,start,end});
    if(bs||be){
      if(!bs||!be||!Number.isFinite(minutes(bs))||!Number.isFinite(minutes(be))||minutes(bs)<minutes(start)||minutes(be)>minutes(end)||minutes(bs)>=minutes(be)){
        notify("Netinkama pertrauka: "+WEEKDAYS[wd]+".",true);return
      }
      breaks.push({clinicId:cid,weekday:wd,start:bs,end:be});
    }
  }
  const candidate=structuredClone(db);
  const staff=candidate.staff.find(s=>s.id===id);
  staff.availability=staff.availability.filter(w=>w.clinicId!==cid).concat(work);
  staff.breaks=staff.breaks.filter(b=>b.clinicId!==cid).concat(breaks);
  for(const a of candidate.appointments.filter(a=>a.staffId===id&&a.clinicId===cid&&a.status!=="Atšauktas")){
    const issues=appointmentIssues(candidate,a);
    if(issues.length){notify("Grafikas konfliktuoja su vizitu "+a.date+" "+a.time+": "+issues.join(" "),true);return}
  }
  update("Pakeistas gydytojo grafikas",id,s=>{
    const doc=s.staff.find(x=>x.id===id);
    doc.availability=staff.availability;doc.breaks=staff.breaks;
  });
  notify("Darbo grafikas išsaugotas.");
}
function saveFinding(){
  const f=formData("finding-form"),v=stringValues(f),patientId=ui.patient,toothNumber=ui.tooth;
  const finding={id:uid("tooth"),patientId,toothNumber,surfaces:f.getAll("surface"),condition:v.condition,
    status:v.status,note:v.note||"",updatedAt:new Date().toISOString()};
  if(!finding.surfaces.length){notify("Pažymėkite bent vieną paviršių.",true);return}
  update("Atnaujinta odontograma",patientId+":"+toothNumber,s=>{
    const i=s.findings.findIndex(x=>x.patientId===patientId&&Number(x.toothNumber)===toothNumber);
    if(i>=0)finding.id=s.findings[i].id;
    if(i>=0)s.findings[i]=finding;else s.findings.push(finding);
  });notify("Danties duomenys išsaugoti.");
}
function savePlan(){
  const v=stringValues(formData("plan-form"));
  if(!v.title?.trim()||!v.patientId){notify("Įrašykite plano pavadinimą ir pacientą.",true);return}
  const p=db.patients.find(x=>x.id===v.patientId),cid=(ui.clinic!=="all"&&p.clinicIds.includes(ui.clinic))?ui.clinic:p.clinicIds[0];
  const plan={id:uid("plan"),patientId:v.patientId,clinicId:cid,title:v.title.trim(),status:v.status,items:[]};
  update("Sukurtas gydymo planas",plan.id,s=>s.plans.push(plan));
  ui.patient=v.patientId;ui.selectedPlan=plan.id;ui.modal=null;ui.route="plans";render();notify("Gydymo planas sukurtas.");
}
function savePlanItem(){
  const f=stringValues(formData("plan-item-form")),p=db.plans.find(p=>p.id===(ui.selectedPlan||db.plans.find(p=>p.patientId===ui.patient)?.id));
  if(!p)return;
  const qty=Number(f.qty),price=Number(f.price);
  if(!Number.isInteger(qty)||qty<1||qty>20||!Number.isFinite(price)||price<0){notify("Neteisingas kiekis ar kaina.",true);return}
  const item={id:uid("item"),serviceId:f.serviceId,description:f.description?.trim()||service(f.serviceId),tooth:f.tooth?.trim()||"",qty,price,done:false};
  update("Į planą pridėta procedūra",p.id,s=>s.plans.find(x=>x.id===p.id).items.push(item));
  ui.selectedPlan=p.id;render();notify("Procedūra pridėta.");
}
function saveNote(){
  const v=stringValues(formData("note-form"));
  if(!validDate(v.date)||!v.text?.trim()){notify("Nurodykite datą ir klinikinį įrašą.",true);return}
  const note={id:uid("note"),patientId:ui.patient,date:v.date,authorId:v.authorId||"",appointmentId:v.appointmentId||"",
    text:v.text.trim(),createdAt:new Date().toISOString()};
  update("Sukurtas klinikinis įrašas",note.id,s=>s.clinicalNotes.push(note));notify("Įrašas išsaugotas.");
}
function saveService(){
  const v=stringValues(formData("service-form")),duration=Number(v.duration),price=Number(v.price),old=db.services.find(s=>s.id===ui.modal.id);
  if(!v.name?.trim()||!v.category?.trim()||!Number.isInteger(duration)||duration<15||duration>240||duration%15!==0||!Number.isFinite(price)||price<0){
    notify("Užpildykite paslaugos laukus. Trukmė turi būti 15 min. kartotinė.",true);return}
  const preserve=old&&Number(old.price)===price;
  const s={...old,id:old?.id||uid("s"),name:v.name.trim(),category:v.category.trim(),duration,price,active:v.active==="on",priceMin:preserve?old.priceMin:price,priceMax:preserve?old.priceMax:price,priceLabel:preserve?(old.priceLabel||money(price)):money(price),source:old?.source||"custom"};
  update(old?"Atnaujinta paslauga":"Sukurta paslauga",s.id,db=>{
    const i=db.services.findIndex(x=>x.id===s.id);
    if(i>=0)db.services[i]=s;else db.services.push(s);
  });
  ui.modal=null;render();notify("Paslauga išsaugota.");
}
function saveVlkCase(){
 const form=$("vlk-form");if(!form)return;
 const data=stringValues(new FormData(form));
 const category=vlkCategory(data.categoryId);
 const current=(db.vlkCases||[]).find(c=>c.id===ui.vlkEditingId);
 if(current&&["Baigtas","Atmestas"].includes(current.status)){notify("Užbaigto / atmesto atvejo redaguoti negalima.",true);return}
 const amount=Number(data.claimedAmount),contribution=Number(data.patientContribution||0);
 const labPrice=Number(data.labPrice||0),materialPrice=Number(data.materialPrice||0);
 const labCatalog=(db.laboratoryCatalog||[]).find(x=>x.id===data.labCatalogId);
 const labName=(labCatalog?.name||data.labName||"").trim();
 const labCost=labCatalog?Number(labCatalog.price):labPrice;
 const materialName=String(data.materialName||"").trim();
 if(!Number.isFinite(labCost)||labCost<0||labCost>100000||!Number.isFinite(materialPrice)||materialPrice<0||materialPrice>100000||
    (labCost>0&&!labName)||(materialPrice>0&&!materialName)){
   notify("Patikrinkite laboratorijos ir medžiagų pavadinimus bei savikainą.",true);return
 }
 const clinician=db.staff.find(d=>d.id===data.doctorId);
 const rate=current?.doctorPercent??(Number.isFinite(Number(clinician?.salaryPercent))?Number(clinician.salaryPercent):35);
 // Įkainiai sąskaitos / VLK atvejo koregavimo metu yra fiksuojami ir po užbaigimo nekeičiami.
 const usage=usageFeeSnapshot({materials:data.usageMaterials==="on",surgicalMaterials:data.usageSurgical==="on"},{
   materials:current?.usage?.materialsFee??db.usageFees?.materials??5,
   surgicalMaterials:current?.usage?.surgicalMaterialsFee??db.usageFees?.surgicalMaterials??20
 });
 const record={
   id:current?.id||uid("vlk"),caseNumber:current?.caseNumber||"VLK-DEMO-"+String(Date.now()).slice(-8),
   clinicId:data.clinicId,patientId:data.patientId,doctorId:data.doctorId,doctorPercent:rate,
   categoryId:data.categoryId,claimedAmount:amount,patientContribution:contribution,
   referralReference:String(data.referralReference||"").trim(),
   evisReference:String(data.evisReference||"").trim(),
   planId:data.planId||"",eligibilityChecked:data.eligibilityChecked==="on",
   costs:{laboratory:labCost>0?[{id:current?.costs?.laboratory?.[0]?.id||uid("vlk-lab"),description:labName,laboratory:labCatalog?.laboratory||"Demo laboratorija",price:roundEuro(labCost),qty:1}]:[],
     materials:materialPrice>0?[{id:current?.costs?.materials?.[0]?.id||uid("vlk-mat"),description:materialName,price:roundEuro(materialPrice),qty:1}]:[]},
   usage,status:data.caseStatus==="Vykdomas"?"Vykdomas":"Planuojamas",completedAt:current?.completedAt||"",createdAt:current?.createdAt||new Date().toISOString(),demo:true
 };
 const issues=vlkCaseIssues(record,db.vlkContracts,db.patients,db.staff);
 if(issues.length){notify(issues.join(" "),true);return}
 if(data.planId&&!db.plans.some(p=>p.id===data.planId&&p.patientId===data.patientId&&p.clinicId===data.clinicId)){
   notify("Pasirinktas gydymo planas nepriklauso šiam pacientui ar klinikai.",true);return
 }
 update(current?"Atnaujintas PSDF demo atvejis":"Sukurtas PSDF demo atvejis",record.id,state=>{
   state.vlkCases??=[];
   const index=state.vlkCases.findIndex(x=>x.id===record.id);
   if(index<0)state.vlkCases.push(record);else state.vlkCases[index]=record;
 });
 ui.vlkEditingId="";render();notify("VLK atvejis išsaugotas (demo).");
}
function finalizeVlkCase(id,status){
 const record=(db.vlkCases||[]).find(c=>c.id===id);
 if(!record||["Baigtas","Atmestas"].includes(record.status))return;
 if(status==="Baigtas"){
   const problems=vlkCaseIssues(record,db.vlkContracts,db.patients,db.staff);
   if(!record.eligibilityChecked)problems.push("Būtina rankiniu būdu patvirtinti, kad patikrinta paciento teisė ir dokumentai.");
   if(vlkCategory(record.categoryId)?.kind==="prosthetics"&&!record.evisReference)
     problems.push("Protezavimui įrašykite demonstracinį EVIS DP atvejo numerį / nuorodą.");
   if(problems.length){notify(problems.join(" "),true);return}
   if(!confirm("Patvirtinti, kad šis demonstracinis VLK atvejis BAIGTAS? Užfiksuota faktinė suma ir savikaina nebus keičiamos. Gydytojo atlygis bus įtrauktas į užbaigimo mėnesį."))return;
 }else if(!confirm("Atmesti šį demonstracinį PSDF atvejį? Gydytojo atlygis nebus skaičiuojamas."))return;
 update(status==="Baigtas"?"Užbaigtas VLK demo atvejis":"Atmestas VLK demo atvejis",id,state=>{
   const item=state.vlkCases.find(x=>x.id===id);
   item.status=status;
   item.completedAt=status==="Baigtas"?new Date().toISOString():"";
 });
 ui.vlkEditingId="";render();notify(status==="Baigtas"?"VLK atvejis baigtas, atlygis apskaičiuotas (demo).":"VLK atvejis atmestas.");
}
function saveInvoice(){
  const v=stringValues(formData("invoice-form")),qty=Number(v.qty),price=Number(v.price);
  if(!v.clinicId||!db.patients.some(p=>p.id===v.patientId&&p.clinicIds.includes(v.clinicId))||!db.services.some(s=>s.id===v.serviceId)||
     !Number.isInteger(qty)||qty<1||qty>100||!Number.isFinite(price)||price<0||!validDate(v.date)){
    notify("Neteisingi sąskaitos duomenys.",true);return}
  const match=v.planItemId?planInvoiceItems(v.patientId,v.clinicId).find(x=>x.id===v.planItemId):null;
  if(v.planItemId&&!match){notify("Pasirinkta procedūra nepriklauso pacientui ar klinikai.",true);return}
  const doc=db.staff.find(d=>d.id===v.doctorId&&d.clinicIds.includes(v.clinicId));
  if(v.doctorId&&!doc){notify("Gydytojas turi dirbti pasirinktoje klinikoje.",true);return}
  const percent=doc?(Number.isFinite(Number(doc.salaryPercent))?Number(doc.salaryPercent):35):null;
  const invoice={id:uid("inv"),number:"DP-"+String(Date.now()).slice(-9),date:v.date,clinicId:v.clinicId,patientId:v.patientId,planItemId:match?.id||"",planId:match?.planId||"",doctorId:doc?.id||"",doctorPercent:percent,usage:usageFeeSnapshot({materials:v.usageMaterials==="on",surgicalMaterials:v.usageSurgical==="on"},db.usageFees),costs:{laboratory:[],materials:[]},
    items:[{id:uid("line"),description:service(v.serviceId),serviceId:v.serviceId,price,qty}],payments:[]};
  update("Sukurta demonstracinė sąskaita",invoice.id,s=>s.invoices.push(invoice));
  ui.modal={kind:"invoice",id:invoice.id};render();notify("Sąskaita sukurta.");
}
function saveInvoiceUsage(){
 const invoice=db.invoices.find(i=>i.id===ui.modal?.id);
 if(!invoice)return;
 if((invoice.payments||[]).length){notify("Medžiagų žymų pakeisti po pirmojo mokėjimo negalima.",true);return}
 const materials=$("invoice-usage-materials")?.checked===true;
 const surgicalMaterials=$("invoice-usage-surgical")?.checked===true;
 update("Atnaujintos fiksuotos medžiagų savikainos žymos",invoice.id,state=>{
   state.invoices.find(i=>i.id===invoice.id).usage={...usageFeeSnapshot({materials,surgicalMaterials},db.usageFees),...invoice.usage,materials,surgicalMaterials};
 });
 notify("Medžiagų atskaitymai išsaugoti.");
}
function savePayment(){
  const invoice=db.invoices.find(i=>i.id===ui.modal.id);
  if(!invoice)return;
  const v=stringValues(formData("payment-form")),amount=Number(v.amount),balance=invoiceTotal(invoice)-(invoice.payments||[]).reduce((s,p)=>s+Number(p.amount),0);
  if(!Number.isFinite(amount)||amount<=0||amount>balance+0.001){notify("Mokėjimo suma turi neviršyti likučio.",true);return}
  update("Registruotas demonstracinis mokėjimas",invoice.id,s=>s.invoices.find(i=>i.id===invoice.id).payments.push({
    id:uid("pay"),date:isoDate(),amount,method:v.method
  }));notify("Demonstracinis mokėjimas įrašytas.");
}
function saveUsageFees(){
 const form=$("usage-fees-form");if(!form)return;
 const v=stringValues(new FormData(form));
 if(!validUsageFee(v.materials)||!validUsageFee(v.surgicalMaterials)){
   notify("Įkainiai turi būti nuo 0 iki 1000 €.",true);return;
 }
 const materials=roundEuro(Number(v.materials)),surgicalMaterials=roundEuro(Number(v.surgicalMaterials));
 update("Pakeisti demonstraciniai fiksuoti medžiagų įkainiai","usageFees",state=>{
   state.usageFees={materials,surgicalMaterials};
 });
 notify("Fiksuoti įkainiai išsaugoti naujoms sąskaitoms.");
}
function saveDoctorPercent(doctorId){
 const field=$("salary-"+doctorId),value=Number(field?.value);
 if(!field||!field.value.trim()||!Number.isFinite(value)||value<0||value>100){notify("Procentas turi būti nuo 0 iki 100.",true);return}
 if(!db.staff.some(d=>d.id===doctorId))return;
 update("Atnaujintas demo gydytojo atlygio procentas",doctorId,state=>{state.staff.find(d=>d.id===doctorId).salaryPercent=value});
 notify("Procentas bus taikomas tik naujoms sąskaitoms.");
}
function saveLaboratoryWork(formId,id=""){
 const form=$(formId);if(!form)return;
 const v=stringValues(new FormData(form)),price=Number(v.price);
 if(!v.laboratory?.trim()||v.laboratory.length>160||!validCost(v.name,price)){notify("Įveskite laboratoriją, darbą ir teisingą įkainį.",true);return}
 const entry={id:id||uid("lab"),laboratory:v.laboratory.trim(),name:v.name.trim(),price:roundEuro(price),active:true,demo:true};
 update(id?"Atnaujintas demo laboratorijos įkainis":"Pridėtas demo laboratorijos įkainis",entry.id,state=>{
   state.laboratoryCatalog??=[];
   const i=state.laboratoryCatalog.findIndex(x=>x.id===entry.id);
   if(i<0)state.laboratoryCatalog.push(entry);else state.laboratoryCatalog[i]=entry;
 });
 if(id)ui.modal=null;
 render();notify("Laboratorijos įkainis išsaugotas.");
}
function importLaboratoryCsv(){
 try{
   const rows=parseLaboratoryCsv($("lab-csv")?.value||"");
   if(!rows.length||rows.length>300){notify("CSV turi būti 1–300 duomenų eilučių.",true);return}
   update("Importuotas demo laboratorijos kainynas",String(rows.length),state=>{
     state.laboratoryCatalog??=[];
     for(const entry of rows){
       const old=state.laboratoryCatalog.find(x=>x.laboratory.toLocaleLowerCase("lt")===entry.laboratory.toLocaleLowerCase("lt")&&x.name.toLocaleLowerCase("lt")===entry.name.toLocaleLowerCase("lt"));
       if(old){old.price=entry.price;old.active=true}
       else state.laboratoryCatalog.push({id:uid("lab"),...entry});
     }
   });notify("Importuota / atnaujinta "+rows.length+" demo darbų.");
 }catch(error){notify(error.message||"Nepavyko nuskaityti CSV.",true)}
}
function updateInvoiceCost(type,removalId=""){
 const invoice=db.invoices.find(i=>i.id===ui.modal?.id);
 if(!invoice||!["laboratory","materials"].includes(type))return;
 if((invoice.payments||[]).length){notify("Savikaina užrakinta po pirmojo mokėjimo.",true);return}
 if(removalId){
   update("Pašalinta demo savikainos eilutė",invoice.id,state=>{
     const target=state.invoices.find(i=>i.id===invoice.id);
     target.costs??={laboratory:[],materials:[]};
     target.costs[type]=(target.costs[type]||[]).filter(x=>x.id!==removalId);
   });notify("Savikainos eilutė pašalinta.");return;
 }
 const form=$(type==="materials"?"invoice-material-form":"invoice-lab-cost-form");if(!form)return;
 const v=stringValues(new FormData(form)),catalog=(db.laboratoryCatalog||[]).find(x=>x.id===v.labWorkId);
 const description=type==="laboratory"&&catalog?catalog.name:String(v.description||"").trim();
 const laboratory=type==="laboratory"?(catalog?.laboratory||String(v.laboratory||"").trim()):"";
 const price=type==="laboratory"&&catalog?Number(catalog.price):Number(v.price);
 const qty=Number(v.qty);
 if(!validCost(description,price,qty)||(type==="laboratory"&&!laboratory)){notify("Įveskite pavadinimą, kainą ir kiekį.",true);return}
 const line={id:uid("cost"),description,laboratory,price:roundEuro(price),qty,catalogId:catalog?.id||"",demo:true};
 update("Pridėta demonstracinė savikaina",invoice.id,state=>{
   const target=state.invoices.find(i=>i.id===invoice.id);
   target.costs??={laboratory:[],materials:[]};
   target.costs[type]??=[];
   target.costs[type].push(line);
 });notify("Savikaina priskirta sąskaitai.");
}
function downloadJson(){
  const blob=new Blob([repository.export()],{type:"application/json;charset=utf-8"});
  const url=URL.createObjectURL(blob),link=document.createElement("a");
  link.href=url;link.download="dentalpro-demo-"+isoDate()+".json";link.click();URL.revokeObjectURL(url);
}
function downloadAppointmentsCsv(){
  const rows=[["Data","Laikas","Klinika","Kėdė","Pacientas (demo)","Gydytojas (demo)","Paslauga","Būsena","Trukmė min."],
    ...db.appointments.filter(a=>ui.clinic==="all"||a.clinicId===ui.clinic)
    .sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time))
    .map(a=>[a.date,a.time,clinic(a.clinicId),chair(a.chairId),name(a.patientId),doctor(a.staffId),service(a.serviceId),a.status,a.duration])];
  // CSV formulėmis prasidedantys tekstai neutralizuojami prieš atidarant skaičiuoklėje.
  const safe=value=>{const text=String(value??"");return '"'+(/^[=+@\-\t\r]/.test(text)?"'":"")+text.replace(/"/g,'""')+'"';};
  const content="\uFEFF"+rows.map(row=>row.map(safe).join(";")).join("\r\n");
  const blob=new Blob([content],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download="dentalpro-vizitai-demo-"+isoDate()+".csv";link.click();URL.revokeObjectURL(url);
}
function switchAppointmentClinic(cid){
  $("appt-chair").innerHTML=opt(db.chairs.filter(c=>c.clinicId===cid).map(c=>[c.id,c.name]),"");
  $("appt-patient").innerHTML=opt(db.patients.filter(p=>p.clinicIds.includes(cid)).map(p=>[p.id,name(p.id)]),"");
  $("appt-doctor").innerHTML='<option value="">Pasirinkite gydytoją</option>'+opt(db.staff.filter(s=>s.clinicIds.includes(cid)).map(s=>[s.id,s.name]),"");
}
function switchInvoiceClinic(cid){
  $("invoice-patient").innerHTML=opt(db.patients.filter(p=>p.clinicIds.includes(cid)).map(p=>[p.id,name(p.id)]),"");
  $("invoice-plan-item").innerHTML='<option value="">Nesusieta</option>'+opt(planInvoiceItems($("invoice-patient").value,cid).map(x=>[x.id,x.name]),"");
  $("invoice-doctor").innerHTML='<option value="">Nepriskirti (atlygis nebus skaičiuojamas)</option>'+opt(db.staff.filter(d=>d.clinicIds.includes(cid)).map(d=>[d.id,d.name]),"");
}
function removeFinding(){
  if(!confirm("Ištrinti šio danties radinį?"))return;
  update("Ištrintas danties radinys",ui.patient+":"+ui.tooth,s=>{
    s.findings=s.findings.filter(f=>!(f.patientId===ui.patient&&Number(f.toothNumber)===ui.tooth));
  });notify("Radinys ištrintas.");
}
function handleAction(target,event){
  const act=target.dataset.action,id=target.dataset.id;
  switch(act){
    case "route":route(target.dataset.route);break;
    case "go-calendar":route("calendar");break;
    case "close-modal":case "backdrop":if(act==="backdrop"&&event.target!==target)break;ui.modal=null;render();break;
    case "new-appt":modal("appointment","",{});break;
    case "new-on-day":modal("appointment","",{preset:{date:target.dataset.date}});break;
    case "slot":modal("appointment","",{preset:{date:ui.day,time:target.dataset.time,chairId:target.dataset.chair,clinicId:db.chairs.find(c=>c.id===target.dataset.chair)?.clinicId}});break;
    case "edit-appt":modal("appointment",id);break;
    case "set-view":ui.view=target.dataset.view;render();break;
    case "cal-prev":calendarMove(-1);break;
    case "cal-next":calendarMove(1);break;
    case "cal-today":ui.day=isoDate();render();break;
    case "save-appt":saveAppointment();break;
    case "delete-appt":if(confirm("Ar tikrai ištrinti šį demonstracinį vizitą?")){
        update("Ištrintas vizitas",ui.modal.id,s=>s.appointments=s.appointments.filter(a=>a.id!==ui.modal.id));
        ui.modal=null;render();notify("Vizitas ištrintas.");
      }break;
    case "appointment-patient":{
      const a=db.appointments.find(a=>a.id===ui.modal.id);if(!a)break;
      ui.patient=a.patientId;ui.modal=null;route("patients");break;
    }
    case "new-patient":modal("patient");break;
    case "new-form":modal("registration-form","",{formType:target.dataset.kind,signature:"",signatureDrawn:false});break;
    case "consent-plan-item":{
      const plan=db.plans.find(p=>p.id===target.dataset.plan),item=plan?.items.find(i=>i.id===id);
      if(!plan||!item)break;
      ui.patient=plan.patientId;
      modal("registration-form","",{formType:"invasive",planId:plan.id,planItemId:item.id,procedureName:item.description,signature:"",signatureDrawn:false});
      break;
    }
    case "view-form":modal("signed-form",id);break;
    case "print-form":printSignedForm(id);break;
    case "save-registration-form":saveRegistrationForm();break;
    case "clear-signature":if(ui.modal?.kind==="registration-form"){
      ui.modal.signature="";ui.modal.signatureDrawn=false;
      const canvas=document.querySelector("#form-signature");
      canvas?.getContext("2d")?.clearRect(0,0,canvas.width,canvas.height);
    }break;
    case "edit-patient":modal("patient",id);break;
    case "save-patient":savePatient();break;
    case "select-patient":ui.patient=id;ui.patientTab="overview";render();break;
    case "patient-tab":ui.patientTab=target.dataset.tab;render();break;
    case "patient-odontogram":route("odontogram");break;
    case "patient-notes":route("notes");break;
    case "patient-documents":route("forms");break;
    case "patient-vlk":route("vlk");break;
    case "patient-plans":route("plans");break;
    case "new-doctor":modal("doctor");break;
    case "save-doctor":saveDoctor();break;
    case "select-doctor":ui.selectedDoctor=id;render();break;
    case "save-schedule":saveSchedule();break;
    case "tooth":ui.tooth=Number(target.dataset.tooth);render();break;
    case "save-finding":saveFinding();break;
    case "delete-finding":removeFinding();break;
    case "new-plan":modal("plan");break;
    case "save-plan":savePlan();break;
    case "select-plan":ui.selectedPlan=id;render();break;
    case "save-plan-item":savePlanItem();break;
    case "delete-plan-item":if(confirm("Pašalinti procedūrą iš demonstracinio gydymo plano?")){
      update("Pašalinta gydymo plano procedūra",target.dataset.plan,s=>{
        const plan=s.plans.find(p=>p.id===target.dataset.plan);
        if(plan)plan.items=plan.items.filter(i=>i.id!==id);
      });notify("Procedūra pašalinta.");
    }break;
    case "save-note":saveNote();break;
    case "new-service":modal("service");break;
    case "edit-service":modal("service",id);break;
    case "save-service":saveService();break;
    case "new-invoice":modal("invoice");break;
    case "open-invoice":modal("invoice",id);break;
    case "vlk-save":saveVlkCase();break;
    case "vlk-new":ui.vlkEditingId="";render();break;
    case "vlk-edit":ui.vlkEditingId=id;render();break;
    case "vlk-complete":finalizeVlkCase(id,"Baigtas");break;
    case "vlk-reject":finalizeVlkCase(id,"Atmestas");break;
    case "save-invoice":saveInvoice();break;
    case "save-invoice-usage":saveInvoiceUsage();break;
    case "save-usage-fees":saveUsageFees();break;
    case "save-doctor-percent":saveDoctorPercent(id);break;
    case "save-lab-work":saveLaboratoryWork("lab-catalog-form");break;
    case "edit-lab-work":modal("lab-work",id);break;
    case "save-lab-edit":saveLaboratoryWork("lab-edit-form",ui.modal?.id);break;
    case "import-lab-csv":importLaboratoryCsv();break;
    case "add-invoice-lab":updateInvoiceCost("laboratory");break;
    case "add-invoice-material":updateInvoiceCost("materials");break;
    case "remove-invoice-cost":if(confirm("Pašalinti demonstracinę savikainos eilutę?"))updateInvoiceCost(target.dataset.type,id);break;
    case "save-payment":savePayment();break;
    case "export":downloadJson();notify("Demo JSON paruoštas.");break;
    case "export-appointments":downloadAppointmentsCsv();notify("Demo vizitų CSV paruoštas.");break;
    case "reset":if(confirm("Atkurti pradinius demonstracinius duomenis? Dabartiniai v2 demonstraciniai pakeitimai bus ištrinti.")){
      db=repository.reset();ui.modal=null;ui.patient="p-0-0";ui.day=isoDate();ui.selectedPlan="";render();notify("Demonstraciniai duomenys atkurti.");
    }break;
  }
}
function handleChange(target){
  const act=target.dataset.change;
  if(act==="day"){if(validDate(target.value)){ui.day=target.value;render()}return}
  if(act==="doctor-color"){
    const color=String(target.value||"");
    if(!/^#[0-9a-fA-F]{6}$/.test(color))return;
    const key=target.dataset.clinic+":"+target.dataset.doctor;
    update("Pakeista gydytojo spalva",key,s=>{
      s.preferences??={};s.preferences.doctorColors??={};s.preferences.doctorColors[key]=color;
    });return
  }
  if(act==="doctor-filter"){ui.doctor=target.value;render();return}
  if(act==="chair-filter"){ui.chair=target.value;render();return}
  if(act==="service-filter"){ui.service=target.value;render();return}
  if(act==="status-filter"){ui.status=target.value;render();return}
  if(act==="patient"){ui.patient=target.value;ui.selectedPlan="";render();return}
  if(act==="plan-status"){
    const plan=db.plans.find(p=>p.id===(ui.selectedPlan||db.plans.find(p=>p.patientId===ui.patient)?.id));
    if(!plan)return;
    update("Atnaujinta gydymo plano būsena",plan.id,s=>s.plans.find(p=>p.id===plan.id).status=target.value);
    notify("Plano būsena atnaujinta.");return
  }
  if(act==="plan-done"){
    const planId=target.dataset.plan,itemId=target.dataset.id,done=target.checked;
    update("Pakeista plano procedūros būsena",planId,s=>{
      const item=s.plans.find(p=>p.id===planId)?.items.find(i=>i.id===itemId);if(item)item.done=done;
    });return
  }
  if(target.id==="appt-clinic"){switchAppointmentClinic(target.value);return}
  if(target.id==="appt-service"&&!ui.modal?.id){
    const d=db.services.find(s=>s.id===target.value)?.duration;
    if(d&&$("appt-duration").querySelector('option[value="'+d+'"]'))$("appt-duration").value=String(d);
    return
  }
  if(target.id==="service-category-filter"){ui.category=target.value;render();return}
  if(act==="vlk-contract"){
    const clinicId=target.dataset.clinic,kind=target.dataset.kind;
    if(!db.clinics.some(c=>c.id===clinicId)||!["prosthetics","consultation"].includes(kind))return;
    update("Pakeista PSDF sutarties demo žyma",clinicId,state=>{
      state.vlkContracts??={};state.vlkContracts[clinicId]??={prosthetics:false,consultation:false};
      state.vlkContracts[clinicId][kind]=target.checked;
    });return
  }
  if(target.id==="vlk-category"){
    const cat=vlkCategory(target.value);
    const limit=$("vlk-cap-display");
    if(limit)limit.value=cat?.limit==null?"Pagal konkrečią sutartį":money(cat.limit);
    return
  }
  if(target.id==="vlk-clinic"){
    $("vlk-patient").innerHTML=opt(db.patients.filter(p=>p.clinicIds.includes(target.value)).map(p=>[p.id,name(p.id)]),"");
    $("vlk-doctor").innerHTML=opt(db.staff.filter(d=>d.clinicIds.includes(target.value)).map(d=>[d.id,d.name]),"");
    const p=$("vlk-form")?.querySelector('[name="planId"]');
    if(p)p.innerHTML='<option value="">Nesusieta</option>'+opt(db.plans.filter(x=>x.clinicId===target.value&&x.patientId===$("vlk-patient").value).map(x=>[x.id,x.title]),"");
    return
  }
  if(target.id==="vlk-patient"){
    const plans=$("vlk-form")?.querySelector('[name="planId"]');
    if(plans)plans.innerHTML='<option value="">Nesusieta</option>'+opt(db.plans.filter(p=>p.patientId===target.value&&p.clinicId===$("vlk-clinic").value).map(p=>[p.id,p.title]),"");
    return
  }
  if(target.id==="vlk-lab-choice"){
    const selected=(db.laboratoryCatalog||[]).find(x=>x.id===target.value),form=$("vlk-form");
    if(selected&&form){
      form.querySelector('[name="labName"]').value=selected.name;
      form.querySelector('[name="labPrice"]').value=selected.price;
    }
    return
  }
  if(target.id==="salary-month"){ui.salaryMonth=target.value;render();return}
  if(target.id==="invoice-lab-work"){
    const chosen=(db.laboratoryCatalog||[]).find(x=>x.id===target.value);
    const form=$("invoice-lab-cost-form");
    if(form&&chosen){
      form.querySelector('[name="laboratory"]').value=chosen.laboratory;
      form.querySelector('[name="description"]').value=chosen.name;
      form.querySelector('[name="price"]').value=chosen.price;
    }
    return;
  }
  if(target.id==="invoice-patient"){
    $("invoice-plan-item").innerHTML='<option value="">Nesusieta</option>'+opt(planInvoiceItems(target.value,$("invoice-clinic").value).map(x=>[x.id,x.name]),"");
    return;
  }
  if(target.id==="invoice-plan-item"){
    const item=planInvoiceItems($("invoice-patient").value,$("invoice-clinic").value).find(x=>x.id===target.value);
    if(item){
      const select=$("invoice-service");
      if(select.querySelector('option[value="'+item.serviceId+'"]'))select.value=item.serviceId;
      $("invoice-price").value=item.price;
      $("invoice-form").querySelector('[name="qty"]').value=item.qty;
    }
    return;
  }
  if(target.id==="invoice-clinic"){switchInvoiceClinic(target.value);return}
  if(target.id==="invoice-service"){$("invoice-price").value=db.services.find(s=>s.id===target.value)?.price||0;return}
  if(target.closest("#plan-item-form")&&target.name==="serviceId"){
    $("plan-price-container").innerHTML=pricePicker(target.value);
  }
}
function start(){
  $("app").innerHTML='<div class="app"><aside class="sidebar"><div class="brand"><div class="brand-icon">✚</div><div><strong>DentalPro</strong><small>Klinikų valdymas 2.0</small></div></div>'+
    [
      ["overview","▦","Apžvalga","DARBO VIETA"],
      ["calendar","▤","Registracijos kalendorius",""],
      ["patients","♙","Pacientai","KLINIKA"],
       ["forms","✎","Paciento dokumentai",""],
      ["doctors","▥","Gydytojų grafikai",""],
      ["odontogram","◇","Odontograma",""],
      ["plans","☷","Gydymo planai",""],
      ["notes","▧","Klinikiniai įrašai",""],
      ["finances","€","Finansai","VALDYMAS"],
       ["compensation","▤","Laboratorija ir atlygis (DEMO)",""],
       ["reports","▥","Ataskaitos",""],
      ["services","☰","Paslaugos",""],
      ["vlk","◈","VLK / PSDF",""],
      ["admin","⚙","Administravimas",""]
    ].map(([id,icon,label,group])=>(group?'<div class="nav-group">'+group+'</div>':"")+
      '<button type="button" class="nav-btn" data-action="route" data-route="'+id+'"><span class="nav-symbol">'+icon+'</span><span class="nav-title">'+label+'</span></button>').join("")+
    '<div class="sidebar-bottom"><span class="status-dot"></span> Demonstracinis režimas<br>Tik sintetiniai duomenys. Jokios realios pacientų informacijos.</div></aside>'+
    '<div class="work"><header class="topbar"><div class="breadcrumbs">DentalPro / <b id="section-name">Apžvalga</b></div>'+
    '<div class="top-right"><div class="clinic-select"><select id="global-clinic" aria-label="Pasirinkti kliniką">'+opt([["akm","Naujoji Akmenė"],["kur","Kuršėnai"],["all","Abi klinikos (demo)"]],ui.clinic)+'</select></div>'+
    '<div class="user-avatar" title="Demonstracinis naudotojas">DP</div></div></header><main class="workspace" id="page"></main></div></div><div id="drawer-root"></div>';
  $("global-clinic").addEventListener("change",e=>selectClinic(e.target.value));
  document.addEventListener("click",e=>{const target=e.target.closest("[data-action]");if(target)handleAction(target,e)});
  document.addEventListener("change",e=>handleChange(e.target));
  document.addEventListener("submit",e=>e.preventDefault());
  document.addEventListener("input",e=>{
    if(e.target.id!=="patient-search")return;
    const value=e.target.value,start=e.target.selectionStart;
    ui.search=value;render();
    const field=$("patient-search");field?.focus();field?.setSelectionRange(start,start);
  });
  document.addEventListener("dragstart",e=>{
    const el=e.target.closest(".sch-event");
    if(el&&e.dataTransfer){e.dataTransfer.setData("text/plain",el.dataset.id);e.dataTransfer.effectAllowed="move"}
  });
  document.addEventListener("dragover",e=>{if(e.target.closest(".sch-slot"))e.preventDefault()});
  document.addEventListener("drop",e=>{
    const target=e.target.closest(".sch-slot"),id=e.dataTransfer?.getData("text/plain");
    if(!target||!id)return;
    e.preventDefault();
    const a=db.appointments.find(x=>x.id===id);if(!a)return;
    const proposed={...a,clinicId:db.chairs.find(c=>c.id===target.dataset.chair)?.clinicId||a.clinicId,chairId:target.dataset.chair,date:ui.day,time:target.dataset.time};
    const issues=appointmentIssues(db,proposed);
    if(issues.length){notify(issues.join(" "),true);return}
    update("Perkeltas vizitas kalendoriuje",id,s=>Object.assign(s.appointments.find(x=>x.id===id),proposed));
    notify("Vizitas perkeltas.");
  });
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&ui.modal){ui.modal=null;render()}});
  if(!repository.storageAvailable())notify("Naršyklės saugykla neprieinama: pakeitimai neišliks atnaujinus puslapį.",true);
  render();
}
start();
