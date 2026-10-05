const v = dataform.projectConfig.vars;
const STEPS = (v.funnel_steps || "").split(">").map(s => s.trim()).filter(Boolean);
const safe = (s) => s.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
const cols = (parts) => parts.filter(s => s && String(s).trim()).join(",\n  ");
module.exports = { STEPS, safe, cols };