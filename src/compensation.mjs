import {paymentEvents} from "./payments.mjs";
// Tik sintetinė demonstracinė darbo užmokesčio apskaita.
// Realioje sistemoje būtina serverinė prieigos kontrolė (owner role), audit trail ir DB.
export const DEFAULT_LAB_WORK=[
  {id:"lab-1",laboratory:"Demonstracinė laboratorija A",name:"Cirkonio monolitinis vainikėlis",price:95,active:true,demo:true},
  {id:"lab-2",laboratory:"Demonstracinė laboratorija A",name:"Metalo keramikos vainikėlis",price:75,active:true,demo:true},
  {id:"lab-3",laboratory:"Demonstracinė laboratorija B",name:"E-MAX vainikėlis",price:110,active:true,demo:true},
  {id:"lab-4",laboratory:"Demonstracinė laboratorija B",name:"Laikinas vainikėlis",price:25,active:true,demo:true},
  {id:"lab-5",laboratory:"Demonstracinė laboratorija B",name:"Pilna išimama plokštelė",price:140,active:true,demo:true}
];
export const STANDARD_MATERIALS_FEE=5;
export const SURGICAL_MATERIALS_FEE=20;
export const DEFAULT_USAGE_FEES={materials:STANDARD_MATERIALS_FEE,surgicalMaterials:SURGICAL_MATERIALS_FEE};
export function validUsageFee(value){return value!==''&&value!==null&&value!==undefined&&Number.isFinite(Number(value))&&Number(value)>=0&&Number(value)<=1000;}
export function usageFeeSnapshot(checked,configured=DEFAULT_USAGE_FEES){return {
 materials:checked?.materials===true, surgicalMaterials:checked?.surgicalMaterials===true,
 materialsFee:validUsageFee(configured?.materials)?roundEuro(Number(configured.materials)):STANDARD_MATERIALS_FEE,
 surgicalMaterialsFee:validUsageFee(configured?.surgicalMaterials)?roundEuro(Number(configured.surgicalMaterials)):SURGICAL_MATERIALS_FEE
};}
export const roundEuro=value=>Math.round((Number(value)+Number.EPSILON)*100)/100;
export function validCost(name,price,quantity=1){
 return !!String(name||"").trim()&&String(name).length<=160&&Number.isFinite(Number(price))&&
 Number(price)>=0&&Number(price)<=100000&&Number.isInteger(Number(quantity))&&Number(quantity)>=1&&Number(quantity)<=100;
}
export function invoiceCosts(invoice){
 const costs=invoice?.costs||{};
 const total=rows=>(rows||[]).reduce((sum,x)=>sum+Number(x.price||0)*Number(x.qty||1),0);
 const standard=invoice?.usage?.materials===true?(validUsageFee(invoice.usage.materialsFee)?Number(invoice.usage.materialsFee):STANDARD_MATERIALS_FEE):0;
 const surgical=invoice?.usage?.surgicalMaterials===true?(validUsageFee(invoice.usage.surgicalMaterialsFee)?Number(invoice.usage.surgicalMaterialsFee):SURGICAL_MATERIALS_FEE):0;
 return {lab:roundEuro(total(costs.laboratory)),materials:roundEuro(total(costs.materials)),standard,surgical};
}
export function salaryEntitlement(received,costs,percentage){
 const paid=Math.max(0,Number(received)||0);
 const rate=Number(percentage);
 if(!Number.isFinite(rate)||rate<0||rate>100)return 0;
 return roundEuro(Math.max(0,paid-Number(costs.lab||0)-Number(costs.materials||0)-Number(costs.standard||0)-Number(costs.surgical||0))*rate/100);
}
/** Apskaita pagal faktines demonstracines įmokas, o ne sąskaitos datą.
 * Savikaina išskaitoma iš pirmųjų įmokų; kol jos nepadengtos, atlygis 0.
 * Nuo kiekvienos įmokos atlygis = naujo kumuliacinio atlygio ir seno skirtumas.
 * Procentas užfiksuojamas sukuriant sąskaitą ir vėliau nekinta.
 */
