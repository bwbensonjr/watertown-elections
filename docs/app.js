"use strict";

// Watertown Election Results — zero-build static site.
// Loads a precomputed elections.json (all winner logic done in R) plus the
// precinct GeoJSON, and renders three hash-routed views: home, election, office.

const app = document.getElementById("app");

// Qualitative palette for candidate colors (assigned per office, by rank).
const PALETTE = [
  "#4269d0", "#efb118", "#ff725c", "#6cc5b0", "#3ca951",
  "#a463f2", "#ff8ab7", "#9c6b4e", "#97bbf5", "#9498a0",
];
// Ballot questions read best with an intuitive yes/no coloring.
const QUESTION_COLORS = { YES: "#3ca951", NO: "#ff725c" };

let DATA = null;      // elections.json
let GEO = null;       // precincts.geojson
const nf = new Intl.NumberFormat("en-US");

// ---- Data loading ---------------------------------------------------------

async function loadData() {
  const [elections, geo] = await Promise.all([
    fetch("data/elections.json").then((r) => {
      if (!r.ok) throw new Error("elections.json " + r.status);
      return r.json();
    }),
    fetch("data/precincts.geojson").then((r) => {
      if (!r.ok) throw new Error("precincts.geojson " + r.status);
      return r.json();
    }),
  ]);
  DATA = elections;
  GEO = geo;
}

// ---- Lookups --------------------------------------------------------------

const electionByDate = (date) =>
  DATA.elections.find((e) => e.date === date) || null;

const officeBySlug = (election, slug) =>
  election ? election.offices.find((o) => o.slug === slug) || null : null;

// Color map for an office's candidates, keyed by candidate name.
function candidateColors(office) {
  const colors = {};
  office.candidates.forEach((c, i) => {
    if (office.scope === "question" && QUESTION_COLORS[c.name]) {
      colors[c.name] = QUESTION_COLORS[c.name];
    } else {
      colors[c.name] = PALETTE[i % PALETTE.length];
    }
  });
  return colors;
}

// ---- Small DOM helpers ----------------------------------------------------

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "text") node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

function swatch(color) {
  return el("span", { class: "swatch", style: `background:${color}` });
}

function winnerNames(office) {
  return office.candidates.filter((c) => c.is_winner).map((c) => c.name);
}

function render(node) {
  app.replaceChildren(node);
  window.scrollTo(0, 0);
}

// ---- Views ----------------------------------------------------------------

function homeView() {
  const list = el("ul", { class: "card-list" });
  DATA.elections.forEach((e) => {
    const offices = e.offices.length;
    list.appendChild(
      el("a", { class: "card", href: `#/${e.date}` }, [
        el("span", { class: "card-title", text: e.label }),
        el("span", {
          class: "card-meta",
          text: `${offices} office${offices === 1 ? "" : "s"} on the ballot`,
        }),
      ])
    );
  });

  render(
    el("div", {}, [
      el("h1", { text: "Watertown Election Results" }),
      el("p", {
        class: "subtitle",
        text:
          "Select an election to see the offices on the ballot, then drill " +
          "down to citywide totals and precinct-by-precinct results.",
      }),
      list,
    ])
  );
}

function electionView(date) {
  const election = electionByDate(date);
  if (!election) return notFound();

  const list = el("ul", { class: "card-list" });
  election.offices.forEach((o) => {
    const winners = winnerNames(o);
    const seatLabel =
      o.scope === "question"
        ? "Ballot question"
        : `${o.seats} seat${o.seats === 1 ? "" : "s"}`;
    list.appendChild(
      el("a", { class: "card", href: `#/${date}/${o.slug}` }, [
        el("span", { class: "card-title", text: titleCaseOffice(o.office) }),
        el("span", {
          class: "card-meta",
          text: `${seatLabel} · ${o.candidates.length} candidate${
            o.candidates.length === 1 ? "" : "s"
          }`,
        }),
        el("span", { class: "card-winners" }, [
          document.createTextNode(winners.length > 1 ? "Winners: " : "Winner: "),
          el("span", { class: "win-name", text: winners.join(", ") || "—" }),
        ]),
      ])
    );
  });

  render(
    el("div", {}, [
      crumbs([["Elections", "#/"]], election.label),
      el("h1", { text: election.label }),
      el("p", { class: "subtitle", text: "Offices on the ballot" }),
      list,
    ])
  );
}

