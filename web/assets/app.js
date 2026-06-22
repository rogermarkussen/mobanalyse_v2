"use strict";

const state = {
  view: "overview",
  metric: "Abonnement",
  challengerScope: "Privat",
  priceMode: "arpu-segment",
  wholesaleYear: null,
};

const COLORS = {
  Telenor: "#008ec2",
  Telia: "#7a2cb7",
  "Lyse Tele (Ice)": "#c99700",
  "Lyse (Ice)": "#c99700",
  Ice: "#c99700",
  "Øvrige": "#26845b",
  Fjordkraft: "#385624",
  "Chili mobil": "#c43b35",
  Lycamobile: "#12365b",
  Xplora: "#2e9f72",
  Happybytes: "#698ed0",
  Plussmobil: "#8a9097",
  Unifon: "#6b7280",
  Nortel: "#53a318",
  "Saga mobil": "#a6332d",
  "SMB mobil": "#548235",
  Privat: "#008ec2",
  Bedrift: "#7a2cb7",
  Abonnement: "#3e6ecb",
  Inntekter: "#d97721",
  CR2: "#12365b",
  HHI: "#c99700",
};

const FORMATTERS = {
  number: new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 }),
  one: new Intl.NumberFormat("nb-NO", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }),
  two: new Intl.NumberFormat("nb-NO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
};

function advancedBlock({ filter, groupBy, metricNote, note }) {
  return `
      <div class="method-advanced">
        <h3>For de avanserte</h3>
        <p>Filter fra <code>data/mobil.parquet</code>:</p>
        <pre class="method-code"><code>${escapeHtml(filter.trim())}</code></pre>
        ${metricNote ? `<p>${escapeHtml(metricNote)}</p>` : ""}
        ${
          groupBy
            ? `<p>group_by-sum:</p>
        <pre class="method-code"><code>${escapeHtml(groupBy.trim())}</code></pre>`
            : ""
        }
        ${note ? `<p>${escapeHtml(note)}</p>` : ""}
      </div>
    `;
}

