const v = dataform.projectConfig.vars;

const bool = (x) => String(x).toLowerCase() === "true";

// Template feature flags. Only `ecommerce` has a real effect today
// (via the disabled clauses of the 27_ecommerce models); the other flags
// are the intended extension points for other site types.
const F = {
  ecommerce: bool(v.has_ecommerce),
  auth:      bool(v.has_auth),
  search:    bool(v.has_search),
  video:     bool(v.has_video),
  model:     v.business_model || "b2b_lead"
};

// Lists from vars
const split = (s) => (s || "").split(",").map(x => x.trim()).filter(Boolean);
const MS    = split(v.milestone_events);
const safe  = (s) => s.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

// Emit a SQL fragment only when the flag is set (for future feature gates).
const iff = (flag, sql, fallback = "") => flag ? sql : fallback;

// Join SQL fragments into a column list.
// Empty fragments are dropped, which prevents ", ," for empty event lists.
const cols = (parts) => parts.filter(s => s && String(s).trim()).join(",\n  ");

const ECOM_FUNNEL = split(v.ecom_funnel_steps);
const ECOM_ITEMS  = split(v.ecom_item_events);
const ECOM_BUY    = (v.ecom_purchase_event || "purchase").trim();
const sqlList     = (arr) => arr.map(x => `'${x}'`).join(",");

module.exports = { F, MS, safe, iff, cols,
                   ECOM_FUNNEL, ECOM_ITEMS, ECOM_BUY, sqlList };