/**
 * FIFA WC 2026 — global match number → tournament stage (104-match schedule).
 * Titles use "Match N" (e.g. "FIFA World Cup 2026™ - Match 1 - Mexico vs …").
 */
(function (root) {
  "use strict";

  const UNKNOWN = { id: "unknown", label: "Other Matches", order: 99 };

  /** Official 104-match bracket — match number ranges only. */
  const STAGES = [
    { id: "group", label: "Group Stage Matches", order: 0, min: 1, max: 72 },
    { id: "r32", label: "Round of 32", order: 1, min: 73, max: 88 },
    { id: "r16", label: "Round of 16", order: 2, min: 89, max: 96 },
    { id: "quarter", label: "Quarter-Finals", order: 3, min: 97, max: 100 },
    { id: "semi", label: "Semi-Finals", order: 4, min: 101, max: 102 },
    { id: "bronze", label: "Bronze Final", order: 5, min: 103, max: 103 },
    { id: "final", label: "Final", order: 6, min: 104, max: 104 },
  ];

  function parseMatchNumber(text) {
    const m = String(text || "").match(/Match\s+(\d+)\b/i);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function stageFromMatchNumber(n) {
    if (!Number.isFinite(Number(n))) return { ...UNKNOWN };
    const num = Number(n);
    for (const s of STAGES) {
      if (num >= s.min && num <= s.max) return s;
    }
    return { ...UNKNOWN };
  }

  function stageFromTitle(title) {
    return stageFromMatchNumber(parseMatchNumber(title));
  }

  root.FWC26Stages = {
    STAGES,
    UNKNOWN,
    parseMatchNumber,
    stageFromMatchNumber,
    stageFromTitle,
  };
})(typeof globalThis !== "undefined" ? globalThis : self);