const METHODS = {
  "market-share": {
    title: "Markedsandeler",
    html: `
      <p>Figuren viser hvor stor del av sluttbrukermarkedet som tilhører hver hovedaktør. Du kan bytte mellom abonnement og omsetning. Abonnement gir et bilde av kundemassen, mens omsetning viser hvor stor del av inntektene som tilfaller aktørene.</p>
      <h3>Hva inngår?</h3>
      <p>Alle beregninger bruker helårstall for mobiltelefoni i sluttbrukermarkedet. Abonnement omfatter fakturerte abonnement og kontantkort som ordinære mobilabonnement. Tilleggslinjer og andre underkategorier som ikke representerer et selvstendig mobilabonnement holdes utenfor. Omsetning er rapportert årsinntekt fra mobiltelefoni i sluttbrukermarkedet.</p>
      <h3>Hvordan grupperes tilbyderne?</h3>
      <p>Tilbydere samles i fire markedsgrupper: Telenor, Telia, Lyse Tele (Ice) og Øvrige. Sammenslåingen gjør at navneendringer og selskapsstrukturer ikke skaper kunstige hopp i tidsserien. Alle aktører som ikke inngår i de tre største gruppene legges i Øvrige.</p>
      <h3>Beregning</h3>
      <div class="formula">\\[
        \\text{Markedsandel}_{g,y} =
        \\frac{\\sum \\text{svar}_{g,y}}{\\sum_h \\text{svar}_{h,y}} \\cdot 100
      \\]</div>
      ${advancedBlock({
        filter: `
dk = 'Mobiltelefoni'
AND tp = 'Sum'
AND sk = 'Sluttbruker'
AND delar = 'Helår'
AND (
  (hg = 'Abonnement'
   AND n1 IN ('Fakturert', 'Kontantkort')
   AND n2 = 'Ingen')
  OR hg = 'Inntekter'
)
        `,
        groupBy: `
GROUP BY ar, metric, markedsgruppe(fusnavn)
sum(svar) AS absolute
value = 100 * absolute / sum(absolute) OVER (PARTITION BY metric, ar)
        `,
        metricNote:
          "Her betyr metric grunnlaget som beregnes: 'Abonnement' for rader med hg = 'Abonnement', og 'Omsetning' for rader med hg = 'Inntekter'.",
      })}
      <p>Telleren er verdien for markedsgruppen \\(g\\) i år \\(y\\). Nevneren er totalen for alle markedsgrupper i samme år og samme grunnlag. Summen av andelene skal derfor være 100 prosent innenfor hvert år.</p>
      <h3>Slik bør figuren leses</h3>
      <p>Endringer fra år til år er prosentpoeng, ikke prosentvis vekst. Dersom en aktør går fra 40 til 42 prosent, er økningen 2 prosentpoeng. Sammenlign abonnement og omsetning for å se om en aktør har høyere inntektsandel enn abonnementsandel.</p>
    `,
  },
  projection: {
    title: "Lineær framskriving",
    html: `
      <p>Framskrivingen viser hvordan markedsandelen ville utviklet seg dersom den historiske retningen fortsatte som en rett linje. Dette er en enkel trendindikator. Den tar ikke hensyn til kampanjer, strategiske beslutninger, prisendringer, regulatoriske tiltak eller andre forhold som kan endre utviklingen framover.</p>
      <h3>Hva inngår?</h3>
      <p>For hver aktør brukes de samme helårsandelene som i markedsandelsfiguren. Abonnement og omsetning beregnes hver for seg, slik at trendlinjen for kundemasse ikke blandes med trendlinjen for inntekter.</p>
      <h3>Beregning</h3>
      <div class="formula">\\[
        \\hat{y}_{t} = \\alpha + \\beta t
      \\]</div>
      <div class="formula">\\[
        \\beta =
        \\frac{\\sum_t (t-\\bar{t})(y_t-\\bar{y})}{\\sum_t (t-\\bar{t})^2},
        \\qquad
        \\alpha = \\bar{y} - \\beta\\bar{t}
      \\]</div>
      ${advancedBlock({
        filter: `
Samme filter som markedsandeler:
dk = 'Mobiltelefoni'
AND tp = 'Sum'
AND sk = 'Sluttbruker'
AND delar = 'Helår'
AND (
  (hg = 'Abonnement'
   AND n1 IN ('Fakturert', 'Kontantkort')
   AND n2 = 'Ingen')
  OR hg = 'Inntekter'
)
        `,
        groupBy: `
GROUP BY ar, metric, markedsgruppe(fusnavn)
sum(svar) AS absolute
historisk_andel = 100 * absolute / sum(absolute) OVER (PARTITION BY metric, ar)
lineær trend beregnes per grunnlag (metric) og tilbyder fra historisk_andel
        `,
        metricNote:
          "Her betyr metric grunnlaget som framskrives: 'Abonnement' for abonnementsandeler og 'Omsetning' for omsetningsandeler.",
      })}
      <p>Her er \\(y_t\\) markedsandelen i år \\(t\\), \\(\\beta\\) er årlig endring i prosentpoeng, og \\(\\alpha\\) er nivået linjen starter fra. Trendlinjen forlenges tre år etter siste tilgjengelige helår.</p>
      <h3>Slik bør figuren leses</h3>
      <p>Bruk framskrivingen som en visuell støtte for retningen i historikken, ikke som et fasitsvar på framtidig markedsandel. En bratt linje betyr at historikken har hatt tydelig bevegelse; en flat linje betyr at andelen har vært relativt stabil.</p>
    `,
  },
  "segment-share": {
    title: "Markedsandeler per segment",
    html: `
      <p>Figuren deler sluttbrukermarkedet i privatmarked og bedriftsmarked. Dette er viktig fordi konkurransebildet kan være forskjellig i de to segmentene: en aktør kan ha sterk posisjon i privatmarkedet og svakere posisjon i bedriftsmarkedet, eller motsatt.</p>
      <h3>Hva inngår?</h3>
      <p>Det brukes helårstall for mobiltelefoni i sluttbrukermarkedet. Abonnement inkluderer ordinære fakturerte abonnement og kontantkort. Omsetning er årsinntekt fra mobiltelefoni. Privat og bedrift behandles som to separate markeder i denne figuren.</p>
      <h3>Beregning</h3>
      <div class="formula">\\[
        \\text{Andel}_{g,s,y} =
        \\frac{\\sum \\text{svar}_{g,s,y}}{\\sum_h \\text{svar}_{h,s,y}} \\cdot 100
      \\]</div>
      ${advancedBlock({
        filter: `
dk = 'Mobiltelefoni'
AND ms IN ('Privat', 'Bedrift')
AND tp = 'Sum'
AND sk = 'Sluttbruker'
AND delar = 'Helår'
AND (
  (hg = 'Abonnement'
   AND n1 IN ('Fakturert', 'Kontantkort')
   AND n2 = 'Ingen')
  OR hg = 'Inntekter'
)
        `,
        groupBy: `
GROUP BY ar, ms, metric, markedsgruppe(fusnavn)
sum(svar) AS absolute
value = 100 * absolute / sum(absolute) OVER (PARTITION BY metric, ms, ar)
        `,
        metricNote:
          "Her betyr metric grunnlaget innen hvert segment: 'Abonnement' for rader med hg = 'Abonnement', og 'Omsetning' for rader med hg = 'Inntekter'.",
      })}
      <p>Andelen beregnes innenfor segmentet \\(s\\). Det betyr at privatmarkedet har sin egen total, og bedriftsmarkedet har sin egen total. En andel i privatmarkedet skal derfor ikke summeres sammen med en andel i bedriftsmarkedet.</p>
      <h3>Slik bør figuren leses</h3>
      <p>Se etter om aktørenes relative posisjon er lik i begge segmenter. Store forskjeller mellom segmentene kan tyde på ulik kundesammensetning, ulik salgsmodell eller ulik konkurranseflate.</p>
    `,
  },
  "private-challengers": {
    title: "Privatmarkedet: øvrige tilbydere",
    html: `
      <p>Figuren løfter fram utvalgte mindre tilbydere i privatmarkedet. I hovedfiguren ligger disse ofte samlet i Øvrige, men her vises de hver for seg slik at utviklingen blant utfordrerne blir lettere å se.</p>
      <h3>Hva inngår?</h3>
      <p>Grunnlaget er helårstall for privatmarkedet innen mobiltelefoni. Abonnement er ordinære mobilabonnement og kontantkort. Omsetning er årsinntekt fra privatmarkedet. Tilbydere uten relevant rapportering for et år vil ikke få en synlig verdi for det året.</p>
      <h3>Utvalg</h3>
      <p>Figuren viser Fjordkraft, Chili mobil, Lycamobile, Xplora, Happybytes og Plussmobil. Utvalget er gjort for å vise aktører som er små i totalmarkedet, men som kan ha tydelig bevegelse i privatmarkedet.</p>
      <h3>Beregning</h3>
      <div class="formula">\\[
        \\text{Andel}_{i,y} =
        \\frac{\\sum \\text{svar}_{i,y}}{\\sum_j \\text{svar}_{j,y}} \\cdot 100
      \\]</div>
      ${advancedBlock({
        filter: `
dk = 'Mobiltelefoni'
AND hg IN ('Abonnement', 'Inntekter')
AND ms = 'Privat'
AND tp = 'Sum'
AND sk = 'Sluttbruker'
AND delar = 'Helår'
AND (
  hg = 'Inntekter'
  OR (n1 IN ('Fakturert', 'Kontantkort') AND n2 = 'Ingen')
)
        `,
        groupBy: `
GROUP BY ar, metric, valgt_tilbyder(fusnavn)
sum(svar) AS absolute
total = sum(svar) OVER (PARTITION BY ar, hg)
value = 100 * absolute / total
        `,
        metricNote:
          "Her betyr metric grunnlaget i privatmarkedet: 'Abonnement' når hg = 'Abonnement', og 'Omsetning' når hg = 'Inntekter'.",
        note:
          "valgt_tilbyder er Fjordkraft, Chili mobil, Lycamobile, Xplora, Happybytes og Plussmobil.",
      })}
      <p>Nevneren er hele privatmarkedet i samme år og på samme grunnlag. Andelen viser derfor tilbyderens størrelse i markedet, ikke tilbyderens andel av bare de aktørene som er tegnet inn i figuren.</p>
      <h3>Slik bør figuren leses</h3>
      <p>Små absolutte endringer kan gi synlige utslag fordi aktørene har lave markedsandeler. Bruk figuren til å se retning og relativ utvikling, og bruk Excel-eksporten dersom du trenger eksakte tall.</p>
    `,
  },
  "business-challengers": {
    title: "Bedriftsmarkedet: øvrige tilbydere",
    html: `
      <p>Figuren viser utvalgte mindre tilbydere i bedriftsmarkedet. Den er laget for å gjøre utviklingen blant bedriftsrettede utfordrere synlig, selv om de har lavere andeler enn de største aktørene.</p>
      <h3>Hva inngår?</h3>
      <p>Grunnlaget er helårstall for bedriftsmarkedet innen mobiltelefoni. Abonnement inkluderer ordinære bedriftsabonnement. Omsetning er årsinntekt fra bedriftsmarkedet. Tallene beregnes separat fra privatmarkedet.</p>
      <h3>Utvalg</h3>
      <p>Figuren viser Unifon, Nortel, Saga mobil og SMB mobil. Disse aktørene er valgt fordi de er relevante for å følge konkurransen i bedriftsmarkedet, men ofte blir for små til å leses tydelig i totalfiguren.</p>
      <h3>Beregning</h3>
      <div class="formula">\\[
        \\text{Andel}_{i,y} =
        \\frac{\\sum \\text{svar}_{i,y}}{\\sum_j \\text{svar}_{j,y}} \\cdot 100
      \\]</div>
      ${advancedBlock({
        filter: `
dk = 'Mobiltelefoni'
AND hg IN ('Abonnement', 'Inntekter')
AND ms = 'Bedrift'
AND tp = 'Sum'
AND sk = 'Sluttbruker'
AND delar = 'Helår'
AND (
  hg = 'Inntekter'
  OR (n1 IN ('Fakturert', 'Kontantkort') AND n2 = 'Ingen')
)
        `,
        groupBy: `
GROUP BY ar, metric, valgt_tilbyder(levnavn)
sum(svar) AS absolute
total = sum(svar) OVER (PARTITION BY ar, hg)
value = 100 * absolute / total
        `,
        metricNote:
          "Her betyr metric grunnlaget i bedriftsmarkedet: 'Abonnement' når hg = 'Abonnement', og 'Omsetning' når hg = 'Inntekter'.",
        note: "valgt_tilbyder er Unifon, Nortel, Saga mobil og SMB mobil.",
      })}
      <p>Nevneren er hele bedriftsmarkedet i samme år og på samme grunnlag. Dermed kan andelene sammenlignes med hovedbildet for bedriftsmarkedet, ikke bare med de andre viste utfordrerne.</p>
      <h3>Slik bør figuren leses</h3>
      <p>Se særlig på om en aktør vokser jevnt over flere år eller om utviklingen skyldes enkelthopp. I små serier kan rapporteringsendringer og kundeporteføljer gi tydelige utslag.</p>
    `,
  },
  "arpu-segment": {
    title: "ARPU per segment",
    html: `
      <p>ARPU viser gjennomsnittlig inntekt per abonnement per måned. Den brukes for å sammenligne inntektsnivået i privatmarkedet og bedriftsmarkedet, og kan påvirkes av prisnivå, produktmiks, rabattbruk, databruk og hvilke kundetyper som inngår i segmentet.</p>
      <h3>Hva inngår?</h3>
      <p>Telleren er helårsinntekt for mobiltelefoni i segmentet. Nevneren er abonnement i samme segment. Siden inntekten opptjenes gjennom hele året, mens abonnement er en beholdning på et tidspunkt, bruker vi gjennomsnittlig abonnementsbeholdning for året.</p>
      <h3>Beregning av abonnementsgrunnlag</h3>
      <div class="formula">\\[
        \\bar{A}_{s,y} = \\frac{A_{s,y-1} + A_{s,y}}{2}
      \\]</div>
      <div class="formula">\\[
        \\text{ARPU}_{s,y} =
        \\frac{I_{s,y} \\cdot 1000}{12 \\cdot \\bar{A}_{s,y}}
      \\]</div>
      ${advancedBlock({
        filter: `
Abonnement:
dk = 'Mobiltelefoni'
AND hg = 'Abonnement'
AND ms IN ('Privat', 'Bedrift')
AND n1 IN ('Fakturert', 'Kontantkort')
AND n2 = 'Ingen'
AND tp = 'Sum'
AND sk = 'Sluttbruker'
AND delar = 'Helår'

Inntekter:
dk = 'Mobiltelefoni'
AND hg = 'Inntekter'
AND ms IN ('Privat', 'Bedrift')
AND tp = 'Sum'
AND sk = 'Sluttbruker'
AND delar = 'Helår'
        `,
        groupBy: `
abonnement_snapshot: GROUP BY ar, ms; sum(svar) AS abonnement
omsetning: GROUP BY ar, ms; sum(svar) AS omsetning
abonnement = (abonnement_y + coalesce(abonnement_y-1, abonnement_y)) / 2
value = omsetning * 1000 / abonnement / 12
        `,
      })}
      <p>\\(I_{s,y}\\) er årsinntekt i tusen kroner for segment \\(s\\) og år \\(y\\). Faktoren 1000 gjør inntekten om fra tusen kroner til kroner. \\(\\bar{A}_{s,y}\\) er gjennomsnittet av abonnementsbeholdningen ved utgangen av året før og ved utgangen av året som beregnes. For første tilgjengelige år brukes årets abonnementstall som beste tilgjengelige anslag.</p>
      <h3>Slik bør figuren leses</h3>
      <p>ARPU er ikke en listepris. Den er en gjennomsnittsberegning av faktisk rapportert omsetning delt på abonnementsgrunnlaget. En økning kan skyldes høyere priser, endret kundemiks eller lavere abonnementsgrunnlag, og bør derfor tolkes sammen med utviklingen i abonnement og omsetning.</p>
    `,
  },
  "arpu-provider": {
    title: "ARPU per tilbyder",
    html: `
      <p>ARPU per tilbyder viser gjennomsnittlig månedlig inntekt per abonnement for utvalgte aktører. Beregningen gjøres separat for privatmarkedet og bedriftsmarkedet, fordi inntektsnivå og kundesammensetning ofte er ulike i de to segmentene.</p>
      <h3>Hva inngår?</h3>
      <p>For hver tilbydergruppe hentes helårsinntekt og abonnement i samme segment. Tilbydere samles etter markedsnavn der det er nødvendig for å få en sammenhengende tidsserie. En aktør vises bare der det finnes tilstrekkelig grunnlag for både omsetning og abonnement.</p>
      <h3>Beregning av abonnementsgrunnlag</h3>
      <div class="formula">\\[
        \\bar{A}_{i,s,y} = \\frac{A_{i,s,y-1} + A_{i,s,y}}{2}
      \\]</div>
      <div class="formula">\\[
        \\text{ARPU}_{i,s,y} =
        \\frac{I_{i,s,y} \\cdot 1000}{12 \\cdot \\bar{A}_{i,s,y}}
      \\]</div>
      ${advancedBlock({
        filter: `
Abonnement:
dk = 'Mobiltelefoni'
AND hg = 'Abonnement'
AND ms IN ('Privat', 'Bedrift')
AND n1 IN ('Fakturert', 'Kontantkort')
AND n2 = 'Ingen'
AND tp = 'Sum'
AND sk = 'Sluttbruker'
AND delar = 'Helår'

Inntekter:
dk = 'Mobiltelefoni'
AND hg = 'Inntekter'
AND ms IN ('Privat', 'Bedrift')
AND tp = 'Sum'
AND sk = 'Sluttbruker'
AND delar = 'Helår'
        `,
        groupBy: `
abonnement_snapshot: GROUP BY ar, ms, arpu_tilbyder(fusnavn); sum(svar) AS abonnement
omsetning: GROUP BY ar, ms, arpu_tilbyder(fusnavn); sum(svar) AS omsetning
abonnement = (abonnement_y + coalesce(abonnement_y-1, abonnement_y)) / 2
value = omsetning * 1000 / abonnement / 12
        `,
        note:
          "arpu_tilbyder er utvalgte tilbydergrupper; rader uten valgt gruppe tas ikke med i figuren.",
      })}
      <p>\\(I_{i,s,y}\\) er årsinntekt i tusen kroner for tilbyder \\(i\\), segment \\(s\\) og år \\(y\\). \\(\\bar{A}_{i,s,y}\\) er gjennomsnittlig abonnementsbeholdning gjennom året, beregnet som snittet av årets og foregående års beholdning. Resultatet deles på 12 for å få kroner per måned.</p>
      <h3>Slik bør figuren leses</h3>
      <p>Sammenlign aktører innenfor samme segment. Privat-ARPU og bedrifts-ARPU bør ikke leses som samme type kundegrunnlag. Store hopp kan komme av endret kundemiks, endret rapportering eller at en aktør har lavt volum.</p>
    `,
  },
  "nok-per-gb-total": {
    title: "Omsetning per GB totalt",
    html: `
      <p>Figuren viser hvor mye rapportert omsetning som tilsvarer én gigabyte datatrafikk. Dette er ikke en pris per datapakke og ikke en ARPU-beregning. Det er et forholdstall mellom samlet inntekt og samlet databruk.</p>
      <h3>Hva inngår?</h3>
      <p>Telleren er helårsinntekt fra mobiltelefoni i sluttbrukermarkedet. Nevneren er rapportert datatrafikk i gigabyte for samme marked og år. Beregningen gjøres for hver hovedgruppe av tilbydere.</p>
      <h3>Beregning</h3>
      <div class="formula">\\[
        \\text{Kroner per GB}_{g,y} =
        \\frac{I_{g,y} \\cdot 1000}{D_{g,y}}
      \\]</div>
      ${advancedBlock({
        filter: `
Inntekter:
dk = 'Mobiltelefoni'
AND hg = 'Inntekter'
AND tp = 'Sum'
AND sk = 'Sluttbruker'
AND delar = 'Helår'

Trafikk:
dk = 'Mobiltelefoni'
AND hg = 'Trafikk'
AND n1 = 'Data'
AND tp = 'Sum'
AND sk = 'Sluttbruker'
AND delar = 'Helår'
        `,
        groupBy: `
inntekter: GROUP BY ar, hovedgruppe(fusnavn); sum(svar) AS inntekter
trafikk: GROUP BY ar, hovedgruppe(fusnavn); sum(svar) AS datatrafikk_gb
value = inntekter * 1000 / datatrafikk_gb
        `,
      })}
      <p>\\(I_{g,y}\\) er årsinntekt i tusen kroner for markedsgruppe \\(g\\) i år \\(y\\). \\(D_{g,y}\\) er datatrafikk målt i GB. Faktoren 1000 gjør inntekten om til kroner før den deles på trafikkvolumet.</p>
      <h3>Slik bør figuren leses</h3>
      <p>En fallende verdi betyr normalt at datatrafikken vokser raskere enn inntektene. Det kan skje selv om abonnementene ikke blir billigere, fordi kundene bruker mer data innenfor abonnementene sine.</p>
    `,
  },
  "nok-per-gb-providers": {
    title: "Omsetning per GB for utvalgte tilbydere",
    html: `
      <p>Denne figuren bruker samme prinsipp som totalfiguren for kroner per GB, men viser utvalgte tilbydere hver for seg. Den kan brukes til å se om forholdet mellom inntekter og datatrafikk utvikler seg forskjellig mellom aktørene.</p>
      <h3>Hva inngår?</h3>
      <p>For hver tilbyder brukes helårsinntekt fra mobiltelefoni og rapportert datatrafikk i GB. En tilbyder må ha både inntekter og trafikkgrunnlag for å kunne vises som egen serie.</p>
      <h3>Beregning</h3>
      <div class="formula">\\[
        \\text{Kroner per GB}_{i,y} =
        \\frac{I_{i,y} \\cdot 1000}{D_{i,y}}
      \\]</div>
      ${advancedBlock({
        filter: `
Inntekter:
dk = 'Mobiltelefoni'
AND hg = 'Inntekter'
AND tp = 'Sum'
AND sk = 'Sluttbruker'
AND delar = 'Helår'

Trafikk:
dk = 'Mobiltelefoni'
AND hg = 'Trafikk'
AND n1 = 'Data'
AND tp = 'Sum'
AND sk = 'Sluttbruker'
AND delar = 'Helår'
        `,
        groupBy: `
inntekter: GROUP BY ar, arpu_tilbyder(fusnavn); sum(svar) AS inntekter
trafikk: GROUP BY ar, arpu_tilbyder(fusnavn); sum(svar) AS datatrafikk_gb
value = inntekter * 1000 / datatrafikk_gb
        `,
        note: "Kun rader med valgt tilbydergruppe inngår i tilbyderfiguren.",
      })}
      <p>\\(I_{i,y}\\) er årsinntekt i tusen kroner for tilbyder \\(i\\) i år \\(y\\). \\(D_{i,y}\\) er tilbyderens datatrafikk målt i GB. Resultatet viser kroner inntekt per GB datatrafikk.</p>
      <h3>Slik bør figuren leses</h3>
      <p>Forskjeller mellom tilbydere kan skyldes ulik kundemiks, ulike pakker, ulik andel bedriftskunder eller forskjeller i rapportert trafikk. Figuren bør derfor brukes som et sammenlignende forholdstall, ikke som en direkte prisindikator.</p>
    `,
  },
  totals: {
    title: "Totaler",
    html: `
      <p>Totalfigurene viser størrelsen på sluttbrukermarkedet over tid. Den ene figuren viser samlet antall abonnement, og den andre viser samlet omsetning. De to siste figurene viser hvordan disse totalene fordeler seg mellom hovedaktørene.</p>
      <h3>Hva inngår?</h3>
      <p>Abonnement omfatter ordinære fakturerte abonnement og kontantkort for mobiltelefoni. Omsetning er rapportert årsinntekt fra sluttbrukermarkedet. Alle tall er helårstall, slik at periodene kan sammenlignes direkte.</p>
      <h3>Beregning</h3>
      <div class="formula">\\[
        \\text{Total}_{y} = \\sum_i \\text{svar}_{i,y}
      \\]</div>
      ${advancedBlock({
        filter: `
dk = 'Mobiltelefoni'
AND tp = 'Sum'
AND sk = 'Sluttbruker'
AND delar = 'Helår'
AND (
  (hg = 'Abonnement'
   AND n1 IN ('Fakturert', 'Kontantkort')
   AND n2 = 'Ingen')
  OR hg = 'Inntekter'
)
        `,
        groupBy: `
GROUP BY ar, delar, metric
sum(svar) AS value
        `,
        metricNote:
          "Her betyr metric totaltypen: 'Abonnement' for abonnementsrader, og 'Inntekter' for inntektsrader.",
      })}
      <p>Totalen i år \\(y\\) er summen av alle relevante tilbydere. For inntekter er grunnverdiene rapportert i tusen kroner, men vises som absolutte tall i appen og i eksportene.</p>
      <h3>Slik bør figuren leses</h3>
      <p>Bruk totalene for å skille mellom markedsvekst og forskyvning mellom aktører. En aktør kan tape markedsandel selv om antall abonnement øker, dersom totalmarkedet vokser raskere.</p>
    `,
  },
  "provider-share-trend": {
    title: "Tilbyderandeler i totaler",
    html: `
      <p>Figurene viser hvordan totalabonnement og totalinntekt fordeler seg på hovedaktørene. De bruker samme markedsgrupper som hovedfiguren for markedsandeler, men ligger sammen med totalene for å gjøre det lettere å se volum og andel i samme visning.</p>
      <h3>Hva inngår?</h3>
      <p>Grunnlaget er helårstall for mobiltelefoni i sluttbrukermarkedet. For abonnement brukes ordinære mobilabonnement og kontantkort. For inntekt brukes samlet årsinntekt. Tilbyderne samles i Telenor, Telia, Lyse Tele (Ice) og Øvrige.</p>
      <h3>Beregning</h3>
      <div class="formula">\\[
        \\text{Andel}_{g,y} =
        \\frac{\\sum \\text{svar}_{g,y}}{\\sum_h \\text{svar}_{h,y}} \\cdot 100
      \\]</div>
      ${advancedBlock({
        filter: `
dk = 'Mobiltelefoni'
AND tp = 'Sum'
AND sk = 'Sluttbruker'
AND delar = 'Helår'
AND (
  (hg = 'Abonnement'
   AND n1 IN ('Fakturert', 'Kontantkort')
   AND n2 = 'Ingen')
  OR hg = 'Inntekter'
)
        `,
        groupBy: `
GROUP BY ar, delar, metric, markedsgruppe(fusnavn)
sum(svar) AS absolute
value = 100 * absolute / sum(absolute) OVER (PARTITION BY metric, delar, ar)
        `,
        metricNote:
          "Her betyr metric grunnlaget i totalfigurene: 'Abonnement' for abonnementsandeler, og 'Omsetning' for inntektsandeler.",
      })}
      <p>Formelen er den samme som for markedsandeler. Forskjellen er at denne visningen er plassert sammen med totalvolumene, slik at andelene kan tolkes mot utviklingen i hele markedet.</p>
      <h3>Slik bør figuren leses</h3>
      <p>Sammenlign andelsutviklingen med totalutviklingen. Hvis totalmarkedet vokser samtidig som en aktørs andel faller, kan aktørens absolutte størrelse likevel være stabil eller økende.</p>
    `,
  },
  wholesale: {
    title: "Grossistandeler",
    html: `
      <p>Grossistandeler viser hvor stor del av abonnementsmassen som ligger på de tre mobilnettene når tilgangskjøpere legges til nettverkseieren de kjøper tilgang hos. Dette er et annet perspektiv enn sluttbrukerandelene, fordi abonnement fra en tjenestetilbyder flyttes til den grossisten som leverer nettverkstilgangen.</p>
      <h3>Hva inngår?</h3>
      <p>Grunnlaget er helårstall for ordinære mobilabonnement og kontantkort. Alle tilbydere med abonnement i valgt år tas med. Telenor, Telia og Lyse Tele (Ice) er grossistene som kan motta abonnement fra tilgangskjøpere.</p>
      <h3>Tilgangskjøpere og år</h3>
      <p>Sammensetningen kan være ulik fra år til år. Derfor velger appen grossisttilordning for hvert enkelt år, og du kan justere den ved å dra en tilbyder til riktig grossist. Endringen påvirker bare året du står på, slik at for eksempel 2025 kan kontrolleres uten å endre 2024.</p>
      <h3>Beregning</h3>
      <div class="formula">\\[
        \\text{Grossistandel}_{G,y} =
        \\frac{\\sum_{i \\in G_y} A_{i,y}}{\\sum_j A_{j,y}} \\cdot 100
      \\]</div>
      ${advancedBlock({
        filter: `
dk = 'Mobiltelefoni'
AND hg = 'Abonnement'
AND n1 IN ('Fakturert', 'Kontantkort')
AND n2 = 'Ingen'
AND tp = 'Sum'
AND sk = 'Sluttbruker'
AND delar = 'Helår'
        `,
        groupBy: `
Fra mobil.parquet:
GROUP BY ar, lower(fusnavn)
sum(svar) AS abonnement

Etter grossisttilordning i figuren:
GROUP BY ar, grossist
sum(abonnement) AS abonnement
value = 100 * abonnement / sum(abonnement) OVER (PARTITION BY ar)
        `,
      })}
      <p>\\(G_y\\) er mengden av tilbydere som er lagt under grossist \\(G\\) i år \\(y\\). \\(A_{i,y}\\) er abonnement for tilbyder \\(i\\) i samme år. Nevneren er alle abonnement som inngår i grossistberegningen.</p>
      <h3>Slik bør figuren leses</h3>
      <p>Hvis du flytter en tilgangskjøper mellom grossister, oppdateres grossistandelene og konsentrasjonstallene med en gang. Dette gjør det mulig å teste og dokumentere ulike forutsetninger for hvem som hører til hvilken grossist i et bestemt år.</p>
    `,
  },
  concentration: {
    title: "Markedskonsentrasjon",
    html: `
      <p>Konsentrasjonstabellene viser hvor konsentrert markedet er målt med CR2 og HHI. Det vises to grunnlag: omsetning i sluttbrukermarkedet og abonnement i grossistmarkedet. Tabellen for omsetning følger sluttbrukeraktørene, mens grossisttabellen følger nettverkseierne etter at tilgangskjøpere er lagt til riktig grossist.</p>
      <h3>CR2</h3>
      <div class="formula">\\[
        \\text{CR2}_{y} = 100 \\cdot (s_{1,y} + s_{2,y})
      \\]</div>
      <p>CR2 er samlet markedsandel for de to største aktørene i valgt år. Dersom CR2 er 82 prosent, betyr det at de to største aktørene samlet står for 82 prosent av grunnlaget i tabellen.</p>
      <h3>HHI</h3>
      <div class="formula">\\[
        \\text{HHI}_{y} = \\sum_i s_{i,y}^{2}
      \\]</div>
      <p>\\(s_{i,y}\\) er aktørens markedsandel som desimaltall, for eksempel 0,40 for 40 prosent. HHI blir høyere når få aktører har store andeler, og lavere når markedet er jevnere fordelt. I denne appen vises HHI som et tall mellom 0 og 1.</p>
      ${advancedBlock({
        filter: `
Sluttbrukeromsetning:
dk = 'Mobiltelefoni'
AND hg = 'Inntekter'
AND tp = 'Sum'
AND sk = 'Sluttbruker'
AND delar = 'Helår'

Grossistabonnement:
dk = 'Mobiltelefoni'
AND hg = 'Abonnement'
AND n1 IN ('Fakturert', 'Kontantkort')
AND n2 = 'Ingen'
AND tp = 'Sum'
AND sk = 'Sluttbruker'
AND delar = 'Helår'
        `,
        groupBy: `
Sluttbruker: GROUP BY ar, fusnavn; sum(svar) AS absolute
Grossist: GROUP BY ar, grossist; sum(abonnement) AS absolute
share = absolute / sum(absolute) OVER (PARTITION BY ar)
CR2 = 100 * sum(de to største share)
HHI = sum(share * share)
        `,
      })}
      <h3>Slik bør tabellene leses</h3>
      <p>Omsetningstabellen og grossisttabellen må ikke tolkes som samme marked. Omsetningstabellen sier noe om inntektskonsentrasjon i sluttbrukermarkedet. Grossisttabellen sier noe om konsentrasjon i nettverkstilgangen når abonnement fra tilgangskjøpere legges til grossisten de bruker.</p>
    `,
  },
};

