## ADDED Requirements

### Requirement: Zero-build static hosting

The website SHALL be a static site served by GitHub Pages from the `docs/`
directory, requiring no build step, server, or GitHub Action. It SHALL load its
data from bundled files and function without any backend.

#### Scenario: Site loads from static files only

- **WHEN** a visitor opens the site's URL
- **THEN** the page renders using only static assets in `docs/` and the bundled
  `data/elections.json`
- **AND** no API, database, or server-side request is required

#### Scenario: No build toolchain; map is the only external dependency

- **WHEN** the site is deployed
- **THEN** no npm install or build command is required
- **AND** the only external runtime dependency is the precinct map, which loads
  Leaflet (pinned, with Subresource Integrity) and basemap tiles over the network
- **AND** if Leaflet or its tiles fail to load, the map shows an "unavailable"
  message while the rest of the site (drill-down and tables) continues to work

### Requirement: Home view lists elections

The site SHALL present a home view listing every available election, ordered most
recent first, each linking to that election's view.

#### Scenario: Elections listed on home

- **WHEN** a visitor opens the site root (`#/`)
- **THEN** all elections from `elections.json` are listed with their labels
- **AND** selecting an election navigates to that election's view

### Requirement: Election view lists offices and winners

The election view SHALL list every office on that ballot and identify the winning
candidate(s) for each, and SHALL link each office to its detailed office view.

#### Scenario: Offices and winners shown

- **WHEN** a visitor opens an election view
- **THEN** each office is listed with its winning candidate(s) marked
- **AND** selecting an office navigates to that office's view

### Requirement: Office view shows citywide totals and precinct matrix

The office view SHALL display the citywide candidate totals ranked by votes with
winners marked, along with blank-vote and write-in counts, and a matrix of each
candidate's votes across the office's precincts.

#### Scenario: Citywide totals displayed

- **WHEN** a visitor opens an office view
- **THEN** candidates are shown ranked by total votes with winners visually
  distinguished
- **AND** blank votes and write-in totals for the office are shown

#### Scenario: Candidate-by-precinct matrix displayed

- **WHEN** a visitor opens an office view
- **THEN** a table shows each candidate's vote count in each precinct that
  participated in the office
- **AND** the table includes only the precincts within the office's scope

### Requirement: Precinct choropleth map over a street basemap

The office view SHALL display a map in which each precinct is filled with a
semi-transparent color identifying the candidate who received the most votes in that
precinct, drawn over a light street basemap so streets and landmarks remain visible
beneath the fills. Each precinct SHALL be labeled with its number, and the map SHALL
provide per-precinct detail on hover.

#### Scenario: Winner-per-precinct coloring over visible streets

- **WHEN** a visitor views the map for a citywide office
- **THEN** all twelve precincts are drawn, each filled with the semi-transparent
  color assigned to that precinct's winning candidate
- **AND** the underlying street basemap remains visible through the fills
- **AND** each precinct shows its number as a label
- **AND** a legend maps colors to candidate names

#### Scenario: Basemap attribution shown

- **WHEN** the map renders
- **THEN** the basemap credits its data sources (OpenStreetMap and the tile
  provider) as required by their terms

#### Scenario: District race limits map scope

- **WHEN** a visitor views the map for a district-council office
- **THEN** only the three precincts in that district are colored by winner
- **AND** precincts outside the district are drawn as inactive or omitted

#### Scenario: Precinct detail on hover

- **WHEN** a visitor hovers over a precinct on the map
- **THEN** the precinct number and its winning candidate (and vote detail) are shown

### Requirement: Shareable hash-based URLs

The site SHALL use hash-based routing so that the home, election, and office views
each have a distinct, shareable URL, and deep links SHALL render the correct view on
load.

#### Scenario: Deep link renders target view

- **WHEN** a visitor opens a URL such as `#/2025-11-04/councilor-at-large`
- **THEN** the site renders that office's view directly
- **AND** navigating between views updates the hash so the URL can be copied and
  shared

#### Scenario: Unknown route handled gracefully

- **WHEN** a visitor opens a hash that matches no election or office
- **THEN** the site shows a not-found message or falls back to the home view rather
  than failing
