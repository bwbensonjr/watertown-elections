library(tidyverse)
library(sf)
library(here)
library(tmap)
library(tidygeocoder)

ma_pcts_url = str_c(
    "https://raw.githubusercontent.com/bwbensonjr/mapoli",
    "/refs/heads/master/gis/geojson/wards_pcts_subs_2022.geojson"
)

precinct_district <- function(precinct) {
    case_when(
        precinct %in% c("1", "2", "3") ~ "A",
        precinct %in% c("4", "5", "6") ~ "B",
        precinct %in% c("7", "8", "9") ~ "C",
        precinct %in% c("10", "11", "12") ~ "D"
    )
}

watertown_pcts <-
    read_sf(ma_pcts_url) |>
    rename(ward = Ward, precinct = Pct) |>
    filter(city_town == "Watertown") |>
    mutate(district = precinct_district(precinct))

watertown_pcts |>
    write_sf(
        here("gis/watertown-precincts-2022.geojson"),
        delete_dsn = TRUE
    )

watertown_pcts <- read_sf("gis/watertown-precincts-2022.geojson")

# Geocode candidate addresses and find home precincts
candidates <-
    read_csv(here("gis/candidate-precinct.csv")) |>
    mutate(full_address = str_c(address, ", Watertown, MA"))

# Geocode addresses to get lat/lon coordinates
candidates_geocoded <-
    candidates |>
    geocode(full_address, method = "osm", lat = latitude, long = longitude)

# Convert to spatial points and set CRS to match precinct data
candidates_sf <-
    candidates_geocoded |>
    select(-precinct) |>
    filter(!is.na(latitude) & !is.na(longitude)) |>
    st_as_sf(coords = c("longitude", "latitude"), crs = 4326) |>
    st_transform(st_crs(watertown_pcts))

# Spatial join to find which precinct each candidate lives in
candidates_with_precinct <-
    candidates_sf |>
    st_join(watertown_pcts |> select(precinct))

# Update original dataframe with precinct and coordinate information
candidates_final <-
    candidates_geocoded |>
    select(-precinct, -full_address) |>
    left_join(
        candidates_with_precinct |>
            st_drop_geometry() |>
            select(candidate, precinct),
        by = "candidate"
    ) |>
    select(election_date, office, candidate, address, latitude, longitude, precinct) |>
    mutate(district = precinct_district(precinct))

candidates_final <- read_csv("gis/candidate-precinct.csv")

# Write updated CSV with lat/lon
candidates_final |>
    write_csv(here("gis/candidate-precinct.csv"))

# Convert candidates to sf for mapping
candidates_map_sf <-
    candidates_final |>
    filter(!is.na(latitude) & !is.na(longitude)) |>
    st_as_sf(coords = c("longitude", "latitude"), crs = 4326) |>
    st_transform(st_crs(watertown_pcts))
    
# Set tmap to interactive mode for clickable popups
tmap_mode("view")

precinct_map <-
    (tm_shape(watertown_pcts) +
     tm_polygons(
         col = "district",
         alpha = 0.6
     ) +
     tm_text("precinct") +
     tm_basemap("OpenStreetMap"))

candidate_map <-
    tm_shape(watertown_pcts) +
    tm_polygons(
        col = "district",
        alpha = 0.6,
        id = "precinct",
        popup.vars = c("Precinct" = "precinct", "District" = "district")
    ) +
    tm_text("precinct") +
    tm_shape(candidates_map_sf) +
    tm_dots(
        alpha = 0.8,
        id = "candidate",
        popup.vars = c(
            "Candidate" = "candidate",
            "Office" = "office",
            "Address" = "address",
            "Precinct" = "precinct"
        )
    ) +
    tm_basemap("OpenStreetMap")