let appData = null;
let pendingCharts = [];
let wholesaleAssignment = {};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

document.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    const response = await fetch("./assets/data/app-data.json");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    appData = await response.json();
    wholesaleAssignment = loadWholesaleAssignment();
    attachGlobalEvents();
    render();
    window.addEventListener("resize", debounce(render, 150));
  } catch (error) {
    $("#view-content").innerHTML = `<div class="status">Kunne ikke laste datagrunnlaget: ${escapeHtml(
      error.message,
    )}</div>`;
  }
}

function attachGlobalEvents() {
  document.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-view]");
    if (tab) {
      state.view = tab.dataset.view;
      render();
      return;
    }

    const stateButton = event.target.closest("[data-state]");
    if (stateButton) {
      state[stateButton.dataset.state] = stateButton.dataset.value;
      render();
      return;
    }

    const exportButton = event.target.closest("[data-export]");
    if (exportButton) {
      event.preventDefault();
      downloadExport(exportButton.dataset.export, exportButton.dataset.format || "xlsx");
      return;
    }

    const pngButton = event.target.closest("[data-png]");
    if (pngButton) {
      event.preventDefault();
      downloadChartPng(pngButton.dataset.png, pngButton.dataset.filename || "figur.png");
      return;
    }

    const methodTrigger = event.target.closest("[data-method]");
    if (methodTrigger) {
      event.preventDefault();
      openMethod(methodTrigger.dataset.method);
      return;
    }

    const closeMethod = event.target.closest("[data-close-method]");
    if (closeMethod) {
      event.preventDefault();
      closeMethodDialog();
      return;
    }

    if (event.target.id === "method-modal") {
      closeMethodDialog();
      return;
    }

    const dynamicDownload = event.target.closest("[data-dynamic-download]");
    if (dynamicDownload) {
      event.preventDefault();
      downloadDynamicCsv(dynamicDownload.dataset.dynamicDownload);
      return;
    }

    const resetWholesale = event.target.closest("[data-reset-wholesale]");
    if (resetWholesale) {
      wholesaleAssignment = defaultWholesaleAssignment();
      saveWholesaleAssignment();
      render();
      return;
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !$("#method-modal").hidden) {
      closeMethodDialog();
    }
  });

  document.addEventListener("dragstart", (event) => {
    const item = event.target.closest("[data-provider]");
    if (!item) return;
    event.dataTransfer.setData("text/plain", item.dataset.provider);
    event.dataTransfer.effectAllowed = "move";
  });

  document.addEventListener("dragover", (event) => {
    const zone = event.target.closest("[data-owner-zone]");
    if (!zone) return;
    event.preventDefault();
    zone.classList.add("drag-over");
  });

  document.addEventListener("dragleave", (event) => {
    const zone = event.target.closest("[data-owner-zone]");
    if (zone) zone.classList.remove("drag-over");
  });

  document.addEventListener("drop", (event) => {
    const zone = event.target.closest("[data-owner-zone]");
    if (!zone) return;
    event.preventDefault();
    zone.classList.remove("drag-over");
    const provider = event.dataTransfer.getData("text/plain");
    if (!provider) return;
    const year = String(state.wholesaleYear || appData.metadata.latest_year);
    wholesaleAssignment[year] = wholesaleAssignment[year] || {};
    wholesaleAssignment[year][provider] = zone.dataset.ownerZone;
    saveWholesaleAssignment();
    render();
  });
}

