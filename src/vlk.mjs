// 2026-11-11 VLK informacija: https://ligoniukasa.lrv.lt/lt/veiklos-sritys/informacija-gyventojams/gydymo-ir-sveikatos-prieziuros-paslaugos/odontologines-paslaugos/dantu-protezavimas/dantu-protezavimo-kompensuojamoji-suma/
// Demonstracinė atvejų apskaita: negali tikrinti PSD/EVIS, sutarties ar realaus apmokėjimo.
// Kategoriją ir teisę nustato įgaliotas specialistas pagal galiojančius dokumentus.
import {invoiceCosts,salaryEntitlement,roundEuro} from "./compensation.mjs";
export const VLK_SOURCE_DATE="2026-11-11";
export const VLK_CATEGORIES=[
 {id:"adult-standard",label:"Suaugęs – įprastas protezavimas (atitinkant sąlygas)",kind:"prosthetics",limit:670.39},
 {id:"adult-complex",label:"Suaugęs – sudėtingas protezavimas (atitinkant sąlygas)",kind:"prosthetics",limit:2062.70},
 {id:"child-primary",label:"Vaikas – pieninių dantų standartiniai vainikėliai",kind:"prosthetics",limit:342.13},
 {id:"child-permanent-one",label:"Vaikas – vieno nuolatinio danties protezas",kind:"prosthetics",limit:670.39},
 {id:"child-complex",label:"Vaikas – sudėtingas protezavimas pagal konsiliumą",kind:"prosthetics",limit:2062.70},
 {id:"oncology-standard",label:"Po onkologinio gydymo – įprastas atvejis (pagal sąlygas)",kind:"prosthetics",limit:670.39},
 {id:"oncology-complex",label:"Po onkologinio gydymo – sudėtingas atvejis (pagal sąlygas)",kind:"prosthetics",limit:2062.70},
 {id:"referral-consultation",label:"Gydytojo specialisto konsultacija su siuntimu (pagal sutartį)",kind:"consultation",limit:null}
];
export const VLK_STATUSES=["Planuojamas","Vykdomas","Baigtas","Atmestas"];
export function vlkCategory(id){return VLK_CATEGORIES.find(c=>c.id===id)||null}
export function vlkAmountIssues(categoryId,amount,patientContribution=0){
 const category=vlkCategory(categoryId),n=Number(amount),p=Number(patientContribution),issues=[];
 if(!category){issues.push("Pasirinkite kompensavimo kategoriją.");return issues}
 if(amount===""||amount===null||!Number.isFinite(n)||n<=0||n>100000)issues.push("Faktinė prašoma kompensuoti suma turi būti teigiama.");
 if(category.limit!==null&&Number.isFinite(n)&&n>category.limit+0.001)issues.push("Faktinė kompensacija viršija šios kategorijos ribą.");
 if(patientContribution===""||patientContribution===null||!Number.isFinite(p)||p<0||p>100000)issues.push("Netinkama paciento priemoka.");
 return issues;
}
export function vlkCaseIssues(record,contracts,patients,staff){
 const issues=vlkAmountIssues(record.categoryId,record.claimedAmount,record.patientContribution);
 const category=vlkCategory(record.categoryId);
 if(!patients?.some(p=>p.id===record.patientId&&p.clinicIds?.includes(record.clinicId)))issues.push("Pacientas nepriskirtas klinikai.");
 if(!staff?.some(d=>d.id===record.doctorId&&d.clinicIds?.includes(record.clinicId)))issues.push("Gydytojas nepriskirtas klinikai.");
 const contract=contracts?.[record.clinicId];
 if(!contract?.[category?.kind])issues.push("Klinikai nepažymėta šios PSDF paslaugų rūšies sutartis (demo).");
 if(category?.kind==="consultation"&&!String(record.referralReference||"").trim())issues.push("Konsultacijai nurodykite demonstracinį siuntimo identifikatorių.");
 const pct=Number(record.doctorPercent);
 if(record.doctorPercent===null||!Number.isFinite(pct)||pct<0||pct>100)issues.push("Netinkamas gydytojo procentas.");
 return issues;
}
export function vlkCaseEarning(record){
 if(record?.status!=="Baigtas"||!record.completedAt||record.claimedAmount==null)return 0;
 if(vlkAmountIssues(record.categoryId,record.claimedAmount,record.patientContribution).length)return 0;
 // Kompensuojamoji suma nėra lygi jos ribai; atlygis tik nuo įrašytos faktinės sumos.
 return salaryEntitlement(Number(record.claimedAmount),invoiceCosts(record),record.doctorPercent);
}
export function vlkSalaryRows(cases,month="",clinicId="all"){
 return (cases||[]).filter(c=>c.status==="Baigtas"&&c.completedAt&&
  (!month||String(c.completedAt).startsWith(month))&&(clinicId==="all"||c.clinicId===clinicId))
  .map(c=>({id:c.id,caseNumber:c.caseNumber,doctorId:c.doctorId,clinicId:c.clinicId,
   date:c.completedAt.slice(0,10),categoryId:c.categoryId,claimedAmount:Number(c.claimedAmount),
   patientContribution:Number(c.patientContribution||0),costs:invoiceCosts(c),
   doctorPercent:Number(c.doctorPercent),earning:vlkCaseEarning(c)}));
}
export function vlkSalaryTotal(cases,month="",clinicId="all"){
 return roundEuro(vlkSalaryRows(cases,month,clinicId).reduce((sum,row)=>sum+row.earning,0));
}
