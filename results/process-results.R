library(tidyverse)
library(janitor)
library(jsonlite)
library(sf)

read_election <- function(file_name) {
    election_date <- str_sub(file_name, end = -5)
    read_csv(file_name) |>
        clean_names() |>
        select(-total) |>
        pivot_longer(
            cols = starts_with("precinct_"),
            names_to = "precinct",
            values_to = "votes"
        ) |>
        mutate(
            precinct = str_extract(precinct, "\\d+"),
            city_town = "Watertown",
            election_date = election_date
        ) |>
        relocate(city_town, election_date) |>
        filter(!is.na(votes))
}

election_info <- function(df) {
    write_ins <-
        df |>
        filter(candidate == "Total number of write-ins") |>
        pull(votes)
    blank_votes <-
        df |>
        filter(candidate == "Times Blank Voted") |>
        pull(votes)
    total_ballots <-
        df |>
        filter(candidate == "Total Ballots") |>
        pull(votes)
    cand_df <-
        df |>
        filter(!(candidate %in% c(
            "Times Blank Voted",
            "Total Ballots",
            "Total number of write-ins"
        )))
    total_votes <- sum(cand_df$votes) + blank_votes
    max_votes <- round(total_votes / total_ballots)
    cand_df |>
        mutate(
            max_votes = max_votes,
            total_ballots = total_ballots,
            write_ins = write_ins,
            blank_votes = blank_votes,
            total_votes
        )
}

candidate_precincts <- function(df) {
    df |>
        filter(office != "Voter Turnout") |>
        group_by(office, precinct) |>
        do(election_info(.))
}

candidate_results <- function(df) {
    df |>
        group_by(
            city_town,
            election_date,
            office,
            candidate
        ) |>
        summarize(
            votes = sum(votes),
            max_votes = first(max_votes),
            total_ballots = sum(total_ballots),
            blank_votes = sum(blank_votes),
            write_ins = sum(write_ins),
            total_votes = sum(total_votes),
            .groups = "drop_last"
        ) |>
        mutate(
            vote_rank = dense_rank(desc(votes)),
            is_winner = (vote_rank <= max_votes)
        ) |>
        ungroup() |>
        arrange(office, desc(votes))
}

check_missing <- function(df) {
    df |>
        group_by(office) |>
        summarize(
            write_ins_count = sum(candidate == "Total number of write-ins"),
            blank_count = sum(candidate == "Times Blank Voted"),
            ballots_count = sum(candidate == "Total Ballots")
        )
}

elec_lines_2025 <- read_election("2025-11-04.csv")
cand_pcts_2025 <-
    candidate_precincts(elec_lines_2025) |>
    mutate(candidate = str_to_title(candidate))
cand_results_2025 <- candidate_results(cand_pcts_2025)

elec_lines_2023 <- read_election("2023-11-07.csv")
cand_pcts_2023 <- candidate_precincts(elec_lines_2023)
cand_results_2023 <- candidate_results(cand_pcts_2023)

elec_lines_2021 <- read_election("2021-11-02.csv")
cand_pcts_2021 <- candidate_precincts(elec_lines_2021)
cand_results_2021 <- candidate_results(cand_pcts_2021)

elec_lines_2019 <- read_election("2019-11-05.csv")
cand_pcts_2019 <- candidate_precincts(elec_lines_2019)
cand_results_2019 <- candidate_results(cand_pcts_2019)

elec_lines_2017 <- read_election("2017-11-07.csv")
cand_pcts_2017 <- candidate_precincts(elec_lines_2017)
cand_results_2017 <- candidate_results(cand_pcts_2017)

cand_pcts <- rbind(cand_pcts_2025, cand_pcts_2023, cand_pcts_2021, cand_pcts_2019, cand_pcts_2017)
cand_results <- rbind(cand_results_2025, cand_results_2023, cand_results_2021, cand_results_2019, cand_results_2017)

cand_pcts |>
   write_csv("watertown-precinct-results.csv")

cand_results |>
   write_csv("watertown-election-results.csv")