function render() {
  pendingCharts = [];
  const meta = appData.metadata;
  $("#data-period").textContent = ` · ${meta.first_year}-${meta.latest_year}`;
  $$(".tabs button").forEach((button) => {
    button.setAttribute("aria-selected", String(button.dataset.view === state.view));
  });

  const content = $("#view-content");
  if (state.view === "overview") content.innerHTML = renderOverview();
  if (state.view === "segments") content.innerHTML = renderSegments();
  if (state.view === "challengers") content.innerHTML = renderChallengers();
  if (state.view === "prices") content.innerHTML = renderPrices();
  if (state.view === "totals") content.innerHTML = renderTotals();
  if (state.view === "wholesale") content.innerHTML = renderWholesale();
  if (state.view === "data") content.innerHTML = renderData();

  pendingCharts.forEach((chart) => {
    const target = document.getElementById(chart.id);
    if (!target) return;
    if (chart.kind === "projection") {
      drawProjectionChart(target, chart);
    } else {
      drawLineChart(target, chart);
    }
  });
}

function renderKpis() {
  const latestYear = appData.metadata.latest_year;
  const previousYear = latestYear - 1;
  const share = (metric, provider, year = latestYear) =>
    findValue(appData.marketShare, { metric, tilbyder: provider, ar: year });
  const concentration = (metric, key, year = latestYear) =>
    findValue(appData.concentration, { metric, ar: year }, key);
  const arpu = (segment, year = latestYear) =>
    findValue(appData.arpuSegment, { segment, ar: year });
  const nokGb = (provider, year = latestYear) =>
    findValue(appData.nokPerGbTotal, { tilbyder: provider, ar: year });

  const items = [
    {
      label: "Telenor abonnement",
      value: formatPercent(share("Abonnement", "Telenor")),
      delta: deltaText(
        share("Abonnement", "Telenor"),
        share("Abonnement", "Telenor", previousYear),
        "pp",
      ),
      color: COLORS.Telenor,
    },
    {
      label: "Telia abonnement",
      value: formatPercent(share("Abonnement", "Telia")),
      delta: deltaText(
        share("Abonnement", "Telia"),
        share("Abonnement", "Telia", previousYear),
        "pp",
      ),
      color: COLORS.Telia,
    },
    {
      label: "Lyse/Ice omsetning",
      value: formatPercent(share("Omsetning", "Lyse Tele (Ice)")),
      delta: deltaText(
        share("Omsetning", "Lyse Tele (Ice)"),
        share("Omsetning", "Lyse Tele (Ice)", previousYear),
        "pp",
      ),
      color: COLORS["Lyse Tele (Ice)"],
    },
    {
      label: "CR2 omsetning",
      value: formatPercent(concentration("Omsetning", "cr2")),
      delta: deltaText(
        concentration("Omsetning", "cr2"),
        concentration("Omsetning", "cr2", previousYear),
        "pp",
      ),
      color: COLORS.CR2,
    },
    {
      label: "ARPU privat",
      value: `${formatNumber(arpu("Privat"))} kr`,
      delta: deltaText(arpu("Privat"), arpu("Privat", previousYear), "nok"),
      color: COLORS.Privat,
    },
    {
      label: "NOK per GB Telenor",
      value: `${FORMATTERS.one.format(nokGb("Telenor"))} kr`,
      delta: deltaText(nokGb("Telenor"), nokGb("Telenor", previousYear), "nok1"),
      color: COLORS.Telenor,
    },
  ];

  $("#kpis").innerHTML = items
    .map(
      (item) => `
      <article class="kpi">
        <div class="label"><span class="swatch" style="background:${item.color}"></span>${escapeHtml(item.label)}</div>
        <div class="value">${item.value}</div>
        <div class="delta">${item.delta}</div>
      </article>
    `,
    )
    .join("");
}

