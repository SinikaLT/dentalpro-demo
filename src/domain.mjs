// DentalPro 2.0 – grynoji demonstracinė verslo logika, be DOM ir DB priklausomybių.
export const CLINICS=[{id:"akm",name:"Naujoji Akmenė"},{id:"kur",name:"Kuršėnai"}];
export const CHAIRS=[{id:"akm-1",clinicId:"akm",name:"1 kėdė"},{id:"akm-2",clinicId:"akm",name:"2 kėdė"},{id:"kur-1",clinicId:"kur",name:"1 kėdė"},{id:"kur-2",clinicId:"kur",name:"2 kėdė"}];
export const STATUSES=["Registruotas","Patvirtintas","Atvykęs","Atliekamas","Atliktas","Neatvyko","Atšauktas"];
export const PLAN_STATUSES=["Juodraštis","Patvirtintas","Vykdomas","Užbaigtas","Atšauktas"];
export const WEEKDAYS=["Sekmadienis","Pirmadienis","Antradienis","Trečiadienis","Ketvirtadienis","Penktadienis","Šeštadienis"];
export const PERMANENT=[18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28,48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];
export const PRIMARY=[55,54,53,52,51,61,62,63,64,65,85,84,83,82,81,71,72,73,74,75];
export const CONDITIONS=["Sveikas","Ėduonis","Plomba","Vainikėlis","Trūkstamas","Šaknų gydymas","Stebėjimas","Kita"];
export const SURFACES=["Visas dantis","M","D","O/I","V/B","L/P"];
export const uid=(prefix="id")=>prefix+"-"+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,9));
export function isoDate(d=new Date()){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")}
export function shiftDate(value,days){const d=new Date(value+"T12:00:00");d.setDate(d.getDate()+days);return isoDate(d)}
export function validDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||""))return false;const d=new Date(value+"T12:00:00Z");return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===value}
export function weekday(value){return new Date(value+"T12:00:00Z").getUTCDay()}
export function minutes(value){if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value)))return NaN;const [h,m]=value.split(":").map(Number);return h*60+m}
export function timeString(value){return String(Math.floor(value/60)).padStart(2,"0")+":"+String(value%60).padStart(2,"0")}
export function overlaps(s1,e1,s2,e2){return s1<e2&&s2<e1}
export function money(v){return (Number(v)||0).toLocaleString("lt-LT",{style:"currency",currency:"EUR"})}
export function appointmentIssues(state,a){
  const issues=[];
  if(!CLINICS.some(c=>c.id===a.clinicId))issues.push("Pasirinkite kliniką.");
  if(!state.chairs.some(c=>c.id===a.chairId&&c.clinicId===a.clinicId))issues.push("Kėdė nepriklauso pasirinktai klinikai.");
  if(!state.patients.some(p=>p.id===a.patientId&&p.clinicIds?.includes(a.clinicId)))issues.push("Pasirinkite pacientą, priskirtą šiai klinikai.");
  const doctor=state.staff.find(s=>s.id===a.staffId);
  if(!doctor||!doctor.clinicIds?.includes(a.clinicId))issues.push("Gydytojas nedirba pasirinktoje klinikoje.");
  if(!validDate(a.date))issues.push("Neteisinga vizito data.");
  const start=minutes(a.time),length=Number(a.duration),end=start+length;
  if(!Number.isFinite(start)||!Number.isInteger(length)||length<15||length>240||length%15!==0)issues.push("Neteisingas laikas arba trukmė (15–240 min.).");
  if(Number.isFinite(start)&&(start<420||end>1320))issues.push("Vizitas turi tilpti į 07:00–22:00.");
  if(!STATUSES.includes(a.status))issues.push("Neteisinga vizito būsena.");
  if(!state.services.some(s=>s.id===a.serviceId))issues.push("Pasirinkite paslaugą.");
  if(String(a.notes||"").length>3000)issues.push("Vizito pastaba per ilga (iki 3000 simbolių).");
  // Atšauktas vizitas neužima išteklių; istorija išlieka.
  if(issues.length||["Atšauktas","Neatvyko"].includes(a.status))return issues;
  const day=weekday(a.date);
  const windows=(doctor.availability||[]).filter(w=>Number(w.weekday)===day&&w.clinicId===a.clinicId);
  if(!windows.some(w=>start>=minutes(w.start)&&end<=minutes(w.end)))issues.push("Gydytojas tuo metu nedirba pagal grafiką.");
  const breaks=(doctor.breaks||[]).filter(b=>Number(b.weekday)===day&&(!b.clinicId||b.clinicId===a.clinicId));
  if(breaks.some(b=>overlaps(start,end,minutes(b.start),minutes(b.end))))issues.push("Vizitas patenka į gydytojo pertrauką.");
  for(const other of state.appointments){
    if(other.id===a.id||["Atšauktas","Neatvyko"].includes(other.status)||other.date!==a.date)continue;
    const os=minutes(other.time),oe=os+Number(other.duration);
    if(!overlaps(start,end,os,oe))continue;
    if(other.clinicId===a.clinicId&&other.chairId===a.chairId)issues.push("Kėdė jau užimta ("+other.time+").");
    if(other.staffId===a.staffId)issues.push("Gydytojas jau užimtas ("+other.time+").");
    if(other.patientId===a.patientId)issues.push("Pacientas jau turi vizitą tuo metu ("+other.time+").");
  }
  return [...new Set(issues)];
}
export function patientName(state,id){const p=state.patients.find(p=>p.id===id);return p?p.firstName+" "+p.lastName:"—"}
export function doctorName(state,id){return state.staff.find(s=>s.id===id)?.name||"—"}
export function serviceName(state,id){return state.services.find(s=>s.id===id)?.name||"—"}
export function invoiceTotal(invoice){return (invoice.items||[]).reduce((total,item)=>total+Number(item.price||0)*Number(item.qty||1),0)}
export function planTotal(plan){return (plan.items||[]).reduce((total,item)=>total+Number(item.price||0)*Number(item.qty||1),0)}
