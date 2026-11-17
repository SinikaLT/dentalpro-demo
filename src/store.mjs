import {CLINICS,CHAIRS,isoDate,shiftDate,weekday,uid} from "./domain.mjs";
import {mkCatalog} from "./pricelist.mjs";
import {DEFAULT_LAB_WORK} from "./compensation.mjs";

// Nauja, izoliuota sintetinė aplinka: neskaitome ankstesnių asmens įrašų.
export const STORAGE_KEY="dentalpro_v3_synthetic_only";
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
  const legacyServices=[
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
  const services=[...legacyServices.map(s=>({...s,active:false,category:"Ankstesnis demo kainynas"})),...mkCatalog()];
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
    version:3,catalogRevision:"mk-2026-11",demo:true,clinics:JSONclone(CLINICS),chairs:JSONclone(CHAIRS),staff,patients,services,
    appointments:appointmentDefs.map((a,i)=>({
      id:"demo-a-"+i,clinicId:a[0],chairId:a[1],patientId:a[2],staffId:a[3],
      date:day,time:a[4],duration:services.find(s=>s.id===a[5]).duration,serviceId:a[5],status:a[6],notes:""
    })),
    findings:[],clinicalNotes:[],plans:[],invoices:[],forms:[],laboratoryCatalog:JSONclone(DEFAULT_LAB_WORK),audit:[{id:"seed",at:new Date().toISOString(),action:"Sukurti sintetiniai demonstraciniai įrašai",entity:"sistema"}]
  };
}
function parse(storage,key,defaultValue){
  try{const raw=storage?.getItem(key);return raw?JSON.parse(raw):defaultValue}catch{return defaultValue}
}
export function openRepository(storage=globalThis.localStorage){
  let current=parse(storage,STORAGE_KEY,null);
  if(!current||current.version!==3||current.demo!==true||!Array.isArray(current.appointments)||
      !Array.isArray(current.patients)||!current.patients.every(p=>p.synthetic===true)){
    current=seedData();
    try{storage?.setItem(STORAGE_KEY,JSON.stringify(current))}catch{}
  }
  if(!Array.isArray(current.forms)){current.forms=[];try{storage?.setItem(STORAGE_KEY,JSON.stringify(current))}catch{}}
  if(!Array.isArray(current.laboratoryCatalog)){current.laboratoryCatalog=JSONclone(DEFAULT_LAB_WORK);try{storage?.setItem(STORAGE_KEY,JSON.stringify(current))}catch{}}
  // Kainyno naujinimas keičia tik katalogą, o ne jau išsaugotų planų kainas.
  if(current.catalogRevision!=="mk-2026-11"){
    const known=new Set(current.services.map(s=>s.id));
    for(const service of mkCatalog())if(!known.has(service.id))current.services.push(service);
    current.catalogRevision="mk-2026-11";
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