function renderOverview() {
  const metric = state.metric;
  const rows = appData.marketShare.filter((row) => row.metric === metric);
  const latestRows = rows
    .filter((row) => row.ar === appData.metadata.latest_year)
    .sort((a, b) => b.value - a.value);
  return `
    ${toolbar(
      segmented("metric", ["Abonnement", "Omsetning"], metric),
      `<span class="chart-note">${escapeHtml(metric)} i sluttbrukermarkedet</span>`,
    )}
    <div class="panel-grid">
      ${chartPanel({
        title: "Utvikling i markedsandeler",
        eyebrow: metric,
        exportId: "market-share",
        data: rows,
        order: appData.order.groups,
        yMax: 60,
        unit: "percent",
        caption: latestInsight(latestRows, metric),
      })}
      ${chartPanel({
        title: "Lineær framskriving",
        eyebrow: `${metric} · ${appData.metadata.latest_year}+3`,
        exportId: "projection",
        kind: "projection",
        actual: rows,
        projection: appData.projection.filter((row) => row.metric === metric),
        order: appData.order.groups,
        yMax: 60,
        unit: "percent",
        caption: "Stiplet linje viser enkel lineær trend fra historikken.",
      })}
    </div>
    <div style="height:14px"></div>
    ${tablePanel({
      title: `Siste år: ${metric.toLowerCase()}`,
      exportId: "market-share",
      rows: latestRows,
      columns: [
        { key: "tilbyder", label: "Tilbyder" },
        { key: "absolute", label: metric, numeric: true, format: "number" },
        { key: "value", label: "Markedsandel", numeric: true, format: "percent" },
      ],
    })}
  `;
}

function renderSegments() {
  const metric = state.metric;
  const privateRows = appData.segmentShare.filter(
    (row) => row.metric === metric && row.segment === "Privat",
  );
  const businessRows = appData.segmentShare.filter(
    (row) => row.metric === metric && row.segment === "Bedrift",
  );
  const yMax = metric === "Omsetning" ? 70 : 60;
  return `
    ${toolbar(
      segmented("metric", ["Abonnement", "Omsetning"], metric),
      `<span class="chart-note">${escapeHtml(metric)} fordelt på privat og bedrift</span>`,
    )}
    <div class="panel-grid">
      ${chartPanel({
        title: "Privatmarkedet",
        eyebrow: metric,
        exportId: "segment-share",
        data: privateRows,
        order: appData.order.groups,
        yMax: metric === "Abonnement" ? 50 : 60,
        unit: "percent",
      })}
      ${chartPanel({
        title: "Bedriftsmarkedet",
        eyebrow: metric,
        exportId: "segment-share",
        data: businessRows,
        order: appData.order.groups,
        yMax,
        unit: "percent",
      })}
    </div>
  `;
}

function renderChallengers() {
  const scope = state.challengerScope;
  const metric = state.metric;
  const data =
    scope === "Privat" ? appData.privateChallengers : appData.businessChallengers;
  const order =
    scope === "Privat"
      ? appData.order.privateChallengers
      : appData.order.businessChallengers;
  const rows = data.filter((row) => row.metric === metric);
  const yMax =
    scope === "Privat"
      ? metric === "Abonnement"
        ? 4
        : 3
      : metric === "Abonnement"
        ? 8
        : 10;
  return `
    ${toolbar(
      `${segmented("challengerScope", ["Privat", "Bedrift"], scope)}${segmented(
        "metric",
        ["Abonnement", "Omsetning"],
        metric,
      )}`,
      `<span class="chart-note">Utvalgte mindre tilbydere</span>`,
    )}
    <div class="panel-grid single">
      ${chartPanel({
        title: `${scope}markedet: øvrige tilbydere`,
        eyebrow: metric,
        exportId: scope === "Privat" ? "private-challengers" : "business-challengers",
        data: rows,
        order,
        yMax,
        unit: "percent",
      })}
    </div>
  `;
}

function renderPrices() {
  const mode = state.priceMode;
  const selector = segmented(
    "priceMode",
    [
      { value: "arpu-segment", label: "ARPU segment" },
      { value: "arpu-provider", label: "ARPU tilbyder" },
      { value: "nok-gb", label: "NOK per GB" },
    ],
    mode,
  );

  if (mode === "arpu-segment") {
    return `
      ${toolbar(selector, `<span class="chart-note">Omsetning per kunde per måned</span>`)}
      <div class="panel-grid single">
        ${chartPanel({
          title: "Omsetning per kunde",
          eyebrow: "NOK per måned",
          exportId: "arpu-segment",
          data: appData.arpuSegment,
          seriesKey: "segment",
          order: ["Bedrift", "Privat"],
          unit: "nok",
        })}
      </div>
    `;
  }

  if (mode === "arpu-provider") {
    const privateRows = appData.arpuProvider.filter((row) => row.segment === "Privat");
    const businessRows = appData.arpuProvider.filter((row) => row.segment === "Bedrift");
    return `
      ${toolbar(selector, `<span class="chart-note">ARPU for utvalgte tilbydere</span>`)}
      <div class="panel-grid">
        ${chartPanel({
          title: "Privatmarkedet",
          eyebrow: "NOK per måned",
          exportId: "arpu-provider",
          data: privateRows,
          order: ["Telenor", "Telia", "Ice", "Fjordkraft", "Chili mobil", "Plussmobil", "Happybytes"],
          unit: "nok",
        })}
        ${chartPanel({
          title: "Bedriftsmarkedet",
          eyebrow: "NOK per måned",
          exportId: "arpu-provider",
          data: businessRows,
          order: ["Telenor", "Telia", "Unifon", "Ice"],
          unit: "nok",
        })}
      </div>
    `;
  }

  return `
    ${toolbar(selector, `<span class="chart-note">Omsetning per GB datatrafikk</span>`)}
    <div class="panel-grid">
      ${chartPanel({
        title: "Totalt",
        eyebrow: "NOK per GB",
        exportId: "nok-per-gb-total",
        data: appData.nokPerGbTotal,
        order: ["Telenor", "Telia", "Ice", "Øvrige"],
        unit: "nok1",
      })}
      ${chartPanel({
        title: "Utvalgte tilbydere",
        eyebrow: "NOK per GB",
        exportId: "nok-per-gb-providers",
        data: appData.nokPerGbProviders,
        order: appData.order.priceProviders,
        unit: "nok1",
      })}
    </div>
  `;
}

function renderTotals() {
  const period = "Helår";
  const totalRows = appData.totals.filter((row) => row.period === period);
  const shareRows = appData.providerShareTrend.filter((row) => row.period === period);
  return `
    ${toolbar(
      "",
      `<span class="chart-note">Helår · samlet utvikling i abonnement og inntekter</span>`,
    )}
    <div class="panel-grid">
      ${chartPanel({
        title: "Totalt antall abonnement",
        eyebrow: period,
        exportId: "totals",
        data: totalRows.filter((row) => row.metric === "Abonnement"),
        seriesKey: "metric",
        order: ["Abonnement"],
        unit: "number",
      })}
      ${chartPanel({
        title: "Totale inntekter",
        eyebrow: period,
        exportId: "totals",
        data: totalRows.filter((row) => row.metric === "Inntekter"),
        seriesKey: "metric",
        order: ["Inntekter"],
        unit: "number",
      })}
      ${chartPanel({
        title: "Andel abonnement",
        eyebrow: period,
        exportId: "provider-share-trend",
        data: shareRows.filter((row) => row.metric === "Abonnement"),
        order: appData.order.groups,
        unit: "percent",
        yMax: 50,
      })}
      ${chartPanel({
        title: "Andel inntekt",
        eyebrow: period,
        exportId: "provider-share-trend",
        data: shareRows.filter((row) => row.metric === "Omsetning"),
        order: appData.order.groups,
        unit: "percent",
        yMax: 60,
      })}
    </div>
  `;
}