function officeView(date, slug) {
  const election = electionByDate(date);
  const office = officeBySlug(election, slug);
  if (!office) return notFound();

  const colors = candidateColors(office);

  const root = el("div", {}, [
    crumbs(
      [
        ["Elections", "#/"],
        [election.label, `#/${date}`],
      ],
      titleCaseOffice(office.office)
    ),
    el("h1", { text: titleCaseOffice(office.office) }),
    el("p", { class: "subtitle", text: election.label }),
    summaryStats(office),
    el("h2", { text: "Citywide totals" }),
    totalsTable(office, colors),
    el("h2", { text: "Winner by precinct" }),
    mapSection(office, colors),
    el("h2", { text: "Votes by precinct" }),
    matrixTable(office),
    el("a", { class: "back-link", href: `#/${date}`, text: "← Back to " + election.label }),
  ]);
  render(root);
}

function notFound() {
  render(
    el("div", {}, [
      el("h1", { text: "Not found" }),
      el("p", {
        class: "subtitle",
        text: "That election or office could not be found.",
      }),
      el("a", { class: "back-link", href: "#/", text: "← Back to all elections" }),
    ])
  );
}

// ---- View pieces ----------------------------------------------------------

function crumbs(trail, current) {
  const node = el("nav", { class: "crumbs" });
  trail.forEach(([label, href]) => {
    node.appendChild(el("a", { href, text: label }));
    node.appendChild(document.createTextNode(" › "));
  });
  node.appendChild(document.createTextNode(current));
  return node;
}

function stat(value, label) {
  return el("li", {}, [
    el("span", { class: "stat-val", text: value }),
    el("span", { class: "stat-lbl", text: label }),
  ]);
}

function summaryStats(office) {
  const list = el("ul", { class: "stats" });
  list.appendChild(stat(nf.format(office.total_ballots), "ballots cast"));
  if (office.scope !== "question") {
    list.appendChild(
      stat(String(office.seats), office.seats === 1 ? "seat" : "seats")
    );
  }
  list.appendChild(stat(nf.format(office.blank_votes), "blank votes"));
  list.appendChild(stat(nf.format(office.write_ins), "write-ins"));
  if (office.scope === "district") {
    list.appendChild(stat("District " + office.district, "council district"));
  }
  return list;
}

function totalsTable(office, colors) {
  const thead = el("thead", {}, el("tr", {}, [
    el("th", { text: "#" }),
    el("th", { text: "Candidate" }),
    el("th", { text: "Votes" }),
  ]));
  const tbody = el("tbody");
  office.candidates.forEach((c) => {
    const nameCell = el("td", {}, [
      swatch(colors[c.name]),
      document.createTextNode(c.name),
    ]);
    if (c.is_winner) nameCell.appendChild(el("span", { class: "badge", text: "WON" }));
    tbody.appendChild(
      el("tr", { class: c.is_winner ? "winner" : "" }, [
        el("td", { text: String(c.rank) }),
        nameCell,
        el("td", { text: nf.format(c.votes) }),
      ])
    );
  });
  return el("div", { class: "table-wrap" }, el("table", {}, [thead, tbody]));
}

