import {CLINICS,CHAIRS,isoDate,shiftDate,weekday,uid} from "./domain.mjs";

export const STORAGE_KEY="dentalpro_v2_demo";
export const LEGACY_NAMES=[
["Jonas Kazlauskas","Ona Petrauskienė","Mantas Jankauskas","Rūta Stankevičienė","Vytautas Žukauskas","Aistė Balčiūnaitė","Darius Vaitkus","Ieva Paulauskaitė","Tomas Butkus","Emilija Šimkutė"],
["Antanas Rimkus","Birutė Norkienė","Lukas Kavaliauskas","Gabija Urbonaitė","Povilas Žilinskas","Monika Kairytė","Arūnas Mikalauskas","Greta Mockutė","Saulius Navickas","Agnė Jurevičiūtė"]
];
const JSONclone=x=>JSON.parse(JSON.stringify(x));
export function defaultAvailability(clinicId){
  return [1,2,3,4,5].map(weekday=>({clinicId,weekday,start:"08:00",end:"18:00"}));
}
export function defaultBreaks(clinicId){
  return [1,2,3,4,5].map(weekday=>({clinicId,weekday,start:"12:00",end:"12:30"}));
}
export function seedData(today=isoDate()){
  const patients=LEGACY_NAMES.flatMap((names,c)=>names.map((name,i)=>({
    id:"p-"+c+"-"+i,firstName:name.split(" ")[0],lastName:name.split(" ").slice(1).join(" "),
    clinicIds:[CLINICS[c].id],birthDate:"",phone:"",email:"",alerts:"",createdAt:today,synthetic:true
  })));
  const staff=[
    {id:"dr-akm-1",name:"Dr. Eglė Mockienė",role:"Gydytojas odontologas",clinicIds:["akm"],availability:defaultAvailability("akm"),breaks:defaultBreaks("akm")},
    {id:"dr-akm-2",name:"Dr. Saulius Pocius",role:"Gydytojas odontologas",clinicIds:["akm"],availability:defaultAvailability("akm"),breaks:defaultBreaks("akm")},
    {id:"dr-kur-1",name:"Dr. Lina Daunoravičienė",role:"Gydytojas odontologas",clinicIds:["kur"],availability:defaultAvailability("kur"),breaks:defaultBreaks("kur")},
    {id:"dr-kur-2",name:"Dr. Tomas Jurkus",role:"Gydytojas odontologas",clinicIds:["kur"],availability:defaultAvailability("kur"),breaks:defaultBreaks("kur")}
  ];
  const services=[
    {id:"s-cons",name:"Konsultacija",duration:30,price:35,category:"Diagnostika",active:true},
    {id:"s-hyg",name:"Profesionali burnos higiena",duration:60,price:65,category:"Profilaktika",active:true},
    {id:"s-fill",name:"Danties plombavimas",duration:60,price:85,category:"Terapija",active:true},
    {id:"s-endo",name:"Šaknų kanalų gydymas",duration:90,price:145,category:"Endodontija",active:true},
    {id:"s-prost",name:"Protezavimo konsultacija",duration:45,price:40,category:"Protezavimas",active:true},
    {id:"s-check",name:"Kontrolinis vizitas",duration:30,price:20,category:"Profilaktika",active:true},
    {id:"s-vlk",name:"Konsultacija su siuntimu",duration:30,price:0,category:"VLK (demo)",active:true},
    {id:"s-prosta",name:"Dantų protezavimas – suaugusieji",duration:90,price:200,category:"Protezavimas",active:true},
    {id:"s-prostc",name:"Dantų protezavimas – vaikai",duration:60,price:120,category:"Protezavimas",active:true}
  ];
  let day=today;
  for(let i=0;i<7&&(weekday(day)===0||weekday(day)===6);i++)day=shiftDate(day,1);
  const appointmentDefs=[
    ["akm","akm-1","p-0-0","dr-akm-1","09:00","s-cons","Patvirtintas"],
    ["akm","akm-2","p-0-1","dr-akm-2","09:30","s-hyg","Atvykęs"],
    ["akm","akm-1","p-0-2","dr-akm-1","10:00","s-fill","Registruotas"],
    ["kur","kur-1","p-1-0","dr-kur-1","09:00","s-cons","Patvirtintas"],
    ["kur","kur-2","p-1-1","dr-kur-2","11:00","s-prost","Registruotas"]
  ];
  return {
    version:2,demo:true,clinics:JSONclone(CLINICS),chairs:JSONclone(CHAIRS),staff,patients,services,
    appointments:appointmentDefs.map((a,i)=>({
      id:"demo-a-"+i,clinicId:a[0],chairId:a[1],patientId:a[2],staffId:a[3],
      date:day,time:a[4],duration:services.find(s=>s.id===a[5]).duration,serviceId:a[5],status:a[6],notes:""
    })),
    findings:[],clinicalNotes:[],plans:[],invoices:[],audit:[{id:"seed",at:new Date().toISOString(),action:"Sukurti sintetiniai demonstraciniai įrašai",entity:"sistema"}]
  };
}
function parse(storage,key,defaultValue){
  try{const raw=storage?.getItem(key);return raw?JSON.parse(raw):defaultValue}catch{return defaultValue}
}
function legacyMigration(state,storage){
  const oldPatients=parse(storage,"dentalpro_demo",{});
  for(let c=0;c<2;c++){
    const clinicId=CLINICS[c].id;
    const oldDocs=parse(storage,"dentalpro_doctors_"+c,[]);
    for(const name of (Array.isArray(oldDocs)?oldDocs:[]))ensureDoctor(state,name,clinicId);
    for(let i=0;i<LEGACY_NAMES[c].length;i++){
      const p=state.patients.find(p=>p.id==="p-"+c+"-"+i);
      const record=oldPatients?.[c+"-"+i];
      if(!record||!p)continue;
      for(const [tooth,value] of Object.entries(record.teeth||{})){
        if(!value||typeof value!=="object")continue;
        state.findings.push({id:uid("legacy-tooth"),patientId:p.id,toothNumber:Number(tooth),
          surfaces:[String(value.surface||"Visas dantis")],condition:String(value.diagnosis||"Stebėjimas"),
          note:String(value.treatment||""),status:"Stebima",updatedAt:new Date().toISOString()});
      }
      for(const visit of record.visits||[]){
        state.clinicalNotes.push({id:uid("legacy-note"),patientId:p.id,appointmentId:"",
          authorId:"",date:String(visit.date||isoDate()),text:String(visit.text||""),createdAt:new Date().toISOString()});
      }
      if(record.plans?.length){
        state.plans.push({id:uid("legacy-plan"),patientId:p.id,clinicId,status:"Juodraštis",title:"Perkeltas ankstesnis planas",
          items:record.plans.map(t=>({id:uid("legacy-item"),serviceId:"",description:String(t),tooth:"",qty:1,price:0,done:false}))});
      }
    }
  }
  const oldAppts=parse(storage,"dentalpro_calendar_v1",[]);
  if(Array.isArray(oldAppts))for(const item of oldAppts){
    const c=Number(item.clinic)===1?1:0,clinicId=CLINICS[c].id;
    const existing=state.patients.find(p=>p.clinicIds.includes(clinicId)&&p.firstName+" "+p.lastName===item.patient);
    if(!existing)continue;
    const doctorId=ensureDoctor(state,String(item.doctor||"Demonstracinis gydytojas"),clinicId);
    const service=state.services.find(s=>s.name===item.service)||state.services[0];
    const chair=String(item.chair||item.room||"").startsWith("2")?clinicId+"-2":clinicId+"-1";
    state.appointments.push({id:"old-"+String(item.id||uid("a")),clinicId,chairId:chair,patientId:existing.id,
      staffId:doctorId,date:String(item.date||isoDate()),time:String(item.time||"09:00"),
      duration:Number(item.duration)||service.duration,serviceId:service.id,
      status:String(item.status||"Registruotas"),notes:String(item.notes||"")});
  }
  state.audit.push({id:uid("audit"),at:new Date().toISOString(),action:"Perkelti seni vietiniai demo duomenys (jei buvo)",entity:"sistema"});
  return state;
}
function ensureDoctor(state,name,clinicId){
  const clean=String(name||"").trim();
  if(!clean)return "";
  let doc=state.staff.find(s=>s.name.toLocaleLowerCase("lt")===clean.toLocaleLowerCase("lt")&&s.clinicIds.includes(clinicId));
  if(doc)return doc.id;
  doc={id:uid("dr"),name:clean,role:"Gydytojas odontologas",clinicIds:[clinicId],
       availability:defaultAvailability(clinicId),breaks:defaultBreaks(clinicId)};
  state.staff.push(doc);return doc.id;
}
export function openRepository(storage=globalThis.localStorage){
  let current=parse(storage,STORAGE_KEY,null);
  if(!current||current.version!==2||!Array.isArray(current.appointments)){
    current=legacyMigration(seedData(),storage);
    try{storage?.setItem(STORAGE_KEY,JSON.stringify(current))}catch{}
  }
  const persist=()=>{try{storage?.setItem(STORAGE_KEY,JSON.stringify(current));return true}catch{return false}};
  return {
    get(){return JSONclone(current)},
    transaction(action,entity,update){
      const copy=JSONclone(current);
      const result=update(copy);
      copy.audit.unshift({id:uid("audit"),at:new Date().toISOString(),action,entity:String(entity||"")});
      copy.audit=copy.audit.slice(0,250);
      current=copy;persist();return result;
    },
    reset(){current=seedData();persist();return this.get()},
    export(){return JSON.stringify(current,null,2)},
    storageAvailable(){try{const k="__dentalpro_probe";storage?.setItem(k,"1");storage?.removeItem(k);return true}catch{return false}}
  };
}