function renderWholesale() {
  const latest = appData.metadata.latest_year;
  const years = yearColumns(appData.providerSubscriptions);
  const selectedYear = years.includes(Number(state.wholesaleYear))
    ? Number(state.wholesaleYear)
    : latest;
  state.wholesaleYear = String(selectedYear);
  const wholesaleRows = computeWholesaleRows();
  const selectedWholesale = wholesaleRows.filter((row) => row.ar === selectedYear);
  const grossistConcentration = computeGrossistConcentration(wholesaleRows);
  const retailRevenueConcentration = appData.concentration.filter(
    (row) => row.metric === "Omsetning",
  );
  const wholesaleMatrix = matrixByYear(
    wholesaleRows,
    "grossist",
    "value",
    ["Telenor", "Telia", "Lyse Tele (Ice)"],
  );
  return `
    ${toolbar(
      segmented("wholesaleYear", years.map(String), String(selectedYear)),
      `<span class="chart-note">Helår · dra tilbydere mellom grossistene for valgt år</span>`,
    )}
    <div class="panel-grid single">
      ${renderWholesaleBuilder(selectedWholesale, selectedYear)}
    </div>
    <div style="height:14px"></div>
    <div class="panel-grid single">
      ${tablePanel({
        title: "Grossistandeler (helår)",
        exportId: "wholesale",
        dynamicId: "wholesale",
        rows: wholesaleMatrix,
        columns: [
          { key: "label", label: "Abonnement" },
          ...yearColumns(wholesaleRows).map((year) => ({
            key: String(year),
            label: String(year),
            numeric: true,
            format: "percent",
          })),
        ],
      })}
    </div>
    <div style="height:14px"></div>
    ${renderConcentrationPanel(retailRevenueConcentration, grossistConcentration)}
  `;
}

function renderConcentrationPanel(retailRows, grossistRows) {
  return `
    <section class="table-panel concentration-panel">
      <div class="table-head">
        <div>
          <span class="eyebrow">Tabell</span>
          <h2>Markedskonsentrasjon</h2>
        </div>
        ${tableDownloadButtons("concentration", null, "concentration")}
      </div>
      <div class="concentration-tables">
        ${renderConcentrationPptTable({
          heading: "Basert på omsetning",
          subheading: "sluttbrukermarked",
          rows: retailRows,
          cr2Digits: 1,
          hhiDigits: 2,
          hhiExactForLatest: true,
        })}
        ${renderConcentrationPptTable({
          heading: "Basert på abonnement",
          subheading: "grossistmarked",
          rows: grossistRows,
          cr2Digits: 2,
          hhiDigits: 4,
        })}
      </div>
    </section>
  `;
}

