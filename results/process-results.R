library(tidyverse)
library(janitor)

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

cand_pcts <- rbind(cand_pcts_2025, cand_pcts_2023, cand_pcts_2021, cand_pcts_2019)
cand_results <- rbind(cand_results_2025, cand_results_2023, cand_results_2021, cand_results_2019)

cand_pcts |>
   write_csv("watertown-precinct-results.csv")

cand_results |>
   write_csv("watertown-election-results.csv")

fix_columns <- function(df) {
    df |>
        mutate(
            office = if_else(
                is.na(district),
                if_else(
                    (office == "PUBLIC LIBRARY TRUSTEE"),
                    "LIBRARY TRUSTEES",
                    office
                ),
                str_glue("DISTRICT {district} COUNCILOR")
            ),
            candidate = if_else(
                (candidate == "Write-in"),
                candidate,
                str_to_title(candidate)
            )
        ) |>
        select(-district)
}
