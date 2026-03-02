library(tidyverse)
library(here)
library(sf)
library(tmap)

pct_results <-
    read_csv(here("results/watertown-precinct-results.csv")) |>
    filter(election_date == "2025-11-04.csv")
