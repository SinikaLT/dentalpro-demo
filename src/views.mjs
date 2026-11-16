
import {CLINICS,CHAIRS,STATUSES,PLAN_STATUSES,WEEKDAYS,PERMANENT,PRIMARY,CONDITIONS,SURFACES,uid,isoDate,shiftDate,validDate,weekday,minutes,timeString,overlaps,money,appointmentIssues,patientName,doctorName,serviceName,invoiceTotal,planTotal} from "./domain.mjs";
import {openRepository,defaultAvailability,defaultBreaks} from "./store.mjs";

const repository=openRepository();
let db=repository.get();
const ui={route:"overview",clinic:"akm",day:isoDate(),view:"day",doctor:"",chair:"",status:"",service:"",patient:"p-0-0",patientTab:"overview",tooth:11,selectedDoctor:"",selectedPlan:"",search:"",modal:null};
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const opt=(arr,value)=>arr.map(x=>'<option value="'+esc(x[0])+'"'+(String(x[0])===String(value)?' selected':'')+'>'+esc(x[1])+'</option>').join("");
const simple=(arr,value)=>opt(arr.map(x=>[x,x]),value);
const btn=(text,action,cls="btn",data="")=>'<button type="button" class="'+cls+'" data-action="'+action+'" '+data+'>'+text+'</button>';
const fmt=d=>validDate(d)?new Date(d+"T12:00:00").toLocaleDateString("lt-LT",{day:"numeric",month:"short",year:"numeric"}):"—";
const name=id=>patientName(db,id);
const doctor=id=>doctorName(db,id);
const service=id=>serviceName(db,id);
const clinic=id=>db.clinics.find(x=>x.id===id)?.name||"—";
const chair=id=>db.chairs.find(x=>x.id===id)?.name||"—";
const pill=s=>'<span class="pill '+(["Atšauktas","Neatvyko"].includes(s)?"danger":(["Atvykęs","Atliekamas"].includes(s)?"warning":(["Registruotas","Juodraštis","Neaktyvi"].includes(s)?"grey":""))+'">'+esc(s)+'</span>';
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
  $("section-name").textContent=({overview:"Apžvalga",calendar:"Registracijos kalendorius",patients:"Pacientai",doctors:"Gydytojų grafikai",odontogram:"Odontograma",plans:"Gydymo planai",notes:"Klinikiniai įrašai",finances:"Finansai",services:"Paslaugos",vlk:"VLK / PSDF",admin:"Administravimas"})[ui.route];
  $("page").innerHTML=({
    overview:viewOverview,calendar:viewCalendar,patients:viewPatients,doctors:viewDoctors,
    odontogram:viewOdontogram,plans:viewPlans,notes:viewNotes,finances:viewFinances,
    services:viewServices,vlk:viewVlk,admin:viewAdmin
  }[ui.route]||viewOverview)();
  $("drawer-root").innerHTML=ui.modal?viewDrawer():"";
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
function viewCalendar(){
  const viewNames={day:"Diena",week:"Savaitė",month:"Mėnuo",list:"Sąrašas"};
  let out=page("Registracijos kalendorius","Registracijos seka: kėdė → pacientas → gydytojas",btn("+ Registruoti vizitą","new-appt","btn primary"));
  out+='<section class="panel"><div class="toolbar space-between"><div class="toolbar">'+btn("←","cal-prev","btn small")+btn("Šiandien","cal-today","btn small")+btn("→","cal-next","btn small")+
    '<input type="date" aria-label="Kalendoriaus data" data-change="day" value="'+esc(ui.day)+'"><b>'+fmt(ui.day)+'</b></div><div class="view-switch">'+
    Object.entries(viewNames).map(([key,label])=>'<button type="button" class="'+(ui.view===key?"active":"")+'" data-action="set-view" data-view="'+key+'">'+label+'</button>').join("")+'</div></div>'+
    '<div class="calendar-filters"><select data-change="doctor-filter" aria-label="Gydytojų filtras"><option value="">Visi gydytojai</option>'+opt(listDoctors().map(d=>[d.id,d.name]),ui.doctor)+'</select>'+
    '<select data-change="chair-filter" aria-label="Kėdžių filtras"><option value="">Visos kėdės</option>'+opt(listChairs().map(c=>[c.id,clinic(c.clinicId)+" · "+c.name]),ui.chair)+'</select>'+
    '<select data-change="service-filter" aria-label="Paslaugų filtras"><option value="">Visos paslaugos</option>'+opt(db.services.map(s=>[s.id,s.name]),ui.service)+'</select>'+
    '<select data-change="status-filter" aria-label="Būsenų filtras"><option value="">Visos būsenos</option>'+simple(STATUSES,ui.status)+'</select></div></section>';
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
    const color=["#07818a","#5f72c4","#a46b39","#26875f"][Math.max(0,listDoctors().findIndex(x=>x.id===a.staffId))%4];
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
function patientDetail(p){
  const items=db.appointments.filter(a=>a.patientId===p.id).sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time));
  let out='<div class="panel-title"><div><h2>'+esc(name(p.id))+'</h2><small class="muted">Nr. '+esc(p.id)+' · Demonstracinis pacientas</small></div>'+btn("Redaguoti","edit-patient","btn small","data-id='"+esc(p.id)+"'")+'</div>'+
    '<div class="tabs">'+[["overview","Apžvalga"],["history","Apsilankymai"],["plans","Gydymo planai"]].map(([id,title])=>'<button class="tab '+(ui.patientTab===id?"active":"")+'" data-action="patient-tab" data-tab="'+id+'">'+title+'</button>').join("")+'</div>';
  if(ui.patientTab==="overview"){
    out+='<div class="detail-grid">'+[["Gimimo data",p.birthDate?fmt(p.birthDate):"Nenurodyta"],["Telefonas",p.phone||"Nenurodyta"],["El. paštas",p.email||"Nenurodyta"],["Klinikos",p.clinicIds.map(clinic).join(", ")]].map(([k,v])=>'<div class="detail-item"><small>'+k+'</small><b>'+esc(v)+'</b></div>').join("")+'</div>'+
      (p.alerts?'<div class="notice warn" style="margin-top:14px">'+esc(p.alerts)+'</div>':"")+
      '<hr class="section-divider"><div class="actions">'+btn("Odontograma","patient-odontogram","btn small")+btn("Klinikiniai įrašai","patient-notes","btn small")+btn("+ Vizitas","new-appt","btn primary small")+'</div><h3 style="margin-top:24px">Apsilankymų istorija</h3>'+eventRows(items.slice(0,5));
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
  return '<h3>'+esc(p.title)+'</h3><div class="flex"><label>Būsena</label><select id="plan-status" data-change="plan-status" style="max-width:230px">'+simple(PLAN_STATUSES,p.status)+'</select><span class="pill">Sąmata '+money(planTotal(p))+'</span></div>'+
    '<div class="table-wrap"><table class="data-table"><thead><tr><th>Dantis</th><th>Procedūra</th><th>Suma</th><th>Atlikta</th></tr></thead><tbody>'+
    p.items.map(i=>'<tr><td>'+esc(i.tooth||"—")+'</td><td>'+esc(i.description)+'</td><td>'+money(Number(i.qty||1)*Number(i.price||0))+'</td>'+
    '<td><input type="checkbox" aria-label="Procedūra atlikta" data-change="plan-done" data-plan="'+esc(p.id)+'" data-id="'+esc(i.id)+'" '+(i.done?"checked":"")+'></td></tr>').join("")+'</tbody></table></div>'+
    '<h3 style="margin-top:20px">Pridėti procedūrą</h3><form id="plan-item-form"><div class="field-grid"><div class="field"><label>Paslauga</label><select name="serviceId">'+opt(db.services.filter(s=>s.active).map(s=>[s.id,s.name]),db.services[0]?.id)+'</select></div>'+
    '<div class="field"><label>Dantis</label><input name="tooth" placeholder="Pvz., 16"></div><div class="field"><label>Kiekis</label><input name="qty" type="number" min="1" max="20" value="1"></div>'+
    '<div class="field"><label>Kaina (€)</label><input name="price" type="number" min="0" step="0.01" value="'+Number(db.services[0]?.price||0)+'"></div>'+
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
  return page("Paslaugų katalogas","Procedūrų kainynas, kategorijos ir trukmės",btn("+ Pridėti paslaugą","new-service","btn primary"))+
    '<div class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>Paslauga</th><th>Kategorija</th><th>Trukmė</th><th>Kaina</th><th>Būsena</th><th></th></tr></thead><tbody>'+
    db.services.map(s=>'<tr><td><b>'+esc(s.name)+'</b></td><td>'+esc(s.category)+'</td><td>'+s.duration+' min.</td><td>'+money(s.price)+'</td><td>'+pill(s.active?"Aktyvi":"Neaktyvi")+'</td>'+
    '<td>'+btn("Redaguoti","edit-service","btn small","data-id='"+esc(s.id)+"'")+'</td></tr>').join("")+'</tbody></table></div></div>';
}
function viewVlk(){
  return page("VLK / PSDF","Tik informacinis demonstracinis modulis")+
    '<section class="panel"><h2>VLK / PSDF</h2><p>Demonstracinis paslaugų katalogas apima konsultacijas su siuntimu, suaugusiųjų ir vaikų dantų protezavimo paslaugas.</p>'+
    '<div class="notice warn">Kompensacijos neskaičiuojamos, teisė į PSDF finansavimą netikrinama, duomenys neteikiami VLK ar kitoms valstybinėms sistemoms.</div></section>';
}
function viewAdmin(){
  return page("Administravimas","Duomenų eksportas, demonstracijos atkūrimas ir veiksmų istorija")+
    '<div class="two-cols"><section class="panel"><h2>Demonstracinė aplinka</h2><div class="notice warn">Nėra prisijungimo, vartotojų teisių, serverinės duomenų bazės, saugaus audito ar atsarginių kopijų. Neveskite tikrų pacientų duomenų.</div>'+
    '<div class="detail-grid" style="margin:20px 0">'+[["Klinikos",db.clinics.length],["Kėdės",db.chairs.length],["Gydytojai",db.staff.length],["Pacientai",db.patients.length]].map(([k,v])=>'<div class="detail-item"><small>'+k+'</small><b>'+v+'</b></div>').join("")+'</div>'+
    '<div class="actions">'+btn("Eksportuoti demo JSON","export","btn primary")+btn("Atkurti demo įrašus","reset","btn danger")+'</div></section>'+
    '<section class="panel"><h2>Veiksmų žurnalas</h2><div class="audit-list">'+db.audit.slice(0,60).map(a=>'<div class="audit-entry"><span><strong>'+esc(a.action)+'</strong><small class="muted" style="display:block">'+esc(a.entity)+'</small></span><span class="muted">'+esc(new Date(a.at).toLocaleString("lt-LT"))+'</span></div>').join("")+'</div></section></div>';
}
