# Otalammen Autohuolto – paikallinen katselmointi 13.10.2026

Vain nykyinen projekti muutettiin. Ei pushia, deploymentia, remote-muutoksia tai GitHub Pages -muutoksia.

## Toteutus

Kopioitu vanhasta lähdeprojektista EstimateTool.tsx, serviceCatalog.ts, estimateRequest.ts, estimate.ts ja estimate.test.mjs sekä INTEGRATION.md.
Hinnoittelu, validointi, pyyntöformaatti, tilat ja kuittausta edellyttävä lähetyslogiikka säilytettiin. Käyttöliittymän ajoneuvotyyppiohje muutettiin käyttäjän antamaan neutraaliin tekstiin; radioiden rengashintaohjeet poistettiin vain käyttöliittymästä.
EstimateSection tarkastettiin, mutta sen erilaista verkkosivutyyliä ei kopioitu. React mount on nykyisen sivun index.html-tiedoston hinta-arvio-osiossa ja src/calculator/main.tsx-tiedostossa.
Vanha alapään demolomake poistettiin näkyvästä sivusta ja sen käyttämät tapahtumankuuntelijat poistettiin script.js-tiedostosta.

## Ulkoasun säilyminen

tokens.css sekä hero-kuvan SHA-256 säilyivät ennallaan. Päätyylitiedoston ainoat muutokset olivat sisäisten palveluluokkien uudelleennimeäminen ja yksi kommentti; visuaalisia CSS-arvoja ei muutettu.
Selaimessa verrattiin ennen ja jälkeen headerin, heron, tekstiblokin, palvelugridin, arvostelukorttien ja karusellin, UKK:n ja footerin fontteja, värejä, leveystietoja, paddingia, gapia ja grid-asetuksia 1440, 1024 ja 390 CSS-pikselissä. Mittareissa ei eroja.
Laskurityylit rajattiin otalampi-calculator-luokkaan. Värit ja fontit periytyvät nykyisestä sivustosta.
GSAP-animaatioiden määritykset ja kestot säilyivät. Vite-moduulin uusi latausjärjestys huomioidaan alustamalla ne säilytettyjen paikallisten vendor-skriptien latauduttua. Laskurin korkeuden muutokset päivittävät ScrollTriggerin mittaukset.

## Testit

- npm run build: TypeScript ja Vite läpäisty. Vite ilmoittaa kahdesta tarkoituksella erillisenä säilytetystä GSAP-vendor-skriptistä; ne kopioituvat dist/vendor-hakemistoon ja latautuvat paikallisesti.
- npm run check: läpäisty.
- npm test: 6 testiä läpäisty, mukaan lukien kaikki 96 palvelu-/ajoneuvoyhdistelmää ja count-up-testit.
- Selaimessa kaikki viisi vaihetta, takaisin/eteenpäin, kenttävalidointi, valintojen säilyminen ja yhteenveto testattu.
- Öljy n. 200 €, ilmastointi 80 €, katsastustarkastus 50 €, renkaat 30/40 €; summat n. 360/n. 370 € testattu.
- Muu työ, määräaikaishuolto ja jarrut: manuaalinen hinta ja pakollinen kuvaus testattu. Tuntematon ajoneuvotyyppi ei saa arvattua rengashintaa.
- Sähköposti on pakollinen sähköpostiyhteydenotossa; nimi, puhelin ja suostumus tarkistetaan.
- Ilman backendia lähetys näyttää virheen, tiedot säilyvät eikä onnistumisnäkymää renderöidä. Odotettu API-virhe ei ole JavaScriptin ajonaikainen virhe.
- Mobiilissa koko viiden vaiheen läpikäynti ja takaisin-painike testattu; esimerkkisumma n. 230 €.
- 320, 390, 768, 1024 ja 1440 px: ei vaakaylivuotoa, kuvat latautuivat eikä testattuja laskurikenttiä tai painikkeita leikkautunut.
- Mobiilinavigaatio, hinta-arvioankkuri, FAQ ja arvostelukarussellin nuoli testattu.
- Renderöidyssä sivussa ja tuotantobuildissa ei vanhan yrityksen nimeä, sijaintia, yhteystietoja tai vanhoja yritysmittareita.

## Lähdeprojektin turvallisuus

82 lähdeprojektin tiedostoa (myös Git-metadata, paikalliset muutokset ja Gitin ulkopuoliset tiedostot; riippuvuus-/build-välimuistit rajattu pois) verrattiin ennen/jälkeen SHA-256-tarkistussummilla: ei muuttuneita tai uusia tiedostoja.
Git-status ja remote tarkastettiin vain lukevasti --no-optional-locks-valinnalla. Olemassa olevat muutokset ja Gitin ulkopuoliset tiedostot säilyivät.
Erillinen tallennettu checkpoint-repository säilyi puhtaana ja samassa commitissa 752e188b0ed24a528076ba2544b1691b8df70e05.

## Paikallinen esikatselu

http://127.0.0.1:4176/
Porttia 4175 käyttää vanhan lähdeprojektin olemassa oleva esikatselu; sitä ei pysäytetty tai muutettu.

Vahvistustarpeet: YRITTAJALTA-VAHVISTETTAVAT.md. Vastaanottosopimus: INTEGRATION.md.
