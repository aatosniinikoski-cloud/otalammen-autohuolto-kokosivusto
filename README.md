# Otalammen Autohuolto – paikallinen ensimmäinen versio

Nykyinen verkkosivupohja on säilytetty: lämmin musta–kulta-värimaailma, Big Shoulders Display / IBM Plex Sans, hero-kuva ja sen sävytys, osioiden leveydet, palvelugrid, arvostelukarusselli, UKK ja GSAP-animaatiot.
Tämä ei ole julkaistu sivusto. Ei GitHub Actionsia, deploymentia tai GHL-integraatiota.

## Käyttö

Node.js ja npm. Riippuvuudet asennetaan vain tähän projektiin.
- npm install
- npm run build
- npm run preview
- npm start (kehityspalvelin)
- npm run check
- npm test

Paikallinen osoite: http://127.0.0.1:4176/
Portti 4175 jätettiin vanhan lähdeprojektin esikatselulle. Vanhaan lähdeprojektiin ei tehty muutoksia.
React 18 / Vite 6 / TypeScript tarvitaan vain itsenäisesti kopioidun laskurin integrointiin; muu sivu säilyy nykyisenä HTML-rakenteena.

## Laskuri

- src/components/estimate/EstimateTool.tsx: viisi vaihetta, tilat, yhteenveto ja käyttöliittymä.
- src/data/serviceCatalog.ts: hinnat, ajoneuvotyypit ja manuaalisten töiden logiikka.
- src/lib/estimateRequest.ts: validointi, pyyntörakenne ja lähetysraja.
- src/types/estimate.ts: tietotyypit.
- src/calculator/main.tsx: React-mount nykyisen sivun pohjassa.
- src/calculator/calculator.css: vain laskuriin kohdistuvat tyylit. Värit ja fontit tulevat nykyisistä sivustotokenista.
- tests/estimate.test.mjs: kopioidut alkuperäiset laskuritestit.
- INTEGRATION.md: vastaanottorajapinnan sopimus.

Vanhan EstimateSection-komponentin uusi sivutyyli jätettiin pois. Sen sijaan index.html säilyttää nykyisen contact-section / contact-grid / form-panel -sommittelun.
Ajoneuvotyypin ohje on neutraali. Renkaanvaihtohintoja ei näytetä auton tietojen radio-valinnoissa.

## Hinnat

Öljy ja suodatin n. 200 €, ilmastointi 80 €, katsastustarkastus 50 €, renkaanvaihto henkilöautolle 30 € ja pakettiautolle/maasturille 40 €.
Määräaikaishuolto, jarrut ja muut työt käsitellään alkuperäisen laskurin Muu huolto tai korjaus -valinnalla ja hinnoitellaan manuaalisesti.
Tuntemattomalle ajoneuvotyypille ei arvata renkaanvaihdon hintaa.

## Yritystiedot ja palautteet

Nimi Otalammen Autohuolto, alue Otalampi / Vihti, käyttäjän toimittama sähköposti otalammenauto@gmail.com.
Puhelin, katuosoite, aukioloajat ja Y-tunnus on jätetty pois, koska niitä ei vahvistettu.
Google-arvosana 4,9/5, 19 arvostelua ja viisi palautetekstiä on otettu käyttäjän toimittamasta tehtäväaineistosta. Arvostelijanimiä ja päivämääriä ei arvata; yksittäiset tähtimäärät jätetään pois, ellei niitä ole toimitettu.
Google-linkki käyttää yrityksen nimellä tehtävää Maps-hakua, kunnes tarkka profiililinkki saadaan.
Headerin ja footerin nimikuva on väliaikainen tekstimerkki, ei väite yrityksen virallisesta logosta.
Nykyinen hero-kuva ja alkuperäinen logoassetti on säilytetty; vanhaa logoassettia ei käytetä eikä sisällytetä tuotantobuildiin.

## Lähetyksen todellinen tila

Backendia ei ole. Näkyvä kehityshuomautus kertoo tämän.
Laskuri lähettää vain omaan /api/estimate-requests-rajapintaan tai myöhemmin määritettävään VITE_ESTIMATE_API_URL-osoitteeseen.
Ilman asianmukaista JSON-kuittausta accepted:true näytetään virhe, ei onnistumista. Tiedot jäävät Reactin muistiin, eivät pysyvään selaintallennukseen.
Älä anna oikeita henkilötietoja tässä paikallisessa esikatselussa. Käytä testitietoja.
Yksityiset webhookit ja avaimet kuuluvat tulevalle palvelinpuolelle, eivät frontendin VITE-muuttujiin.

## Turvallisuus

Työ tehtiin vain nykyisessä projektissa. Vanhaa otalammen-autohuolto-lähdeprojektia käytettiin vain lukemiseen ja tiedostojen kopiointiin.
Sen olemassa olevia muokkaamattomia, muokattuja ja Gitin ulkopuolisia tiedostoja ei muuteta.
Tallennettu checkpoint-repository ja kaikki muut projektit säilyvät ennallaan.
Ei pushia, deploymentia, remote-muutoksia tai Pages-muutoksia.