function matrixTable(office) {
  const precincts = office.precincts;
  const headRow = el("tr", {}, [el("th", { text: "Candidate" })]);
  precincts.forEach((p) => headRow.appendChild(el("th", { text: "P" + p })));
  headRow.appendChild(el("th", { text: "Total" }));

  const tbody = el("tbody");
  office.candidates.forEach((c) => {
    const row = el("tr", { class: c.is_winner ? "winner" : "" }, [
      el("td", { text: c.name }),
    ]);
    precincts.forEach((p) => {
      const isWin = office.precinct_winners[String(p)] === c.name;
      row.appendChild(
        el("td", {
          class: isWin ? "matrix-win" : "",
          text: nf.format(c.by_precinct[String(p)] ?? 0),
        })
      );
    });
    row.appendChild(el("td", { text: nf.format(c.votes) }));
    tbody.appendChild(row);
  });

  return el("div", { class: "table-wrap" },
    el("table", {}, [el("thead", {}, headRow), tbody]));
}

// ---- Map (Leaflet choropleth over a light basemap) ------------------------
//
// Semi-transparent precinct fills sit over Esri World Light Gray Canvas tiles
// so residents can orient by streets and landmarks. Each precinct carries a
// permanent number label. Needs a network connection and the Leaflet library;
// if either is missing, only the map degrades — the rest of the page works.
//
// Basemap history: this used CARTO Positron, but CARTO now stamps an
// "API KEY REQUIRED" watermark across keyless tiles. Esri's light gray canvas
// is the closest muted, keyless equivalent — no credentials to embed in a
// public static site. It only renders through zoom 16, so TILE_MAX_NATIVE_ZOOM
// lets Leaflet upscale beyond that.

const TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/" +
  "World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}";
const TILE_ATTRIB =
  'Tiles &copy; <a href="https://www.esri.com/">Esri</a> — Esri, HERE, Garmin, ' +
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
  'contributors';
const TILE_MAX_NATIVE_ZOOM = 16;

const FILL_OPACITY = 0.5;
const FILL_OPACITY_HOVER = 0.72;

let currentMap = null; // active Leaflet map; torn down on navigation

function destroyMap() {
  if (currentMap) {
    currentMap.remove();
    currentMap = null;
  }
}

function mapSection(office, colors) {
  const inScope = new Set(office.precincts.map(String));

  const canvas = el("div", { class: "map-canvas" });

  // Legend: candidates that win at least one in-scope precinct.
  const seen = new Set();
  office.precincts.forEach((p) => {
    const w = office.precinct_winners[String(p)];
    if (w) seen.add(w);
  });
  const legend = el("ul", { class: "legend" });
  office.candidates
    .filter((c) => seen.has(c.name))
    .forEach((c) => {
      const count = office.precincts.filter(
        (p) => office.precinct_winners[String(p)] === c.name
      ).length;
      legend.appendChild(
        el("li", {}, [
          swatch(colors[c.name]),
          document.createTextNode(`${c.name} (${count})`),
        ])
      );
    });

  const layout = el("div", { class: "map-layout" }, [
    canvas,
    el("div", {}, [el("div", { class: "note", text: "Precincts won:" }), legend]),
  ]);
  const wrap = el("div", {}, [layout]);

  if (typeof L === "undefined") {
    canvas.classList.add("map-unavailable");
    canvas.appendChild(
      el("p", { class: "note", text: "Map unavailable (map library did not load)." })
    );
  } else {
    // Defer init until the container is attached to the DOM and laid out
    // (rAF fires after layout), so Leaflet reads a non-zero container size.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => buildLeafletMap(canvas, office, colors, inScope))
    );
  }

  if (office.scope === "district") {
    wrap.appendChild(
      el("p", {
        class: "note",
        text:
          "District " +
          office.district +
          " covers precincts " +
          office.precincts.join(", ") +
          "; other precincts are shown faded for context.",
      })
    );
  }
  wrap.appendChild(
    el("p", { class: "note", text: "Fills are semi-transparent; scroll-to-zoom is off — use + / −." })
  );
  return wrap;
}

