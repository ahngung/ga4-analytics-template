const v = dataform.projectConfig.vars;

const bool = (x) => String(x).toLowerCase() === "true";

// Feature-Flags des Templates. Aktuell steuert nur `ecommerce` real etwas
// (ueber die disabled-Klauseln der 27_ecommerce-Modelle); die uebrigen Flags
// sind die vorgesehene Erweiterungsflaeche fuer weitere Mandanten.
const F = {
  ecommerce: bool(v.has_ecommerce),
  auth:      bool(v.has_auth),
  search:    bool(v.has_search),
  video:     bool(v.has_video),
  model:     v.business_model || "b2b_lead"
};

// Listen aus Vars
const split = (s) => (s || "").split(",").map(x => x.trim()).filter(Boolean);
const MS    = split(v.milestone_events);
const safe  = (s) => s.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

// Baustein nur ausgeben, wenn Flag gesetzt (fuer kuenftige Feature-Gates).
const iff = (flag, sql, fallback = "") => flag ? sql : fallback;

// Liste von SQL-Fragmenten zu einer Spaltenliste verbinden.
// Leere Fragmente fliegen raus — verhindert ", ," bei leeren Event-Listen.
const cols = (parts) => parts.filter(s => s && String(s).trim()).join(",\n  ");

const ECOM_FUNNEL = split(v.ecom_funnel_steps);
const ECOM_ITEMS  = split(v.ecom_item_events);
const ECOM_BUY    = (v.ecom_purchase_event || "purchase").trim();
const sqlList     = (arr) => arr.map(x => `'${x}'`).join(",");

module.exports = { F, MS, safe, iff, cols,
                   ECOM_FUNNEL, ECOM_ITEMS, ECOM_BUY, sqlList };