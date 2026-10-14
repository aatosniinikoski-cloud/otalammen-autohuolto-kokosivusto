# Huoltopyyntöjen vastaanotto

Laskin käyttää Otalammen Autohuollon yrittäjän ilmoittamia hintoja. Öljynvaihto on noin 200 €, renkaanvaihto 30 € henkilöautolle ja 40 € pakettiautolle / maasturille, katsastustarkastus 50 € ja ilmastointihuolto 80 €. Muut työt ja tuntemattoman ajoneuvotyypin renkaanvaihto saavat hinnaksi `null`. Jarrutyön 95 €/h ei ole kokonaishinta eikä sitä käytetä laskennassa. Määräaikaishuoltoa ei hinnoitella automaattisesti.

## Nykyinen valmius

Projektissa ei ole vastaanottavaa backendia tai GoHighLevel-yhteyttä. Lomake muodostaa valmiiksi jäsennellyn pyynnön ja yrittää lähettää sen alla kuvattuun rajapintaan. Ilman vastaanottopalvelua lähetys näyttää virheen, säilyttää lomakkeen tiedot eikä näytä onnistumisvahvistusta. Asiakastietoja ei tallenneta selaimen pysyvään tallennustilaan. Sivun lataaminen uudelleen tyhjentää keskeneräisen pyynnön.

## Mihin webhook lisätään

1. Toteuta omalle palvelimelle `POST /api/estimate-requests` tai vastaava vastaanottoreitti. Lähetyskutsu on tiedostossa `src/lib/estimateRequest.ts`, funktiossa `submitEstimateRequest`.
2. Aseta tarvittaessa paikalliseen, Gitin ulkopuolelle jäävään `.env.local`-tiedostoon `VITE_ESTIMATE_API_URL` osoittamaan omaan vastaanottoreittiisi. Oletus on `/api/estimate-requests`. Ympäristötiedostoja ei sisällytetä tähän repositoryyn. Vite käyttää asetusta käynnistyksen / buildin aikana. Suosi samaa originia. Erillinen API tarvitsee asianmukaisen CORS-tuen myös `Idempotency-Key`-otsakkeelle.
3. Lisää **GHL-webhookin URL palvelimen ympäristömuuttujaan**, esimerkiksi `GHL_ESTIMATE_WEBHOOK_URL`, ja välitä validoitu pyyntö GHL:ään palvelimelta. Älä laita webhookin yksityistä URL:ia tai avaimia selaimen `VITE_*`-muuttujiin.

## Pyyntö

Sisältö on `multipart/form-data`:

- `request`: JSON-merkkijono (rakenne `buildEstimateRequest`-funktiossa).
- `images`: kuvatiedostot, kukin omana samannimisenä kenttänään, enintään 5 kuvaa ja 10 Mt / kuva.
- `Idempotency-Key`: pyynnön UUID. Samojen tietojen uudelleenyritys käyttää samaa tunnusta. Tietojen muokkaus muodostaa uuden tunnuksen.

JSON sisältää `schemaVersion`, `requestId`, `createdAt`, `vehicle`, `services`, `estimate`, `details`, `contact`, `consent` ja liitteiden metatiedot. `estimate.amount` on automaattisesti laskettava osuus tai `null`, `approximate` kertoo noin-hinnasta ja `requiresManualQuote` erillisen arvion tarpeesta. `services[].price` on `{amount, approximate}` tai `null`. Muun työn kuvaus kulkee myös kyseisen palvelun mukana. Tuntemattomalle tyypille ei arvata renkaanvaihdon hintaa.

Palvelimen on validoitava kaikki kentät ja liitteet sekä laskettava hinnat uudelleen omasta hinnastosta; selaimen summaan ei luoteta. Puhelinnumero ja nimi ovat aina pakollisia. Sähköposti tarvitaan, jos yhteydenottotavaksi on valittu sähköposti. Muun työn kuvaus on pakollinen. Toteuta palvelimella pyyntöjen deduplikointi tunnuksen perusteella, liitteiden tallennus / toimitus, kokorajat ja virheenkäsittely. GHL:lle voi toimittaa kuvien palvelimella muodostetut linkit multipart-tiedostojen sijaan.

## Vastaanottokuittaus

Näytä onnistuminen vain, kun backend on hyväksynyt pyynnön kestävään käsittelyyn (tallentanut tai välittänyt sen onnistuneesti). Palauta HTTP 200 / 201 / 202 ja `Content-Type: application/json`:

```json
{ "accepted": true, "requestId": "palvelimen-vahvistama-tunnus" }
```

Epäonnistumisessa palauta virhestatus. Tyhjä vastaus, HTML-sivu tai `{accepted:false}` eivät näytä asiakkaalle onnistumista. Lähetyksen aikaraja on 20 sekuntia. Palvelimen tulee tunnistaa saman tunnuksen uudelleenyritykset, jos vastaus katkeaa hyväksymisen jälkeen.

## Ennen tuotantokäyttöä

Liitä vastaanottopalvelu, tarkista todellinen toimitus GHL:ään, varmista yrityksen tietosuojakäytäntö ja kuvien käsittely. Hinnoittelu ja lomakkeen asiakaspolku toimivat paikallisesti; pyyntöjen toimitus vaatii tämän integraation.
