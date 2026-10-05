# GA4 Analytics Template (Dataform)

A config-driven [Dataform](https://cloud.google.com/dataform) project that turns the raw GA4 BigQuery export into clean session, conversion and attribution tables plus ready-to-use marts. Everything site-specific (conversion events, funnel steps, lookback windows, timezone) lives in `dataform.json`, so the SQL itself stays untouched between sites.

## Layers

| Folder | Dataset | What it builds |
| --- | --- | --- |
| `00_staging` | `ga4_stg` | `events`: incremental, deduplicated events from `events_*` plus not-yet-finalized `events_intraday_*`, with identity, source cascade and channel group |
| `10_core` | `ga4_core` | `fct_sessions`, `fct_conversions`, `fct_touchpoints` |
| `20_attribution` | `ga4_core` / `ga4_mart` | `bridge_attribution` (first, last, last non-direct, linear, position-based, time-decay credits), model comparison, journey paths |
| `21`–`26` | `ga4_mart` | engagement, content, funnel, weekly retention cohorts, landing pages, data-quality header, user lifecycle milestones |
| `27_ecommerce` | `ga4_mart` | ecommerce funnel, product performance, customer value (only when `has_ecommerce` is `true`) |
| `90_assertions` | `ga4_qa` | credits sum to 1, unique keys, freshness, no intraday leak, conversions have sessions, traffic anomalies |

Shared SQL helpers live in `includes/ga4.js` (source tables, identity, channel logic, `event_params` access), `includes/funnel.js` and `includes/features.js`.

## Configuration

All settings are `vars` in `dataform.json`:

| Var | Meaning |
| --- | --- |
| `ga4_dataset` | GA4 export dataset, e.g. `analytics_123456789` |
| `ds_prefix` | Prefix for output datasets (`ga4_` gives `ga4_stg`, `ga4_core`, `ga4_mart`, `ga4_qa`) |
| `conversion_events` / `micro_events` | Comma-separated macro and micro conversion events |
| `milestone_events` | Ordered events for the lifecycle milestone tables |
| `funnel_steps` | Ordered funnel, separated by `>` |
| `has_ecommerce` | `true` enables the `27_ecommerce` models; `purchase` then counts as a macro conversion |
| `lookback_days` | Attribution lookback window |
| `halflife_days` | Half-life for time-decay attribution |
| `reprocess_days` | Days the incremental staging table re-reads on each run (covers late GA4 data) |
| `history_start` | First export day (`YYYYMMDD`) loaded on a full refresh |
| `timezone` | Reporting timezone |
| `use_user_id` | Use `user_id` when present, otherwise `user_pseudo_id` |

Also set `defaultDatabase` to your GCP project ID and `defaultLocation` to the **same location as your GA4 export dataset** (`US`, `EU`, ...). A mismatch makes every query fail.

## Running it in Google Cloud

Prerequisite: [GA4 BigQuery export](https://support.google.com/analytics/answer/9823238) is enabled, so a dataset `analytics_<property_id>` with daily `events_YYYYMMDD` tables exists.

1. **Get your own copy.** Fork this repo (or push a copy to your own Git host). Dataform commits config changes back to the repository, so it needs one you can write to.
2. **Create a Dataform repository.** In the Cloud console open *BigQuery → Dataform → Create repository*. Pick a region and a service account.
3. **Connect it to Git.** Create a personal access token on GitHub with contents read/write on the repo, store it in *Secret Manager*, then in the Dataform repository open *Settings → Connect with Git*. Enter the HTTPS URL, default branch `main` and that secret.
4. **Grant the Dataform service account access:**
   - `Secret Manager Secret Accessor` on the token secret
   - `BigQuery Data Viewer` on the GA4 export dataset
   - `BigQuery Data Editor` and `BigQuery Job User` on the project (the output datasets are created automatically)
5. **Configure.** Create a development workspace, edit `dataform.json` (`defaultDatabase`, `defaultLocation`, `ga4_dataset`, events, `history_start`), then commit and push from the workspace. Dependencies install from `package.json` (`@dataform/core` 2.9.0).
6. **First run.** In the workspace choose *Start execution → All actions* with **Run with full refresh** turned on. This backfills `ga4_stg.events` from `history_start`.
7. **Schedule.** Create a *release configuration* on `main`, then two *workflow configurations* that run it:
   - daily, selecting the tag `daily`, timed after the GA4 daily export has landed (late morning in the property's timezone is a safe default)
   - weekly, selecting the tag `weekly` (retention cohorts, customer value)

   Turn on *Include dependencies* so a tag never runs against stale upstream tables.

Assertion failures show up in the workflow run, and the offending rows land in `ga4_qa`.

### Running locally instead

```bash
npm i -g @dataform/cli@^2
dataform install
dataform init-creds bigquery   # writes .df-credentials.json (gitignored)
dataform compile
dataform run --full-refresh    # first time
dataform run --tags daily
```