function renderConcentrationPptTable({
  heading,
  subheading,
  rows,
  cr2Digits,
  hhiDigits,
  hhiExactForLatest = false,
}) {
  const sortedRows = [...rows].sort((a, b) => Number(a.ar) - Number(b.ar));
  const latest = Math.max(...sortedRows.map((row) => Number(row.ar)));
  return `
    <table class="ppt-concentration">
      <thead>
        <tr>
          <th rowspan="2">År</th>
          <th colspan="2">${escapeHtml(heading)} <em>(${escapeHtml(subheading)})</em></th>
        </tr>
        <tr>
          <th>CR2</th>
          <th>HHI</th>
        </tr>
      </thead>
      <tbody>
        ${sortedRows
          .map(
            (row) => `
            <tr>
              <td>${row.ar}</td>
              <td>${formatPercentDigits(row.cr2, cr2Digits)}</td>
              <td>${formatHhiForConcentration(row.hhi, hhiDigits, hhiExactForLatest && Number(row.ar) >= latest - 1)}</td>
            </tr>
          `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderWholesaleBuilder(yearRows, year) {
  const latestByOwner = new Map(yearRows.map((row) => [row.grossist, row]));
  const zones = appData.order.wholesaleOwners || ["Telenor", "Telia", "Lyse Tele (Ice)"];
  const activeProviders = providersForYear(year);
  return `
    <section class="panel">
      <div class="panel-head">
        <div>
          <span class="eyebrow">Tilgangstilordning</span>
          <h2>Velg hvem som hører til hvilken grossist i ${year}</h2>
        </div>
        <div class="panel-actions">
          ${methodButton("wholesale")}
          <button class="icon-button" type="button" data-reset-wholesale title="Tilbakestill til startforslag" aria-label="Tilbakestill til startforslag">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 3-6.7"></path>
              <path d="M3 4v6h6"></path>
            </svg>
          </button>
        </div>
      </div>
      <p class="panel-caption">
        Tabellen under beregnes fra rapporterte abonnementstall. Tilgangskjøpere legges til
        grossisten de kjøpte tilgang hos i valgt år. Du kan justere sammensetningen ved å
        dra tilbydere mellom grossistene.
      </p>
      <div class="owner-grid">
        ${zones
          .map((owner) => {
            const providers = activeProviders
              .filter((provider) => getWholesaleOwner(year, provider.provider) === owner)
              .sort((a, b) => a.label.localeCompare(b.label, "nb"));
            const summary = latestByOwner.get(owner);
            return `
              <div class="owner-zone" data-owner-zone="${escapeHtml(owner)}">
                <div class="owner-head">
                  <span><span class="swatch" style="background:${COLORS[owner] || "#8a9097"}"></span>${escapeHtml(owner)}</span>
                  <strong>${summary ? formatPercent(summary.value) : "0,0 %"}</strong>
                </div>
                <div class="provider-list">
                  ${providers
                    .map(
                      (provider) => `
                        <div class="provider-chip" draggable="true" data-provider="${escapeHtml(provider.provider)}">
                          <span>${escapeHtml(provider.label)}</span>
                        </div>
                      `,
                    )
                    .join("")}
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function defaultWholesaleAssignment() {
  const defaults = {};
  yearColumns(appData.providerSubscriptions).forEach((year) => {
    const yearKey = String(year);
    const template = appData.wholesaleAssignmentTemplate?.[yearKey] || {};
    defaults[yearKey] = {};
    providersForYear(year).forEach((provider) => {
      defaults[yearKey][provider.provider] =
        template[provider.provider] || provider.defaultOwner || "Telenor";
    });
  });
  return defaults;
}

function loadWholesaleAssignment() {
  const defaults = defaultWholesaleAssignment();
  try {
    const stored = JSON.parse(localStorage.getItem("mobilanalyse.wholesaleAssignment") || "{}");
    const owners = new Set(appData.order.wholesaleOwners || []);
    const merged = {};
    Object.entries(defaults).forEach(([year, assignments]) => {
      merged[year] = { ...assignments };
      const storedYear = stored?.[year];
      if (!storedYear || typeof storedYear !== "object") return;
      Object.entries(storedYear).forEach(([provider, owner]) => {
        if (provider in assignments && owners.has(owner)) {
          merged[year][provider] = owner;
        }
      });
    });
    return merged;
  } catch {
    return defaults;
  }
}

function saveWholesaleAssignment() {
  localStorage.setItem(
    "mobilanalyse.wholesaleAssignment",
    JSON.stringify(wholesaleAssignment),
  );
}

function providersForYear(year) {
  const providerMeta = new Map(appData.providers.map((provider) => [provider.provider, provider]));
  const providerNames = [
    ...new Set(
      appData.providerSubscriptions
        .filter((row) => Number(row.ar) === Number(year))
        .map((row) => row.provider),
    ),
  ];
  return providerNames.map(
    (provider) =>
      providerMeta.get(provider) || {
        provider,
        label: provider.slice(0, 1).toUpperCase() + provider.slice(1),
        defaultOwner: "Telenor",
      },
  );
}

function defaultOwnerFor(provider) {
  return appData.providers.find((item) => item.provider === provider)?.defaultOwner || "Telenor";
}

function getWholesaleOwner(year, provider) {
  const yearKey = String(year);
  return (
    wholesaleAssignment?.[yearKey]?.[provider] ||
    appData.wholesaleAssignmentTemplate?.[yearKey]?.[provider] ||
    defaultOwnerFor(provider)
  );
}

function computeWholesaleRows() {
  const buckets = new Map();
  const totals = new Map();
  appData.providerSubscriptions
    .filter((row) => row.period === "Helår")
    .forEach((row) => {
      const year = Number(row.ar);
      const owner = getWholesaleOwner(year, row.provider);
      const key = `${year}|${owner}`;
      const value = Number(row.abonnement);
      buckets.set(key, (buckets.get(key) || 0) + value);
      totals.set(year, (totals.get(year) || 0) + value);
    });
  return [...buckets.entries()]
    .map(([key, abonnement]) => {
      const [yearText, grossist] = key.split("|");
      const year = Number(yearText);
      return {
        ar: year,
        grossist,
        abonnement,
        value: totals.get(year) ? (abonnement * 100) / totals.get(year) : 0,
      };
    })
    .sort((a, b) => a.ar - b.ar || a.grossist.localeCompare(b.grossist, "nb"));
}

function computeGrossistConcentration(rows) {
  const years = yearColumns(rows);
  return years.map((year) => {
    const shares = rows
      .filter((row) => row.ar === year)
      .map((row) => row.value / 100)
      .sort((a, b) => b - a);
    return {
      ar: year,
      cr2: shares.slice(0, 2).reduce((sum, value) => sum + value, 0) * 100,
      hhi: shares.reduce((sum, value) => sum + value * value, 0),
    };
  });
}

function matrixByYear(rows, groupKey, valueKey, preferredOrder = []) {
  const years = yearColumns(rows);
  const groups = [
    ...preferredOrder.filter((group) => rows.some((row) => row[groupKey] === group)),
    ...inferSeries(rows, groupKey).filter((group) => !preferredOrder.includes(group)),
  ];
  return groups.map((group) => {
    const output = { label: group };
    years.forEach((year) => {
      const row = rows.find((item) => item[groupKey] === group && item.ar === year);
      output[String(year)] = row ? row[valueKey] : null;
    });
    return output;
  });
}

function yearColumns(rows) {
  return [...new Set(rows.map((row) => Number(row.ar)))].sort((a, b) => a - b);
}

function renderData() {
  const meta = appData.metadata;
  const downloads = Object.entries(appData.exports)
    .map(([id, exportInfo]) => {
      const label = exportInfo.label || id.replace(/-/g, " ");
      return `
        <button class="icon-link" type="button" data-export="${id}" data-format="xlsx">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <path d="M7 10l5 5 5-5"></path>
            <path d="M12 15V3"></path>
          </svg>
          <span>${escapeHtml(label)}</span>
        </button>
      `;
    })
    .join("");
  const latestRows = appData.marketShare.filter((row) => row.ar === meta.latest_year);
  return `
    <div class="panel-grid single">
      <section class="panel">
        <div class="panel-head">
          <div>
            <span class="eyebrow">Datagrunnlag</span>
            <h2>${formatNumber(meta.row_count)} rader fra ${meta.first_year}-${meta.latest_year}</h2>
          </div>
        </div>
        <p class="panel-caption">
          Appen bygger på helårsrapporterte mobilmarkedstall for ${meta.first_year}-${meta.latest_year}.
          Nedlastingene under gir tallene bak figurene i Excel-format.
        </p>
      </section>
    </div>
    <div style="height:14px"></div>
    <section class="table-panel">
      <div class="table-head">
        <div>
          <span class="eyebrow">Nedlasting</span>
          <h2>Excel-eksporter</h2>
        </div>
      </div>
      <div class="download-list" style="padding:15px">${downloads}</div>
    </section>
    <div style="height:14px"></div>
    ${tablePanel({
      title: `Markedsandeler ${meta.latest_year}`,
      exportId: "market-share",
      rows: latestRows.sort((a, b) => a.metric.localeCompare(b.metric) || b.value - a.value),
      columns: [
        { key: "metric", label: "Grunnlag" },
        { key: "tilbyder", label: "Tilbyder" },
        { key: "absolute", label: "Verdi", numeric: true, format: "number" },
        { key: "value", label: "Andel", numeric: true, format: "percent" },
      ],
    })}
  `;
}

function chartPanel(config) {
  const id = `chart-${pendingCharts.length + 1}`;
  pendingCharts.push({ id, kind: "line", ...config });
  const order = config.order || inferSeries(config.data, config.seriesKey || "tilbyder");
  const methodId = config.methodId || config.exportId;
  return `
    <article class="panel">
      <div class="panel-head">
        <div>
          <span class="eyebrow">${escapeHtml(config.eyebrow || "")}</span>
          <h2>${escapeHtml(config.title)}</h2>
        </div>
        ${chartDownloadButtons(config.exportId, id, `${slugify(config.title)}.png`, methodId)}
      </div>
      <div class="chart" id="${id}"></div>
      ${legend(order)}
      ${config.caption ? `<p class="panel-caption">${escapeHtml(config.caption)}</p>` : ""}
    </article>
  `;
}

function tablePanel({ title, exportId, dynamicId, methodId, rows, columns }) {
  return `
    <section class="table-panel">
      <div class="table-head">
        <div>
          <span class="eyebrow">Tabell</span>
          <h2>${escapeHtml(title)}</h2>
        </div>
        ${tableDownloadButtons(exportId, dynamicId, methodId || dynamicId || exportId)}
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>${columns
              .map(
                (column) =>
                  `<th class="${column.numeric ? "number" : ""}">${escapeHtml(column.label)}</th>`,
              )
              .join("")}</tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (row) => `
                <tr>
                  ${columns
                    .map(
                      (column) =>
                        `<td class="${column.numeric ? "number" : ""}">${formatCell(
                          row[column.key],
                          column.format,
                        )}</td>`,
                    )
                    .join("")}
                </tr>
              `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function drawLineChart(container, config) {
  const data = config.data || [];
  const seriesKey = config.seriesKey || "tilbyder";
  if (!data.length) {
    container.innerHTML = '<div class="status">Ingen data</div>';
    return;
  }
  const series = (config.order || inferSeries(data, seriesKey)).filter((name) =>
    data.some((row) => row[seriesKey] === name),
  );
  const allYears = [...new Set(data.map((row) => Number(row.ar)))].sort((a, b) => a - b);
  const maxValue = Math.max(...data.map((row) => Number(row.value || 0)));
  const bounds = chartBounds(container, allYears, config.yMax || niceMax(maxValue));
  const svg = createSvg(bounds.width, bounds.height);
  drawAxes(svg, bounds, config.unit);

  series.forEach((name) => {
    const rows = data
      .filter((row) => row[seriesKey] === name)
      .sort((a, b) => Number(a.ar) - Number(b.ar));
    if (!rows.length) return;
    drawSeries(svg, rows, name, bounds, {
      color: COLORS[name] || "#44546a",
      unit: config.unit,
      seriesKey,
      dashed: false,
    });
  });

  container.replaceChildren(svg);
}

function drawProjectionChart(container, config) {
  const actual = config.actual || [];
  const projection = config.projection || [];
  const data = actual.concat(projection);
  const allYears = [...new Set(data.map((row) => Number(row.ar)))].sort((a, b) => a - b);
  const maxValue = Math.max(...data.map((row) => Number(row.value || 0)));
  const bounds = chartBounds(container, allYears, config.yMax || niceMax(maxValue));
  const svg = createSvg(bounds.width, bounds.height);
  drawAxes(svg, bounds, config.unit);

  config.order.forEach((name) => {
    const actualRows = actual
      .filter((row) => row.tilbyder === name)
      .sort((a, b) => Number(a.ar) - Number(b.ar));
    const projectionRows = projection
      .filter((row) => row.tilbyder === name)
      .sort((a, b) => Number(a.ar) - Number(b.ar));
    const color = COLORS[name] || "#44546a";
    if (actualRows.length) {
      drawSeries(svg, actualRows, name, bounds, {
        color,
        unit: config.unit,
        seriesKey: "tilbyder",
        dashed: false,
        endpoint: false,
      });
    }
    if (projectionRows.length) {
      drawSeries(svg, projectionRows, name, bounds, {
        color,
        unit: config.unit,
        seriesKey: "tilbyder",
        dashed: true,
        endpoint: true,
      });
    }
  });

  container.replaceChildren(svg);
}

function drawSeries(svg, rows, name, bounds, options) {
  const points = rows.map((row) => ({
    x: scaleX(Number(row.ar), bounds),
    y: scaleY(Number(row.value), bounds),
    row,
  }));
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("class", "series-line");
  path.setAttribute("d", points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" "));
  path.setAttribute("stroke", options.color);
  path.setAttribute("stroke-width", options.dashed ? "2.4" : "3");
  if (options.dashed) path.setAttribute("stroke-dasharray", "5 5");
  svg.appendChild(path);

  points.forEach((point, index) => {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("class", "point");
    circle.setAttribute("cx", point.x);
    circle.setAttribute("cy", point.y);
    circle.setAttribute("r", index === points.length - 1 ? 4.2 : 3.4);
    circle.setAttribute("stroke", options.color);
    circle.addEventListener("pointerenter", (event) =>
      showTooltip(event, tooltipHtml(name, point.row, options.unit)),
    );
    circle.addEventListener("pointermove", (event) =>
      showTooltip(event, tooltipHtml(name, point.row, options.unit)),
    );
    circle.addEventListener("pointerleave", hideTooltip);
    svg.appendChild(circle);
  });

  const last = points[points.length - 1];
  if (last && options.endpoint !== false) {
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("class", "endpoint-label");
    label.setAttribute("x", Math.min(last.x + 8, bounds.width - 50));
    label.setAttribute("y", clamp(last.y + 4, bounds.margin.top + 8, bounds.height - bounds.margin.bottom - 4));
    label.textContent = formatByUnit(last.row.value, options.unit);
    svg.appendChild(label);
  }
}

function drawAxes(svg, bounds, unit) {
  const grid = document.createElementNS("http://www.w3.org/2000/svg", "g");
  grid.setAttribute("class", "grid");
  const ticks = yTicks(bounds.yMax);
  ticks.forEach((tick) => {
    const y = scaleY(tick, bounds);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", bounds.margin.left);
    line.setAttribute("x2", bounds.width - bounds.margin.right);
    line.setAttribute("y1", y);
    line.setAttribute("y2", y);
    grid.appendChild(line);
  });
  svg.appendChild(grid);

  const axis = document.createElementNS("http://www.w3.org/2000/svg", "g");
  axis.setAttribute("class", "axis");

  ticks.forEach((tick) => {
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", bounds.margin.left - 8);
    text.setAttribute("y", scaleY(tick, bounds) + 4);
    text.setAttribute("text-anchor", "end");
    text.textContent = formatAxis(tick, unit);
    axis.appendChild(text);
  });

  bounds.years.forEach((year) => {
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", scaleX(year, bounds));
    text.setAttribute("y", bounds.height - bounds.margin.bottom + 24);
    text.setAttribute("text-anchor", "middle");
    text.textContent = year;
    axis.appendChild(text);
  });

  svg.appendChild(axis);
}

function chartBounds(container, years, yMax) {
  const rect = container.getBoundingClientRect();
  const width = Math.max(420, Math.round(rect.width || 720));
  const height = Math.max(280, Math.round(rect.height || 340));
  return {
    width,
    height,
    years,
    xMin: Math.min(...years),
    xMax: Math.max(...years),
    yMax,
    margin: { top: 18, right: 74, bottom: 48, left: 54 },
  };
}

function createSvg(width, height) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Linjediagram");
  return svg;
}

function scaleX(value, bounds) {
  if (bounds.xMax === bounds.xMin) return bounds.margin.left;
  const span = bounds.width - bounds.margin.left - bounds.margin.right;
  return bounds.margin.left + ((value - bounds.xMin) / (bounds.xMax - bounds.xMin)) * span;
}

function scaleY(value, bounds) {
  const span = bounds.height - bounds.margin.top - bounds.margin.bottom;
  return bounds.height - bounds.margin.bottom - (value / bounds.yMax) * span;
}

function toolbar(left, right = "") {
  return `
    <div class="toolbar">
      <div style="display:flex;gap:8px;flex-wrap:wrap">${left}</div>
      <div>${right}</div>
    </div>
  `;
}

function segmented(key, options, active) {
  const normalized = options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option,
  );
  return `
    <div class="segmented" role="group">
      ${normalized
        .map(
          (option) => `
          <button
            type="button"
            data-state="${key}"
            data-value="${escapeHtml(option.value)}"
            aria-pressed="${option.value === active}"
          >${escapeHtml(option.label)}</button>
        `,
        )
        .join("")}
    </div>
  `;
}

function legend(order) {
  return `
    <div class="legend">
      ${order
        .map(
          (name) => `
          <span class="legend-item">
            <span class="swatch" style="background:${COLORS[name] || "#44546a"}"></span>
            ${escapeHtml(name)}
          </span>
        `,
        )
        .join("")}
    </div>
  `;
}

function chartDownloadButtons(exportId, chartId, filename, methodId) {
  return `
    <div class="panel-actions">
      ${methodButton(methodId)}
      ${exportId ? iconButton("data-export", exportId, "xlsx", "Last ned Excel", "M4 4h16v16H4z|M8 8h8|M8 12h8|M8 16h5") : ""}
      <button class="icon-button" type="button" data-png="${chartId}" data-filename="${escapeHtml(filename)}" title="Last ned PNG" aria-label="Last ned PNG">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <path d="M7 10l5 5 5-5"></path>
          <path d="M12 15V3"></path>
        </svg>
      </button>
    </div>
  `;
}

function tableDownloadButtons(exportId, dynamicId, methodId) {
  if (!exportId && !dynamicId && !methodId) return "";
  return `
    <div class="panel-actions">
      ${methodButton(methodId)}
      ${exportId ? iconButton("data-export", exportId, "xlsx", "Last ned Excel", "M4 4h16v16H4z|M8 8h8|M8 12h8|M8 16h5") : ""}
      ${
        dynamicId
          ? `<button class="icon-button" type="button" data-dynamic-download="${dynamicId}" title="Last ned aktuell CSV" aria-label="Last ned aktuell CSV">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <path d="M7 10l5 5 5-5"></path>
        <path d="M12 15V3"></path>
      </svg>
    </button>`
          : ""
      }
    </div>
  `;
}

function methodButton(methodId) {
  if (!methodId || !METHODS[methodId]) return "";
  return `
    <button class="icon-button method-button" type="button" data-method="${escapeHtml(methodId)}" title="Vis beregningsmetode" aria-label="Vis beregningsmetode">
      <span aria-hidden="true">?</span>
    </button>
  `;
}

function openMethod(methodId) {
  const method = METHODS[methodId];
  if (!method) return;
  const modal = $("#method-modal");
  $("#method-title").textContent = method.title;
  $("#method-body").innerHTML = method.html;
  modal.hidden = false;
  document.body.classList.add("modal-open");
  modal.querySelector("[data-close-method]")?.focus();
  if (window.MathJax?.typesetPromise) {
    window.MathJax.typesetPromise([$("#method-body")]).catch(() => {});
  }
}

function closeMethodDialog() {
  const modal = $("#method-modal");
  modal.hidden = true;
  document.body.classList.remove("modal-open");
  $("#method-body").innerHTML = "";
}

function iconButton(attribute, id, format, title, paths) {
  return `
    <button class="icon-button" type="button" ${attribute}="${id}" data-format="${format}" title="${title}" aria-label="${title}">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        ${paths
          .split("|")
          .map((path) => `<path d="${path}"></path>`)
          .join("")}
      </svg>
    </button>
  `;
}

function downloadExport(id, format = "xlsx") {
  const info = appData.exports[id];
  if (!info) return;
  const link = document.createElement("a");
  link.href = format === "csv" ? info.csvPath : info.xlsxPath || info.csvPath;
  link.download = format === "csv" ? info.csvFilename : info.xlsxFilename || info.csvFilename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function downloadDynamicCsv(id) {
  if (id !== "wholesale") return;
  const rows = computeWholesaleRows();
  const columns = ["ar", "grossist", "abonnement", "value"];
  const csv = [
    columns.join(";"),
    ...rows.map((row) =>
      columns
        .map((column) => String(row[column] ?? "").replaceAll(";", ","))
        .join(";"),
    ),
  ].join("\n");
  downloadBlob(
    new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }),
    "wholesale-helar-aktuell.csv",
  );
}

