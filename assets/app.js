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

  let catalog = null;

  function listingStatus(l) {
    return l && l.status === "sold" ? "sold" : "available";
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
      const available = rows.filter((l) => listingStatus(l) === "available");
      const sold = rows.filter((l) => listingStatus(l) === "sold");
      available.sort((a, b) => {
        const d = (Number(a.priceEach) || 0) - (Number(b.priceEach) || 0);
        return sort === "price-asc" ? d : -d;
      });
      sold.sort(
        (a, b) =>
          String(b.soldAt || b.sortDate).localeCompare(String(a.soldAt || a.sortDate)) ||
          String(a.matchTitle).localeCompare(String(b.matchTitle))
      );
      rows = available.concat(sold);
    } else if (sort === "date-desc") {
      rows.sort(
        (a, b) =>
          statusRank(a) - statusRank(b) ||
          String(b.sortDate).localeCompare(String(a.sortDate)) ||
          String(a.matchTitle).localeCompare(String(b.matchTitle))
      );
    } else {
      rows.sort(
        (a, b) =>
          statusRank(a) - statusRank(b) ||
          String(a.sortDate).localeCompare(String(b.sortDate)) ||
          String(a.matchTitle).localeCompare(String(b.matchTitle))
      );
    }
    return rows;
  }

  function renderAvailableCard(l) {
    const datePart = [l.dateLabel, l.timeLabel].filter(Boolean).join(" · ");
    const href = waHref(l, catalog.brand);
    return (
      `<article class="ff-card ff-card--available" data-id="${escapeHtml(l.id)}" data-status="available">` +
      `<div class="ff-card-body">` +
      `<div class="ff-card-head">` +
      `<h2 class="ff-match">${escapeHtml(l.matchTitle)}</h2>` +
      `<p class="ff-meta">${escapeHtml(datePart)}${datePart && l.venue ? " · " : ""}${escapeHtml(l.venue)}</p>` +
      `<p class="ff-seat">${escapeHtml(l.category)} · ${escapeHtml(l.seatDisplay)} · Qty ${l.quantity}</p>` +
      (l.publicNote ? `<p class="ff-note">${escapeHtml(l.publicNote)}</p>` : "") +
      `</div>` +
      `<div class="ff-pricing">` +
      `<div class="ff-price-block">` +
      `<span class="ff-price-label">Friends &amp; Family price</span>` +
      `<div class="ff-price">${fmtMoney(l.priceEach)} <span class="ff-price-unit">/ ticket</span></div>` +
      `<p class="ff-compare">FIFA resale est. ${fmtMoney(l.fifaBuyerEach)} · <span class="ff-save">Save ${fmtMoney(l.saveEach)}</span></p>` +
      `</div>` +
      `<a class="ff-btn-wa" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">Buy on WhatsApp</a>` +
      `</div>` +
      `</div>` +
      `</article>`
    );
  }

  function renderSoldCard(l) {
    const datePart = [l.dateLabel, l.timeLabel].filter(Boolean).join(" · ");
    const soldLine = fmtSoldDate(l.soldAt);
    const aria = `Sold — ${l.matchTitle}, ${l.seatDisplay}`;
    return (
      `<article class="ff-card ff-card--sold" data-id="${escapeHtml(l.id)}" data-status="sold" aria-label="${escapeHtml(aria)}">` +
      `<div class="ff-card-body">` +
      `<div class="ff-card-head">` +
      `<div class="ff-card-title-row">` +
      `<h2 class="ff-match">${escapeHtml(l.matchTitle)}</h2>` +
      `<span class="ff-badge-sold">SOLD</span>` +
      `</div>` +
      `<p class="ff-meta">${escapeHtml(datePart)}${datePart && l.venue ? " · " : ""}${escapeHtml(l.venue)}</p>` +
      `<p class="ff-seat">${escapeHtml(l.category)} · ${escapeHtml(l.seatDisplay)} · Qty ${l.quantity}</p>` +
      (l.publicNote ? `<p class="ff-note">${escapeHtml(l.publicNote)}</p>` : "") +
      `</div>` +
      `<div class="ff-sold-foot">` +
      (soldLine ? `<p class="ff-sold-date">${escapeHtml(soldLine)}</p>` : "") +
      `<p class="ff-sold-tagline">Sold privately below FIFA resale</p>` +
      `</div>` +
      `</div>` +
      `</article>`
    );
  }

  function renderCard(l) {
    return listingStatus(l) === "sold" ? renderSoldCard(l) : renderAvailableCard(l);
  }

  function renderStats() {
    if (!els.catalogStats || !catalog) return;
    const stats = catalog.stats || {};
    let available = stats.availableCount;
    let sold = stats.soldCount;
    if (available == null || sold == null) {
      const rows = catalog.listings || [];
      available = rows.filter((l) => listingStatus(l) === "available").length;
      sold = rows.filter((l) => listingStatus(l) === "sold").length;
    }
    if (available === 0 && sold === 0) {
      els.catalogStats.hidden = true;
      return;
    }
    els.catalogStats.hidden = false;
    els.catalogStats.innerHTML =
      `<span class="ff-stat ff-stat--available">${available} available</span>` +
      `<span class="ff-stat-sep"> · </span>` +
      `<span class="ff-stat ff-stat--sold">${sold} sold</span>`;
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
        els.listings.innerHTML = rows.map(renderCard).join("");
      }
    }
  }

  function applyCatalog(data) {
    catalog = data;
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
      els.disclaimers.innerHTML = data.disclaimers.map((d) => `<li>${escapeHtml(d)}</li>`).join("");
    }
    if (els.contact && data.brand && data.brand.contactEmail) {
      els.contact.hidden = false;
      const em = escapeHtml(data.brand.contactEmail);
      els.contact.innerHTML = `Questions? <a href="mailto:${em}">${em}</a>`;
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
