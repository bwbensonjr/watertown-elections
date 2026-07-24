## 1. Data export (R pipeline)

- [x] 1.1 In `results/process-results.R`, add a function that assembles the nested
  structure (elections → offices → candidates with `by_precinct`) from the existing
  aggregated and precinct data frames
- [x] 1.2 Classify each office `scope` (`citywide` | `district` | `question`), set
  `district` and the participating `precincts` list, and carry `seats`,
  `total_ballots`, `blank_votes`, `write_ins`
- [x] 1.3 Compute `precinct_winners` (name of top candidate per precinct) with
  deterministic tie resolution, and carry `rank`/`is_winner` per candidate
- [x] 1.4 Order elections most-recent-first and add a human-readable `label` per
  election
- [x] 1.5 Write the structure to `docs/data/elections.json`; confirm the existing
  CSV outputs are unchanged after the run
- [x] 1.6 Reproject `gis/watertown-precincts-2022.geojson` (EPSG:6491) to WGS84 via
  `sf` and write `docs/data/precincts.geojson`

## 2. Site shell and routing

- [x] 2.1 Create `docs/index.html` with the app container and no external
  dependencies, plus `style.css` and `app.js`
- [x] 2.2 Implement hash-based routing in `app.js` for `#/`, `#/<date>`, and
  `#/<date>/<office-slug>`, including deep-link rendering on load
- [x] 2.3 Load `data/elections.json` once and handle unknown routes gracefully
  (not-found message or fallback to home)
- [x] 2.4 Add base styling in `docs/style.css` (layout, tables, winner emphasis)

## 3. Views

- [x] 3.1 Home view: list elections most-recent-first, linking to each election
- [x] 3.2 Election view: list offices with winner(s) marked, linking to each office
- [x] 3.3 Office view — citywide totals: candidates ranked by votes with winners
  distinguished, plus blank-vote and write-in totals
- [x] 3.4 Office view — candidate-by-precinct matrix limited to the office's scope

## 4. Choropleth map

- [x] 4.1 Render the precinct map with Leaflet over a light (CARTO Positron) street
  basemap, fitting the view to the town
- [x] 4.2 Assign a qualitative color per candidate and fill each precinct by
  `precinct_winners`; render a color→candidate legend
- [x] 4.3 Limit map to the office's precinct scope (all 12 for citywide/questions,
  the district's 3 for district races; render others inactive)
- [x] 4.4 Add hover tooltips showing precinct number and winning candidate/vote
  detail

## 5. Verification and deployment

- [x] 5.1 Serve `docs/` locally and verify all 5 elections and every office scope
  (citywide, district, question) render correctly, including maps and deep links
- [x] 5.2 Add an About / data-sources note and update `README.md` to link to the
  published site
- [ ] 5.3 Enable GitHub Pages on the default branch pointing at `/docs` and confirm
  the deployed site loads

## 6. Map basemap (per review feedback)

- [x] 6.1 Add Leaflet (pinned CDN + Subresource Integrity) and required
  OpenStreetMap/CARTO attribution; guard for the library failing to load
- [x] 6.2 Make precinct fills semi-transparent so the street basemap shows through
- [x] 6.3 Add a permanent precinct-number label to each precinct
- [x] 6.4 Tear down the Leaflet map on navigation and fix map sizing/fit on init
