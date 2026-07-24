## Context

The repository already curates Watertown municipal election results (2017–2025)
into two clean CSVs via an R pipeline (`results/process-results.R`), plus a
12-feature precinct GeoJSON (`gis/watertown-precincts-2022.geojson`). The combined
dataset is tiny (~110 KB) and fully static: 5 biennial elections, 11 offices that
vary by year, 12 precincts organized into 4 council districts (A={1,2,3},
B={4,5,6}, C={7,8,9}, D={10,11,12}).

Because the entire dataset fits in the browser at once, there is no need for a
backend, API, database, or pagination. The repository currently has an R + Markdown
character and **no JavaScript toolchain**, which is the primary constraint driving
the design toward minimal moving parts.

## Goals / Non-Goals

**Goals:**
- Publicly browsable results with drill-down: elections → offices → precincts.
- A categorical choropleth showing the winning candidate per precinct.
- Zero build step: deployable by committing files and pointing GitHub Pages at
  `docs/`.
- Keep all vote/winner logic in the existing R pipeline; the frontend only renders.
- Shareable URLs for each view.

**Non-Goals:**
- Voter-turnout percentages (registered-voter denominators are not surfaced).
- Cross-year trend comparisons.
- Candidate-information pages (websites, forums, addresses).
- Click-to-filter or other advanced map interaction beyond hover tooltips.
- Any server, API, database, npm install, or CI build.

## Decisions

### Decision: Zero-build vanilla site in `docs/`, served by GitHub Pages
A single `docs/` folder (`index.html`, `app.js`, `style.css`, `data/`) is served
directly by GitHub Pages with no build step or Action.
- **Why:** Matches "simple and efficient" and this repo's toolchain-free character;
  the 110 KB dataset never justifies a bundler or backend.
- **Alternatives considered:** Astro/Eleventy SSG (clean URLs + SEO, but adds
  npm/node and a GitHub Action — rejected as overkill); Leaflet SPA with a street
  basemap (heavier deps and requires tile fetches — rejected, not self-contained).

### Decision: Hash-based routing
Views are addressed by URL fragment: `#/` (home), `#/2025-11-04` (election),
`#/2025-11-04/councilor-at-large` (office).
- **Why:** Gives shareable, deep-linkable URLs with no server-side routing and no
  build step. GitHub Pages needs no `404.html` rewrite trick.
- **Alternatives considered:** History API / clean paths (requires SSG or SPA
  fallback config — rejected for complexity); single scrolling page (loses
  shareable per-office links — rejected).

### Decision: R pipeline emits a precomputed `elections.json`
`process-results.R` gains a step that writes `docs/data/elections.json` nested as
elections → offices → candidates (with `by_precinct`), including `seats`, `scope`
(`citywide` | `district` | `question`), `district`, `precincts`, `is_winner`,
`rank`, blank/write-in totals, and a precomputed `precinct_winners` map. Existing
CSV outputs are unchanged.
- **Why:** Keeps all data logic in the language already used and trusted; ties and
  winner determination are resolved once, server-side of the data flow, so `app.js`
  is pure rendering. One HTTP fetch loads everything.
- **Alternatives considered:** Fetch + parse the CSVs in the browser (pushes
  winner/scope logic into JS, duplicating R — rejected); a separate Python/Node
  build script (introduces a second language/toolchain — rejected).

### Decision: Leaflet + light basemap tiles for the choropleth
`app.js` renders the precinct map with Leaflet (pinned CDN, with SRI) over CARTO
Positron ("light") street tiles. Precincts are semi-transparent (`fillOpacity`
0.5) so streets, water, and landmarks show through, each carries a permanent
number label, and the map fits to the town with neighboring towns visible for
orientation. The R pipeline reprojects the GeoJSON to WGS84 so Leaflet can use it.
- **Why:** Residents asked to see streets and features beneath the results to
  understand *where* each precinct is. Real street context requires a tile basemap,
  which requires a map library; Leaflet is the lightweight standard. A muted
  grayscale basemap keeps the colored precincts as the visual focus.
- **Trade-off accepted:** This reverses the earlier "self-contained / works offline"
  choice — the map now needs a network connection and a third-party tile provider
  (attributed to OpenStreetMap/CARTO). The rest of the site still works offline, and
  the map degrades to a message if Leaflet fails to load.
- **Alternatives considered:** Self-contained SVG with no basemap (the previous
  implementation — rejected because it cannot show streets); MapLibre GL vector
  tiles (heavier, more complex — rejected); full-color OSM tiles (busier, competes
  with precinct colors — rejected in favor of the muted basemap).

### Decision: Reproject precinct GeoJSON to WGS84 in the R pipeline
The source `gis/watertown-precincts-2022.geojson` is in Massachusetts State Plane
(EPSG:6491, meters). `process-results.R` reads it with `sf` and writes
`docs/data/precincts.geojson` transformed to EPSG:4326.
- **Why:** Leaflet (and web maps generally) require WGS84 lon/lat; State Plane
  coordinates place the town off the map. Doing the transform in R keeps all data
  prep in one place and needs no client-side projection library.
- **Alternatives considered:** Reproject client-side with proj4js (adds another
  dependency and per-load work — rejected); ship as-is (rejected — the map cannot
  locate the geometry).

### Decision: Map scope follows office scope
Citywide offices and ballot questions color all 12 precincts; district-council
offices color only the 3 precincts in their district and render the rest inactive.
The `scope`/`district`/`precincts` fields in the JSON drive this.
- **Why:** District races only have candidates in 3 precincts; a full-town map would
  misleadingly grey most of it. Data-driven scope keeps the frontend generic.

## Risks / Trade-offs

- **Hash URLs are less clean than path URLs and weaker for SEO** → Acceptable for a
  civic-info site; hash links are still fully shareable.
- **Map depends on a CDN (Leaflet) and a tile provider being reachable** → Pin the
  Leaflet version with Subresource Integrity; guard for `L` being undefined and show
  a "map unavailable" message so the rest of the page still works offline/on failure.
- **Tile provider terms / attribution** → Use CARTO Positron with the required
  OpenStreetMap + CARTO attribution shown on the map.
- **Categorical color palette may not distinguish many candidates** (e.g. 5-way
  at-large race) → Use a qualitative palette sized to the max candidate count and
  pair every map with a legend and a data table, so color is never the sole channel.
- **Precinct boundaries are the 2022 geometry; pre-2022 elections may have used
  different lines** → The curated CSVs already normalize all years to precincts 1–12,
  so the map is an approximation for older years; note this in the site's About text.
- **Offices vary by year and new elections will be added** → Pages are generated
  from the JSON, not hardcoded; adding an election is a data change (new CSV → re-run
  R) with no frontend edits.

## Migration Plan

1. Extend `results/process-results.R` to emit `docs/data/elections.json`; verify the
   existing CSV outputs are byte-for-byte unchanged.
2. In the same script, reproject `gis/watertown-precincts-2022.geojson` (EPSG:6491)
   to WGS84 and write `docs/data/precincts.geojson`.
3. Add `docs/index.html`, `docs/app.js`, `docs/style.css` implementing routing,
   views, and the D3 choropleth.
4. Verify locally with a static file server across all 5 elections and every office
   scope (citywide, district, question).
5. Enable GitHub Pages on the default branch pointing at `/docs`.
- **Rollback:** Disable GitHub Pages or revert the commit; nothing else in the repo
  depends on `docs/`.

## Open Questions

- Where should the "About / data sources" text live — a footer on the home view, or
  a dedicated `#/about` route?
- Should ballot questions render on the same office-view layout, or a simplified
  Yes/No-oriented variant?
