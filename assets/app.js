(function () {
  "use strict";

  const DATA_URL = "data/inventory.json";

  const els = {
    brandTitle: document.getElementById("brand-title"),
    brandTagline: document.getElementById("brand-tagline"),
    updatedAt: document.getElementById("updated-at"),
    search: document.getElementById("filter-search"),
    venue: document.getElementById("filter-venue"),
    category: document.getElementById("filter-category"),
    sort: document.getElementById("filter-sort"),
    status: document.getElementById("status"),
    listings: document.getElementById("listings"),
    disclaimers: document.getElementById("disclaimers"),
    contact: document.getElementById("contact-line"),
  };

  let catalog = null;

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

  function filteredListings() {
    if (!catalog || !Array.isArray(catalog.listings)) return [];
    const q = (els.search && els.search.value || "").trim().toLowerCase();
    const venue = els.venue && els.venue.value;
    const cat = els.category && els.category.value;
    let rows = catalog.listings.filter((l) => {
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
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });

    const sort = (els.sort && els.sort.value) || "date-asc";
    rows = rows.slice();
    rows.sort((a, b) => {
      if (sort === "price-asc") return a.priceEach - b.priceEach;
      if (sort === "price-desc") return b.priceEach - a.priceEach;
      if (sort === "date-desc") return String(b.sortDate).localeCompare(String(a.sortDate));
      return String(a.sortDate).localeCompare(String(b.sortDate));
    });
    return rows;
  }

  function renderCard(l) {
    const datePart = [l.dateLabel, l.timeLabel].filter(Boolean).join(" · ");
    const href = waHref(l, catalog.brand);
    return (
      `<article class="ff-card" data-id="${escapeHtml(l.id)}">` +
      `<div class="ff-card-head">` +
      `<h2 class="ff-match">${escapeHtml(l.matchTitle)}</h2>` +
      `<p class="ff-meta">${escapeHtml(datePart)}${datePart && l.venue ? " · " : ""}${escapeHtml(l.venue)}</p>` +
      `<p class="ff-seat">${escapeHtml(l.category)} · ${escapeHtml(l.seatDisplay)} · Qty ${l.quantity}</p>` +
      (l.publicNote ? `<p class="ff-note">${escapeHtml(l.publicNote)}</p>` : "") +
      `</div>` +
      `<div class="ff-pricing">` +
      `<div class="ff-price-block">` +
      `<span class="ff-price-label">Friends &amp; Family price</span>` +
      `<div class="ff-price">${fmtMoney(l.priceEach)} <span style="font-size:0.75rem;font-weight:500;color:var(--ff-muted)">/ ticket</span></div>` +
      `<p class="ff-compare">FIFA resale est. ${fmtMoney(l.fifaBuyerEach)} · <span class="ff-save">Save ${fmtMoney(l.saveEach)}</span></p>` +
      `</div>` +
      `<a class="ff-btn-wa" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">Buy on WhatsApp</a>` +
      `</div>` +
      `</article>`
    );
  }

  function render() {
    if (!catalog) return;
    const rows = filteredListings();
    if (els.status) {
      els.status.textContent =
        rows.length === catalog.listings.length
          ? `${rows.length} listing${rows.length === 1 ? "" : "s"}`
          : `${rows.length} of ${catalog.listings.length} listings`;
    }
    if (els.listings) {
      if (!rows.length) {
        els.listings.innerHTML = `<div class="ff-empty">No tickets match your filters.</div>`;
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
      /* fall through to fetch */
    }
    return null;
  }

  function showLoadError(message) {
    if (els.status) els.status.textContent = message;
    if (els.listings) {
      els.listings.innerHTML =
        `<div class="ff-empty">${escapeHtml(message)}</div>`;
    }
  }

  function wireFilters() {
    ["input", "change"].forEach((ev) => {
      els.search && els.search.addEventListener(ev, render);
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