function buildLeafletMap(canvas, office, colors, inScope) {
  if (!canvas.isConnected) return;
  destroyMap();

  const map = L.map(canvas, { scrollWheelZoom: false });
  currentMap = map;

  L.tileLayer(TILE_URL, {
    maxZoom: 19,
    maxNativeZoom: TILE_MAX_NATIVE_ZOOM,
    attribution: TILE_ATTRIB,
  }).addTo(map);

  const tooltip = ensureTooltip();

  const styleFor = (feature) => {
    const precinct = String(feature.properties.precinct);
    const winner = office.precinct_winners[precinct];
    if (inScope.has(precinct) && winner) {
      return { color: "#333", weight: 1, fillColor: colors[winner], fillOpacity: FILL_OPACITY };
    }
    return { color: "#999", weight: 1, fillColor: "#999", fillOpacity: 0.1 };
  };

  const layer = L.geoJSON(GEO, {
    style: styleFor,
    onEachFeature: (feature, lyr) => {
      const precinct = String(feature.properties.precinct);
      lyr.bindTooltip(precinct, {
        permanent: true,
        direction: "center",
        className: "precinct-label",
      });
      if (!inScope.has(precinct)) return;
      lyr.on("mousemove", (e) => {
        showTooltip(tooltip, e.originalEvent, office, precinct);
        lyr.setStyle({ weight: 2.5, fillOpacity: FILL_OPACITY_HOVER });
        lyr.bringToFront();
      });
      lyr.on("mouseout", () => {
        hideTooltip(tooltip);
        layer.resetStyle(lyr);
      });
    },
  }).addTo(map);

  map.invalidateSize(); // ensure Leaflet knows the real container size
  map.fitBounds(layer.getBounds(), { padding: [10, 10] });
}

function ensureTooltip() {
  let t = document.querySelector(".map-tooltip");
  if (!t) {
    t = el("div", { class: "map-tooltip" });
    document.body.appendChild(t);
  }
  return t;
}

function showTooltip(tooltip, ev, office, precinct) {
  const winner = office.precinct_winners[precinct];
  const rows = office.candidates
    .map((c) => ({ name: c.name, votes: c.by_precinct[precinct] ?? 0 }))
    .sort((a, b) => b.votes - a.votes);

  const ul = el("ul");
  rows.forEach((r) => {
    ul.appendChild(
      el("li", { class: r.name === winner ? "tt-win" : "" }, [
        el("span", { text: r.name }),
        el("span", { text: nf.format(r.votes) }),
      ])
    );
  });
  tooltip.replaceChildren(
    el("div", { class: "tt-precinct", text: "Precinct " + precinct }),
    ul
  );
  tooltip.classList.add("show");

  const pad = 14;
  let x = ev.clientX + pad;
  let y = ev.clientY + pad;
  const rect = tooltip.getBoundingClientRect();
  if (x + rect.width > window.innerWidth) x = ev.clientX - rect.width - pad;
  if (y + rect.height > window.innerHeight) y = ev.clientY - rect.height - pad;
  tooltip.style.left = x + "px";
  tooltip.style.top = y + "px";
}

function hideTooltip(tooltip) {
  tooltip.classList.remove("show");
}

// ---- Formatting -----------------------------------------------------------

// Office names arrive upper-cased; render them in title case, preserving the
// single-letter district and ballot-question numbers.
function titleCaseOffice(name) {
  return name
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .replace(/\bAt-large\b/i, "At-Large")
    .replace(/\bOf\b/g, "of");
}

// ---- Router ---------------------------------------------------------------

function route() {
  if (!DATA) return;
  const hash = location.hash.replace(/^#\/?/, "");
  const parts = hash.split("/").filter(Boolean);
  hideTooltip(ensureTooltip());
  destroyMap(); // tear down any Leaflet map from the previous view

  if (parts.length === 0) return homeView();
  if (parts.length === 1) return electionView(parts[0]);
  if (parts.length === 2) return officeView(parts[0], parts[1]);
  return notFound();
}

async function main() {
  try {
    await loadData();
  } catch (err) {
    app.replaceChildren(
      el("p", { class: "error", text: "Failed to load election data: " + err.message })
    );
    return;
  }
  window.addEventListener("hashchange", route);
  route();
}

main();