async function downloadChartPng(chartId, filename) {
  const chart = document.getElementById(chartId);
  const svg = chart?.querySelector("svg");
  if (!svg) return;
  const clone = svg.cloneNode(true);
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = `
    .axis text{fill:#667584;font-size:11px;font-family:Inter,Arial,sans-serif}
    .axis line,.grid line{stroke:#d7e0e8}
    .series-line{fill:none;stroke-linecap:round;stroke-linejoin:round}
    .point{fill:white;stroke-width:2}
    .endpoint-label{fill:#26323d;font-size:11px;font-weight:650;font-family:Inter,Arial,sans-serif;paint-order:stroke;stroke:white;stroke-width:4px}
  `;
  clone.insertBefore(style, clone.firstChild);
  const source = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const image = new Image();
  const { width, height } = svg.viewBox.baseVal;
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * 2);
  canvas.height = Math.round(height * 2);
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  return new Promise((resolve) => {
    canvas.toBlob((png) => {
      if (png) downloadBlob(png, filename);
      resolve(Boolean(png && png.size > 1000));
    }, "image/png");
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function findValue(rows, match, key = "value") {
  const row = rows.find((item) =>
    Object.entries(match).every(([field, value]) => item[field] === value),
  );
  return row ? Number(row[key]) : NaN;
}

function latestInsight(rows, metric) {
  const leader = rows[0];
  const challenger = rows.find((row) => row.tilbyder === "Lyse Tele (Ice)");
  if (!leader || !challenger) return "";
  return `${leader.tilbyder} er størst på ${metric.toLowerCase()} med ${formatPercent(
    leader.value,
  )}. Lyse/Ice ligger på ${formatPercent(challenger.value)}.`;
}

function inferSeries(rows, key) {
  return [...new Set(rows.map((row) => row[key]))].filter(Boolean);
}

function yTicks(max) {
  const count = 5;
  const step = max / count;
  return Array.from({ length: count + 1 }, (_, index) => step * index);
}

function niceMax(value) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const padded = value * 1.12;
  const step = padded <= 5 ? 0.5 : padded <= 12 ? 1 : padded <= 80 ? 10 : 50;
  return Math.ceil(padded / step) * step;
}

function tooltipHtml(series, row, unit) {
  return `<strong>${escapeHtml(series)}</strong>${row.ar}: ${formatByUnit(row.value, unit)}`;
}

function showTooltip(event, html) {
  const tooltip = $("#tooltip");
  tooltip.innerHTML = html;
  tooltip.style.display = "block";
  const pad = 12;
  const rect = tooltip.getBoundingClientRect();
  const left = Math.min(event.clientX + pad, window.innerWidth - rect.width - pad);
  const top = Math.min(event.clientY + pad, window.innerHeight - rect.height - pad);
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function hideTooltip() {
  $("#tooltip").style.display = "none";
}

function formatCell(value, format) {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  if (format === "percent") return formatPercent(value);
  if (format === "number") return formatNumber(value);
  if (format === "nok") return `${formatNumber(value)} kr`;
  if (format === "nok1") return `${FORMATTERS.one.format(Number(value))} kr`;
  if (format === "hhi") return FORMATTERS.two.format(Number(value));
  return escapeHtml(String(value)).replaceAll("; ", "<br>");
}

function formatByUnit(value, unit) {
  if (unit === "percent") return formatPercent(value);
  if (unit === "nok") return `${formatNumber(value)} kr`;
  if (unit === "nok1") return `${FORMATTERS.one.format(Number(value))} kr`;
  if (unit === "number") return formatNumber(value);
  return FORMATTERS.one.format(Number(value));
}

function formatAxis(value, unit) {
  if (unit === "percent") return `${FORMATTERS.one.format(value)} %`;
  if (unit === "number") return formatNumber(value);
  if (unit === "nok" || unit === "nok1") return FORMATTERS.one.format(value);
  return FORMATTERS.one.format(value);
}

function formatPercent(value) {
  return `${FORMATTERS.one.format(Number(value))} %`;
}

function formatPercentDigits(value, digits) {
  return `${new Intl.NumberFormat("nb-NO", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value))} %`;
}

function formatDecimalDigits(value, digits) {
  return new Intl.NumberFormat("nb-NO", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value));
}

function formatHhiForConcentration(value, digits, includeExact) {
  const rounded = formatDecimalDigits(value, digits);
  if (!includeExact) return rounded;
  return `${rounded} (${formatDecimalDigits(value, 4)})`;
}

function formatNumber(value) {
  return FORMATTERS.number.format(Number(value));
}

function deltaText(current, previous, unit) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return "ingen sammenligning";
  const delta = current - previous;
  const sign = delta > 0 ? "+" : "";
  if (unit === "pp") return `${sign}${FORMATTERS.one.format(delta)} pp fra året før`;
  if (unit === "nok1") return `${sign}${FORMATTERS.one.format(delta)} kr fra året før`;
  return `${sign}${formatNumber(delta)} kr fra året før`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function debounce(fn, wait) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}
