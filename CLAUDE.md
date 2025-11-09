# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Purpose

This repository maintains voter information for Watertown, MA municipal elections and processes historical election results data. It serves as both a public information resource and a data processing pipeline for election analysis.

## Repository Structure

### Election Documentation (`/*.md`)
- `README.md` - Landing page with links to specific elections
- `YYYY-MM-DD.md` - Election-specific information including:
  - Candidate lists with websites and addresses
  - Voting locations and precinct information
  - Candidate forum videos and links
  - About section with data sources

### Results Data Pipeline (`results/`)

Election results are processed from official PDFs through an R pipeline:

**Source Data:**
- `YYYY-MM-DD.pdf` - Official election result PDFs from Watertown city website
- `YYYY-MM-DD.csv` - Manually extracted precinct-by-precinct results in wide format

**Processing Script:**
- `process-results.R` - Main R script with three key functions:
  - `read_election()` - Converts wide CSV format to long (tidy) format, one row per candidate-precinct combination
  - `candidate_precincts()` - Calculates election statistics by office and precinct
  - `candidate_results()` - Aggregates votes across precincts and determines winners

**Output Data:**
- `watertown-precinct-results.csv` - Detailed results with one row per candidate-precinct-office combination
- `watertown-election-results.csv` - Aggregated results across all precincts with winner determination

### GIS Data (`gis/`)

Precinct boundary data for mapping and geographic analysis:
- `watertown-maps.R` - Fetches MA precinct boundaries and filters to Watertown, assigns council districts (A-D)
- `watertown-precincts-2022.geojson` - GeoJSON file with Watertown's 12 precincts and 4 council districts

## Common Commands

### R Data Processing

Run election results processing pipeline:
```bash
cd results
Rscript process-results.R
```

Generate or update precinct GIS data:
```bash
cd gis
Rscript watertown-maps.R
```

### Required R Packages

Both scripts require these tidyverse ecosystem packages:
- `tidyverse` (includes dplyr, tidyr, readr, stringr)
- `janitor` (for `clean_names()`)
- `sf` (for spatial data in GIS scripts)
- `here` (for path management in GIS scripts)

## Data Processing Notes

### Election CSV Format

Input CSVs must follow this structure:
- Column 1: `Office` - Election office name
- Column 2: `Candidate` - Candidate name or special rows:
  - "Registered voters" / "Voters" (for Voter Turnout office)
  - "Total number of write-ins"
  - "Times Blank Voted"
  - "Total Ballots"
- Columns 3-14: `Precinct_1` through `Precinct_12` - Vote counts per precinct
- Column 15: `Total` - Sum across precincts (removed during processing)

### Election Statistics Calculated

For each office, the pipeline calculates:
- `max_votes` - Number of seats available (votes per ballot / total ballots)
- `total_ballots` - Number of ballots cast
- `write_ins` - Total write-in votes
- `blank_votes` - Number of blank votes
- `total_votes` - Sum of all votes including blanks
- `vote_rank` - Ranking by vote count (dense ranking)
- `is_winner` - Boolean indicating if candidate won (rank <= max_votes)

### Council Districts

Watertown has 12 precincts organized into 4 council districts:
- District A: Precincts 1, 2, 3
- District B: Precincts 4, 5, 6
- District C: Precincts 7, 8, 9
- District D: Precincts 10, 11, 12

## Workflow for Adding New Election

1. Create new `YYYY-MM-DD.md` file with candidate information
2. Update `README.md` to link to new election
3. After election day, obtain official results PDF from watertown-ma.gov
4. Manually extract precinct data to `results/YYYY-MM-DD.csv`
5. Update `process-results.R` to include new election year:
   - Add `read_election()` call
   - Add `candidate_precincts()` call
   - Add `candidate_results()` call
   - Add to `rbind()` calls for combined datasets
6. Run `Rscript process-results.R` to generate updated aggregate files
