
import {CLINICS,CHAIRS,STATUSES,PLAN_STATUSES,WEEKDAYS,PERMANENT,PRIMARY,CONDITIONS,SURFACES,uid,isoDate,shiftDate,validDate,weekday,minutes,timeString,overlaps,money,appointmentIssues,patientName,doctorName,serviceName,invoiceTotal,planTotal} from "./domain.mjs";
import {openRepository,defaultAvailability,defaultBreaks} from "./store.mjs";
import {PRICE_SOURCE,PRICE_REVIEWED,priceOptions} from "./pricelist.mjs";
import {FORM_VERSION,FORM_TYPES,HEALTH_QUESTIONS,validateForm,statusOfForm,registrationChecklist,invasiveConsentForItem,FORM_DISCLOSURES} from "./forms.mjs";
import {invoiceCosts,salaryAccruals,salarySummary,validCost,parseLaboratoryCsv,roundEuro,DEFAULT_USAGE_FEES,usageFeeSnapshot,validUsageFee} from "./compensation.mjs";
import {VLK_CATEGORIES,VLK_SOURCE_DATE,vlkCategory,vlkAmountIssues,vlkCaseIssues,vlkCaseEarning,vlkSalaryRows,vlkSalaryTotal} from "./vlk.mjs";
import {PAYMENT_METHODS,paymentMethod,isConfirmed,paidAmount,pendingAmount,invoiceOutstanding,paymentEvents,cashRounded,cashDifference,invoiceCashRounding,advanceRemaining,patientAdvanceBalance,settlementDaySummary} from "./payments.mjs";
import {sourceInvoice,duplicateInvoiceIssues,planItemBillingState,appointmentIntake,labVisitWarnings,vlkContributionInvoiceIssues} from "./billing.mjs";
import {searchPatients,duplicatePatients,receptionistDashboard,LAB_ORDER_STATUSES,TASK_STATUSES,WAITLIST_STATUSES} from "./workflows.mjs";

