# election-data-export Specification

## Purpose

Defines how the R results pipeline exports curated Watertown election data into
site-ready artifacts (a single `elections.json` and a web-projected precinct
GeoJSON) so the static website can render results without performing any
vote-derived computation of its own.

## Requirements

### Requirement: Site-ready JSON export

The R pipeline SHALL emit a single `elections.json` file that contains all curated
election data needed by the website, derived from
`results/watertown-election-results.csv` and
`results/watertown-precinct-results.csv`. The existing CSV outputs SHALL remain
unchanged.

#### Scenario: JSON generated from curated CSVs

- **WHEN** `process-results.R` is run
- **THEN** it writes `docs/data/elections.json` containing every election, office,
  candidate, and per-precinct vote count present in the curated CSVs
- **AND** the existing `watertown-election-results.csv` and
  `watertown-precinct-results.csv` outputs are still produced with identical content

#### Scenario: Elections ordered most-recent-first

- **WHEN** the JSON is generated
- **THEN** elections appear ordered from the most recent date to the oldest
- **AND** each election includes its ISO date and a human-readable label

### Requirement: Precomputed winners and office scope

The exported JSON SHALL precompute all vote-derived facts so the frontend performs
no winner determination. Each office SHALL include the number of seats, its
geographic scope, its list of participating precincts, the citywide candidate
ranking with winner flags, per-candidate per-precinct vote counts, and the winning
candidate in each precinct.

#### Scenario: Citywide winners precomputed

- **WHEN** an office is exported
- **THEN** each candidate includes total votes, rank, and an `is_winner` flag
  consistent with the office's seat count
- **AND** the office includes a `precinct_winners` mapping from precinct number to
  the name of the candidate with the most votes in that precinct

#### Scenario: Office scope classified

- **WHEN** an office is exported
- **THEN** it is labeled with a scope of `citywide`, `district`, or `question`
- **AND** district-council offices record their district letter and list only the
  precincts belonging to that district
- **AND** citywide offices and ballot questions list all twelve precincts

#### Scenario: Tie resolved once in the pipeline

- **WHEN** two candidates are tied for the most votes in a precinct
- **THEN** the pipeline resolves the precinct winner deterministically and records a
  single value, so the frontend never re-derives it

### Requirement: Precinct geometry available to the site in WGS84

The precinct boundary GeoJSON SHALL be available under the site's data directory,
reprojected to WGS84 (EPSG:4326) so a web map can place it correctly.

#### Scenario: GeoJSON present and web-ready

- **WHEN** the site data is prepared
- **THEN** `docs/data/precincts.geojson` exists with one feature per precinct
- **AND** each feature exposes its precinct number and council district

#### Scenario: Coordinates reprojected to lon/lat

- **WHEN** the precinct geometry is written for the site
- **THEN** its coordinates are in WGS84 lon/lat (not the source Massachusetts State
  Plane coordinates), so map libraries locate the town correctly
