# DentalPro 2.0 – produkto specifikacija (v0.1)

Statusas: projektavimo pradžia. Funkcinis etalonas: CareStack, tačiau DentalPro dizainas ir kodas originalūs. Testavimas tik su sintetiniais duomenimis.

## Pagrindiniai naudotojų keliai
1. Registratorė atidaro dienos tvarkaraštį, filtruoja kliniką, gydytoją ir kabinetą.
2. Paspaudžia laisvą laiką → renkasi esamą pacientą arba kuria naują → nurodo paslaugą, trukmę, gydytoją, kabinetą, pastabas → išsaugo.
3. Sistema tikrina gydytojo ir kabineto užimtumą, darbo valandas ir pertraukas. Konfliktą rodo prieš išsaugant.
4. Registratorė perkelia vizitą į kitą laiką / gydytoją, keičia trukmę, būseną (registruotas, patvirtintas, atvykęs, atliekamas, atliktas, neatvyko, atšauktas).
5. Paspaudus vizitą atidaroma paciento kortelė, iš jos – odontograma, gydymo planas, apsilankymų istorija.
6. Gydytojas per vizitą fiksuoja klinikinius įrašus, dantų būkles ir procedūras.

## Tvarkaraščio ekranai
- Diena: laiko ašis ir gydytojų/kabinetų stulpeliai.
- Savaitė: laiko ašis, dienų stulpeliai, pasirenkamas gydytojas.
- Mėnuo: kompaktiški vizitų įvykiai, perėjimas į dieną.
- Sąrašas: šiandienos pacientai, jų atvykimo ir vizito būsenos.
- Veiksmai: paspaudimas, dvigubas paspaudimas, tempimas ir trukmės keitimas; klaviatūra ir mobilus naudojimas.
- Filtrai: klinika, gydytojas, kabinetas, paslauga, būsena.
- Kelių klinikų atskyrimas ir bendras autorizuotas peržiūros režimas.

## Duomenų objektai (projektuojamos sąsajos)
Clinic(id,name), Staff(id,name,role,clinicIds), Room(id,clinicId,name),
Patient(id,demographics,contacts), Appointment(id,clinicId,patientId,staffId,roomId,start,end,serviceId,status,notes),
Service(id,name,duration,price), Availability(staffId,clinicId,weekday,start,end), Break(staffId,start,end),
ClinicalNote(id,patientId,appointmentId,authorId,createdAt,text),
ToothFinding(id,patientId,toothNumber,surfaces,condition,status),
TreatmentPlan(id,patientId,status,items), AuditEvent(id,actorId,action,entityId,timestamp).

## Pirmosios realizacijos priėmimo kriterijai
- [ ] Diena / savaitė / mėnuo / sąrašas be puslapio perkrovimo.
- [ ] Vizito sukūrimas, atidarymas, redagavimas, perkėlimas, trukmės keitimas.
- [ ] Konfliktų tikrinimas pagal gydytoją ir kabinetą.
- [ ] Vizitų susiejimas su paciento kortele.
- [ ] Klinikos ir gydytojo filtrai išsaugomi perjungiant rodinius.
- [ ] Lietuviška sąsaja, datų ir laiko formatas.
- [ ] Automatiniai testai: vizito persidengimas, pertrauka, skirtingos klinikos, atšaukimas, datos ribos.
- [ ] Jokių tikrų pacientų duomenų demonstracinėje aplinkoje.

## Neįtraukta į pirmąją realizaciją
Tikras prisijungimas, sinchronizacija tarp įrenginių, SMS, mokėjimai, e. receptai, VLK integracijos. Jiems reikės serverio, duomenų bazės, saugumo ir atitikties patikros.

## Techninė pastaba
Dabartinis index.html yra demonstracija su localStorage. Jis laikomas veikiančia pradine versija; naujos funkcijos turi būti kuriamos su aiškiai atskirta duomenų prieigos sąsaja, kad vėliau būtų galima pakeisti localStorage į API be visos UI perrašymo.

## Etalono šaltiniai
- https://carestack.com/dental-software/features/scheduling
- https://carestack.com/dental-software/features/charting
- https://carestack.com/en-GB/dental-software/faq
