"""Generate the wide-format 2017-11-07.csv from the 2017 PDF-derived data.

The 2017 official results (2017-11-07.pdf) are a per-precinct summary report
rather than the wide precinct-by-candidate table used for later years, so the
wide-format source CSV that process-results.R consumes has to be assembled.

This is a one-time build tool, NOT part of the R pipeline: it produces
2017-11-07.csv, which is then committed and read directly by process-results.R
like every other year's CSV. Its value going forward is as the reproducible
record of how the PDF's per-precinct ballot/registration/blank figures map into
the CSV. Re-run only if 2017-11-07.csv needs to be regenerated or audited.

Inputs:
  - 2017-11-07-no-totals.csv : candidate + write-in votes per office/precinct,
    already transcribed from the PDF.
  - The per-precinct "Registered Voters" and "Cards Cast" (ballots) counts read
    from each page header of 2017-11-07.pdf, hardcoded below.

"Times Blank Voted" follows the same convention as the other years: total empty
vote slots = seats*ballots - candidate_votes - write_ins (equivalently, the
PDF's Number of Uncast Votes + blank_ballots*seats).

Run from the results/ directory:
    uv run --no-project python gen_2017_wide.py
"""

import csv
from collections import OrderedDict

SRC = "2017-11-07-no-totals.csv"
OUT = "2017-11-07.csv"

# From the PDF header of each precinct page: "Registered Voters R - Cards Cast C"
registered = {1: 1763, 2: 1907, 3: 1971, 4: 2015, 5: 1934, 6: 1886,
              7: 2059, 8: 2041, 9: 1787, 10: 2553, 11: 1819, 12: 1786}
ballots = {1: 233, 2: 311, 3: 374, 4: 534, 5: 412, 6: 319,
           7: 563, 8: 543, 9: 281, 10: 520, 11: 341, 12: 327}

seats = {
    "CITY COUNCIL PRESIDENT": 1,
    "COUNCILOR-AT-LARGE": 4,
    "DISTRICT A COUNCILOR": 1,
    "DISTRICT B COUNCILOR": 1,
    "DISTRICT C COUNCILOR": 1,
    "DISTRICT D COUNCILOR": 1,
    "SCHOOL COMMITTEE": 3,
    "SCHOOL COMMITTEE 2-YEAR TERM": 1,
    "LIBRARY TRUSTEES": 3,
}

# Output office ordering (Voter Turnout first, then contests)
office_order = [
    "CITY COUNCIL PRESIDENT",
    "COUNCILOR-AT-LARGE",
    "DISTRICT A COUNCILOR",
    "DISTRICT B COUNCILOR",
    "DISTRICT C COUNCILOR",
    "DISTRICT D COUNCILOR",
    "SCHOOL COMMITTEE",
    "SCHOOL COMMITTEE 2-YEAR TERM",
    "LIBRARY TRUSTEES",
]

# Spot-check candidate+write-in totals against PDF "Total Votes" cells
pdf_total_votes = {
    ("COUNCILOR-AT-LARGE", 1): 623, ("SCHOOL COMMITTEE", 1): 490,
    ("LIBRARY TRUSTEES", 1): 395, ("CITY COUNCIL PRESIDENT", 1): 170,
    ("SCHOOL COMMITTEE 2-YEAR TERM", 1): 150, ("DISTRICT A COUNCILOR", 1): 172,
    ("COUNCILOR-AT-LARGE", 5): 1140, ("SCHOOL COMMITTEE", 8): 1230,
    ("LIBRARY TRUSTEES", 10): 783, ("DISTRICT D COUNCILOR", 12): 237,
}

# votes[office][precinct] = OrderedDict(candidate -> votes); write_in stored separately
votes = OrderedDict((o, {}) for o in office_order)
write_ins = {o: {} for o in office_order}
cand_order = {o: [] for o in office_order}

with open(SRC, newline="") as f:
    for row in csv.DictReader(f):
        p = int(row["precinct"])
        o = row["office"]
        cand = row["candidate"]
        v = int(row["votes"])
        if cand == "Write-in":
            write_ins[o][p] = v
            continue
        if cand == "V.j. Piccirilli Jr":  # fix OCR casing artifact
            cand = "V.J. Piccirilli Jr"
        votes[o].setdefault(p, OrderedDict())[cand] = v
        if cand not in cand_order[o]:
            cand_order[o].append(cand)

precincts = list(range(1, 13))
header = ["Office", "Candidate"] + [f"Precinct_{p}" for p in precincts] + ["Total"]
rows = []


def cell(vals):
    total = sum(v for v in vals.values() if v is not None)
    line = [vals.get(p, "") for p in precincts]
    return line, total


# Voter Turnout block
rows.append(["Voter Turnout", "Registered voters"]
            + [registered[p] for p in precincts] + [sum(registered.values())])
rows.append(["Voter Turnout", "Voters"]
            + [ballots[p] for p in precincts] + [sum(ballots.values())])

for o in office_order:
    active = sorted(votes[o].keys())  # precincts where this office appears
    # candidate rows
    for cand in cand_order[o]:
        vals = {p: votes[o][p][cand] for p in active}
        line, total = cell(vals)
        rows.append([o, cand] + line + [total])
    # write-ins
    wi = {p: write_ins[o].get(p, 0) for p in active}
    line, total = cell(wi)
    rows.append([o, "Total number of write-ins"] + line + [total])
    # blank slots + total ballots
    blank_vals, ballot_vals = {}, {}
    for p in active:
        cand_sum = sum(votes[o][p].values())
        blank = seats[o] * ballots[p] - cand_sum - write_ins[o].get(p, 0)
        assert blank >= 0, f"neg blank {o} p{p}: {blank}"
        # verify against PDF where known
        if (o, p) in pdf_total_votes:
            got = cand_sum + write_ins[o].get(p, 0)
            assert got == pdf_total_votes[(o, p)], \
                f"PDF mismatch {o} p{p}: got {got} want {pdf_total_votes[(o, p)]}"
        blank_vals[p] = blank
        ballot_vals[p] = ballots[p]
    line, total = cell(blank_vals)
    rows.append([o, "Times Blank Voted"] + line + [total])
    line, total = cell(ballot_vals)
    rows.append([o, "Total Ballots"] + line + [total])

with open(OUT, "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(header)
    w.writerows(rows)

print(f"Wrote {OUT} with {len(rows)} data rows")
print("Verified: all blank-slot values >= 0; PDF Total-Votes spot checks passed")