const labNames=()=>[...new Set((db.laboratoryCatalog||[]).filter(x=>x.active!==false).map(x=>x.laboratory).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"lt"));
const labJobs=lab=>(db.laboratoryCatalog||[]).filter(x=>x.active!==false&&x.laboratory===lab);
const labOptions=(lab,selected="")=>'<option value="">Pasirinkite darbą / rankinis įrašas</option>'+opt(labJobs(lab).map(x=>[x.id,x.name+" · "+money(x.price)]),selected);
const repository=openRepository();
let db=repository.get();
const ui={cashDay:isoDate(),salaryMonth:isoDate().slice(0,7),category:"all",route:"overview",clinic:"akm",day:isoDate(),view:"day",doctor:"",chair:"",status:"",service:"",patient:"p-0-0",patientTab:"overview",tooth:11,selectedDoctor:"",selectedPlan:"",search:"",financeTab:"payments",modal:null};
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
  $("section-name").textContent=({overview:"Registratūros darbo vieta",calendar:"Registracijos kalendorius",patients:"Pacientai",doctors:"Gydytojų grafikai",odontogram:"Odontograma",plans:"Gydymo planai",notes:"Klinikiniai įrašai",finances:"Finansai",compensation:"Laboratorija ir atlygis",reports:"Ataskaitos",laborders:"Laboratorijų užsakymai",forms:"Paciento dokumentai",services:"Paslaugos",vlk:"VLK / PSDF",admin:"Administravimas"})[ui.route];
  $("page").innerHTML=({
    overview:viewOverview,calendar:viewCalendar,patients:viewPatients,doctors:viewDoctors,
    odontogram:viewOdontogram,plans:viewPlans,notes:viewNotes,finances:viewFinances,
    services:viewServices,compensation:viewCompensation,reports:viewReports,laborders:viewLabOrders,forms:viewForms,vlk:viewVlk,admin:viewAdmin
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
 const d=receptionistDashboard(db,ui.day,ui.clinic);
 const rows=d.appointments;
 const taskRows=(db.tasks||[]).filter(t=>(ui.clinic==="all"||t.clinicId===ui.clinic)&&t.status!=="Atlikta").sort((a,b)=>(a.dueDate||"").localeCompare(b.dueDate||""));
 const waitRows=(db.waitlist||[]).filter(w=>(ui.clinic==="all"||w.clinicId===ui.clinic)&&w.status==="Laukia");
 return page("Registratūros darbo vieta","Dienos pacientai, dokumentai, užduotys ir mokėjimai – DEMO",
   btn("+ Vizitas","new-appt","btn primary")+btn("+ Pacientas","new-patient","btn small"))+
 '<section class="panel"><div class="toolbar space-between"><h2>Dienos darbai · '+fmt(ui.day)+'</h2><input type="date" aria-label="Darbo diena" data-change="day" value="'+esc(ui.day)+'"></div>'+
 '<div class="stat-grid">'+[
  ["Dienos vizitai",rows.length],["Laukia patvirtinimo",d.awaiting.length],
  ["Trūksta registracijos dokumentų",d.documents.length],["Neapmokėtos sąskaitos",d.debts.length],
  ["Neatliktos užduotys",d.overdueTasks.length],["Gauti laboratorijos darbai",d.readyOrders.length]
 ].map(([label,count])=>'<div class="stat"><small>'+esc(label)+'</small><strong>'+count+'</strong></div>').join("")+'</div>'+
 '<div class="actions">'+btn("Atidaryti kalendorių","go-calendar","btn small")+
 btn("Nauja sąskaita","new-invoice","btn small")+btn("Dienos atsiskaitymai","go-finances","btn small")+
 btn("Laboratorijų užsakymai","go-laborders","btn small")+'</div></section>'+
 '<section class="panel"><div class="panel-title"><h2>Šiandienos pacientai</h2><span class="pill">'+rows.length+' viz.</span></div>'+
 '<div class="table-wrap"><table class="data-table"><thead><tr><th>Laikas</th><th>Pacientas</th><th>Gydytojas</th><th>Būsena</th><th>Dokumentai</th><th>Veiksmai</th></tr></thead><tbody>'+
 rows.map(a=>{
  const checklist=registrationChecklist(db.forms,a.patientId),signed=checklist.filter(x=>x.signed).length;
  return '<tr><td>'+esc(a.time)+'</td><td>'+esc(name(a.patientId))+'</td><td>'+esc(doctor(a.staffId))+'</td><td>'+pill(a.status)+'</td>'+
   '<td>'+signed+'/3'+(signed<3?' <span class="pill danger">Trūksta</span>':' <span class="pill">Gerai</span>')+'</td>'+
   '<td>'+btn("Priimti","open-intake","btn small primary","data-id=\'"+esc(a.id)+"\'")+btn("Vizitas","edit-appt","btn small","data-id=\'"+esc(a.id)+"\'")+
   btn("Pacientas","work-patient","btn small","data-id=\'"+esc(a.patientId)+"\'")+
   (signed<3?btn("Dokumentai","work-documents","btn small","data-id=\'"+esc(a.patientId)+"\'"):"")+
   btn("Atsiskaitymas","work-payment","btn small","data-id=\'"+esc(a.patientId)+"\'")+'</td></tr>';
 }).join("")+'</tbody></table></div>'+
 (!rows.length?empty("Šiandien vizitų nėra","Peržiūrėkite kalendorių arba registruokite pacientą."):"")+'</section>'+
 '<div class="two-cols"><section class="panel"><h2>Neatliktos užduotys</h2>'+
 taskRows.slice(0,15).map(t=>'<div class="segment"><b>'+esc(t.title)+'</b><small style="display:block">'+fmt(t.dueDate)+' · '+esc(t.patientId?name(t.patientId):clinic(t.clinicId))+'</small>'+
 btn("Atlikta","finish-task","btn small","data-id=\'"+esc(t.id)+"\'")+'</div>').join("")+
 (!taskRows.length?'<p class="help">Atvirų užduočių nėra.</p>':"")+
 '<form id="desk-task-form"><h3>Pridėti užduotį</h3><div class="field-grid">'+
 '<div class="field"><label>Užduotis</label><input name="title" maxlength="160" required placeholder="Pvz., paskambinti pacientui"></div>'+
 '<div class="field"><label>Iki datos</label><input type="date" name="dueDate" value="'+isoDate()+'" required></div>'+
 '<div class="field full"><label>Pacientas (nebūtina)</label><select name="patientId"><option value="">Bendroji klinikos užduotis</option>'+opt(listPatients().map(p=>[p.id,name(p.id)]),"")+'</select></div></div>'+
 '<p>'+btn("Pridėti užduotį","add-desk-task","btn small primary")+'</p></form></section>'+
 '<section class="panel"><h2>Laukiančiųjų sąrašas</h2>'+
 waitRows.map(w=>'<div class="segment"><b>'+esc(name(w.patientId))+'</b><small style="display:block">'+esc(w.reason||"Laukia vizito")+' · '+esc(w.preferredDoctorId?doctor(w.preferredDoctorId):"Bet kuris gydytojas")+'</small>'+
 btn("Registruoti","wait-register","btn small","data-id=\'"+esc(w.id)+"\'")+
 btn("Pašalinti iš laukiančių","wait-cancel","btn small ghost","data-id=\'"+esc(w.id)+"\'")+'</div>').join("")+
 (!waitRows.length?'<p class="help">Laukiančiųjų nėra.</p>':"")+
 '<form id="waitlist-form"><h3>Įrašyti į laukiančiųjų sąrašą</h3><div class="field-grid">'+
 '<div class="field"><label>Pacientas</label><select name="patientId">'+opt(listPatients().map(p=>[p.id,name(p.id)]),ui.patient)+'</select></div>'+
 '<div class="field"><label>Pageidaujamas gydytojas</label><select name="doctorId"><option value="">Bet kuris</option>'+opt(listDoctors().map(d=>[d.id,d.name]),"")+'</select></div>'+
 '<div class="field full"><label>Pageidavimas</label><input name="reason" maxlength="250" placeholder="Pvz., kuo anksčiau ryte"></div></div>'+
 '<p>'+btn("Įtraukti į sąrašą","add-waitlist","btn small primary")+'</p></form></section></div>'+
 '<section class="panel"><h2>Rytojaus vizitų priminimai (rankinis sąrašas)</h2>'+
 '<p class="help">Tai nėra automatinis SMS ar el. pašto siuntimas. Registratorė susisiekia su pacientu atskirai, o čia pažymi atliktą priminimą.</p>'+
 '<div class="table-wrap"><table class="data-table"><thead><tr><th>Pacientas</th><th>Laikas</th><th>Gydytojas</th><th>Veiksmai</th></tr></thead><tbody>'+
 d.reminders.map(a=>'<tr><td>'+esc(name(a.patientId))+'</td><td>'+esc(a.time)+'</td><td>'+esc(doctor(a.staffId))+'</td><td>'+
 btn("Atidaryti","edit-appt","btn small","data-id=\'"+esc(a.id)+"\'")+
 btn("Priminta telefonu","mark-reminder","btn small","data-id=\'"+esc(a.id)+"\'")+'</td></tr>').join("")+
 '</tbody></table></div>'+
 (!d.reminders.length?'<p class="help">Rytojaus priminimų eilė tuščia.</p>':"")+'</section>'+
 '<section class="panel"><h2>Reikia dėmesio</h2>'+
 '<p><b>Neapmokėta:</b> '+money(d.outstanding)+' · <b>Vėluojantys laboratorijos darbai:</b> '+d.lateOrders.length+' · <b>Dokumentų trūksta:</b> '+d.documents.length+'</p>'+
 '<p class="help">Priminimus galima pasižymėti ranka prie vizito. Sistema nesiunčia tikrų SMS ar el. laiškų.</p></section>';
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
  let out=page("Registracijos kalendorius","Registracijos seka: pacientas → gydytojas → paslauga → laikas",btn("+ Registruoti vizitą","new-appt","btn primary"));
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
  const patients=searchPatients(listPatients(),ui.search);
  const p=db.patients.find(p=>p.id===ui.patient)||patients[0];
  return page("Pacientai","Pacientų kortelės, vizitų istorija, gydymo eiga",btn("+ Naujas pacientas","new-patient","btn primary"))+
    '<div class="three-cols"><section class="panel"><div class="panel-title"><h2>Pacientų sąrašas</h2><span class="pill grey">'+patients.length+'</span></div>'+
    '<input type="search" id="patient-search" value="'+esc(ui.search)+'" placeholder="Ieškoti pagal vardą, pavardę, telefoną ar el. paštą…" aria-label="Pacientų paieška"><div class="patient-list" style="margin-top:15px">'+
    patients.map(p=>'<button class="person-card '+(ui.patient===p.id?"selected":"")+'" data-action="select-patient" data-id="'+esc(p.id)+'"><span class="person-dot">'+esc(p.firstName[0]+p.lastName[0])+'</span><span><b>'+esc(name(p.id))+'</b><small>'+esc(p.id)+' · '+esc(p.clinicIds.map(clinic).join(", "))+'</small></span></button>').join("")+'</div></section>'+
    '<section class="panel">'+(p?patientDetail(p):empty("Paciento nėra","Sukurkite naują demonstracinį įrašą."))+'</section></div>';
}
function registrationBanner(patientId){
  const status=registrationChecklist(db.forms,patientId),
    review=db.patients.find(p=>p.id===patientId)?.healthReviewRequired===true,
    ready=status.every(x=>x.signed)&&!review;
  return '<div class="notice '+(ready?"":"warn")+'" style="margin-top:14px"><b>Registracijos dokumentai: '+status.filter(x=>x.signed).length+'/3 (demo)</b>'+
    '<div class="actions" style="margin-top:10px">'+status.map(x=>'<span class="pill '+(x.signed?"":"grey")+'">'+
    esc(FORM_TYPES.find(f=>f.id===x.type)?.short||x.type)+': '+(x.type==="health"&&review?"Reikia peržiūrėti":x.signed?"Pasirašyta":"Trūksta")+'</span>').join("")+'</div>'+
    '<p class="help">Invazinės procedūros sutikimas pildomas atskirai konkrečiai procedūrai; jis nėra būtinas kiekvienai registracijai.</p>'+
    (review?'<p class="help"><b>Sveikatos anketą reikia peržiūrėti prieš kitą vizitą.</b></p>':"")+
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
      '<div class="notice" style="margin-top:12px"><b>Paciento atsiskaitymai:</b> skola '+
       money(db.invoices.filter(i=>i.patientId===p.id).reduce((n,i)=>n+invoiceOutstanding(i,invoiceTotal(i)),0))+
       ' · avansų likutis '+money((db.advances||[]).filter(a=>a.patientId===p.id).reduce((n,a)=>n+advanceRemaining(a),0))+
       ' '+btn("Atsiskaityti","work-payment","btn small","data-id=\'"+esc(p.id)+"\'")+'</div>'+
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
 const orders=(db.labOrders||[]).filter(o=>o.planId===p.id);
 return '<h3>'+esc(p.title)+'</h3><div class="flex"><label>Būsena</label><select id="plan-status" data-change="plan-status" style="max-width:230px">'+simple(PLAN_STATUSES,p.status)+'</select>'+
 '<span class="pill">Sąmata '+money(planTotal(p))+'</span>'+
 '<span class="pill">'+p.items.filter(x=>x.done).length+'/'+p.items.length+' procedūrų atlikta</span></div>'+
 '<div class="table-wrap"><table class="data-table"><thead><tr><th>Dantis</th><th>Procedūra / etapas</th><th>Terminas</th><th>Suma</th><th>Veiksmai</th></tr></thead><tbody>'+
 p.items.map(i=>{
   const form=invasiveConsentForItem(db.forms,patientId,p.id,i.id),billing=planItemBillingState(db,p.id,i.id);
   return '<tr><td>'+esc(i.tooth||"—")+'</td><td><b>'+esc(i.description)+'</b><small style="display:block">'+esc(i.stage||"Procedūra")+'</small>'+
     '<label style="display:block"><span class="pill">'+esc(billing.status)+'</span></label>'+ '<label style="display:block"><input type="checkbox" aria-label="Procedūra atlikta" data-change="plan-done" data-plan="'+esc(p.id)+'" data-id="'+esc(i.id)+'" '+(i.done?"checked":"")+'> Atlikta</label></td>'+
     '<td>'+fmt(i.targetDate)+(i.targetDate&&!i.done&&i.targetDate<isoDate()?' <span class="pill danger">Vėluoja</span>':"")+'</td>'+
     '<td>'+money(Number(i.qty||1)*Number(i.price||0))+'</td>'+
     '<td>'+(form?'<span class="pill">Sutikimas: '+esc(form.answers?.decision||"")+'</span>':'<span class="pill grey">Invazinis sutikimas (jei taikoma): nėra</span>')+
     btn("Sutikimas","consent-plan-item","btn small","data-plan=\'"+esc(p.id)+"\' data-id=\'"+esc(i.id)+"\'")+
     btn("Kitas vizitas","plan-next-appointment","btn small","data-plan=\'"+esc(p.id)+"\' data-id=\'"+esc(i.id)+"\'")+
     (billing.invoice?btn("Atidaryti sąskaitą","open-invoice","btn small","data-id=\'"+esc(billing.invoice.id)+"\'"):billing.vlkCase?'<span class="pill grey">VLK atvejis</span>':btn("Sąskaita","plan-invoice","btn small","data-plan=\'"+esc(p.id)+"\' data-id=\'"+esc(i.id)+"\'"))+
     btn("Pašalinti","delete-plan-item","btn small ghost","data-plan=\'"+esc(p.id)+"\' data-id=\'"+esc(i.id)+"\'")+'</td></tr>';
 }).join("")+'</tbody></table></div>'+
 '<h3 style="margin-top:16px">Susieti laboratorijos užsakymai</h3>'+
 orders.map(o=>'<div class="segment">'+esc(o.description)+' · '+esc(o.laboratory)+' · '+pill(o.status)+' · '+fmt(o.dueDate)+'</div>').join("")+
 (!orders.length?'<p class="help">Su planu nesusietų laboratorijos darbų čia nematysite.</p>':"")+
 btn("+ Laboratorijos užsakymas","plan-lab-order","btn small")+
 '<h3 style="margin-top:20px">Pridėti gydymo etapą / procedūrą</h3><form id="plan-item-form"><div class="field-grid">'+
 '<div class="field"><label>Paslauga</label><select name="serviceId" id="plan-item-service">'+serviceChoices(primaryService()?.id)+'</select></div>'+
 '<div class="field"><label>Dantis</label><input name="tooth" placeholder="Pvz., 16"></div>'+
 '<div class="field"><label>Kiekis</label><input name="qty" type="number" min="1" max="20" value="1"></div>'+
 '<div class="field"><label>Pasirenkama kaina (€)</label><div id="plan-price-container">'+pricePicker(primaryService()?.id)+'</div><small class="help">Intervalai: 10 € žingsniu ir tiksli intervalo pabaiga.</small></div>'+
 '<div class="field"><label>Gydymo etapas</label><select name="stage">'+simple(["Konsultacija","Gydymas","Atspaudai / skenavimas","Laboratorija","Matavimas","Fiksavimas","Kontrolė"],"Gydymas")+'</select></div>'+
 '<div class="field"><label>Planuojama data</label><input type="date" name="targetDate" value="'+isoDate()+'"></div>'+
 '<div class="field full"><label>Aprašymas</label><input name="description" maxlength="200" placeholder="Papildomas paaiškinimas"></div></div>'+
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
  const paid=invoices.reduce((n,i)=>n+paidAmount(i),0);
  const cash=settlementDaySummary(db.invoices,db.advances||[],db.vlkCases||[],ui.cashDay,ui.clinic);
  const pendingTransfers=invoices.flatMap(invoice=>(invoice.payments||[]).filter(p=>p.status==="pending"&&paymentMethod(p.method)==="transfer").map(p=>({invoice,p})));
  const pendingOther=invoices.flatMap(invoice=>(invoice.payments||[]).filter(p=>p.status==="pending"&&paymentMethod(p.method)!=="transfer").map(p=>({invoice,p})));
  const advances=(db.advances||[]).filter(a=>ui.clinic==="all"||a.clinicId===ui.clinic);
  return page("Finansai","Rankinė grynųjų, kortelių, pavedimų ir PSDF apskaita – tik DEMO",btn("+ Nauja sąskaita","new-invoice","btn primary"))+
    '<div class="tabs">'+[["payments","Pacientų atsiskaitymai"],["advances","Avansai ir grąžinimai"],["reconcile","Laukiantys mokėjimai"],["daily","Dienos kasa"]].map(([id,label])=>
    '<button type="button" class="tab '+(ui.financeTab===id?"active":"")+'" data-action="finance-tab" data-tab="'+id+'">'+label+'</button>').join("")+'</div>'+
    '<div class="notice warn"><b>Be kasos aparato, kortelių terminalo ar banko integracijos.</b> Mokėjimą darbuotojas patvirtina ranka pagal kasos / terminalo kvitą arba banko išrašą. DentalPro įrašas nėra fiskalinis kvitas ir neįrodo realaus pervedimo. Tik sintetiniai duomenys.</div>'+
    '<div class="stat-grid"><div class="stat"><small>Sąskaitų</small><strong>'+invoices.length+'</strong></div><div class="stat"><small>Išrašyta</small><strong>'+money(total)+'</strong></div>'+
    '<div class="stat"><small>Patvirtinta, atėmus grąžinimus</small><strong>'+money(paid)+'</strong></div><div class="stat"><small>Sąskaitų likutis</small><strong>'+money(Math.max(0,total-paid))+'</strong></div></div>'+
    '<section class="panel" style="'+(ui.financeTab==="daily"?"":"display:none")+'"><div class="panel-title"><h2>Dienos atsiskaitymų suvestinė pagal operacijas</h2><label>Data <input type="date" id="cash-day" value="'+esc(ui.cashDay)+'"></label></div>'+
    '<div class="stat-grid">'+[
      ["Grynaisiais",cash.totals.cash],["Kortele",cash.totals.card],["Pavedimu",cash.totals.transfer],["VLK (baigti atvejai)",cash.vlk]
    ].map(([label,value])=>'<div class="stat"><small>'+label+'</small><strong>'+money(value)+'</strong></div>').join("")+'</div>'+
    '<p><b>Pacientų mokėjimai ir avansai (grynieji, kortelės, pavedimai): '+money(cash.netTotal)+'</b></p>'+
    '<p><b>PSDF administraciškai baigti atvejai: '+money(cash.vlk)+'</b></p>'+
    '<p class="help">VLK skiltis nėra į kasą gauti pinigai – tai tik tą dieną užbaigtų atvejų PSDF sumos. Ji neįtraukiama į grynųjų / kortelių / pavedimų sumą. Grynieji rodomi po atsiskaitymo apvalinimo.</p>'+
    '<div class="table-wrap"><table class="data-table"><thead><tr><th>Operacija</th><th>Pacientas</th><th>Sąskaita</th><th>Atsiskaitymo būdas</th><th>Patvirtinta suma</th><th>Nuoroda</th></tr></thead><tbody>'+
    cash.rows.map(x=>'<tr><td>'+esc(({invoice:"Mokėjimas",refund:"Grąžinimas",deposit:"Avansas","advance-refund":"Avanso grąžinimas"})[x.kind]||x.kind)+'</td><td>'+esc(name(x.patientId))+'</td><td>'+esc(x.invoiceNumber)+'</td><td>'+esc(PAYMENT_METHODS.find(m=>m.id===x.method)?.label||x.method)+'</td><td>'+money(x.method==="cash"?x.cashAmount:x.amount)+'</td><td>'+esc(x.reference||"—")+'</td></tr>').join("")+
    cash.vlkCases.map(x=>'<tr><td>Baigtas VLK atvejis</td><td>'+esc(name(x.patientId))+'</td><td>'+esc(x.caseNumber)+'</td><td>VLK / PSDF (ne kasos įplauka)</td><td>'+money(x.claimedAmount)+'</td><td>'+esc(x.evisReference||"—")+'</td></tr>').join("")+
    '</tbody></table></div>'+
    btn("Eksportuoti dienos CSV","export-cash-day","btn small")+
    '<h3 style="margin-top:16px">Dienos kasos uždarymas ir suderinimas (DEMO)</h3>'+
    '<p class="help">Atskirai patikrinkite faktinius grynuosius, terminalo suvestinę ir banko išrašą. Programa jų negali nuskaityti automatiškai.</p>'+
    '<form id="cash-close-form"><div class="field-grid">'+
    '<div class="field"><label>Klinika</label><select name="clinicId">'+opt(db.clinics.map(c=>[c.id,c.name]),ui.clinic==="all"?"akm":ui.clinic)+'</select></div>'+
    '<div class="field"><label>Faktiškai suskaičiuota grynųjų (€)</label><input type="number" name="countedCash" step="0.01" min="-100000" max="100000" required></div>'+
    '<div class="field"><label>Pagal terminalo suvestinę kortelių (€)</label><input type="number" name="countedCard" step="0.01" min="-100000" max="100000" required></div>'+
    '<div class="field"><label>Banko išraše patvirtinta pavedimų (€)</label><input type="number" name="countedTransfer" step="0.01" min="-100000" max="100000" required></div>'+
    '<div class="field full"><label>Pastabos</label><input name="notes" maxlength="400" placeholder="Grynųjų / terminalo neatitikimų paaiškinimai"></div></div>'+
    '<p>'+btn("Išsaugoti dienos suderinimą","close-cash-day","btn small primary")+'</p></form>'+
    '<h3>Uždarymų istorija</h3>'+
    (db.cashClosings||[]).filter(x=>x.date===ui.cashDay&&(ui.clinic==="all"||x.clinicId===ui.clinic)).map(x=>
      '<div class="segment">'+esc(clinic(x.clinicId))+' · '+fmt(x.date)+' · '+esc(new Date(x.createdAt).toLocaleString("lt-LT"))+
      ' · grynųjų skirtumas '+money(x.difference.cash)+' · kortelių skirtumas '+money(x.difference.card)+
      ' · pavedimų skirtumas '+money(x.difference.transfer)+(x.notes?' · '+esc(x.notes):"")+'</div>').join("")+
    '</section>'+
    '<section class="panel" style="'+(ui.financeTab==="payments"?"":"display:none")+'"><h2>Sąskaitos ir daliniai / mišrūs mokėjimai</h2>'+
    '<div class="table-wrap"><table class="data-table"><thead><tr><th>Numeris</th><th>Data</th><th>Pacientas</th><th>Klinika</th><th>Suma</th><th>Patvirtinta</th><th>Likutis</th><th></th></tr></thead><tbody>'+
    invoices.map(i=>'<tr><td>'+esc(i.number)+'</td><td>'+fmt(i.date)+'</td><td>'+esc(name(i.patientId))+'</td><td>'+esc(clinic(i.clinicId))+'</td><td>'+money(invoiceTotal(i))+'</td><td>'+money(paidAmount(i))+'</td><td>'+money(invoiceOutstanding(i,invoiceTotal(i)))+'</td>'+
      '<td>'+btn("Atverti","open-invoice","btn small","data-id=\'"+esc(i.id)+"\'")+'</td></tr>').join("")+'</tbody></table></div>'+
    (!invoices.length?empty("Sąskaitų nėra","Sukurkite demonstracinę sąskaitą."):"")+'</section>'+
    '<section class="panel" style="'+(ui.financeTab==="reconcile"?"":"display:none")+'"><h2>Banko pavedimų suderinimas (rankinis)</h2>'+
    '<p class="help">Suderinkite pagal banko išrašą: patikrinkite datą, sumą, mokėjimo paskirtį ir tik tuomet patvirtinkite. Nėra automatinės banko API integracijos.</p>'+
    '<div class="table-wrap"><table class="data-table"><thead><tr><th>Sąskaita</th><th>Pacientas</th><th>Suma</th><th>Įvesta nuoroda</th><th></th></tr></thead><tbody>'+
    pendingTransfers.map(({invoice,p})=>'<tr><td>'+esc(invoice.number)+'</td><td>'+esc(name(invoice.patientId))+'</td><td>'+money(p.amount)+'</td><td>'+esc(p.reference||"—")+'</td><td>'+
      btn("Suderinti ir patvirtinti","payment-confirm","btn small primary","data-id=\'"+esc(p.id)+"\' data-invoice=\'"+esc(invoice.id)+"\'")+
      btn("Atmesti","payment-cancel","btn small ghost","data-id=\'"+esc(p.id)+"\' data-invoice=\'"+esc(invoice.id)+"\'")+'</td></tr>').join("")+'</tbody></table></div>'+
    (!pendingTransfers.length?'<p class="help">Laukiančių pavedimų nėra.</p>':"")+
    (pendingOther.length?'<h3>Kiti nepatvirtinti mokėjimai</h3>'+pendingOther.map(({invoice,p})=>
      '<div class="segment">'+esc(invoice.number)+' · '+esc(PAYMENT_METHODS.find(m=>m.id===paymentMethod(p.method))?.label||p.method)+' · '+money(p.amount)+
      btn("Patvirtinti","payment-confirm","btn small","data-id=\'"+esc(p.id)+"\' data-invoice=\'"+esc(invoice.id)+"\'")+
      btn("Atmesti","payment-cancel","btn small ghost","data-id=\'"+esc(p.id)+"\' data-invoice=\'"+esc(invoice.id)+"\'")+'</div>').join(""):"")+'</section>'+
    '<section class="panel" style="'+(ui.financeTab==="advances"?"":"display:none")+'"><h2>Pacientų avansai</h2><p class="help">Avansas registruojamas atskirai ir nėra iš naujo laikomas kasos įplauka jį panaudojus sąskaitai. Gydytojo atlygis atsiranda tik avansą priskyrus sąskaitai.</p>'+
    '<form id="advance-form"><div class="field-grid"><div class="field"><label>Klinika</label><select id="advance-clinic" name="clinicId">'+opt(db.clinics.map(c=>[c.id,c.name]),ui.clinic==="all"?"akm":ui.clinic)+'</select></div>'+
    '<div class="field"><label>Pacientas</label><select name="patientId" id="advance-patient">'+opt(db.patients.filter(p=>p.clinicIds.includes(ui.clinic==="all"?"akm":ui.clinic)).map(p=>[p.id,name(p.id)]),"")+'</select></div>'+
    '<div class="field"><label>Avanso suma (€)</label><input type="number" name="amount" min="0.01" step="0.01" required></div>'+
    '<div class="field"><label>Būdas</label><select name="method">'+opt(PAYMENT_METHODS.filter(m=>m.id!=="advance").map(m=>[m.id,m.label]),"cash")+'</select></div>'+
    '<div class="field"><label>Kvito / terminalo / pavedimo nuoroda (demo)</label><input name="reference" maxlength="120"></div>'+
    '<div class="field"><label>Įrašymo data</label><input type="date" name="date" value="'+isoDate()+'"></div></div>'+
    '<p>'+btn("Registruoti avansą","advance-save","btn primary")+'</p></form>'+
    '<h3>Avansų istorija</h3><div class="table-wrap"><table class="data-table"><thead><tr><th>Pacientas</th><th>Data</th><th>Būdas</th><th>Įmoka</th><th>Likutis</th><th>Būsena</th><th></th></tr></thead><tbody>'+
    advances.map(a=>'<tr><td>'+esc(name(a.patientId))+'</td><td>'+fmt(a.date)+'</td><td>'+esc(PAYMENT_METHODS.find(m=>m.id===paymentMethod(a.method))?.label||a.method)+'</td><td>'+money(a.amount)+'</td><td>'+money(advanceRemaining(a))+'</td><td>'+esc(a.status==="pending"?"Laukiama":a.status==="cancelled"?"Atmesta":"Patvirtinta")+'</td><td>'+
      (a.status==="pending"?btn("Patvirtinti","advance-confirm","btn small primary","data-id=\'"+esc(a.id)+"\'")+btn("Atmesti","advance-cancel","btn small ghost","data-id=\'"+esc(a.id)+"\'"):"")+
      (advanceRemaining(a)>0?btn("Grąžinti avansą","advance-refund-open","btn small ghost","data-id=\'"+esc(a.id)+"\'"):"")+'</td></tr>').join("")+'</tbody></table></div>'+
    (!advances.length?'<p class="help">Avansų dar nėra.</p>':"")+'</section>';
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
   '<div class="panel"><div class="search-line">'+patientPicker()+'</div><div class="notice">Registracijos dokumentai: <b>'+checklist.filter(x=>x.signed).length+'/3</b> pasirašyti (demo).'+
   (p.healthReviewRequired?'<b> Sveikatos anketa pažymėta peržiūrai.</b>':"")+
   ' Invazinės procedūros sutikimas – tik konkrečiam gydymui.</div><p class="help">Pacientas: <b>'+esc(name(p.id))+
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
 planId:type==="invasive"?(ui.modal.planId||""):"",planItemId:type==="invasive"?(ui.modal.planItemId||""):"",
 documentText:FORM_DISCLOSURES[type],answers,signature:ui.modal.signature,signedAt:new Date().toISOString(),demo:true};
 update("Pasirašytas demo paciento dokumentas",signed.id,s=>{
    s.forms??=[];s.forms.push(signed);
    if(type==="health"){const patient=s.patients.find(p=>p.id===patientId);if(patient)patient.healthReviewRequired=false}
  });
 ui.modal=null;ui.route="forms";render();notify("Dokumentas pasirašytas (tik demo).");
}
function viewCompensation(){
 const catalog=db.laboratoryCatalog||[],summary=salarySummary(db.invoices,ui.salaryMonth,ui.clinic);
 const vlkRows=vlkSalaryRows(db.vlkCases||[],ui.salaryMonth,ui.clinic,db.invoices),vlkTotal=vlkSalaryTotal(db.vlkCases||[],ui.salaryMonth,ui.clinic,db.invoices);
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
  const received=invoices.reduce((n,i)=>n+paidAmount(i),0);
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
 '<div class="field full"><label>Dantų technikų laboratorija</label><select id="vlk-laboratory" name="selectedLaboratory"><option value="">Pasirinkite laboratoriją</option>'+opt(labNames().map(x=>[x,x]),editing?.costs?.laboratory?.[0]?.laboratory||"")+'<option value="__manual">Kita laboratorija (įvesti ranka)</option></select></div>'+
 '<div class="field full"><label>Laboratorijos darbas</label><select name="labCatalogId" id="vlk-lab-choice">'+labOptions(editing?.costs?.laboratory?.[0]?.laboratory||"",editing?.labCatalogId||"")+'</select></div>'+
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
 (Number(c.patientContribution)>0?
   (sourceInvoice(db.invoices,{vlkCaseId:c.id})?
     btn("Priemokos sąskaita","open-invoice","btn small","data-id=\'"+esc(sourceInvoice(db.invoices,{vlkCaseId:c.id}).id)+"\'"):
     btn("Išrašyti priemoką","new-vlk-copay","btn small","data-id=\'"+esc(c.id)+"\'")):"")+
 '</td></tr>').join("")+'</tbody></table></div>'+
 (!cases.length?empty("Atvejų nėra","Sukurkite pirmąjį demonstracinį PSDF atvejį."):"")+
 '<p class="help">Baigtos PSDF sumos nėra tikrų VLK gautų mokėjimų patvirtinimas. Šiame demo atlygis priskaičiuojamas tik pažymėjus atvejį „Baigtas“, tačiau VLK faktinio apmokėjimo duomenys negaunami.</p></section>';
}
function viewLabOrders(){
 const orders=(db.labOrders||[]).filter(o=>ui.clinic==="all"||o.clinicId===ui.clinic);
 const patientId=listPatients().some(p=>p.id===ui.patient)?ui.patient:listPatients()[0]?.id||"";
 const selectedPlans=db.plans.filter(p=>p.patientId===patientId);
 return page("Laboratorijų užsakymai","Užsakymo, gamybos, gavimo ir perdavimo sekimas – tik DEMO")+
 '<section class="panel"><h2>Užsakymo eiga</h2><p class="help">Paciento galutinį protezavimo vizitą registruokite tik patikrinę, ar laboratorinis darbas jau gautas. Šis modulis nesusisiekia su laboratorijomis automatiškai.</p>'+
 '<div class="table-wrap"><table class="data-table"><thead><tr><th>Pacientas</th><th>Laboratorija</th><th>Darbas</th><th>Išsiųsta</th><th>Terminas</th><th>Savikaina</th><th>Būsena</th><th>Veiksmai</th></tr></thead><tbody>'+
 orders.map(o=>'<tr><td>'+esc(name(o.patientId))+'</td><td>'+esc(o.laboratory)+'</td><td>'+esc(o.description)+'</td><td>'+fmt(o.sentDate)+'</td><td>'+fmt(o.dueDate)+'</td><td>'+money(o.cost)+'</td><td>'+pill(o.status)+'</td><td>'+
 (o.status!=="Atiduota"&&o.status!=="Atšaukta"?'<select data-change="lab-order-status" data-id="'+esc(o.id)+'">'+simple(LAB_ORDER_STATUSES,o.status)+'</select>':"")+
 btn("Pacientas","work-patient","btn small","data-id=\'"+esc(o.patientId)+"\'")+'</td></tr>').join("")+'</tbody></table></div>'+
 (!orders.length?empty("Užsakymų nėra","Sukurkite pirmąjį demonstracinį laboratorijos užsakymą."):"")+'</section>'+
 '<section class="panel"><h2>Pridėti laboratorijos užsakymą</h2>'+
 '<form id="lab-order-form"><div class="field-grid">'+
 '<div class="field"><label>Klinika</label><select name="clinicId" id="order-clinic">'+opt(db.clinics.map(c=>[c.id,c.name]),ui.clinic==="all"?"akm":ui.clinic)+'</select></div>'+
 '<div class="field"><label>Pacientas</label><select name="patientId" id="order-patient">'+opt(listPatients().map(p=>[p.id,name(p.id)]),patientId)+'</select></div>'+
 '<div class="field full"><label>Gydymo planas (nebūtina)</label><select name="planId" id="order-plan"><option value="">Nesusieta</option>'+opt(selectedPlans.map(p=>[p.id,p.title]),"")+'</select></div>'+
 '<div class="field"><label>Laboratorija</label><select name="laboratory" id="order-lab">'+opt(labNames().map(x=>[x,x]),labNames()[0]||"")+'<option value="__manual">Kita (ranka)</option></select></div>'+
 '<div class="field"><label>Kita laboratorija (jei reikia)</label><input name="manualLab" maxlength="160"></div>'+
 '<div class="field"><label>Darbo pavadinimas</label><input name="description" maxlength="160" required></div>'+
 '<div class="field"><label>Savikaina (€)</label><input type="number" name="cost" min="0" step="0.01" value="0" required></div>'+
 '<div class="field"><label>Užsakyta / išsiųsta</label><input name="sentDate" type="date" value="'+isoDate()+'" required></div>'+
 '<div class="field"><label>Planuojama gavimo data</label><input name="dueDate" type="date" value="'+shiftDate(isoDate(),7)+'" required></div></div>'+
 '<p>'+btn("Pridėti užsakymą","add-lab-order","btn primary")+'</p></form></section>';
}
function viewAdmin(){
  return page("Administravimas","Duomenų eksportas, demonstracijos atkūrimas ir veiksmų istorija")+
    '<div class="two-cols"><section class="panel"><h2>Demonstracinė aplinka</h2><div class="notice warn">Nėra prisijungimo, naudotojų teisių, serverinės duomenų bazės ar saugaus audito. Tai tik sintetinė v3 aplinka; ankstesni naršyklės pacientų įrašai neperkeliami. Neveskite tikrų pacientų duomenų.</div>'+
    '<div class="detail-grid" style="margin:20px 0">'+[["Klinikos",db.clinics.length],["Kėdės",db.chairs.length],["Gydytojai",db.staff.length],["Pacientai",db.patients.length]].map(([k,v])=>'<div class="detail-item"><small>'+k+'</small><b>'+v+'</b></div>').join("")+'</div>'+
    '<div class="actions">'+btn("Eksportuoti demo JSON","export","btn primary")+btn("Eksportuoti vizitų CSV","export-appointments","btn small")+btn("Atkurti demo įrašus","reset","btn danger")+'</div></section>'+
    '<section class="panel"><h2>Veiksmų žurnalas (tik vietinis DEMO)</h2>'+
    '<p class="help">Rodomos kai kurios saugios laukų reikšmės prieš / po pakeitimo. Ši istorija nėra nuo klastojimo apsaugotas serverinis auditas.</p>'+
    '<div class="audit-list">'+db.audit.slice(0,60).map(a=>'<div class="audit-entry"><span><strong>'+esc(a.action)+'</strong>'+
    '<small class="muted" style="display:block">'+esc(a.entity)+' · '+esc(a.actor||"Senas demonstracinis įrašas")+'</small>'+
    (a.changes&&Object.keys(a.changes).length?'<details><summary>Peržiūrėti laukų pasikeitimus</summary>'+
    Object.entries(a.changes).slice(0,12).map(([key,values])=>'<small style="display:block">'+esc(key)+': '+
      esc(values.before??"—")+' → '+esc(values.after??"—")+'</small>').join("")+'</details>':"")+
    '</span><span class="muted">'+esc(new Date(a.at).toLocaleString("lt-LT"))+'</span></div>').join("")+'</div></section></div>';
}


