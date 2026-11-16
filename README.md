# DentalPro 2.0 – odontologijos klinikų valdymas (DEMO)

**Statusas: demonstracinė programa, tik sintetiniams duomenims. NE naudoti tikriems pacientams.**

- Klinikos: **Naujoji Akmenė** ir **Kuršėnai**
- Kiekvienoje klinikoje – **2 kėdės**
- Registracijos seka: **kėdė → pacientas → gydytojas**
- Sąsaja: lietuvių kalba, prisitaikanti prie ekrano dydžio
- Principai: integruotas klinikos darbo srautas, originalus dizainas ir kodas, ne konkrečių komercinių produktų kopija
- Specifikacija: [docs/DENTALPRO_2_SPEC.md](docs/DENTALPRO_2_SPEC.md)

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

Jei GitHub Pages tinkamai aktyvuotas ir leidžiamas šioje saugykloje, po pakeitimų prijungimo prie `main` puslapis publikuojamas per [GitHub Pages workflow](.github/workflows/pages.yml). **Nevertinkite nuorodos kaip veikiančios, kol nepatvirtintas deployment statusas.**

Ankstesnę veikiančią demonstraciją rasite [legacy.html](legacy.html). Nauja sistema perkelia senųjų demonstracinių įrašų `localStorage` struktūras į v2 duomenų saugyklą, jų neištrindama.

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
| Paslaugos | Kainynas, trukmės, kategorijos, redagavimas ir aktyvumo būsena |
| Finansai | Demonstracinės sąskaitos, eilutės, likučiai, demonstraciniai mokėjimai |
| Administravimas | Demo JSON eksportas, duomenų atkūrimas, demonstracinis veiksmų žurnalas |
| Senos sistemos išsaugojimas | Originali sistema prieinama `legacy.html`, senieji demo duomenys vienkartinai migruojami |

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
