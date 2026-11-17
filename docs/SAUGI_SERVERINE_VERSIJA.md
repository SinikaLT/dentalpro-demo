# DentalPro 2.0 – serverinės versijos ir vaidmenų architektūra

Šis dokumentas yra **įgyvendinimo specifikacija, NE veikianti autentifikacija**. Dabartinė GitHub Pages versija yra vieša demonstracija su sintetiniais duomenimis. Ji negali užtikrinti tik savininkui prieinamos finansų / atlyginimų informacijos, prieigos žurnalų ir duomenų integralumo.

## Tikslinės rolės ir prieiga

| Duomenys / veiksmas | Klinikos savininkas | Administratorė | Gydytojas |
|---|---|---|---|
| Pacientų registravimas, vizitų grafikas | Taip | Taip, priskirtoje klinikoje | Skaityti savo vizitus |
| Paciento kontaktai / dokumentų būsena | Taip, pagal poreikį | Taip, savo klinikoje | Taip, savo pacientams |
| Medicininės pastabos ir anamnezė | Pagal teisėtą poreikį | Tik administravimo duomenų dalis | Pagal gydymo santykį |
| Gydymo planai | Skaityti | Būsena, terminai, vizitų planavimas | Klinikinis turinys |
| Laboratorijų užsakymai / įkainiai | Taip | Įrašyti užsakymą ir savikainą, be darbo užmokesčio duomenų | Su savo pacientų gydymu susiję užsakymai |
| Paciento sąskaitos ir mokėjimai | Taip | Registruoti / suderinti | Tik pagal poreikį, ne visi mokėjimai |
| Dienos kasos ataskaita | Taip | Savo klinikoje | Ne |
| Gydytojų atlygio procentai, ataskaitos | **Tik savininkas** | **Ne** | **Ne** |
| Audito peržiūra, prieigos suteikimas | Tik savininkas / įgaliotas administratorius | Ne | Ne |

Vaidmenys negali būti įgyvendinami vien paslepiant meniu: serveris PRIVALO kiekviename API endpoint'e patikrinti prisijungusį asmenį, rolę, leidžiamas klinikas ir konkretaus paciento / darbo santykį. Neautorizuotam naudotojui negrąžinami net paslėpti atlyginimai API duomenyse. Duomenis reikėtų atskirti klinikos ir organizacijos ribomis (tenantId, clinicId) kiekvienoje užklausoje.

## Rekomenduojami komponentai

- HTTPS frontend, atskiras autentifikuotas API ir PostgreSQL (ar kita tinkama transakcinė DB) su atsarginėmis kopijomis. Pasirinkti atitinkamą ES/EEE duomenų tvarkymo regioną ir duomenų tvarkymo sutartis.
- Autentifikavimo paslaugos / savo serverio sesijos su MFA, trumpalaikiais prisijungimais, sesijų atšaukimu, prisijungimo bandymų ribojimu ir saugiais cookie. Slaptažodžių, sesijų žetonų ir API raktų nelaikyti vietinėje naršyklės demo saugykloje.
- Minimalios teisės pagal pareigas; gydytojai mato tik savo pacientų medicininę informaciją, kai tai pagrįsta.
- Pacientų, vizitų, dokumentų, planų, laboratorijų, sąskaitų, mokėjimų, VLK atvejų ir užduočių duomenų lentelės. Visi susiejimai per užsienio raktus; jokio finansinio įrašo be susieto paciento / klinikos.
- Finansiniams skaičiavimams naudoti tikslius centus (INTEGER) arba DECIMAL, o ne JavaScript slankiojo kablelio aritmetiką. Mokėjimas, grąžinimas ir avanso priskyrimas turi būti atominių DB transakcijų dalis.
- Neleidžiama ištrinti patvirtintų mokėjimų. Taisyti tik nauju atvirkštiniu įrašu, su identifikatoriumi, priežastimi, patvirtinusiu naudotoju ir laikais. Dvigubus integracijų įvykius valdyti idempotency key.
- Kiekvienas finansinis / medicininis pakeitimas kuria serverinį audito įvykį: actorId, role, tenantId, clinicId, entity, operacija, UTC laikas, senos / naujos leidžiamos reikšmės (be nereikalingų sveikatos detalių), priežastis. Audito įrašų neleidžiama taisyti klientui. Įrašų apsaugą ir saugojimo terminus nustatyti teisiškai pagrįstai.
- Klinikinių įrašų tvarkymui: versijų ir autorių atsekamumas, atsakingo specialisto patvirtinimas, prieigos pagal būtinumą, laikymo terminai, incidentų valdymas, atsarginės kopijos ir periodinės atkūrimo pratybos.

