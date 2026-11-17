# DentalPro 2.0 – odontologijos klinikų valdymas (DEMO)

**Statusas: išplėsta, tik sintetiniams duomenims skirta demonstracinė odontologijos sistema. NENAUDOTI tikriems pacientams.**\n\n**[Atidaryti DentalPro 2.0 internete](https://sinikalt.github.io/dentalpro-demo/)**

- Klinikos: **Naujoji Akmenė** ir **Kuršėnai**
- Kiekvienoje klinikoje – **2 kėdės**
- Registracijos seka: **kėdė → pacientas → gydytojas**
- Sąsaja: lietuvių kalba, prisitaikanti prie ekrano dydžio
- Principai: integruotas klinikos darbo srautas, originalus dizainas ir kodas, ne konkrečių komercinių produktų kopija
- Specifikacija: [docs/DENTALPRO_2_SPEC.md](docs/DENTALPRO_2_SPEC.md)

## Vieno failo demonstracija – patogiausias išbandymas

**[Atsisiųsti `demo-standalone.html`](demo-standalone.html)**: GitHub puslapyje pasirinkite **Raw / Download raw file**, išsaugokite ir atverkite HTML failą naršyklėje. Ši versija veikia per `file://`, be serverio, ir taip pat naudoja tik vietinę naršyklės saugyklą.

Po kodo pakeitimų atnaujinti vieno failo versiją:

```bash
npm run build
```

CI taip pat pateikia failą kaip **dentalpro-standalone-demo** artefaktą, kurį galima atsisiųsti iš sėkmingo GitHub Actions vykdymo.

## Paleidimas

ES moduliai naršyklėje reikalauja HTTP, todėl nevykdykite naujos versijos per `file://`.

```bash
python3 -m http.server 8080
```

Naršyklėje atverkite **http://localhost:8080**.

Testai su Node.js 20+:

```bash
npm run verify
```

GitHub Pages automatiškai publikuoja [DentalPro 2.0 demonstraciją](https://sinikalt.github.io/dentalpro-demo/) per [GitHub Actions](.github/workflows/pages.yml). Ši statinė svetainė neturi saugaus backend ar tikro elektroninio parašo.

**V3 demonstracinių duomenų izoliacija:** sistema naudoja atskirą `dentalpro_v3_synthetic_only` saugyklą. Senieji `localStorage` įrašai, net ir likę toje pačioje naršyklėje, **automatiškai neperkeliami**. Nauja versija pradeda tik su sintetiniais pavyzdžiais.

## Įgyvendinta (demonstracinis režimas)

| Sritis | Veiksmai |
| --- | --- |
| Pacientai | Sąrašas, paieška, kortelės kūrimas ir redagavimas, klinikų susiejimas, vizitų istorija |
| Registracija | Dienos/kėdžių grafikas, savaitės ir mėnesio rodiniai, sąrašas, filtrai; vizito kūrimas, redagavimas, ištrynimas, būsenos ir trukmės keitimas, nutempimas dienos grafike |
| Konfliktai | Gydytojo ir kėdės persidengimai, skirtingų klinikų ištekliai, darbo valandos, pertraukos, atšauktos registracijos |
| Darbo grafikai | Savaitinis gydytojų darbo laikas ir pertraukos, grafikų redagavimas su konfliktų tikrinimu |
| Odontograma | FDI 32 nuolatinių ir 20 pieninių dantų numeriai, būklė, paviršiai, pastabos, radinių saugojimas |
| Gydymo planai | Planai, būsenos, paslaugų eilutės, numatoma kaina, atliktų procedūrų žymėjimas |
| Klinikiniai įrašai | Data, pacientas, gydytojas, susijęs vizitas, tekstas ir istorija |
| Paslaugos | MK odontologijos kainynas (~130 paslaugų), kategorijos, trukmės, 10 € kainos intervalo pasirinkimas gydymo plane |
| Finansai | Demonstracinės sąskaitos, eilutės, likučiai, demonstraciniai mokėjimai |
| Paciento dokumentai | Keturi atskiri įrašai: sutartis, BDAR informavimas, sveikatos anketa ir invazinės procedūros sutikimas / atsisakymas; kiekvienam piešiamas paciento demonstracinis parašas |\n| Ataskaitos | Vizitų skaičiai, paslaugų dažniai, finansų suvestinė, CSV eksportas |\n| Administravimas | Demo JSON eksportas, duomenų atkūrimas, demonstracinis veiksmų žurnalas |
| Duomenų izoliacija | V3 veikia atskirai, nepasiima ankstesnių pacientų įrašų |

## Architektūra

- `src/domain.mjs` – grynosios verslo taisyklės ir validacija.
- `src/store.mjs` – keičiamas saugojimo adapteris (dabartinis adapteris naudoja `localStorage`), sintetiniai įrašai ir senųjų duomenų migracija.
- `src/views.mjs` – sąsaja, formos ir naudotojo veiksmai.
- `src/styles.css` – prisitaikantis dizainas.
- `tests/domain.test.mjs` – automatiniai verslo taisyklių ir migravimo testai.

Duomenys tarp skirtingų naršyklių ar įrenginių nesinchronizuojami.

## Apribojimai ir prieš diegimą reikalingi darbai

**NĖRA** naudotojų autentifikavimo, rolėmis grįstos prieigos kontrolės, serverinės DB, saugios audito grandinės, automatinių atsarginių kopijų, realių pacientų duomenų apsaugos, serverinio validavimo, bendro klinikų kelių naudotojų darbo. Demonstraciniai finansiniai mokėjimai **nėra realūs mokėjimai**. **NĖRA** SMS, e. receptų, VLK / PSDF integracijos ar tikrų kompensacijų skaičiavimo.

Prieš naudojant medicininius asmens duomenis reikės saugaus API, DB, prieigos valdymo ir audito, šifravimo, atsarginių kopijų, BDAR reikalavimų įvertinimo, klinikinių funkcijų validavimo ir saugumo testų. Neįkelkite tikrų pacientų duomenų į demonstraciją.

## Duomenų demonstravimas

Vardai, gydytojai, laikai ir mokėjimai yra išgalvoti. Pirmą kartą atidarius naują versiją automatiškai generuojami demonstraciniai duomenys. **Administravimas → Atkurti demo įrašus** iš naujo sukuria tik sintetinius pavyzdžius.
\n## Teisinės formos\n\n**[Pacientų formų teisinis pagrindas ir naudojimo ribos](docs/PACIENTU_FORMOS_TEISE.md)**. Tai peržiūrai skirti pavyzdžiai, ne klinikos vadovo patvirtinti dokumentai. Piešinys ekrane yra tik demonstracinis parašas – **ne patikimas ar kvalifikuotas elektroninis parašas**. Tikros sveikatos anketos, invazinės procedūros sutikimai ir paciento tapatybės / atstovavimo patikra turi būti įgyvendinami saugioje infrastruktūroje, su teisinės atitikties vertinimu.\n
## Vystymo etapas: registracijos dokumentų kontrolė (2026-11-17)

- Paciento kortelėje automatiškai matoma 3 registracijos dokumentų būsena: paciento sutartis, BDAR informavimas ir sveikatos anketa. Kiekviena pasirašoma atskirai ir turi savo istoriją.
- **Invazinio gydymo sutikimas nėra automatinis reikalavimas kiekvienai registracijai.** Jis susiejamas su pasirinkta gydymo plano procedūra paspaudžiant „Sutikimas“ prie konkrečios procedūros. Sprendimas „Atsisakau“ rodomas kaip atsisakymas, ne kaip leidimas atlikti procedūrą.
- Pasirašytų demonstracinių formų lange yra „Spausdinti / išsaugoti PDF“: naršyklės spausdinimo dialoge galima pasirinkti išsaugojimą PDF. Kopijoje pateikiamas dokumento versijos tekstas, atsakymai, demonstracinis parašas ir data. Tai nėra kvalifikuotas elektroninis parašas.
- Pasirašyto dokumento tekstas užfiksuojamas jo sukūrimo metu; pakeitus vėlesnį formos šabloną, senasis įrašas išlieka toks, koks buvo. Visi dokumentai saugomi tik atskirtoje sintetinių duomenų naršyklės saugykloje.
