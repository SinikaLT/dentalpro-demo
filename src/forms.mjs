// Teisinių formų struktūra: išgalvotų duomenų demonstracija, ne kvalifikuotas e. parašas.
// Pagal Pacientų teisių įstatymo 12, 15–17 str. ir SAM V-184 formos reikalavimus.
export const FORM_VERSION="2026-11-17-demo-1";
export const FORM_TYPES=[
 {id:"agreement",name:"Paciento aptarnavimo sutartis ir vidaus taisyklės",short:"Paciento sutartis"},
 {id:"privacy",name:"Informavimas apie duomenų tvarkymą (BDAR)",short:"BDAR informavimas"},
 {id:"health",name:"Asmens sveikatos anketa",short:"Sveikatos anketa"},
 {id:"invasive",name:"Informuotas sutikimas dėl invazinės procedūros",short:"Invazinis sutikimas"}
];
export const HEALTH_QUESTIONS=[
 ["allergies","Ar turite alergijų vaistams, lateksui ar kitoms medžiagoms?"],
 ["medicines","Ar nuolat vartojate vaistus (ypač kraują skystinančius)?"],
 ["heart","Ar turite širdies, kraujagyslių ligų arba padidėjusį kraujospūdį?"],
 ["diabetes","Ar sergate cukriniu diabetu?"],
 ["bleeding","Ar yra kraujavimo, krešėjimo sutrikimų?"],
 ["infection","Ar sergate infekcine liga, svarbia gydymo saugumui?"],
 ["pregnancy","Ar esate nėščia arba maitinate krūtimi (jei taikoma)?"],
 ["anesthesia","Ar anksčiau pasireiškė nepageidaujamų reakcijų į nuskausminimą?"],
 ["surgeries","Ar turėjote rimtų operacijų, sveikatos būklių, svarbių odontologijai?"]
];
export function requiredFields(type){
 switch(type){
 case "agreement":return ["rules","fees","representative"];
 case "privacy":return ["notice","controller","contact","representative"];
 case "health":return ["representative",...HEALTH_QUESTIONS.map(([id])=>"q_"+id)];
 case "invasive":return ["representative","procedure","purpose","alternatives","risksCommon","risksRare","risksIndividual","anesthesia","anesthesiaRisks","refusalRisks","scope","clinician","decision"];
 default:return [];
 }
}
export function validateForm(type,answers,signature){
 if(!FORM_TYPES.some(f=>f.id===type))return ["Nežinomas dokumento tipas."];
 const issues=[];
 for(const field of requiredFields(type))if(!String(answers?.[field]??"").trim())issues.push("Neužpildytas laukas: "+field);
 if(type==="health")for(const [name] of HEALTH_QUESTIONS)if(!["Taip","Ne","Nežinau"].includes(answers?.["q_"+name]))issues.push("Neteisingas atsakymas: "+name);
 if(type==="invasive"&&!["Sutinku","Atsisakau"].includes(answers?.decision))issues.push("Pasirinkite sutikimą ar atsisakymą.");
 if(type==="invasive"&&answers?.decision==="Sutinku"&&!String(answers?.procedure).trim())issues.push("Nurodykite konkrečią procedūrą.");
 if(!signature||typeof signature!=="string"||!signature.startsWith("data:image/png;base64,")||signature.length<150)issues.push("Reikia paciento / atstovo ranka nupiešto demonstracinio parašo.");
 return [...new Set(issues)];
}
export function statusOfForm(record){return record?.signedAt?"Pasirašyta (demo)":"Nepasirašyta"}
