## Why

Watertown's curated municipal election results (2017–2025) currently live only as
CSV files and official PDFs. They are inaccessible to residents who want to see who
won, how offices were contested, and how their own precinct voted. A simple public
website would turn this already-curated data into a browsable civic resource.

## What Changes

- Add a zero-build static website, served by GitHub Pages from a `docs/` directory,
  that exposes the curated election data with no backend, API, or database.
- Provide a three-level drill-down: **home** (list of elections) → **election**
  (offices on the ballot with winners) → **office** (citywide totals, a
  candidate-by-precinct matrix, and a precinct choropleth map).
- Render a categorical choropleth showing the winning candidate in each precinct,
  drawn with Leaflet over a light (CARTO Positron) street basemap so residents can
  orient by streets and landmarks. Precinct fills are semi-transparent and each
  precinct is labeled with its number. The map scope follows the office (12
  precincts for citywide races and ballot questions, 3 precincts for
  district-council races, with the rest shown faded for context).
- Extend the existing R pipeline (`process-results.R`) to emit a site-ready
  `elections.json` with all vote logic (winners, per-precinct winners, office
  scope) precomputed, so the frontend is pure rendering.
- Use hash-based routing (e.g. `#/2025-11-04/councilor-at-large`) so every view has
  a shareable URL without a build step or server-side routing.

Out of scope for this change: voter-turnout percentages, cross-year trend
comparisons, and candidate-information pages.

## Capabilities

### New Capabilities
- `election-data-export`: Transformation of the curated election CSVs and precinct
  GeoJSON into a single site-ready `elections.json` with precomputed winners,
  per-precinct winners, and office scope.
- `election-results-website`: The static, GitHub Pages–hosted site that renders the
  election, office, and precinct drill-down views and the precinct choropleth map.

### Modified Capabilities
<!-- None: no existing specs; behavior of the R pipeline's existing CSV outputs is unchanged. -->

## Impact

- **New code**: `docs/` (index.html, app.js, style.css, `data/elections.json`,
  `data/precincts.geojson`).
- **Modified code**: `results/process-results.R` gains a JSON export step and a
  GeoJSON reprojection step (via `sf`); the existing CSV outputs are unchanged.
- **Dependencies**: no npm, no build toolchain, no GitHub Action. At runtime the map
  uses Leaflet (pinned CDN, with SRI) and CARTO Positron basemap tiles, so the map
  needs network access; the rest of the site works offline. R gains an `sf`
  dependency for reprojection (already used by the GIS scripts).
- **Data sources**: reads `results/watertown-election-results.csv`,
  `results/watertown-precinct-results.csv`, and
  `gis/watertown-precincts-2022.geojson` (reprojected to WGS84 into `docs/data/`).
- **Deployment**: repository GitHub Pages settings must point at the `docs/` folder
  on the default branch.