export function salaryAccruals(invoices){
 const rows=[];
 for(const invoice of invoices||[]){
   if(!invoice.doctorId||!Number.isFinite(Number(invoice.doctorPercent)))continue;
   const total=(invoice.items||[]).reduce((sum,x)=>sum+Number(x.price||0)*Number(x.qty||1),0);
   const costs=invoiceCosts(invoice);
   let received=0,earned=0;
   for(const payment of paymentEvents(invoice)){
     const amount=Number(payment.amount);
     received=Math.min(Math.max(0,total),Math.max(0,roundEuro(received+amount)));
     const next=salaryEntitlement(received,costs,invoice.doctorPercent);
     const payout=roundEuro(next-earned);
     earned=next;
     rows.push({id:payment.id,invoiceId:invoice.id,invoiceNumber:invoice.number,date:payment.date,paymentKind:payment.kind,
       clinicId:invoice.clinicId,patientId:invoice.patientId,doctorId:invoice.doctorId,
       doctorPercent:Number(invoice.doctorPercent),paymentAmount:amount,receivedToDate:received,
       lab:costs.lab,materials:costs.materials,standard:costs.standard,surgical:costs.surgical,earning:payout,earningToDate:earned,
       service:(invoice.items||[]).map(x=>x.description).join(", ")});
   }
 }
 return rows.sort((a,b)=>a.date.localeCompare(b.date)||String(a.invoiceNumber).localeCompare(String(b.invoiceNumber)));
}
export function salarySummary(invoices,month="",clinicId="all"){
 const rows=salaryAccruals(invoices).filter(r=>(!month||r.date.startsWith(month))&&(clinicId==="all"||r.clinicId===clinicId));
 const doctors=new Map();
 for(const row of rows){
   const curr=doctors.get(row.doctorId)||{doctorId:row.doctorId,received:0,earning:0,payments:0};
   curr.received=roundEuro(curr.received+row.paymentAmount);
   curr.earning=roundEuro(curr.earning+row.earning);
   curr.payments++;doctors.set(row.doctorId,curr);
 }
 return {rows,doctors:[...doctors.values()],total:roundEuro(rows.reduce((n,r)=>n+r.earning,0))};
}
export function parseLaboratoryCsv(csv){
 const text=String(csv||"").replace(/^\uFEFF/,"");
 const delimiter=text.split(/\r?\n/,1)[0].includes(";")?";":",";
 const records=[];let field="",row=[],quoted=false;
 for(let i=0;i<text.length;i++){
   const c=text[i];
   if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;continue}
   if(c===delimiter&&!quoted){row.push(field.trim());field="";continue}
   if((c==="\n"||c==="\r")&&!quoted){if(c==="\r"&&text[i+1]==="\n")i++;row.push(field.trim());if(row.some(Boolean))records.push(row);row=[];field="";continue}
   field+=c;
 }
 if(quoted)throw Error("Neuždarytos CSV kabutės.");
 row.push(field.trim());if(row.some(Boolean))records.push(row);
 if(!records.length)return [];
 const headers=records[0].map(h=>h.toLocaleLowerCase("lt-LT").trim());
 const find=(list)=>headers.findIndex(h=>list.includes(h));
 const labCol=find(["laboratorija","laboratory"]);
 const nameCol=find(["darbas","paslauga","pavadinimas","work","name"]);
 const priceCol=find(["kaina","kaina (€)","price","savikaina"]);
 if(nameCol<0||priceCol<0)throw Error("CSV būtini stulpeliai: Darbas ir Kaina (taip pat galima Laboratorija).");
 return records.slice(1).map(row=>{
   const name=row[nameCol]||"",raw=(row[priceCol]||"").replace(/\s/g,"").replace(",",".");
   const price=Number(raw);
   if(!validCost(name,price))throw Error("Neteisingas laboratorijos darbas ar kaina: "+name);
   return {laboratory:(labCol>=0&&row[labCol])||"Importuota laboratorija",name,price,active:true,demo:true};
 });
}
