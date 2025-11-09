library(tidyverse)
library(here)
library(sf)
library(tmap)

pct_results <-
    read_csv(here("results/watertown-election-results.csv"))