function viewDrawer(){
  const d=ui.modal;
  const close=btn("✕","close-modal","btn small ghost","aria-label='Uždaryti'");
  const wrap=(title,content)=>'<div class="drawer-shade" data-action="backdrop"><aside class="drawer" role="dialog" aria-modal="true" aria-label="'+esc(title)+'"><div class="drawer-title"><h2>'+title+'</h2>'+close+'</div>'+content+'</aside></div>';
  if(d.kind==="intake"){
    const info=appointmentIntake(db,d.id);
    if(!info)return wrap("Paciento priėmimas",empty("Vizitas nerastas",""));
    const a=info.appointment,problem=labVisitWarnings(db,a);
    return wrap("Paciento priėmimas – "+esc(name(a.patientId)),
      '<div class="notice">Vizitas: <b>'+fmt(a.date)+' '+esc(a.time)+'</b> · Gydytojas '+esc(doctor(a.staffId))+
      ' · Būsena '+esc(a.status)+'</div>'+
      '<h3>Registracijos dokumentai</h3>'+
      info.documents.map(x=>'<div class="segment">'+(x.signed?'✓ ':'⚠ ')+esc(x.label)+' – '+(x.signed?'Pasirašyta':'Trūksta')+'</div>').join("")+
      (info.review?'<div class="notice warn">Sveikatos anketą reikia peržiūrėti su gydytoju prieš gydymą.</div>':"")+
      '<p>'+btn("Atverti dokumentus","intake-documents","btn small","data-id=\'"+esc(a.id)+"\'")+'</p>'+
      '<h3>Laboratorijos darbų parengtis</h3>'+
      (problem.length?problem.map(x=>'<div class="notice warn">'+esc(x)+'</div>').join(""):'<p class="help">Nėra susietų nebaigtų laboratorijos užsakymų.</p>')+
      '<h3>Atsiskaitymas</h3>'+
      (info.invoices.length?info.invoices.map(i=>'<div class="segment">'+esc(i.number)+' · '+money(invoiceOutstanding(i,invoiceTotal(i)))+' likutis '+
        btn("Atidaryti mokėjimą","open-invoice","btn small","data-id=\'"+esc(i.id)+"\'")+'</div>').join(""):
        '<p class="help">Šiam vizitui sąskaita dar neišrašyta.</p>')+
      '<div class="drawer-footer">'+
      (!["Atvykęs","Atliekamas","Atliktas","Atšauktas","Neatvyko"].includes(a.status)?
        btn("Pažymėti atvykimą","intake-arrived","btn primary","data-id=\'"+esc(a.id)+"\'"):"")+
      btn("Gydymo planas","intake-plan","btn small","data-id=\'"+esc(a.id)+"\'")+
      btn(info.invoices.length?"Sąskaita jau išrašyta":"Paruošti sąskaitą","intake-invoice","btn small","data-id=\'"+esc(a.id)+"\'")+
      '</div>');
  }
  if(d.kind==="appointment"){
    const original=db.appointments.find(a=>a.id===d.id);
    const a=Object.assign({clinicId:ui.clinic==="all"?"akm":ui.clinic,chairId:"",patientId:ui.patient,
      staffId:"",date:ui.day,time:"09:00",duration:30,serviceId:primaryService()?.id||"",status:"Registruotas",notes:""},original||{},d.preset||{});
    if(!a.chairId||!db.chairs.some(c=>c.id===a.chairId&&c.clinicId===a.clinicId))a.chairId=a.clinicId+"-1";
    if(!db.patients.some(p=>p.id===a.patientId&&p.clinicIds.includes(a.clinicId)))a.patientId=db.patients.find(p=>p.clinicIds.includes(a.clinicId))?.id||"";
    const doctorOptions=db.staff.filter(s=>s.clinicIds.includes(a.clinicId)).map(s=>[s.id,s.name]);
    const patients=db.patients.filter(p=>p.clinicIds.includes(a.clinicId)).map(p=>[p.id,name(p.id)]);
    return wrap(original?"Redaguoti vizitą":"Registruoti vizitą",
      '<div class="notice">Registracijos seka: <b>pacientas → gydytojas → paslauga → laikas</b>. Bus patikrintas grafikas, pertrauka ir užimtumas.</div>'+
      '<form id="appt-form" style="margin-top:17px"><div class="field-grid">'+
      '<div class="field full"><label>1. Klinika</label><select name="clinicId" id="appt-clinic">'+opt(db.clinics.map(c=>[c.id,c.name]),a.clinicId)+'</select></div>'+
      '<div class="field"><label>2. Pacientas</label><select name="patientId" id="appt-patient">'+opt(patients,a.patientId)+'</select>'+btn("+ Naujas pacientas","new-patient-from-appt","btn small")+'</div>'+
      '<div class="field"><label>3. Gydytojas</label><select name="staffId" id="appt-doctor"><option value="">Pasirinkite gydytoją</option>'+opt(doctorOptions,a.staffId)+'</select></div>'+
      '<div class="field"><label>4. Kėdė</label><select name="chairId" id="appt-chair">'+opt(db.chairs.filter(c=>c.clinicId===a.clinicId).map(c=>[c.id,c.name]),a.chairId)+'</select></div>'+
      '<div class="field"><label>Data</label><input type="date" name="date" value="'+esc(a.date)+'" required></div>'+
      '<div class="field"><label>Laikas</label><input type="time" name="time" value="'+esc(a.time)+'" step="900" required></div>'+
      '<div class="field"><label>Trukmė (min.)</label><select name="duration" id="appt-duration">'+opt([15,30,45,60,75,90,105,120,150,180,210,240].map(x=>[x,x+" min."]),a.duration)+'</select></div>'+
      '<div class="field"><label>Paslauga</label><select name="serviceId" id="appt-service">'+serviceChoices(a.serviceId)+'</select></div>'+
      '<div class="field full"><label>Būsena</label><select name="status">'+simple(STATUSES,a.status)+'</select></div>'+
      '<div class="field"><label>Priminimo būsena (rankinė)</label><select name="reminderStatus">'+simple(["Nesiųstas","Priminta telefonu","Priminta SMS išorėje","Priminta el. paštu išorėje"],a.reminderStatus||"Nesiųstas")+'</select></div>'+
      '<div class="field full"><label>Pastabos (tik demo)</label><textarea name="notes">'+esc(a.notes||"")+'</textarea></div></div>'+
      '<div class="drawer-footer">'+(original?btn("Paciento kortelė","appointment-patient","btn small")+btn("Sąskaita už vizitą","appointment-invoice","btn small")+btn("Ištrinti","delete-appt","btn danger"):"")+
      btn("Rasti laisvą laiką","suggest-appt-slot","btn small")+btn("Išsaugoti vizitą","save-appt","btn primary")+'</div></form>');
  }
  if(d.kind==="patient"){
    const p=db.patients.find(p=>p.id===d.id);
    const a=p||{firstName:"",lastName:"",birthDate:"",phone:"",email:"",alerts:"",clinicIds:[ui.returnToAppointment?.clinicId||(ui.clinic==="all"?"akm":ui.clinic)]};
    return wrap(p?"Redaguoti paciento kortelę":"Naujas demonstracinis pacientas",
      '<div class="notice warn">Įveskite tik išgalvoto paciento duomenis, ne tikrą asmeninę ar medicininę informaciją.</div>'+
      '<form id="patient-form" style="margin-top:16px"><div class="field-grid"><div class="field"><label>Vardas</label><input name="firstName" maxlength="90" required value="'+esc(a.firstName)+'"></div>'+
      '<div class="field"><label>Pavardė</label><input name="lastName" maxlength="90" required value="'+esc(a.lastName)+'"></div>'+
      '<div class="field"><label>Gimimo data</label><input type="date" name="birthDate" value="'+esc(a.birthDate||"")+'"></div>'+
      '<div class="field"><label>Telefonas (išgalvotas)</label><input name="phone" maxlength="45" value="'+esc(a.phone||"")+'"></div>'+
      '<div class="field full"><label>El. paštas (išgalvotas)</label><input type="text" name="email" value="'+esc(a.email||"")+'"></div>'+
      '<div class="field full"><label>Klinika</label><div class="flex">'+db.clinics.map(c=>'<label style="font-weight:400"><input name="clinicIds" type="checkbox" value="'+c.id+'" '+(a.clinicIds.includes(c.id)?"checked":"")+'>'+esc(c.name)+'</label>').join("")+'</div></div>'+
      '<div class="field full"><label>Pastabos / įspėjimai (tik demo)</label><textarea name="alerts">'+esc(a.alerts||"")+'</textarea></div>'+
       '<div class="field full"><label><input type="checkbox" name="healthReviewRequired" '+(a.healthReviewRequired?"checked":"")+'> Reikia peržiūrėti sveikatos anketą prieš kitą vizitą</label></div></div>'+
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
  if(d.kind==="advance-refund"){
    const a=(db.advances||[]).find(x=>x.id===d.id);
    if(!a)return wrap("Avanso grąžinimas",empty("Avansas nerastas",""));
    return wrap("Grąžinti nepanaudotą avansą (DEMO)",
      '<div class="notice warn">Tai tik rankinis įrašas. Pinigus grąžinkite kasos aparatu, per terminalą arba banku atskirai.</div>'+
      '<p>Pacientas: <b>'+esc(name(a.patientId))+'</b>, turimas nepanaudotas avansas: <b>'+money(advanceRemaining(a))+'</b></p>'+
      '<form id="advance-refund-form"><div class="field-grid">'+
      '<div class="field"><label>Grąžinama suma (€)</label><input name="amount" type="number" min="0.01" step="0.01" max="'+advanceRemaining(a)+'" required value="'+advanceRemaining(a)+'"></div>'+
      '<div class="field"><label>Būdas</label><select name="method">'+opt(PAYMENT_METHODS.filter(x=>x.id!=="advance").map(x=>[x.id,x.label]),a.method)+'</select></div>'+
      '<div class="field"><label>Priežastis *</label><input name="reason" required maxlength="250"></div>'+
      '<div class="field"><label>Grąžinimo dokumento nuoroda</label><input name="reference" maxlength="120"></div></div>'+
      '<p>'+btn("Užregistruoti grąžinimą","advance-refund","btn primary")+'</p></form>');
  }
  if(d.kind==="invoice"){
    const invoice=db.invoices.find(i=>i.id===d.id);
    if(invoice){
      const costLocked=(invoice.payments||[]).length>0||!!invoice.vlkCaseId;
       const total=invoiceTotal(invoice),paid=paidAmount(invoice),remaining=invoiceOutstanding(invoice,total),reserved=pendingAmount(invoice),uncommitted=Math.max(0,roundEuro(remaining-reserved));
      return wrap((invoice.vlkCaseId?"VLK priemoka · ":"Sąskaita ")+invoice.number,'<div class="detail-grid"><div class="detail-item"><small>Pacientas</small><b>'+esc(name(invoice.patientId))+'</b></div>'+
        '<div class="detail-item"><small>Data</small><b>'+fmt(invoice.date)+'</b></div>'+
        '<div class="detail-item"><small>Suma</small><b>'+money(total)+'</b></div><div class="detail-item"><small>Likutis</small><b>'+money(remaining)+'</b></div></div>'+
        (invoice.vlkCaseId?'<div class="notice">VLK priemokos sąskaita. Laboratorijos ir medžiagų savikaina skaičiuojama tik VLK atvejyje, o atlygis tik užbaigus atvejį.</div>':"")+
        '<h3 style="margin-top:24px">Paslaugos</h3>'+(invoice.planItemId?'<p class="help">Susieta su gydymo plano procedūra: '+esc(invoice.planItemId)+'</p>':"")+invoice.items.map(x=>'<div class="segment">'+esc(x.description)+' · '+money(x.price)+'</div>').join("")+
        '<h3 style="margin-top:18px">Vienkartiniai medžiagų atskaitymai nuo gydytojo apyvartos</h3>'+
         '<div class="segment">'+
         '<label style="display:flex;gap:10px;align-items:center"><input type="checkbox" id="invoice-usage-materials" '+(invoice.usage?.materials?"checked":"")+' '+(costLocked?"disabled":"")+'> Medžiagos (sterilūs paketai, autoklavo įrankiai ir kt.) – '+money(invoice.usage?.materialsFee??DEFAULT_USAGE_FEES.materials)+'</label>'+
         '<label style="display:flex;gap:10px;align-items:center;margin-top:10px"><input type="checkbox" id="invoice-usage-surgical" '+(invoice.usage?.surgicalMaterials?"checked":"")+' '+(costLocked?"disabled":"")+'> Chirurginės medžiagos – '+money(invoice.usage?.surgicalMaterialsFee??DEFAULT_USAGE_FEES.surgicalMaterials)+'</label>'+
         '<p class="help">Atskaitoma vieną kartą už šią sąskaitoje esančią paslaugą, ne nuo kiekvieno mokėjimo. Jei pažymėtos abi – atskaitoma abiejų įkainių suma. Paciento mokėtina suma nesikeičia.</p>'+
         (!costLocked?btn("Išsaugoti medžiagų žymas","save-invoice-usage","btn small"):'<span class="pill grey">Užrakinta po mokėjimo</span>')+
         '</div>'+
         '<p class="help">Fiksuoti atskaitymai: '+money((invoiceCosts(invoice).standard||0)+(invoiceCosts(invoice).surgical||0))+' · Kitos medžiagos ir laboratorija atskaitomos papildomai.</p>'+'<h3 style="margin-top:18px">Atlikęs gydytojas ir savikaina</h3>'+ 
        (invoice.doctorId?'<div class="notice">Gydytojas: <b>'+esc(doctor(invoice.doctorId))+'</b> · Užfiksuotas atlygio tarifas: <b>'+Number(invoice.doctorPercent)+' %</b></div>':'<div class="notice warn">Sąskaita nepriskirta gydytojui, todėl neįtraukiama į atlygio skaičiavimą.</div>')+
        '<p class="help">Sąskaitos savikaina turi būti suvestinė prieš pirmąjį mokėjimą. Užregistravus mokėjimą savikainos eilutės užrakinamos, kad nekeistų ankstesnių atlygio skaičiavimų.</p>'+
        '<h3>Laboratorijos darbai ('+money(invoiceCosts(invoice).lab)+')</h3>'+
        (invoice.costs?.laboratory||[]).map(x=>'<div class="segment">'+esc(x.description)+' · '+esc(x.laboratory||"")+' · '+Number(x.qty||1)+' × '+money(x.price)+(!costLocked?btn("Pašalinti","remove-invoice-cost","btn small ghost","data-type=\'laboratory\' data-id=\'"+esc(x.id)+"\'"):"")+'</div>').join("")+
        (!costLocked?'<form id="invoice-lab-cost-form"><div class="field-grid"><div class="field full"><label>Dantų technikų laboratorija</label><select id="invoice-laboratory" name="selectedLaboratory"><option value="">Pasirinkite laboratoriją</option>'+opt(labNames().map(x=>[x,x]),"")+'<option value="__manual">Kita laboratorija (įvesti ranka)</option></select></div>'+
        '<div class="field full"><label>Laboratorijos darbas</label><select id="invoice-lab-work" name="labWorkId">'+labOptions("")+'</select></div>'+
        '<div class="field"><label>Laboratorijos pavadinimas (rankiniam įrašui)</label><input name="laboratory" maxlength="160" placeholder="Jei laboratorijos nėra sąraše"></div><div class="field"><label>Darbo pavadinimas</label><input name="description" maxlength="160" placeholder="Pvz., cirkonio vainikėlis"></div>'+
        '<div class="field"><label>Vieneto įkainis (€)</label><input name="price" type="number" min="0" max="100000" step="0.01" value="0"></div>'+
        '<div class="field"><label>Kiekis</label><input name="qty" type="number" min="1" max="100" value="1"></div></div>'+
        '<p>'+btn("+ Pridėti laboratorijos darbą","add-invoice-lab","btn small")+'</p></form>':"")+
        '<h3>Medžiagos ir detalės ('+money(invoiceCosts(invoice).materials)+')</h3>'+
        (invoice.costs?.materials||[]).map(x=>'<div class="segment">'+esc(x.description)+' · '+Number(x.qty||1)+' × '+money(x.price)+(!costLocked?btn("Pašalinti","remove-invoice-cost","btn small ghost","data-type=\'materials\' data-id=\'"+esc(x.id)+"\'"):"")+'</div>').join("")+
        (!costLocked?'<form id="invoice-material-form"><div class="field-grid"><div class="field"><label>Detalė / medžiaga</label><input name="description" maxlength="160" required placeholder="Pvz., multiunitas, stiklo pluošto kaištis"></div>'+
        '<div class="field"><label>Kaina (€)</label><input name="price" type="number" min="0" max="100000" step="0.01" required></div>'+
        '<div class="field"><label>Kiekis</label><input name="qty" type="number" min="1" max="100" value="1"></div></div>'+
        '<p>'+btn("+ Pridėti detalę / medžiagą","add-invoice-material","btn small")+'</p></form>':"")+
        '<h3 style="margin-top:22px">Mokėjimų istorija</h3>'+
        '<p class="help">Gauti mokėjimai patvirtinami ranka pagal kasos / kortelės kvitą ar banko išrašą. Tik patvirtinti mokėjimai skaičiuoja gydytojo atlygį.</p>'+
        (invoice.payments||[]).map(p=>'<div class="segment">'+fmt(p.confirmedDate||p.date)+' · '+esc(PAYMENT_METHODS.find(x=>x.id===paymentMethod(p.method))?.label||p.method)+' · '+money(p.amount)+' · '+esc(p.status==="pending"?"Laukiama":p.status==="cancelled"?"Atmesta":"Patvirtinta")+(p.reference?' · '+esc(p.reference):"")+(p.status==="pending"?btn("Patvirtinti","payment-confirm","btn small primary","data-id=\'"+esc(p.id)+"\' data-invoice=\'"+esc(invoice.id)+"\'")+btn("Atmesti","payment-cancel","btn small ghost","data-id=\'"+esc(p.id)+"\' data-invoice=\'"+esc(invoice.id)+"\'"):"")+'</div>').join("")+
        (invoice.refunds||[]).map(r=>'<div class="segment">Grąžinimas · '+fmt(r.date)+' · '+esc(r.method)+' · –'+money(r.amount)+' · '+esc(r.reason||"")+'</div>').join("")+
        '<p><b>Patvirtinta po grąžinimų: '+money(paid)+'</b> · Laukiama: '+money(reserved)+' · Likutis: '+money(remaining)+'</p>'+
        (uncommitted>0?'<form id="payment-form" style="margin-top:18px"><h3>Registruoti dalinį ar mišrų mokėjimą</h3><div class="field-grid">'+
        '<div class="field"><label>Mokėjimo suma (€)</label><input name="amount" type="number" min=".01" max="'+uncommitted.toFixed(2)+'" step=".01" required value="'+uncommitted.toFixed(2)+'"></div>'+
        '<div class="field"><label>Būdas</label><select name="method" id="payment-method">'+opt(PAYMENT_METHODS.filter(x=>x.id!=="advance").map(x=>[x.id,x.label]),"cash")+'</select></div>'+
        '<div class="field"><label>Būsena</label><select name="status" id="payment-status"><option value="confirmed">Patvirtinta rankiniu būdu</option><option value="pending">Laukiama patvirtinimo</option></select></div>'+
        '<div class="field"><label>Mokėjimo data</label><input name="date" type="date" value="'+isoDate()+'" required></div>'+
        '<div class="field"><label>Išorinio kvito / mokėjimo nuoroda</label><input name="reference" maxlength="120" placeholder="Kasa, terminalas, pavedimas"></div>'+
        '<div class="field"><label>Paciento įteikti grynieji (€)</label><input name="cashReceived" type="number" min="0" step="0.01" placeholder="Tik grynųjų grąžai"></div></div>'+
        '<p class="help">Grynųjų faktinė suma apvalinama iki 0,05 €; grąža nuo įteiktos sumos apskaičiuojama automatiškai. Kortelė ir pavedimas neapvalinami. Pavedimas registruojamas kaip laukiantis iki banko išrašo patvirtinimo.</p>'+
        '<p>'+btn("Įrašyti mokėjimą","save-payment","btn primary")+'</p></form>':'<div class="notice">Nėra laisvo likučio naujam mokėjimui (gali būti laukiančių mokėjimų).</div>')+
        (paid>0?'<form id="invoice-refund-form"><h3>Grąžinimas</h3><div class="field-grid">'+
        '<div class="field"><label>Suma (€)</label><input name="amount" type="number" min=".01" max="'+paid.toFixed(2)+'" step=".01" required></div>'+
        '<div class="field"><label>Grąžinimo būdas</label><select name="method">'+opt(PAYMENT_METHODS.filter(x=>x.id!=="advance").map(x=>[x.id,x.label]),"transfer")+'</select></div>'+
        '<div class="field"><label>Nuoroda</label><input name="reference" maxlength="120"></div>'+
        '<div class="field"><label>Priežastis *</label><input name="reason" maxlength="250" required></div></div>'+
        '<p>'+btn("Registruoti grąžinimą","invoice-refund","btn small ghost")+'</p></form>':"")+
        '<h3>Paciento avansai</h3><p>Turimas avanso likutis: <b>'+money(patientAdvanceBalance(db.advances||[],invoice.patientId,invoice.clinicId))+'</b></p>'+
        ((db.advances||[]).some(a=>a.patientId===invoice.patientId&&a.clinicId===invoice.clinicId&&advanceRemaining(a)>0)&&uncommitted>0?
        '<form id="advance-allocation-form"><div class="field-grid"><div class="field"><label>Patvirtintas avansas</label><select name="advanceId">'+opt((db.advances||[]).filter(a=>a.patientId===invoice.patientId&&a.clinicId===invoice.clinicId&&advanceRemaining(a)>0).map(a=>[a.id,a.date+" · "+money(advanceRemaining(a))]),"")+'</select></div>'+
        '<div class="field"><label>Priskiriama suma (€)</label><input name="amount" type="number" min=".01" step=".01" max="'+uncommitted.toFixed(2)+'" required></div></div>'+
        '<p>'+btn("Priskirti avansą sąskaitai","advance-allocate","btn small")+'</p></form>':"")+
        '<p class="help">Avanso priskyrimas nėra nauja kasos įplauka.</p>');
    }
    const clinicId=d.clinicId|| (ui.clinic==="all"?"akm":ui.clinic);
    const picked=planInvoiceItems(ui.patient,clinicId).find(x=>x.id===d.planItemId);
    return wrap("Nauja demonstracinė sąskaita",'<form id="invoice-form"><div class="field-grid"><div class="field full"><label>Klinika</label><select name="clinicId" id="invoice-clinic">'+opt(db.clinics.map(c=>[c.id,c.name]),clinicId)+'</select></div>'+
      '<div class="field full"><label>Pacientas</label><select name="patientId" id="invoice-patient">'+opt(db.patients.filter(p=>p.clinicIds.includes(clinicId)).map(p=>[p.id,name(p.id)]),ui.patient)+'</select></div>'+
      '<div class="field full"><label>Gydymo plano procedūra (nebūtina)</label><select name="planItemId" id="invoice-plan-item"><option value="">Nesusieta</option>'+opt(planInvoiceItems(db.patients.some(p=>p.id===ui.patient&&p.clinicIds.includes(clinicId))?ui.patient:db.patients.find(p=>p.clinicIds.includes(clinicId))?.id,clinicId).map(x=>[x.id,x.name]),picked?.id||"")+'</select></div>'+'<div class="field full"><label>Paslauga</label><select name="serviceId" id="invoice-service">'+serviceChoices(picked?.serviceId||d.serviceId||primaryService()?.id)+'</select></div>'+
      '<div class="field"><label>Kiekis</label><input name="qty" type="number" min="1" max="100" value="'+Number(picked?.qty||1)+'"></div>'+
      '<div class="field"><label>Kaina (€)</label><input name="price" id="invoice-price" type="number" min="0" step=".01" value="'+Number(picked?.price??db.services.find(x=>x.id===d.serviceId)?.price??primaryService()?.price??0)+'"></div>'+
      '<div class="field full"><label>Gydytojas, kuriam priskiriama procedūra</label><select name="doctorId" id="invoice-doctor"><option value="">Nepriskirti (atlygis nebus skaičiuojamas)</option>'+opt(db.staff.filter(d=>d.clinicIds.includes(clinicId)).map(d=>[d.id,d.name]),ui.modal?.doctorId||"")+'</select></div>'+'<div class="field full"><label>Medžiagų naudojimas šiai paslaugai (atskaitymas tik nuo gydytojo atlygio bazės)</label>'+
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
function addDeskTask(){
 const form=$("desk-task-form");if(!form)return;
 const v=stringValues(new FormData(form)),clinicId=ui.clinic==="all"?"akm":ui.clinic;
 if(!v.title?.trim()||v.title.length>160||!validDate(v.dueDate)){notify("Nurodykite užduoties pavadinimą ir datą.",true);return}
 if(v.patientId&&!db.patients.some(p=>p.id===v.patientId&&p.clinicIds.includes(clinicId))){notify("Pacientas nepriklauso klinikai.",true);return}
 const entry={id:uid("task"),clinicId,patientId:v.patientId||"",title:v.title.trim(),dueDate:v.dueDate,status:"Atvira",createdAt:new Date().toISOString(),demo:true};
 update("Registratūros užduotis pridėta",entry.id,state=>{state.tasks??=[];state.tasks.push(entry)});
 notify("Užduotis įrašyta.");
}
function finishTask(id){
 const t=(db.tasks||[]).find(x=>x.id===id);if(!t||t.status==="Atlikta")return;
 update("Registratūros užduotis atlikta",id,state=>{
  const task=state.tasks.find(x=>x.id===id);task.status="Atlikta";task.finishedAt=new Date().toISOString();
 });notify("Užduotis pažymėta atlikta.");
}
function addWaitlist(){
 const form=$("waitlist-form");if(!form)return;
 const v=stringValues(new FormData(form)),clinicId=ui.clinic==="all"?"akm":ui.clinic;
 if(!db.patients.some(p=>p.id===v.patientId&&p.clinicIds.includes(clinicId))){notify("Pasirinkite pacientą.",true);return}
 if(v.doctorId&&!db.staff.some(d=>d.id===v.doctorId&&d.clinicIds.includes(clinicId))){notify("Gydytojas nedirba šioje klinikoje.",true);return}
 if((db.waitlist||[]).some(w=>w.patientId===v.patientId&&w.clinicId===clinicId&&w.status==="Laukia")){
  notify("Pacientas jau įtrauktas į laukiančiųjų sąrašą.",true);return
 }
 const item={id:uid("wait"),clinicId,patientId:v.patientId,preferredDoctorId:v.doctorId||"",
  reason:String(v.reason||"").trim().slice(0,250),status:"Laukia",createdAt:new Date().toISOString(),demo:true};
 update("Pacientas įtrauktas į laukiančiųjų sąrašą",item.id,state=>{state.waitlist??=[];state.waitlist.push(item)});
 notify("Pacientas įtrauktas į laukiančiųjų sąrašą.");
}
function waitlistAction(id,register){
 const w=(db.waitlist||[]).find(x=>x.id===id&&x.status==="Laukia");if(!w)return;
 if(!register){
  update("Pašalintas iš laukiančiųjų sąrašo",id,state=>{const x=state.waitlist.find(y=>y.id===id);x.status="Atšaukta";x.finishedAt=new Date().toISOString()});
  notify("Pažymėta, kad nebelaukia.");return;
 }
 ui.patient=w.patientId;
 modal("appointment","",{preset:{patientId:w.patientId,clinicId:w.clinicId,staffId:w.preferredDoctorId||""},waitlistId:id});
}
function addLabOrder(){
 const form=$("lab-order-form");if(!form)return;
 const v=stringValues(new FormData(form)),lab=v.laboratory==="__manual"?String(v.manualLab||"").trim():v.laboratory;
 const amount=Number(v.cost);
 if(!lab||lab.length>160||!v.description?.trim()||v.description.length>160||!validDate(v.sentDate)||!validDate(v.dueDate)||
   v.dueDate<v.sentDate||!Number.isFinite(amount)||amount<0||amount>100000){
  notify("Patikrinkite laboratoriją, darbą, savikainą ir datas.",true);return
 }
 if(!db.patients.some(p=>p.id===v.patientId&&p.clinicIds.includes(v.clinicId))){notify("Pacientas nepriskirtas klinikai.",true);return}
 if(v.planId&&!db.plans.some(p=>p.id===v.planId&&p.patientId===v.patientId&&p.clinicId===v.clinicId)){
  notify("Gydymo planas nepriklauso pacientui ar klinikai.",true);return
 }
 const order={id:uid("laborder"),clinicId:v.clinicId,patientId:v.patientId,planId:v.planId||"",laboratory:lab,
   description:v.description.trim(),cost:roundEuro(amount),sentDate:v.sentDate,dueDate:v.dueDate,
   status:"Užsakyta",statusHistory:[{status:"Užsakyta",at:new Date().toISOString()}],demo:true};
 update("Registruotas laboratorijos užsakymas",order.id,state=>{state.labOrders??=[];state.labOrders.push(order)});
 notify("Laboratorijos užsakymas sukurtas.");
}
function suggestAppointmentSlot(){
 const form=$("appt-form");if(!form)return;
 const v=stringValues(new FormData(form)),duration=Number(v.duration||30);
 const chairs=db.chairs.filter(c=>c.clinicId===v.clinicId);
 if(!v.staffId||!v.patientId||!chairs.length){notify("Pirmiausia pasirinkite pacientą ir gydytoją.",true);return}
 const startDate=validDate(v.date)?v.date:isoDate();
 for(let offset=0;offset<21;offset++){
  const date=shiftDate(startDate,offset);
  for(let min=480;min<=1080-duration;min+=15){
   for(const ch of chairs){
    const a={id:ui.modal.id||"new",clinicId:v.clinicId,chairId:ch.id,patientId:v.patientId,
      staffId:v.staffId,date,time:timeString(min),duration,serviceId:v.serviceId,status:v.status||"Registruotas",notes:""};
    if(appointmentIssues(db,a).length===0){
      form.querySelector('[name="date"]').value=date;
      form.querySelector('[name="time"]').value=a.time;
      form.querySelector('[name="chairId"]').value=ch.id;
      notify("Laisvas laikas: "+fmt(date)+" "+a.time+" · "+ch.name+". Patvirtinkite išsaugodami vizitą.");
      return;
    }
   }
  }
 }
 notify("Per artimiausią 21 dieną nerasta laisvo laiko.",true);
}
function saveAppointment(){
  const f=stringValues(formData("appt-form"));
  const a={
    id:ui.modal.id||uid("a"),clinicId:f.clinicId,chairId:f.chairId,patientId:f.patientId,
    staffId:f.staffId,date:f.date,time:f.time,duration:Number(f.duration),serviceId:f.serviceId,
    status:f.status,reminderStatus:f.reminderStatus||"Nesiųstas",notes:String(f.notes||"").trim()
  };
  const issues=appointmentIssues(db,a);
  if(issues.length){notify(issues.join(" "),true);return}
  update(ui.modal.id?"Redaguotas vizitas":"Sukurtas vizitas",a.id,s=>{
    const i=s.appointments.findIndex(x=>x.id===a.id);
    if(i>=0)s.appointments[i]=a;else s.appointments.push(a);
    if(ui.modal.waitlistId){
      const w=(s.waitlist||[]).find(x=>x.id===ui.modal.waitlistId);
      if(w){w.status="Užregistruotas";w.appointmentId=a.id;w.finishedAt=new Date().toISOString();}
    }
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
  const dupe=duplicatePatients(db.patients,{firstName:v.firstName,lastName:v.lastName,birthDate:v.birthDate,phone:v.phone},old?.id);
  if(dupe.length&&!confirm("Galimas pasikartojantis pacientas: "+dupe.map(x=>name(x.id)).join(", ")+". Vis tiek tęsti?"))return;
  const p={id:old?.id||uid("p"),firstName:v.firstName.trim(),lastName:v.lastName.trim(),birthDate:v.birthDate||"",
    phone:v.phone?.trim()||"",email:v.email?.trim()||"",alerts:v.alerts?.trim()||"",healthReviewRequired:v.healthReviewRequired==="on",clinicIds:ids,createdAt:old?.createdAt||isoDate(),synthetic:true};
  update(old?"Atnaujinta paciento kortelė":"Sukurtas demo pacientas",p.id,s=>{
    const i=s.patients.findIndex(x=>x.id===p.id);if(i>=0)s.patients[i]=p;else s.patients.push(p);
  });
  ui.patient=p.id;
  if(ui.returnToAppointment){
    const preset={...ui.returnToAppointment,patientId:p.id};
    ui.returnToAppointment=null;ui.modal={kind:"appointment",preset};render();
    notify("Pacientas sukurtas. Tęskite vizito registraciją.");return;
  }
  ui.modal=null;ui.route="patients";render();notify("Paciento kortelė išsaugota.");
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
  if(f.targetDate&&!validDate(f.targetDate)){notify("Neteisinga planuojamos procedūros data.",true);return}
   const item={id:uid("item"),serviceId:f.serviceId,description:f.description?.trim()||service(f.serviceId),tooth:f.tooth?.trim()||"",
      qty,price,stage:f.stage||"Gydymas",targetDate:f.targetDate||"",done:false};
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
 const labCatalog=labJobs(data.selectedLaboratory).find(x=>x.id===data.labCatalogId);
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
   planId:data.planId||"",labCatalogId:labCatalog?.id||"",eligibilityChecked:data.eligibilityChecked==="on",
   costs:{laboratory:labCost>0?[{id:current?.costs?.laboratory?.[0]?.id||uid("vlk-lab"),description:labName,laboratory:labCatalog?.laboratory||(data.selectedLaboratory&&data.selectedLaboratory!=="__manual"?data.selectedLaboratory:"Demo laboratorija"),price:roundEuro(labCost),qty:1}]:[],
     materials:materialPrice>0?[{id:current?.costs?.materials?.[0]?.id||uid("vlk-mat"),description:materialName,price:roundEuro(materialPrice),qty:1}]:[]},
   usage,status:data.caseStatus==="Vykdomas"?"Vykdomas":"Planuojamas",completedAt:current?.completedAt||"",createdAt:current?.createdAt||new Date().toISOString(),demo:true
 };
 if(current){
  const copay=sourceInvoice(db.invoices,{vlkCaseId:current.id});
  if(copay&&(current.patientId!==record.patientId||current.clinicId!==record.clinicId||
     current.doctorId!==record.doctorId||Math.abs(Number(current.patientContribution)-Number(record.patientContribution))>0.001)){
   notify("VLK priemokos sąskaita jau išrašyta; šių atvejo duomenų keisti negalima.",true);return
  }
 }
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
  const existing=sourceInvoice(db.invoices,{appointmentId:ui.modal?.appointmentId||"",planItemId:match?.id||""});
  if(existing){notify("Už šį vizitą arba plano procedūrą sąskaita jau išrašyta: "+existing.number,true);modal("invoice",existing.id);return}
  if(match&&(db.vlkCases||[]).some(c=>c.planId===match.planId&&c.status!=="Atmestas")){
    notify("Šis gydymo planas susietas su VLK atveju. Paciento priemoka registruojama tik per VLK atvejį, kad sąnaudos nesidubliuotų.",true);return
  }
  if(!doc&&!confirm("Sąskaitai nepriskirtas gydytojas. Gydytojo atlyginimas nebus skaičiuojamas. Tikrai tęsti?"))return;
  const percent=doc?(Number.isFinite(Number(doc.salaryPercent))?Number(doc.salaryPercent):35):null;
  const invoice={id:uid("inv"),number:"DP-"+String(Date.now()).slice(-9),date:v.date,clinicId:v.clinicId,patientId:v.patientId,planItemId:match?.id||"",planId:match?.planId||"",appointmentId:ui.modal?.appointmentId||"",doctorId:doc?.id||"",doctorPercent:percent,usage:usageFeeSnapshot({materials:v.usageMaterials==="on",surgicalMaterials:v.usageSurgical==="on"},db.usageFees),costs:{laboratory:[],materials:[]},
    items:[{id:uid("line"),description:service(v.serviceId),serviceId:v.serviceId,price,qty}],payments:[]};
  const problems=duplicateInvoiceIssues(db.invoices,invoice);
  if(problems.length){notify(problems.join(" "),true);return}
  update("Sukurta demonstracinė sąskaita",invoice.id,s=>{
    const conflicts=duplicateInvoiceIssues(s.invoices,invoice);
    if(conflicts.length)throw new Error(conflicts.join(" "));
    s.invoices.push(invoice);
  });
  ui.modal={kind:"invoice",id:invoice.id};render();notify("Sąskaita sukurta.");
}
function saveInvoiceUsage(){
 const invoice=db.invoices.find(i=>i.id===ui.modal?.id);
 if(!invoice)return;
 if((invoice.payments||[]).length||invoice.vlkCaseId){notify("Medžiagų žymos užrakintos po mokėjimo arba VLK priemokai.",true);return}
 const materials=$("invoice-usage-materials")?.checked===true;
 const surgicalMaterials=$("invoice-usage-surgical")?.checked===true;
 update("Atnaujintos fiksuotos medžiagų savikainos žymos",invoice.id,state=>{
   state.invoices.find(i=>i.id===invoice.id).usage={...usageFeeSnapshot({materials,surgicalMaterials},db.usageFees),...invoice.usage,materials,surgicalMaterials};
 });
 notify("Medžiagų atskaitymai išsaugoti.");
}
function manualPaymentValues(formId,max){
 const form=$(formId);if(!form)return {error:"Mokėjimo forma nerasta."};
 const v=stringValues(new FormData(form));
 const amount=roundEuro(Number(v.amount)),method=paymentMethod(v.method);
 if(!v.amount||!Number.isFinite(amount)||amount<=0||amount>max+0.001)return {error:"Mokėjimo suma turi būti teigiama ir neviršyti likučio."};
 if(!["cash","card","transfer"].includes(method))return {error:"Neteisingas mokėjimo būdas."};
 const date=v.date||isoDate();
 if(!validDate(date))return {error:"Neteisinga mokėjimo data."};
 const status=method==="transfer"?"pending":(v.status==="pending"?"pending":"confirmed");
 const reference=String(v.reference||"").trim().slice(0,120);
 if(method==="card"&&status==="confirmed"&&!reference)return {error:"Patvirtintai kortelės operacijai būtina terminalo kvito nuoroda."};
 const cashAmount=method==="cash"?cashRounded(amount):0;
 const given=String(v.cashReceived||"").trim()?Number(v.cashReceived):cashAmount;
 if(method==="cash"&&(!Number.isFinite(given)||given<cashAmount||given>100000))return {error:"Įteikta grynųjų suma negali būti mažesnė už apvalintą mokėjimą."};
 return {amount,method,date,status,reference,cashAmount,
   cashReceived:method==="cash"?roundEuro(given):0,change:method==="cash"?roundEuro(given-cashAmount):0,
   confirmedDate:status==="confirmed"?date:"",demo:true};
}
function savePayment(){
 const invoice=db.invoices.find(i=>i.id===ui.modal?.id);if(!invoice)return;
 const max=Math.max(0,roundEuro(invoiceOutstanding(invoice,invoiceTotal(invoice))-pendingAmount(invoice)));
 const result=manualPaymentValues("payment-form",max);
 if(result.error){notify(result.error,true);return}
 const entry={...result,id:uid("pay"),status:result.status};
 update("Įrašytas demonstracinis "+(entry.status==="pending"?"laukiantis":"patvirtintas")+" mokėjimas",invoice.id,state=>{
   state.invoices.find(i=>i.id===invoice.id).payments.push(entry);
 });
 notify(entry.status==="pending"?"Mokėjimas laukia rankinio patvirtinimo.":"Mokėjimas patvirtintas (demo)."+(entry.method==="cash"?" Grąža: "+money(entry.change):""));
}
function confirmPayment(invoiceId,paymentId,confirmIt){
 const invoice=db.invoices.find(i=>i.id===invoiceId),payment=invoice?.payments?.find(p=>p.id===paymentId&&p.status==="pending");
 if(!payment)return;
 if(confirmIt){
   if(!confirm("Patvirtinate, kad patikrinote išorinį terminalo kvitą arba banko išrašą ir mokėjimas realiai gautas? (Tik demo)"))return;
   if(!String(payment.reference||"").trim()){
     const ref=prompt("Įveskite banko išrašo ar terminalo kvito operacijos numerį (tik demo):","");
     if(!ref?.trim()){notify("Patvirtinimui būtina išorinio dokumento nuoroda.",true);return}
     payment.reference=ref.trim().slice(0,120);
   }
 }
 update(confirmIt?"Patvirtintas mokėjimas pagal išorinį dokumentą":"Atmestas nepatvirtintas mokėjimas",invoiceId,state=>{
   const target=state.invoices.find(i=>i.id===invoiceId).payments.find(p=>p.id===paymentId);
   target.status=confirmIt?"confirmed":"cancelled";
   if(confirmIt){target.confirmedDate=isoDate();target.reference=payment.reference}
 });
 notify(confirmIt?"Mokėjimas rankiniu būdu patvirtintas.":"Laukiantis mokėjimas atmestas.");
}
function refundInvoicePayment(){
 const invoice=db.invoices.find(i=>i.id===ui.modal?.id);
 if(!invoice)return;
 const form=$("invoice-refund-form");if(!form)return;
 const v=stringValues(new FormData(form)),amount=roundEuro(Number(v.amount)),available=paidAmount(invoice);
 if(!v.amount||!Number.isFinite(amount)||amount<=0||amount>available+0.001){notify("Grąžinama suma turi neviršyti patvirtintų mokėjimų likučio.",true);return}
 const method=paymentMethod(v.method);
 if(!["cash","card","transfer"].includes(method)||!String(v.reason||"").trim()){notify("Pasirinkite grąžinimo būdą ir nurodykite priežastį.",true);return}
 if(!confirm("Patvirtinate, kad pinigai jau grąžinti išoriniu būdu? Ši demonstracija neatlieka mokėjimų."))return;
 const record={id:uid("refund"),date:isoDate(),amount,method,reason:String(v.reason).trim().slice(0,250),
   reference:String(v.reference||"").trim().slice(0,120),cashAmount:method==="cash"?cashRounded(amount):0,demo:true};
 update("Atliktas grąžinimas (demo, nekoreguojant ankstesnio įrašo)",invoice.id,state=>{
   const item=state.invoices.find(i=>i.id===invoice.id);
   item.refunds??=[];item.refunds.push(record);
 });
 notify("Grąžinimas užregistruotas; atlygis perskaičiuojamas pagal grąžinimo datą.");
}
function saveAdvance(){
 const form=$("advance-form");if(!form)return;
 const v=stringValues(new FormData(form)),method=paymentMethod(v.method),amount=roundEuro(Number(v.amount));
 if(!v.amount||!Number.isFinite(amount)||amount<=0||amount>100000||
    !db.patients.some(p=>p.id===v.patientId&&p.clinicIds.includes(v.clinicId))||
    !["cash","card","transfer"].includes(method)||!validDate(v.date)){notify("Patikrinkite avanso įrašą.",true);return}
 const reference=String(v.reference||"").trim().slice(0,120);
 const status=method==="transfer"?"pending":"confirmed";
 if(method==="card"&&!reference){notify("Kortelės avansui įveskite terminalo kvito numerį.",true);return}
 const entry={id:uid("adv"),patientId:v.patientId,clinicId:v.clinicId,date:v.date,method,
   amount,status,reference,confirmedDate:status==="confirmed"?v.date:"",
   cashAmount:method==="cash"?cashRounded(amount):0,allocations:[],refunds:[],demo:true};
 update("Registruotas "+(status==="pending"?"laukiantis":"patvirtintas")+" demonstracinis avansas",entry.id,state=>{
   state.advances??=[];state.advances.push(entry);
 });
 notify(status==="pending"?"Pavedimo avansas laukia banko išrašo patvirtinimo.":"Avansas užregistruotas (demo).");
}
function confirmAdvance(id,accepted){
 const item=(db.advances||[]).find(a=>a.id===id&&a.status==="pending");if(!item)return;
 if(accepted&&!confirm("Patvirtinate, kad įmoka rasta banko išraše / kvite? (Demo)"))return;
 if(accepted&&!item.reference){
   const ref=prompt("Įveskite išorinę mokėjimo nuorodą:","");
   if(!ref?.trim())return;
   item.reference=ref.trim().slice(0,120);
 }
 update(accepted?"Patvirtintas avansas":"Atmestas avansas",id,state=>{
   const target=state.advances.find(a=>a.id===id);
   target.status=accepted?"confirmed":"cancelled";
   if(accepted){target.confirmedDate=isoDate();target.reference=item.reference}
 });notify(accepted?"Avansas patvirtintas.":"Avansas atmestas.");
}
function allocateAdvance(){
 const invoice=db.invoices.find(i=>i.id===ui.modal?.id),form=$("advance-allocation-form");
 if(!invoice||!form)return;
 const v=stringValues(new FormData(form)),a=(db.advances||[]).find(x=>x.id===v.advanceId),amount=roundEuro(Number(v.amount));
 const available=Math.max(0,roundEuro(invoiceOutstanding(invoice,invoiceTotal(invoice))-pendingAmount(invoice)));
 if(!a||a.patientId!==invoice.patientId||a.clinicId!==invoice.clinicId||!isConfirmed(a)||
    !v.amount||!Number.isFinite(amount)||amount<=0||amount>available+0.001||amount>advanceRemaining(a)+0.001){
   notify("Avanso likutis arba priskiriama suma neteisinga.",true);return
 }
 const paymentId=uid("pay"),now=isoDate();
 update("Avansas priskirtas paciento sąskaitai (be pakartotinės įplaukos)",invoice.id,state=>{
   state.advances.find(x=>x.id===a.id).allocations.push({id:uid("alloc"),invoiceId:invoice.id,paymentId,amount,date:now});
   state.invoices.find(x=>x.id===invoice.id).payments.push({id:paymentId,date:now,confirmedDate:now,method:"advance",
     amount,status:"confirmed",reference:"Avansas "+a.id,advanceId:a.id,demo:true});
 });notify("Avansas priskirtas sąskaitai; pakartotinio pinigų gavimo neįrašyta.");
}
function refundAdvance(){
 const entry=(db.advances||[]).find(a=>a.id===ui.modal?.id),form=$("advance-refund-form");
 if(!entry||!form)return;
 const v=stringValues(new FormData(form)),amount=roundEuro(Number(v.amount)),method=paymentMethod(v.method);
 if(!v.amount||!Number.isFinite(amount)||amount<=0||amount>advanceRemaining(entry)+0.001||
   !["cash","card","transfer"].includes(method)||!String(v.reason||"").trim()){notify("Neteisinga grąžinimo suma arba priežastis.",true);return}
 if(!confirm("Patvirtinkite, kad avanso grąžinimas atliktas už programos ribų."))return;
 const record={id:uid("ar"),date:isoDate(),amount,method,reason:v.reason.trim().slice(0,250),
   reference:String(v.reference||"").trim().slice(0,120),cashAmount:method==="cash"?cashRounded(amount):0,demo:true};
 update("Grąžintas nepanaudotas avansas",entry.id,state=>{
   const advance=state.advances.find(a=>a.id===entry.id);
   advance.refunds??=[];advance.refunds.push(record);
 });
 ui.modal=null;render();notify("Avanso grąžinimas įrašytas.");
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
 const v=stringValues(new FormData(form)),catalog=labJobs(v.selectedLaboratory).find(x=>x.id===v.labWorkId);
 const description=type==="laboratory"&&catalog?catalog.name:String(v.description||"").trim();
 const laboratory=type==="laboratory"?(catalog?.laboratory||(v.selectedLaboratory&&v.selectedLaboratory!=="__manual"?v.selectedLaboratory:String(v.laboratory||"").trim())):"";
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
function downloadCashDayCsv(){
 const summary=settlementDaySummary(db.invoices,db.advances||[],db.vlkCases||[],ui.cashDay,ui.clinic);
 const rows=[["Data","Operacijos rūšis","Klinika","Pacientas (demo)","Sąskaita / atvejis","Mokėjimo būdas","Suma EUR","Išorinis dokumentas"]];
 for(const row of summary.rows)rows.push([ui.cashDay,row.kind,ui.clinic,name(row.patientId),row.invoiceNumber,row.method,
   row.method==="cash"?row.cashAmount:row.amount,row.reference||""]);
 for(const v of summary.vlkCases)rows.push([ui.cashDay,"VLK baigtas atvejis",clinic(v.clinicId),name(v.patientId),v.caseNumber,"VLK / PSDF (ne kasos įplauka)",v.claimedAmount,v.evisReference||""]);
 rows.push([ui.cashDay,"SUMA","", "", "", "Grynieji",summary.totals.cash,""]);
 rows.push([ui.cashDay,"SUMA","", "", "", "Kortelės",summary.totals.card,""]);
 rows.push([ui.cashDay,"SUMA","", "", "", "Pavedimai",summary.totals.transfer,""]);
 rows.push([ui.cashDay,"SUMA","", "", "", "VLK baigti atvejai (ne įplaukos)",summary.vlk,""]);
 const cell=value=>{const valueText=String(value??"");return '"'+(/^[=+@\-\t\r]/.test(valueText)?"'":"")+valueText.replace(/"/g,'""')+'"';};
 const content="\uFEFF"+rows.map(x=>x.map(cell).join(";")).join("\r\n");
 const blob=new Blob([content],{type:"text/csv;charset=utf-8"});
 const url=URL.createObjectURL(blob),link=document.createElement("a");
 link.href=url;link.download="dentalpro-dienos-suvestine-demo-"+ui.cashDay+".csv";link.click();URL.revokeObjectURL(url);
 notify("Dienos suvestinė eksportuota CSV (demo).");
}
function closeCashDay(){
 const form=$("cash-close-form");if(!form)return;
 const v=stringValues(new FormData(form));
 const clinicId=v.clinicId;
 if(!db.clinics.some(c=>c.id===clinicId)){notify("Pasirinkite kliniką.",true);return}
 const counted={cash:Number(v.countedCash),card:Number(v.countedCard),transfer:Number(v.countedTransfer)};
 if(["countedCash","countedCard","countedTransfer"].some(key=>!v[key]&&v[key]!=="0")||
    Object.values(counted).some(x=>!Number.isFinite(x)||Math.abs(x)>100000)){
   notify("Įveskite faktines dienos grynųjų, kortelių ir pavedimų sumas.",true);return
 }
 const computed=settlementDaySummary(db.invoices,db.advances||[],db.vlkCases||[],ui.cashDay,clinicId);
 const difference={cash:roundEuro(counted.cash-computed.totals.cash),
   card:roundEuro(counted.card-computed.totals.card),
   transfer:roundEuro(counted.transfer-computed.totals.transfer)};
 const record={id:uid("close"),date:ui.cashDay,clinicId,createdAt:new Date().toISOString(),
   counted,expected:{...computed.totals},difference,vlk:computed.vlk,
   notes:String(v.notes||"").trim().slice(0,400),demo:true};
 update("Išsaugotas rankinis dienos mokėjimų suderinimas",record.id,state=>{
   state.cashClosings??=[];state.cashClosings.push(record);
 });
 notify(Object.values(difference).some(x=>Math.abs(x)>0.001)?"Dienos suvestinė išsaugota; yra neatitikimų.":"Dienos suvestinė išsaugota; įvestos sumos sutampa.");
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
    case "go-finances":ui.financeTab="daily";route("finances");break;
    case "finance-tab":ui.financeTab=target.dataset.tab;render();break;
    case "go-laborders":route("laborders");break;
    case "work-patient":ui.patient=id;ui.patientTab="overview";route("patients");break;
    case "work-documents":ui.patient=id;route("forms");break;
    case "work-payment":{
      ui.patient=id||ui.patient;
      const item=db.invoices.find(i=>i.patientId===id&&invoiceOutstanding(i,invoiceTotal(i))>0.001);
      if(item)modal("invoice",item.id);else modal("invoice");
      break;
    }
    case "add-desk-task":addDeskTask();break;
    case "finish-task":finishTask(id);break;
    case "mark-reminder":{
      const appt=db.appointments.find(a=>a.id===id);if(!appt)break;
      update("Rankiniu būdu pažymėtas priminimas pacientui",id,state=>{
        const item=state.appointments.find(a=>a.id===id);
        item.reminderStatus="Priminta telefonu";item.reminderAt=new Date().toISOString();
      });notify("Priminimas pažymėtas. Sistema jokio pranešimo nesiuntė.");break;
    }
    case "add-waitlist":addWaitlist();break;
    case "wait-register":waitlistAction(id,true);break;
    case "wait-cancel":waitlistAction(id,false);break;
    case "add-lab-order":addLabOrder();break;
    case "close-modal":case "backdrop":if(act==="backdrop"&&event.target!==target)break;ui.modal=null;render();break;
    case "new-appt":modal("appointment","",{});break;
    case "suggest-appt-slot":suggestAppointmentSlot();break;
    case "new-patient-from-appt":{
      const form=$("appt-form");if(!form)break;
      ui.returnToAppointment=stringValues(new FormData(form));modal("patient");break;
    }
    case "new-on-day":modal("appointment","",{preset:{date:target.dataset.date}});break;
    case "slot":modal("appointment","",{preset:{date:ui.day,time:target.dataset.time,chairId:target.dataset.chair,clinicId:db.chairs.find(c=>c.id===target.dataset.chair)?.clinicId}});break;
    case "open-intake":modal("intake",id);break;
    case "intake-arrived":{
      const a=db.appointments.find(x=>x.id===id);if(!a||["Atšauktas","Neatvyko"].includes(a.status))break;
      update("Patvirtintas paciento atvykimas (demo)",id,state=>{
        const item=state.appointments.find(x=>x.id===id);
        item.status="Atvykęs";item.arrivedAt=new Date().toISOString();
      });notify("Paciento atvykimas pažymėtas.");break;
    }
    case "intake-documents":{
      const a=db.appointments.find(x=>x.id===id);if(!a)break;
      ui.patient=a.patientId;route("forms");break;
    }
    case "intake-plan":{
      const a=db.appointments.find(x=>x.id===id);if(!a)break;
      ui.patient=a.patientId;route("plans");break;
    }
    case "intake-invoice":{
      const a=db.appointments.find(x=>x.id===id);if(!a)break;
      const existing=sourceInvoice(db.invoices,{appointmentId:a.id});
      if(existing){modal("invoice",existing.id);break;}
      ui.patient=a.patientId;
      modal("invoice","",{clinicId:a.clinicId,appointmentId:a.id,doctorId:a.staffId,serviceId:a.serviceId});break;
    }
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
    case "appointment-invoice":{
      const a=db.appointments.find(x=>x.id===ui.modal?.id);if(!a)break;
      const previous=sourceInvoice(db.invoices,{appointmentId:a.id});
      if(previous){modal("invoice",previous.id);notify("Šiam vizitui sąskaita jau išrašyta.");break}
      ui.patient=a.patientId;
      modal("invoice","",{clinicId:a.clinicId,appointmentId:a.id,doctorId:a.staffId,serviceId:a.serviceId});
      break;
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
    case "plan-lab-order":ui.patient=db.plans.find(p=>p.id===ui.selectedPlan)?.patientId||ui.patient;route("laborders");break;
    case "plan-next-appointment":{
      const plan=db.plans.find(p=>p.id===target.dataset.plan),item=plan?.items.find(x=>x.id===id);
      if(!plan||!item)break;
      ui.patient=plan.patientId;
      modal("appointment","",{preset:{clinicId:plan.clinicId,patientId:plan.patientId,serviceId:item.serviceId,date:item.targetDate||ui.day}});
      break;
    }
    case "plan-invoice":{
      const plan=db.plans.find(p=>p.id===target.dataset.plan),item=plan?.items.find(x=>x.id===id);
      if(!plan||!item)break;
      const billed=planItemBillingState(db,plan.id,item.id);
      if(billed.invoice){modal("invoice",billed.invoice.id);notify("Procedūra jau apmokestinta.");break}
      if(billed.vlkCase){notify("Šis gydymo planas priklauso VLK atvejui. Priemoka apskaitoma per VLK.",true);break}
      if(!item.done&&!confirm("Procedūra dar nepažymėta atlikta. Ar tikrai jau norite paruošti sąskaitą?"))break;
      ui.patient=plan.patientId;
      modal("invoice","",{planItemId:item.id,planId:plan.id,clinicId:plan.clinicId});
      break;
    }
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
    case "payment-confirm":confirmPayment(target.dataset.invoice,id,true);break;
    case "payment-cancel":confirmPayment(target.dataset.invoice,id,false);break;
    case "invoice-refund":refundInvoicePayment();break;
    case "advance-save":saveAdvance();break;
    case "advance-confirm":confirmAdvance(id,true);break;
    case "advance-cancel":confirmAdvance(id,false);break;
    case "advance-allocate":allocateAdvance();break;
    case "advance-refund-open":modal("advance-refund",id);break;
    case "advance-refund":refundAdvance();break;
    case "export-cash-day":downloadCashDayCsv();break;
    case "close-cash-day":closeCashDay();break;
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
  if(act==="lab-order-status"){
    const id=target.dataset.id,status=target.value;
    const order=(db.labOrders||[]).find(x=>x.id===id);
    if(!order||!LAB_ORDER_STATUSES.includes(status)||["Atiduota","Atšaukta"].includes(order.status))return;
    update("Pakeista laboratorijos užsakymo būsena",id,state=>{
      const item=state.labOrders.find(x=>x.id===id);item.status=status;
      item.statusHistory??=[];item.statusHistory.push({status,at:new Date().toISOString()});
    });notify("Užsakymo būsena atnaujinta.");return;
  }
  if(target.id==="order-patient"){
    const plan=$("order-plan"),clinicId=$("order-clinic")?.value;
    if(plan)plan.innerHTML='<option value="">Nesusieta</option>'+opt(db.plans.filter(p=>p.patientId===target.value&&p.clinicId===clinicId).map(p=>[p.id,p.title]),"");
    return
  }
  if(target.id==="order-clinic"){
    const patients=$("order-patient"),plans=$("order-plan");
    if(patients)patients.innerHTML=opt(db.patients.filter(p=>p.clinicIds.includes(target.value)).map(p=>[p.id,name(p.id)]),"");
    if(plans)plans.innerHTML='<option value="">Nesusieta</option>'+opt(db.plans.filter(p=>p.patientId===patients?.value&&p.clinicId===target.value).map(p=>[p.id,p.title]),"");
    return
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
  if(target.id==="vlk-laboratory"){
    const form=$("vlk-form");
    if(form){$("vlk-lab-choice").innerHTML=labOptions(target.value);
      form.querySelector('[name="labName"]').value="";
      form.querySelector('[name="labPrice"]').value="0";}
    return;
  }
  if(target.id==="vlk-lab-choice"){
    const selected=labJobs($("vlk-laboratory")?.value).find(x=>x.id===target.value),form=$("vlk-form");
    if(form){form.querySelector('[name="labName"]').value=selected?.name||"";
      form.querySelector('[name="labPrice"]').value=selected?.price??0;}
    return;
  }
  if(target.id==="cash-day"){if(validDate(target.value)){ui.cashDay=target.value;render()}return}
  if(target.id==="advance-clinic"){
    const pick=$("advance-patient");
    if(pick)pick.innerHTML=opt(db.patients.filter(p=>p.clinicIds.includes(target.value)).map(p=>[p.id,name(p.id)]),"");
    return
  }
  if(target.id==="payment-method"){
    const field=$("payment-status");
    if(field){field.value=target.value==="transfer"?"pending":"confirmed";field.disabled=target.value==="transfer"}
    return
  }
  if(target.id==="salary-month"){ui.salaryMonth=target.value;render();return}
  if(target.id==="invoice-laboratory"){
    const form=$("invoice-lab-cost-form");
    if(form){$("invoice-lab-work").innerHTML=labOptions(target.value);
      form.querySelector('[name="laboratory"]').value=target.value==="__manual"?"":target.value;
      form.querySelector('[name="description"]').value="";
      form.querySelector('[name="price"]').value="0";}
    return;
  }
  if(target.id==="invoice-lab-work"){
    const chosen=labJobs($("invoice-laboratory")?.value).find(x=>x.id===target.value);
    const form=$("invoice-lab-cost-form");
    if(form){form.querySelector('[name="description"]').value=chosen?.name||"";
      form.querySelector('[name="price"]').value=chosen?.price??0;}
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
       ["laborders","▧","Laboratorijų užsakymai",""],
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
  document.addEventListener("click",e=>{const target=e.target.closest("[data-action]");if(target)try{handleAction(target,e)}catch(error){notify(error.message||"Nepavyko išsaugoti pakeitimų.",true)}});
  document.addEventListener("change",e=>{try{handleChange(e.target)}catch(error){notify(error.message||"Nepavyko išsaugoti pakeitimų.",true)}});
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
