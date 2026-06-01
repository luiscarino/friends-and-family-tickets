(function () {
  "use strict";

  const DATA_URL = "data/inventory.json";

  const els = {
    brandTitle: document.getElementById("brand-title"),
    brandTagline: document.getElementById("brand-tagline"),
    catalogStats: document.getElementById("catalog-stats"),
    updatedAt: document.getElementById("updated-at"),
    search: document.getElementById("filter-search"),
    status: document.getElementById("filter-status"),
    venue: document.getElementById("filter-venue"),
    category: document.getElementById("filter-category"),
    sort: document.getElementById("filter-sort"),
    statusLine: document.getElementById("status"),
    listings: document.getElementById("listings"),
    disclaimers: document.getElementById("disclaimers"),
    contact: document.getElementById("contact-line"),
  };

  const REMOVED_DISCLAIMERS = new Set([
    "FIFA resale estimate includes ~15% buyer fee on top of list price for comparison only.",
    "Sold listings show match and seat details only — sale prices are not published.",
  ]);

  function listingStatus(l) {
    if (!l) return "available";
    if (l.status === "sold") return "sold";
    if (l.soldAt) return "sold";
    // Sold export strips price + WhatsApp; v1/mismatch data may omit status.
    if (l.priceEach == null && l.fifaBuyerEach == null && !l.whatsappMessage) return "sold";
    return "available";
  }

  function fmtMoney(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return "—";
    return "$" + v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }

  function fmtUpdated(iso) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch (_) {
      return iso;
    }
  }

  function fmtSoldDate(iso) {
    if (!iso) return "";
    try {
      return (
        "Sold " +
        new Date(String(iso).slice(0, 10) + "T12:00:00").toLocaleDateString(undefined, {
          dateStyle: "medium",
        })
      );
    } catch (_) {
      return "Sold " + iso;
    }
  }

  function waHref(listing, brand) {
    const phone = String((brand && brand.whatsappE164) || "525651766308").replace(/\D/g, "");
    const text = listing.whatsappMessage || "";
    return "https://wa.me/" + phone + "?text=" + encodeURIComponent(text);
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** Drop repeated FIFA prefix in section headers (full title stays in search/export). */
  function shortMatchTitle(title) {
    let s = String(title || "Match").trim();
    s = s.replace(/^FIFA\s+World\s+Cup\s+2026™?\s*[-–—:\u2013\u2014]\s*/i, "");
    s = s.replace(/^FIFA\s+World\s+Cup\s+2026™?\s+/i, "");
    return s.trim() || String(title || "Match").trim();
  }

  function renderStatusCounts(counts) {
    const parts = [];
    if (counts.available > 0) {
      parts.push(`<span class="ff-stat ff-stat--available">${counts.available} available</span>`);
    }
    if (counts.sold > 0) {
      if (parts.length) parts.push(`<span class="ff-stat-sep"> · </span>`);
      parts.push(`<span class="ff-stat ff-stat--sold">${counts.sold} sold</span>`);
    }
    return parts.join("");
  }

  function uniqueValues(listings, key) {
    const set = new Set();
    for (const l of listings) {
      const v = String(l[key] || "").trim();
      if (v) set.add(v);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  function fillSelect(select, values, allLabel) {
    if (!select) return;
    const cur = select.value;
    select.innerHTML = `<option value="">${escapeHtml(allLabel)}</option>`;
    for (const v of values) {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      select.appendChild(opt);
    }
    if (values.includes(cur)) select.value = cur;
  }

  function statusRank(l) {
    return listingStatus(l) === "sold" ? 1 : 0;
  }

  function seatSortKey(l) {
    if (l.seats && l.seats.length && Number.isFinite(Number(l.seats[0]))) {
      return Number(l.seats[0]);
    }
    const m = String(l.seatDisplay || "").match(/Seat\s*(\d+)/i);
    return m ? parseInt(m[1], 10) : 99999;
  }

  function compareByMatchOrder(a, b) {
    const so = (a.stageOrder ?? 99) - (b.stageOrder ?? 99);
    if (so !== 0) return so;
    const fn = (a.fifaMatchNumber ?? 9999) - (b.fifaMatchNumber ?? 9999);
    if (fn !== 0) return fn;
    const mo = (a.matchOrder ?? 0) - (b.matchOrder ?? 0);
    if (mo !== 0) return mo;
    const sr = statusRank(a) - statusRank(b);
    if (sr !== 0) return sr;
    return seatSortKey(a) - seatSortKey(b) || String(a.seatDisplay || "").localeCompare(String(b.seatDisplay || ""));
  }

  function inferStageForListing(l) {
    if (l.stageId && l.stageLabel) {
      return { id: l.stageId, label: l.stageLabel, order: l.stageOrder ?? 99 };
    }
    const St = typeof FWC26Stages !== "undefined" ? FWC26Stages : null;
    if (St && typeof St.stageFromTitle === "function") return St.stageFromTitle(l.matchTitle);
    return { id: "unknown", label: "Other Matches", order: 99 };
  }

  function parseFifaMatchNumber(title) {
    const St = typeof FWC26Stages !== "undefined" ? FWC26Stages : null;
    if (St && typeof St.parseMatchNumber === "function") return St.parseMatchNumber(title);
    const m = String(title || "").match(/Match\s+(\d+)\b/i);
    return m ? parseInt(m[1], 10) : null;
  }

  function countStatuses(listings) {
    let available = 0;
    let sold = 0;
    for (const l of listings || []) {
      if (listingStatus(l) === "sold") sold += 1;
      else available += 1;
    }
    return { available, sold };
  }

  /** Older exports may lack matchKey/matchOrder — infer so grouping still works. */
  function backfillListingMatchFields(listings) {
    if (!Array.isArray(listings)) return;
    const seen = new Map();
    let order = 0;
    for (const l of listings) {
      const title = String(l.matchTitle || "Match");
      if (!seen.has(title)) {
        seen.set(title, order);
        order += 1;
      }
      if (l.matchOrder == null || l.matchOrder === undefined) {
        l.matchOrder = seen.get(title);
      }
      if (!l.matchKey) {
        const raw = `${title}\0${l.sortDate || ""}\0${l.venue || ""}`;
        let h = 5381;
        for (let i = 0; i < raw.length; i += 1) {
          h = ((h << 5) + h + raw.charCodeAt(i)) >>> 0;
        }
        l.matchKey = `M${h.toString(16)}`;
      }
      if (l.fifaMatchNumber == null) {
        const n = parseFifaMatchNumber(l.matchTitle);
        if (n != null) l.fifaMatchNumber = n;
      }
      if (!l.stageId) {
        const stage = inferStageForListing(l);
        l.stageId = stage.id;
        l.stageLabel = stage.label;
        l.stageOrder = stage.order;
      }
    }
  }

  function groupByStage(rows) {
    const stages = [];
    const map = new Map();
    for (const l of rows) {
      const st = inferStageForListing(l);
      if (!map.has(st.id)) {
        const g = { id: st.id, label: st.label, order: st.order ?? 99, listings: [] };
        map.set(st.id, g);
        stages.push(g);
      }
      map.get(st.id).listings.push(l);
    }
    stages.sort((a, b) => a.order - b.order);
    return stages;
  }

  function renderStageSection(stageGroup) {
    const counts = countStatuses(stageGroup.listings);
    const countHtml = renderStatusCounts(counts);
    const total = stageGroup.listings.length;
    const matchGroups = groupListingsInOrder(stageGroup.listings);
    const body = matchGroups
      .map(
        (g) =>
          `<section class="ff-match-group" data-match-key="${escapeHtml(g.key)}">` +
          renderMatchHeader(g) +
          `<div class="ff-match-listings">${g.listings.map((l) => renderCard(l, true)).join("")}</div>` +
          `</section>`
      )
      .join("");
    return (
      `<details class="ff-stage-panel" open>` +
      `<summary class="ff-stage-summary">` +
      `<div class="ff-stage-header-accent" aria-hidden="true"></div>` +
      `<div class="ff-stage-header-inner">` +
      `<div class="ff-stage-header-main">` +
      `<p class="ff-match-header-eyebrow">Tournament stage · ${total} ticket${total === 1 ? "" : "s"}</p>` +
      `<h2 class="ff-match-header-title">${escapeHtml(stageGroup.label)}</h2>` +
      `</div>` +
      `<div class="ff-stage-header-actions">` +
      (countHtml ? `<p class="ff-match-header-counts">${countHtml}</p>` : "") +
      `<span class="ff-stage-chevron" aria-hidden="true"></span>` +
      `</div>` +
      `</div>` +
      `</summary>` +
      `<div class="ff-stage-body">${body}</div>` +
      `</details>`
    );
  }

  function groupListingsInOrder(rows) {
    const groups = [];
    const map = new Map();
    for (const l of rows) {
      const k = l.matchKey || `${l.matchTitle}\0${l.sortDate}`;
      if (!map.has(k)) {
        const g = {
          key: k,
          matchTitle: l.matchTitle,
          dateLabel: l.dateLabel,
          timeLabel: l.timeLabel,
          venue: l.venue,
          sortDate: l.sortDate,
          matchOrder: l.matchOrder ?? 0,
          listings: [],
        };
        map.set(k, g);
        groups.push(g);
      }
      map.get(k).listings.push(l);
    }
    return groups;
  }

  function renderMatchHeader(group) {
    const datePart = [group.dateLabel, group.timeLabel].filter(Boolean).join(" · ");
    const counts = countStatuses(group.listings);
    const total = group.listings.length;
    const shortTitle = shortMatchTitle(group.matchTitle);
    return (
      `<header class="ff-match-header" role="group" aria-label="${escapeHtml(shortTitle)}">` +
      `<div class="ff-match-header-accent" aria-hidden="true"></div>` +
      `<div class="ff-match-header-inner">` +
      `<div class="ff-match-header-main">` +
      `<p class="ff-match-header-eyebrow">Match · ${total} ticket${total === 1 ? "" : "s"}</p>` +
      `<h2 class="ff-match-header-title">${escapeHtml(shortTitle)}</h2>` +
      `<p class="ff-match-header-meta">${escapeHtml(datePart)}${datePart && group.venue ? " · " : ""}${escapeHtml(group.venue)}</p>` +
      `</div>` +
      `<p class="ff-match-header-counts">${renderStatusCounts(counts)}</p>` +
      `</div>` +
      `</header>`
    );
  }

  function filteredListings() {
    if (!catalog || !Array.isArray(catalog.listings)) return [];
    const q = (els.search && els.search.value || "").trim().toLowerCase();
    const venue = els.venue && els.venue.value;
    const cat = els.category && els.category.value;
    const statusFilter = els.status && els.status.value;

    let rows = catalog.listings.filter((l) => {
      if (statusFilter && listingStatus(l) !== statusFilter) return false;
      if (venue && l.venue !== venue) return false;
      if (cat && l.category !== cat) return false;
      if (!q) return true;
      const hay = [
        l.matchTitle,
        l.venue,
        l.category,
        l.seatDisplay,
        l.dateLabel,
        l.publicNote,
        listingStatus(l),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });

    const sort = (els.sort && els.sort.value) || "default";
    rows = rows.slice();

    if (sort === "price-asc" || sort === "price-desc") {
      rows.sort(compareByMatchOrder);
      const groups = groupListingsInOrder(rows);
      const flat = [];
      for (const g of groups) {
        const available = g.listings.filter((l) => listingStatus(l) === "available");
        const sold = g.listings.filter((l) => listingStatus(l) === "sold");
        available.sort((a, b) => {
          const d = (Number(a.priceEach) || 0) - (Number(b.priceEach) || 0);
          return sort === "price-asc" ? d : -d;
        });
        sold.sort(
          (a, b) =>
            seatSortKey(a) - seatSortKey(b) ||
            String(a.seatDisplay || "").localeCompare(String(b.seatDisplay || ""))
        );
        flat.push(...available, ...sold);
      }
      rows = flat;
    } else if (sort === "date-desc") {
      rows.sort(
        (a, b) =>
          String(b.sortDate).localeCompare(String(a.sortDate)) ||
          compareByMatchOrder(a, b)
      );
    } else if (sort === "date-asc") {
      rows.sort(
        (a, b) =>
          String(a.sortDate).localeCompare(String(b.sortDate)) ||
          compareByMatchOrder(a, b)
      );
    } else {
      rows.sort(compareByMatchOrder);
    }
    return rows;
  }

  function renderAvailableCard(l, inGroup) {
    if (listingStatus(l) === "sold") return renderSoldCard(l, inGroup);
    const datePart = [l.dateLabel, l.timeLabel].filter(Boolean).join(" · ");
    const hasPrice = Number.isFinite(Number(l.priceEach));
    const href = hasPrice ? waHref(l, catalog.brand) : "";
    const waBtn = hasPrice
      ? `<a class="ff-btn-wa" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">Buy on WhatsApp</a>`
      : "";
    const head = inGroup
      ? `<p class="ff-seat ff-seat--lead">${escapeHtml(l.category)} · ${escapeHtml(l.seatDisplay)} · Qty ${l.quantity}</p>`
      : `<h2 class="ff-match">${escapeHtml(l.matchTitle)}</h2>` +
        `<p class="ff-meta">${escapeHtml(datePart)}${datePart && l.venue ? " · " : ""}${escapeHtml(l.venue)}</p>` +
        `<p class="ff-seat">${escapeHtml(l.category)} · ${escapeHtml(l.seatDisplay)} · Qty ${l.quantity}</p>`;
    return (
      `<article class="ff-card ff-card--available${inGroup ? " ff-card--ingroup" : ""}" data-id="${escapeHtml(l.id)}" data-status="available">` +
      `<div class="ff-card-body">` +
      `<div class="ff-card-head">` +
      head +
      (l.publicNote ? `<p class="ff-note">${escapeHtml(l.publicNote)}</p>` : "") +
      `</div>` +
      `<div class="ff-pricing">` +
      `<div class="ff-price-block">` +
      `<span class="ff-price-label">Friends &amp; Family price</span>` +
      `<div class="ff-price">${fmtMoney(l.priceEach)} <span class="ff-price-unit">/ ticket</span></div>` +
      `<p class="ff-compare">FIFA resale est. ${fmtMoney(l.fifaBuyerEach)} · <span class="ff-save">Save ${fmtMoney(l.saveEach)}</span></p>` +
      `</div>` +
      waBtn +
      `</div>` +
      `</div>` +
      `</article>`
    );
  }

  function renderSoldCard(l, inGroup) {
    const datePart = [l.dateLabel, l.timeLabel].filter(Boolean).join(" · ");
    const soldLine = fmtSoldDate(l.soldAt);
    const aria = `Sold — ${l.matchTitle}, ${l.seatDisplay}`;
    const head = inGroup
      ? `<div class="ff-card-title-row">` +
        `<p class="ff-seat ff-seat--lead">${escapeHtml(l.category)} · ${escapeHtml(l.seatDisplay)} · Qty ${l.quantity}</p>` +
        `<span class="ff-badge-sold">SOLD</span>` +
        `</div>`
      : `<div class="ff-card-title-row">` +
        `<h2 class="ff-match">${escapeHtml(l.matchTitle)}</h2>` +
        `<span class="ff-badge-sold">SOLD</span>` +
        `</div>` +
        `<p class="ff-meta">${escapeHtml(datePart)}${datePart && l.venue ? " · " : ""}${escapeHtml(l.venue)}</p>` +
        `<p class="ff-seat">${escapeHtml(l.category)} · ${escapeHtml(l.seatDisplay)} · Qty ${l.quantity}</p>`;
    return (
      `<article class="ff-card ff-card--sold${inGroup ? " ff-card--ingroup" : ""}" data-id="${escapeHtml(l.id)}" data-status="sold" aria-label="${escapeHtml(aria)}">` +
      `<div class="ff-card-body">` +
      `<div class="ff-card-head">` +
      head +
      (l.publicNote ? `<p class="ff-note">${escapeHtml(l.publicNote)}</p>` : "") +
      `</div>` +
      `<div class="ff-sold-foot">` +
      (soldLine ? `<p class="ff-sold-date">${escapeHtml(soldLine)}</p>` : "") +
      `</div>` +
      `</div>` +
      `</article>`
    );
  }

  function renderCard(l, inGroup) {
    return listingStatus(l) === "sold" ? renderSoldCard(l, inGroup) : renderAvailableCard(l, inGroup);
  }

  function renderStats() {
    if (!els.catalogStats || !catalog) return;
    const rows = catalog.listings || [];
    const counted = countStatuses(rows);
    const available = counted.available;
    const sold = counted.sold;
    if (available === 0 && sold === 0) {
      els.catalogStats.hidden = true;
      return;
    }
    els.catalogStats.hidden = false;
    els.catalogStats.innerHTML = renderStatusCounts({ available, sold });
  }

  function render() {
    if (!catalog) return;
    const rows = filteredListings();
    const total = (catalog.listings || []).length;

    if (els.statusLine) {
      if (!total) {
        els.statusLine.textContent = "";
      } else if (rows.length === total) {
        els.statusLine.textContent = `${rows.length} listing${rows.length === 1 ? "" : "s"}`;
      } else {
        els.statusLine.textContent = `${rows.length} of ${total} listings`;
      }
    }

    if (els.listings) {
      if (!total) {
        els.listings.innerHTML =
          `<div class="ff-empty">Catalog not available yet. The seller may still be preparing listings.</div>`;
      } else if (!rows.length) {
        const sf = els.status && els.status.value;
        const msg =
          sf === "available"
            ? "No tickets available right now — try All or Sold to see recent sales."
            : sf === "sold"
              ? "No sold listings yet."
              : "No tickets match your filters.";
        els.listings.innerHTML = `<div class="ff-empty">${escapeHtml(msg)}</div>`;
      } else {
        const stages = groupByStage(rows);
        els.listings.innerHTML =
          `<div class="ff-stage-accordion">` +
          stages.map(renderStageSection).join("") +
          `</div>`;
      }
    }
  }

  function applyCatalog(data) {
    catalog = data;
    if (catalog && Array.isArray(catalog.listings)) {
      backfillListingMatchFields(catalog.listings);
    }
    if (els.brandTitle && data.brand && data.brand.title) els.brandTitle.textContent = data.brand.title;
    if (els.brandTagline && data.brand && data.brand.tagline) {
      els.brandTagline.textContent = data.brand.tagline;
    }
    if (els.updatedAt) {
      els.updatedAt.textContent = data.publishedAt
        ? "Updated " + fmtUpdated(data.publishedAt)
        : "";
    }
    if (els.disclaimers && Array.isArray(data.disclaimers)) {
      const lines = data.disclaimers.filter((d) => !REMOVED_DISCLAIMERS.has(String(d || "").trim()));
      els.disclaimers.innerHTML = lines.map((d) => `<li>${escapeHtml(d)}</li>`).join("");
    }
    if (els.contact && data.brand && data.brand.contactEmail) {
      els.contact.hidden = false;
      const em = String(data.brand.contactEmail).trim();
      els.contact.innerHTML =
        `<span class="ff-contact-lead muted">Questions about a listing?</span> ` +
        `<a class="ff-btn-contact" href="mailto:${escapeHtml(em)}">Email the seller</a>`;
    }
    fillSelect(els.venue, uniqueValues(data.listings || [], "venue"), "All venues");
    fillSelect(els.category, uniqueValues(data.listings || [], "category"), "All categories");
    renderStats();
    render();
  }

  function readEmbeddedCatalog() {
    const el = document.getElementById("catalog-data");
    if (!el) return null;
    const raw = (el.textContent || "").trim();
    if (!raw) return null;
    try {
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.listings)) return data;
    } catch (_) {
      /* fall through */
    }
    return null;
  }

  function showLoadError(message) {
    if (els.statusLine) els.statusLine.textContent = message;
    if (els.listings) {
      els.listings.innerHTML = `<div class="ff-empty">${escapeHtml(message)}</div>`;
    }
  }

  function wireFilters() {
    ["input", "change"].forEach((ev) => {
      els.search && els.search.addEventListener(ev, render);
      els.status && els.status.addEventListener(ev, render);
      els.venue && els.venue.addEventListener(ev, render);
      els.category && els.category.addEventListener(ev, render);
      els.sort && els.sort.addEventListener(ev, render);
    });
  }

  function loadCatalog() {
    const embedded = readEmbeddedCatalog();
    if (embedded) {
      applyCatalog(embedded);
      return;
    }

    fetch(DATA_URL)
      .then((r) => {
        if (!r.ok) throw new Error("Could not load inventory (" + r.status + ")");
        return r.json();
      })
      .then(applyCatalog)
      .catch((err) => {
        const onFile = window.location.protocol === "file:";
        const msg = onFile
          ? "Could not load catalog offline. Re-download the catalog ZIP from the extension (data is embedded in index.html)."
          : String(err.message || err);
        showLoadError(msg);
      });
  }

  wireFilters();
  loadCatalog();
})();
