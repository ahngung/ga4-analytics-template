const v = dataform.projectConfig.vars;

const bool = (x) => String(x).toLowerCase() === "true";

// --- Projekt & Quelle ---
const DB     = dataform.projectConfig.defaultDatabase;
const T_EVENTS   = `\`${DB}.${v.ga4_dataset}.events_*\``;
const T_INTRADAY = `\`${DB}.${v.ga4_dataset}.events_intraday_*\``;
const SUFFIX = `REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\\d{8}$')`;
const HISTORY_START = v.history_start || "20000101";

// --- Dataset-Namen ---
// Kanonische Schemanamen. Die config-Bloecke setzen das Schema aktuell noch
// direkt ueber ds_prefix; diese Konstanten sind der vorgesehene Ersatz dafuer.
const P      = v.ds_prefix || "";
const S_STG  = `${P}stg`;
const S_CORE = `${P}core`;
const S_MART = `${P}mart`;
const S_QA   = `${P}qa`;

// --- Event-Listen aus Vars ---
const arr   = (s) => (s || "").split(",").map(x => x.trim()).filter(Boolean);
const uniq  = (a) => Array.from(new Set(a));
const quote = (a) => a.map(x => `'${x}'`).join(",");

// Purchase zaehlt bei aktivem Ecommerce automatisch als Macro-Conversion.
// Ohne das landet purchase nie in fct_conversions und mart_customer_value
// liefert dauerhaft null Zeilen.
const CONV_ARR = uniq(
  arr(v.conversion_events).concat(
    bool(v.has_ecommerce) ? [(v.ecom_purchase_event || "purchase").trim()] : []
  )
);
// Ueberschneidungen entfernen, damit conv_class eindeutig bleibt.
const MICRO_ARR = uniq(arr(v.micro_events)).filter(x => CONV_ARR.indexOf(x) === -1);

const CONV  = quote(CONV_ARR);
const MICRO = quote(MICRO_ARR);

// --- Identitaet ---
const USE_UID  = bool(v.use_user_id);
const IDENTITY = USE_UID
  ? `COALESCE(NULLIF(user_id,''), user_pseudo_id)`
  : `user_pseudo_id`;

// --- Quellen-Kaskade ---
const SRC = `COALESCE(
    session_traffic_source_last_click.cross_channel_campaign.source,
    collected_traffic_source.manual_source,
    traffic_source.source)`;
const MDM = `COALESCE(
    session_traffic_source_last_click.cross_channel_campaign.medium,
    collected_traffic_source.manual_medium,
    traffic_source.medium)`;
const CMP = `COALESCE(
    session_traffic_source_last_click.cross_channel_campaign.campaign_name,
    collected_traffic_source.manual_campaign_name,
    traffic_source.name)`;

// --- Channel: Export bevorzugen, sonst ableiten ---
const CHANNEL_RAW = `COALESCE(
    NULLIF(session_traffic_source_last_click.cross_channel_campaign.default_channel_group,''),
    CASE
      WHEN ${MDM} = 'ai-assistant'
        OR REGEXP_CONTAINS(LOWER(IFNULL(${SRC},'')),
           r'chatgpt|perplexity|copilot|gemini|claude|phind|you\\.com')    THEN 'AI Assistant'
      WHEN REGEXP_CONTAINS(LOWER(IFNULL(${MDM},'')), r'^(cpc|ppc|paid)')  THEN 'Paid Search'
      WHEN LOWER(IFNULL(${MDM},'')) = 'organic'                           THEN 'Organic Search'
      WHEN REGEXP_CONTAINS(LOWER(IFNULL(${MDM},'')), r'email|newsletter') THEN 'Email'
      WHEN REGEXP_CONTAINS(LOWER(IFNULL(${MDM},'')), r'social')           THEN 'Organic Social'
      WHEN LOWER(IFNULL(${MDM},'')) = 'referral'                          THEN 'Referral'
      WHEN LOWER(IFNULL(${MDM},'')) IN ('affiliate','display','video')    THEN INITCAP(${MDM})
      WHEN ${SRC} IS NULL AND ${MDM} IS NULL                              THEN 'Direct'
      ELSE 'Unassigned'
    END)`;

// Labels vereinheitlichen — Export und Fallback auf eine Schreibweise bringen
const CHANNEL = `CASE
    WHEN REGEXP_CONTAINS(LOWER(${CHANNEL_RAW}), r'ai|llm')       THEN 'AI Assistant'
    WHEN LOWER(${CHANNEL_RAW}) LIKE '%paid search%'              THEN 'Paid Search'
    WHEN LOWER(${CHANNEL_RAW}) LIKE '%organic search%'           THEN 'Organic Search'
    WHEN LOWER(${CHANNEL_RAW}) LIKE '%organic social%'           THEN 'Organic Social'
    WHEN LOWER(${CHANNEL_RAW}) IN ('(not set)','unassigned','')  THEN 'Unassigned'
    ELSE ${CHANNEL_RAW}
  END`;

const param = (k, t = 'string') =>
  `(SELECT value.${t}_value FROM UNNEST(event_params) WHERE key='${k}')`;

// Numerischer Parameter ueber alle drei GA4-Typen.
// GA4 legt denselben Key je nach gesendetem Wert in int_value, float_value
// oder double_value ab — nur double abzufragen verliert ganzzahlige Werte.
const paramNum = (k) => `COALESCE(
      ${param(k, 'double')},
      ${param(k, 'float')},
      SAFE_CAST(${param(k, 'int')} AS FLOAT64))`;

// --- Zeit ---
const TZ    = v.timezone || "UTC";
const TODAY = `CURRENT_DATE('${TZ}')`;

module.exports = { v, TZ, TODAY, bool, USE_UID,
                   T_EVENTS, T_INTRADAY, SUFFIX, HISTORY_START,
                   P, S_STG, S_CORE, S_MART, S_QA,
                   CONV, MICRO, IDENTITY, SRC, MDM, CMP, CHANNEL,
                   param, paramNum };