## Minimalūs API kontraktai (tik spec.)

`GET /api/me` – dabartinis naudotojas ir leidžiamos klinikos.

`GET /api/reception?clinicId&date` – tik patikrintos klinikos administracinis darbo sąrašas.

`POST /api/appointments` – serveryje tikrinamas gydytojo, paciento ir kėdės užimtumas; atominių konfliktų atmetimas.

`POST /api/finance/invoices/:id/payments` – centais registruojama patvirtinta arba laukianti įmoka; tik autorizuota registratorė / savininkas.

`POST /api/finance/payments/:id/confirm` – rankinis išorinio dokumento sutikrinimas, originalo nekeitimo politika.

`POST /api/finance/invoices/:id/refunds` – atskiras grąžinimo dokumentas ir neigiamas atlygio perskaičiavimas.

`POST /api/vlk/cases/:id/complete` – patvirtinamas gydymo atvejo baigimas tik pagal teisėtą dokumentaciją, atskiriant atvejo baigimą nuo faktinio VLK apmokėjimo.

`GET /api/owner/compensation?clinicId&month` – **tik savininkui**. Administratorei ir gydytojui – HTTP 403, taip pat tiesiogine užklausa.

`GET /api/audit` – tik įgaliotam, filtruojami pagal kliniką ir duomenų jautrumą.

## Dokumentai ir priminimai

- Teisiškai patvirtinti konkrečios klinikos sutikimų šablonai, jų versijos ir autorizuotas pasirašymo / tapatybės patvirtinimo procesas. Demo pieštas parašas nėra realaus proceso įrodymas.
- Primintuvams (jei klinika renkasi SMS / el. pašto tiekėją) reikia atskiro pranešimų siuntimo serverio, užduočių eilės, patikrintų kontaktų ir pristatymo būsenų; turinyje neturi būti nereikalingos informacijos apie sveikatą. Pranešimų teisinis pagrindas ir kontaktų naudojimas turi būti patvirtinti.
- Gydymo plano ir laboratorijos būsenų keitimai turi būti atriboti: registratorė gali keisti organizacines datas, bet klinikinė procedūra laikoma atlikta tik pagal gydytojo patvirtinimą.

## Migravimo ir priėmimo seka

1. Įsteigti saugų serverinį projekto resursą / hostingą ir autentifikavimo sprendimą. Reikalingos konkrečios klinikų paskyros ir teisės; šio projekto savininkas turi pasirinkti hostingą ir patvirtinti atitinkamą paslaugų teikėją.
2. Įgyvendinti DB schemą ir API leidimų patikrinimą; automatizuoti testus, kad „administratorė“ / „gydytojas“ negautų atlyginimų laukų / endpointų.
3. Perkelti demonstracinio UI veiksmus į serverines transakcijas, pridėti konfliktų / dubliavimo kontrolę ir duomenų atkūrimą.
4. Atlikti testus su visiškai sintetiniais duomenimis, nepriklausomą saugumo ir privatumo vertinimą, finansinės / medicininės apskaitos bei dokumentų atitikties peržiūrą.
5. Tik patvirtinus visus reikalavimus, sudaryti realių duomenų migravimo ir naudojimo planą. Neperkelti jokių galimai tikrų ankstesnių naršyklių įrašų į viešą demo.

**Neįgyvendinta dabartiniame GitHub Pages:** prisijungimai, serverinės rolės, saugi bendroji DB, tikri SMS / el. laiškai, fiskalizavimas ir VLK/EVIS/ESPBI automatinė sąsaja. Iki serverinio etapo leidžiami tik sintetiniai duomenys.
