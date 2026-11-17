# DentalPro 2.0 – administratorės darbo eiga (DEMO)

Atnaujinta 2026-11-17. Ši instrukcija taikoma tik demonstracijai su sintetiniais pacientais ir išgalvotais finansiniais įrašais.

## 1. Registratūros pradinis ekranas

Atidarius sistemą matoma **Registratūros darbo vieta**: dienos vizitų sąrašas ir būsenos, pasirašytų registracijos dokumentų dalis, rankinės užduotys, laukiančiųjų sąrašas, gauti / vėluojantys laboratorijos užsakymai ir neapmokėtos sąskaitos. Kiekvienas vizitas turi nuorodas į paciento kortelę, dokumentus bei atsiskaitymą.

**Priminimai** – atskiras rytojaus vizitų sąrašas. „Priminta telefonu“ pažymima tik po tikro pokalbio už sistemos ribų. Demo nesiunčia SMS / el. pašto ir netikrina pristatymo.

## 2. Paciento paieška ir registracija

„Pacientai“ paieška ieško pagal vardą, pavardę, telefono skaitmenis ir el. paštą. Registruojant kitą pacientą su tokiu pat telefonu arba vardo / pavardės ir gimimo datos deriniu, rodoma galimo dublikato patikra. Tai tik pagalbinis tikrinimas, ne asmens tapatybės patvirtinimas.

„Registracijos kalendorius“ → naujas vizitas: klinika → pacientas → gydytojas → paslauga → data / laikas → kėdė. Jei pacientas naujas, galima atidaryti jo kūrimą tiesiai iš vizito formos ir po išsaugojimo grįžti į registraciją. „Rasti laisvą laiką“ siūlo tinkamą laiką ir kėdę pagal gydytojo darbo laiką, pertraukas ir esamus vizitus (21 dienos paieška). Visada peržiūrėkite siūlomą laiką prieš išsaugodami.

„Laukiančiųjų sąrašas“ – registratūra suveda pageidavimą ir pasirinktą gydytoją. „Registruoti“ atveria vizito formą; sėkmingai išsaugojus vizitą, laukiančiojo būsena pakeičiama „Užregistruotas“.

## 3. Paciento dokumentai

Paciento kortelėje rodoma, ar yra pasirašyta demonstracinė sutartis, BDAR informavimas ir sveikatos anketa. Sveikatos anketą galima pažymėti „Reikia peržiūrėti“ – pasirašius naują anketą ši žyma nuimama. Invazinis sutikimas reikalingas atitinkamai procedūrai, **ne kiekvienai registracijai**. Gydymo plano procedūroje atidaroma forma išsaugo plano ir procedūros identifikatorius. Dokumentai pasirašomi tik demonstraciniu pieštu parašu; nėra tapatybės patvirtinimo ar kvalifikuoto e. parašo.

## 4. Gydymo planai ir laboratorijos

Gydymo plano eilutė turi etapą, datą, procedūrą, kainą ir „Atlikta“ žymą. Administratorei yra mygtukai „Kitas vizitas“ ir „Sąskaita“, kurie perkelia pasirinktą pacientą, o sąskaitos formoje – ir numatytą paslaugą / kainą.

„Laboratorijų užsakymai“ registruoja paciento ir gydymo plano sąsają, laboratoriją, aprašymą, savikainą, išsiuntimo ir planuojamo gavimo datą. Būsenos: „Užsakyta“, „Gaminama“, „Gauta“, „Atiduota“, „Atšaukta“. Darbų gavimas žymimas ranka, laboratorijos nėra sujungtos su šiuo moduliu. Kiekvienai gydymo sesijai reikia patikrinti, ar laboratorinis darbas gautas.

## 5. Finansai

Finansų vaizdas suskaidytas į keturias darbo sritis: **Pacientų atsiskaitymai**, **Avansai ir grąžinimai**, **Laukiantys mokėjimai**, **Dienos kasa**. Mokėjimai registruojami ranka (grynieji numatyta parinktis). Pavedimas visada pirmiausia laukiamas, patvirtinamas pagal banko išrašą; kortelė – pagal atskirą terminalo kvitą. Ši programa nėra kasa, terminalas ar bankas.

Skolos skaičiuojamos pagal patvirtintas įmokas, atėmus grąžinimus. Grąžinimas nepradeda „trinti“ patvirtinto įrašo. Avansas tampa sąskaitos apmokėjimu tik po priskyrimo, tačiau nėra pakartotinė kasos įplauka. „Dienos kasa“ rodo grynuosius, korteles, pavedimus ir administraciškai užbaigtus VLK atvejus **atskirai**; VLK suma nėra faktiškai gautas pinigų pervedimas. Galima atlikti rankinį dienos suderinimą ir eksportuoti CSV.

## 6. Klaidų atpažinimas ir apribojimai

Jei naršyklės saugykla neleidžia išsaugoti pakeitimo, operacija atmetama, ankstesnė saugoma būsena paliekama, rodomas perspėjimas. Vis dėlto tai nėra patikima serverinė duomenų bazė, saugus auditas ar duomenų atsarginė kopija. Viešoje demonstracijoje nėra prisijungimų ir atlyginimų duomenų prieigos apsaugos. Jokie tikri pacientai, klinikiniai dokumentai, atlyginimai ar finansiniai mokėjimai čia neregistruojami.

## 7. Priėmimo testai prieš realios versijos kūrimą

1. Į registratūrą skambina esamas pacientas – surandamas pagal telefoną, siūlomas laikas, išsaugomas vizitas.
2. Naujas pacientas kuriamas nepaliekant vizito formos. Bandoma sukurti dublikatą – rodomas perspėjimas.
3. Rytojaus pacientui trūksta sveikatos anketos – rodoma peržiūros žyma ir užduotis.
4. Protezavimo planui sukuriami etapai, laboratorijos užsakymas, gaunamas darbas, registruojamas kitas vizitas.
5. Iš vizito / plano sukuriama sąskaita ir registruojamas dalinis mokėjimas grynaisiais, kortele, pavedimu.
6. Pavedimas laukia – nesumažina skolos; patvirtinimas pagal išrašą ją sumažina.
7. Avansas panaudojamas vienoje sąskaitoje – į dienos kasą įrašomas tik pradinio gavimo metu.
8. Grąžinimas rodomas nauju įrašu ir neigiamu atlygio perskaičiavimu.
9. Dienos suvestinė atskirai rodo grynuosius, korteles, pavedimus ir VLK; vykdomi VLK atvejai į VLK baigtų atvejų suvestinę nepatenka.
10. Bandant išsaugoti užpildytoje / užblokuotoje naršyklės saugykloje, vartotojui pateikiama aiški klaida, o ankstesnis įrašas išlieka.
11. Tik realios serverinės versijos bandymuose turi būti patvirtinta, kad administratoriui ir gydytojui nepasiekiama savininko atlygio ataskaita net tiesiogiai kviečiant API.