# --- Site-ready JSON export (docs/data/elections.json) ---------------------
#
# Emits a single nested JSON consumed by the static website in docs/. All
# vote logic (winners, per-precinct winners, office scope) is precomputed
# here so the frontend is pure rendering. The CSV outputs above are unchanged.

slugify <- function(x) {
    x |>
        str_to_lower() |>
        str_replace_all("[^a-z0-9]+", "-") |>
        str_replace_all("^-|-$", "")
}

election_label <- function(date_str) {
    format(as.Date(date_str), "%B %e, %Y") |> str_squish()
}

# scope: "citywide" | "district" | "question"; district letter for district races
office_scope <- function(office) {
    if (str_detect(office, "^BALLOT QUESTION")) {
        list(scope = "question", district = NA_character_)
    } else if (str_detect(office, "^DISTRICT [A-D] COUNCILOR")) {
        list(scope = "district", district = str_extract(office, "(?<=^DISTRICT )[A-D]"))
    } else {
        list(scope = "citywide", district = NA_character_)
    }
}

build_office <- function(off_name, results_df, pcts_df) {
    res <- results_df |>
        filter(office == off_name) |>
        arrange(vote_rank, desc(votes), candidate)
    pcts <- pcts_df |>
        filter(office == off_name) |>
        mutate(precinct = as.integer(precinct))
    sc <- office_scope(off_name)
    precinct_list <- pcts |> pull(precinct) |> unique() |> sort()

    candidates <- lapply(seq_len(nrow(res)), function(i) {
        cand <- res$candidate[i]
        cp <- pcts |> filter(candidate == cand) |> arrange(precinct)
        by_precinct <- setNames(as.list(as.integer(cp$votes)),
                                as.character(cp$precinct))
        list(
            name = cand,
            votes = as.integer(res$votes[i]),
            rank = as.integer(res$vote_rank[i]),
            is_winner = isTRUE(res$is_winner[i]),
            by_precinct = by_precinct
        )
    })

    # Winner per precinct: most votes, ties broken by citywide total then name
    winners <- pcts |>
        left_join(res |> select(candidate, city_votes = votes), by = "candidate") |>
        group_by(precinct) |>
        arrange(desc(votes), desc(city_votes), candidate, .by_group = TRUE) |>
        slice(1) |>
        ungroup() |>
        arrange(precinct)
    precinct_winners <- setNames(as.list(winners$candidate),
                                 as.character(winners$precinct))

    list(
        office = off_name,
        slug = slugify(off_name),
        seats = as.integer(res$max_votes[1]),
        scope = sc$scope,
        district = sc$district,
        precincts = precinct_list,
        total_ballots = as.integer(res$total_ballots[1]),
        blank_votes = as.integer(res$blank_votes[1]),
        write_ins = as.integer(res$write_ins[1]),
        candidates = candidates,
        precinct_winners = precinct_winners
    )
}

build_election <- function(date_str) {
    res_d <- cand_results |> filter(election_date == date_str)
    pcts_d <- cand_pcts |> filter(election_date == date_str)
    offices <- res_d |> pull(office) |> unique() |> sort()
    list(
        date = date_str,
        label = election_label(date_str),
        offices = lapply(offices, build_office, results_df = res_d, pcts_df = pcts_d)
    )
}

dates_desc <- cand_results |> pull(election_date) |> unique() |> sort(decreasing = TRUE)

site_data <- list(
    city_town = "Watertown",
    elections = lapply(dates_desc, build_election)
)

dir.create("../docs/data", recursive = TRUE, showWarnings = FALSE)
write_json(
    site_data,
    "../docs/data/elections.json",
    auto_unbox = TRUE,
    pretty = TRUE,
    na = "null"
)

# Reproject precinct geometry to WGS84 (EPSG:4326) for the web map. The source
# geojson is in Massachusetts State Plane meters, which Leaflet cannot use.
precincts_wgs84 <- st_read(
    "../gis/watertown-precincts-2022.geojson",
    quiet = TRUE
) |>
    st_transform(4326)

geojson_path <- "../docs/data/precincts.geojson"
if (file.exists(geojson_path)) file.remove(geojson_path)
st_write(precincts_wgs84, geojson_path, driver = "GeoJSON", quiet = TRUE)
