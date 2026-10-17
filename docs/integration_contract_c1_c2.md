# Integration contract: Component 1 (nutrients) → Component 2 (chlorophyll-a) and Component 1 API → frontend

Version 1.1 – 17 Oct 2026 – status: **draft for PP1**.
- Interface A content agreed in v1.0 (11 Oct 2026) is unchanged. It was agreed by both components, with cell IDs and grid centres verified.
- The rules added in v1.1 are marked **Requires agreement** wherever they place an obligation on another owner. They are not binding on that owner until confirmed.

Project: FishGuard AI (J26-DS-350). This document is maintained by Component 1.

---

## 0. Document control

| Item | Value |
|---|---|
| Document | `docs/integration_contract_c1_c2.md` |
| Current version | 1.1 (draft for PP1) |
| Previous version | 1.0 – agreed 11 Oct 2026 by Component 1 and Component 2 |
| Component 1 owner | Layara (IT23173590) – Coastal Nutrient Forecasting |
| Component 2 owner | TBD – Chlorophyll-a / productivity modelling |
| Frontend owner | TBD – shared React Native + Expo frontend |
| Code changes in v1.1 | None. Documentation only. |

What v1.1 adds to v1.0:
- explicit owners;
- producer and consumer responsibilities;
- data types and formats;
- validation rules;
- versioning;
- rules for missing, invalid and delayed data;
- issue reporting;
- a second interface (Component 1 FastAPI → React Native frontend);
- PP1 integration status;
- a list of open items.

## 1. Purpose and scope

This contract covers two interfaces owned on the producer side by Component 1:

| Interface | Producer | Consumer | Form |
|---|---|---|---|
| A | Component 1 – Coastal Nutrient Forecasting | Component 2 – Chlorophyll-a / productivity modelling | CSV file |
| B | Component 1 FastAPI backend (`/c1`) | Shared React Native + Expo frontend | HTTP GET, JSON (CSV from one endpoint) |

**Operating mode.** All current Component 1 outputs are produced in validated **replay / hindcast-forcing mode**:
- Forecasts for issue dates in the 2022–2025 test period are produced with reanalysis forcing over the forecast window.
- This is **not** live, real-time or operational forecasting. Live mode would require weather-forecast forcing and is out of scope for this version.

**Out of scope:**
- Component 2 modelling and its internal fallback logic.
- Components 3 and 4.
- Live data retrieval.
- Authentication and authorization implementation (see 4.10).

## 2. Shared definitions and data provenance

**Nutrient values.** Nutrient targets and reference values come from Copernicus Marine GLOBAL_MULTIYEAR_BGC_001_029.
- This is a model-derived hindcast without data assimilation.
- The values are **model-hindcast reference values, not in-situ observations**.

**Forcing.** ERA5-Land and ERA5 are reanalysis products. Catchment information comes from HydroBASINS (level 9).

**Time terms:**
- Issue date (t0): the day the forecast is made.
- Lead time: 1–7 days.
- Target date: issue date + lead time.

**Unit.** All nutrient concentrations are in mmol m-3.

**Model.** The Component 1 model is `NeuralODE_s2026`, the Neural ODE selected on validation loss. Test-period results were not used for selection.

---

## 3. Interface A – Component 1 → Component 2 (CSV)

### 3.1 Owners and contacts

| Role | Owner | Contact / channel |
|---|---|---|
| Producer (Component 1) | Layara (IT23173590) | TBD – Requires agreement (see Section 5) |
| Consumer (Component 2) | TBD | TBD – Requires agreement |

### 3.2 Spatial (agreed in v1.0, unchanged)

- 12 coastal Copernicus 0.25° cells, Western + Southern Sri Lanka (box 5.75–7.0°N, 79.25–81.0°E).
- Cell list and IDs: `data/processed/cells.csv`. Cell centres are on 0.25° multiples, e.g. `N6.75_E79.75`.
- Join key: `cell_id`.
- Negombo and Hambantota are not required (box not widened).

### 3.3 Temporal (agreed in v1.0, unchanged)

- Daily time step; dates in ISO format `YYYY-MM-DD`.
- Lead times: 1–7 days.
- Shared split: train 1997-09-04 → 2017-12-31 | validation 2018–2021 | test 2022–2025.
- Component 2 trains on original Copernicus nutrients. Component 1 forecasts are used on the test period.
- Both components are evaluated in hindcast-forcing mode (reanalysis forcing over the forecast window).

### 3.4 File format and schema

**Format (agreed in v1.0).** CSV (Parquet optional), one row per cell × issue_date × lead time. The current delivery is CSV.

**Clarified in v1.1:**
- UTF-8 encoding, comma separator, one header row, no index column, decimal point.
- Column names are lower-case, exactly as below.

| # | Column | Meaning | Unit | Type / format |
|---|---|---|---|---|
| 1 | cell_id | Coastal cell ID | – | text, e.g. `N6.75_E79.75`; must exist in the agreed cell list |
| 2 | latitude | Cell centre | degrees | decimal degrees |
| 3 | longitude | Cell centre | degrees | decimal degrees |
| 4 | issue_date | Day the forecast is made (t0) | date | `YYYY-MM-DD` |
| 5 | lead_time_days | 1–7 | days | integer 1–7 |
| 6 | target_date | Day being forecast (issue_date + lead) | date | `YYYY-MM-DD`; equals issue_date + lead_time_days |
| 7 | no3 | Forecast nitrate | mmol m-3 | finite number ≥ 0 |
| 8 | po4 | Forecast phosphate | mmol m-3 | finite number ≥ 0 |
| 9 | si | Forecast silicate | mmol m-3 | finite number ≥ 0 |
| 10 | no3_copernicus | Original Copernicus value for reference (at target_date) | mmol m-3 | number ≥ 0 |
| 11 | po4_copernicus | Original Copernicus value for reference (at target_date) | mmol m-3 | number ≥ 0 |
| 12 | si_copernicus | Original Copernicus value for reference (at target_date) | mmol m-3 | number ≥ 0 |
| 13 | model_name | Model that produced the forecast | – | text, currently `NeuralODE_s2026` |
| (after PP1) | \*_lower, \*_upper | Uncertainty bounds | mmol m-3 | planned, not in the current file |

**Unique row key (agreed in v1.0):** `cell_id + issue_date + lead_time_days`, equivalently `cell_id + target_date + lead_time_days`.
- Each target_date appears once per lead time, so 7 times per cell.
- Component 2 filters to one lead time before joining on `cell_id + target_date`.

**Clarified in v1.1 – export key vs downstream join.**
- The export unique key identifies rows in the file.
- A consumer is **not** required to join on the export key for every operation.
- The agreed downstream pattern is:
  1. filter to a chosen `lead_time_days`;
  2. join on `cell_id + target_date`.
- After step 1, `cell_id + target_date` is unique.
- Joining on `cell_id + target_date` **without** first filtering to one lead time would match 7 rows per key, and must be avoided.

**Meaning of the `*_copernicus` columns (clarified in v1.1).**
- They hold the Copernicus model-hindcast reference value **at the target date**, for comparison and evaluation.
- They are not observations, and they are not Component 1 forecasts.
- They contain information that is not available on the issue date. They must not be used as forecast inputs, and must not be substituted for missing forecasts (see 3.8).

**Current delivered file:**

| Item | Value |
|---|---|
| Path (Component 1 repository, not tracked in Git) | `outputs/c1_to_c2/c1_nutrient_forecasts_test_2022_2025.csv` |
| Columns | 13, as above |
| Rows | 122,136 = 12 cells × 1,454 issue dates (2022-01-01 → 2025-12-24) × 7 lead times |
| Model | `NeuralODE_s2026` (validation-selected) |
| SHA-256 of delivered file | b8344c9703243074ea44b7d1ed9b2225fc9feb621b1a0e715918c13be76fa0f2 |
| Handover method | TBD – to be recorded |

Missing values (agreed in v1.0): represented as empty / NaN. Handling rules are in 3.8.

### 3.5 Producer responsibilities (Component 1)

1. Produce the file in the schema in 3.4 from the validation-selected model only.
2. Run the export's automatic validation checks (currently 10 checks, implemented in the Component 1 export step) before every handover.
3. Hand over a file **as valid only if all checks pass** (see 3.9).
4. Record every handover in the change log (Section 8): contract version, `model_name`, row count, SHA-256 of the file, date.
5. Describe outputs as replay / hindcast-forcing forecasts, and the `*_copernicus` columns as model-hindcast reference values.
6. Notify the Component 2 owner **before** any change to schema, units, key, model or coverage (see 3.11).
7. Investigate and respond to integration issues reported under Section 5.

### 3.6 Consumer responsibilities (Component 2)

The rules in this section are **Requires agreement from the Component 2 owner (status: TBD)**.

1. Use the agreed join pattern: filter to one lead time, then join on `cell_id + target_date` (or use the export unique key where appropriate).
2. On loading, confirm the 13 columns, the unit (mmol m-3) and the `model_name` value are as expected.
3. Record which Component 1 file was used (`model_name` and SHA-256) alongside Component 2 results.
4. Do not silently treat missing, invalid or stale Component 1 values as valid forecasts (see 3.8–3.10).
5. Report problems through Section 5 rather than correcting Component 1 data locally.

### 3.7 Validation rules

**Producer-side automatic checks.** The Component 1 export runs 10 automatic checks. A file is considered valid only if all of them pass.

**Rules that define a valid file (v1.1).** Every rule below must hold:

| Rule | Requirement |
|---|---|
| V1 | Exactly the 13 columns in 3.4, with those names |
| V2 | `cell_id` values belong to the 12 agreed cells |
| V3 | `issue_date` and `target_date` are valid `YYYY-MM-DD` dates; `target_date` = `issue_date` + `lead_time_days` |
| V4 | `lead_time_days` is an integer 1–7 |
| V5 | No duplicate export key (`cell_id + issue_date + lead_time_days`) |
| V6 | `no3`, `po4`, `si` are finite and ≥ 0 |
| V7 | `model_name` matches the model recorded for this handover |
| V8 | Row count matches the coverage stated for the handover (currently 122,136) |

V1–V8 restate what a valid file means for this contract. They do not replace or renumber the existing 10 automatic checks.

**Consumer-side checks.** Component 2 checks at least V1, V4, V5 and V7 on loading. **Requires agreement from the Component 2 owner.**

**Integration evidence.** Component 2 has loaded and verified the current file (Oct 2026).

### 3.8 Missing data

**Producer side:**
- If a Component 1 forecast value (`no3`, `po4`, `si`) is missing for a key covered by the handover, the file is not considered valid.
- Missing values, where they occur, are represented as empty / NaN (v1.0).

**Consumer side** (**Requires agreement from the Component 2 owner**):
- A key with no Component 1 forecast is treated as "no Component 1 forecast available". This covers a missing value, or a date or cell outside the delivered coverage.
- Such keys stay missing or flagged.
- They must **not** be silently filled by interpolation, persistence, zeros, the `*_copernicus` columns or any other substitute and then treated as a valid forecast.

**`*_copernicus` as a fallback.** This is **not an implemented or agreed fallback.**
- Any proposal to use these columns in place of a missing forecast **requires agreement from the Component 2 owner**.
- Such use would also have to be clearly labelled, because it substitutes target-date reference data for a forecast.
- It is therefore not suitable for forecast evaluation.

### 3.9 Invalid data

**Producer side:**
- An export is not considered valid, and is not handed over as valid, unless all automatic checks pass.
- The last validated file remains the reference version until a new file passes.

**Consumer side** (**Requires agreement from the Component 2 owner**):
- If a file fails consumer-side checks (schema, key, unit, negative or non-finite forecast values, unexpected `model_name`), the file is not used as a valid Component 1 forecast.
- Component 2 reports the problem (Section 5) and continues with the last validated file.

### 3.10 Delayed delivery

The current test-period file has been delivered. Delay rules apply to future re-exports, for example after PP1 (uncertainty bounds, final file).

- Component 1 informs the Component 2 owner of the expected delivery date and of any delay.
- Until a new validated file is delivered, the last validated file remains the reference.
- That file must be labelled by its own `model_name`, version and SHA-256, and must not be presented as the newer version.
- Forecasts outside the delivered issue-date coverage do not exist and must not be extrapolated.
- **Requires agreement from the Component 2 owner** for the consumer-side parts of this section.

### 3.11 Versioning and change control

**Contract version.** This document uses MAJOR.MINOR. **Requires agreement from the Component 2 owner.**

| Change | Examples | Requirement |
|---|---|---|
| Major (x.0) | Rename or remove a column; change the key, unit, meaning or date format | Agreement from the Component 2 owner before release |
| Minor (1.x) | New model version with the same schema; changed coverage; new columns appended (e.g. \*_lower, \*_upper); clarifications | Component 2 owner notified before handover |

**File version:**
- A file is identified by `model_name` plus its SHA-256.
- Every handover is recorded in the change log (Section 8).

### 3.12 Delivery

**Agreed in v1.0:**
- Sample file (test period, baseline model): by ~16 Oct 2026.
- Final file (selected model): after model selection, Dec 2026.

**Status at v1.1:**
- A test-period file from the validation-selected `NeuralODE_s2026` (122,136 rows) has been delivered.
- Component 2 has loaded and verified it.
- Any later file (e.g. with uncertainty bounds) follows 3.5 and 3.11.

---

## 4. Interface B – Component 1 FastAPI → React Native frontend

### 4.1 Owners

| Role | Owner | Contact / channel |
|---|---|---|
| Producer (Component 1 backend, `/c1` router) | Layara (IT23173590) | TBD – Requires agreement |
| Consumer (shared React Native + Expo frontend) | TBD | TBD – Requires agreement |

### 4.2 Transport, format and contract file

- **Transport:** HTTP, GET only, path prefix `/c1`.
- **Base URL:** local development server. The host and port for the shared backend are TBD.
- **Format:**
  - JSON (UTF-8) for all endpoints except `/c1/forecast.csv`.
  - `/c1/forecast.csv` returns `text/csv` as a file attachment.
- **Machine-readable contract:** `docs/c1_api_openapi.json`, generated from the running API.
  - The API version is the `info.version` value in that file.
  - The OpenAPI file is regenerated whenever the API changes.
- **Mode:** replay / hindcast-forcing only. No endpoint retrieves live data.

### 4.3 Endpoints

| Endpoint | Parameters | 200 response (summary) | Purpose |
|---|---|---|---|
| `GET /c1/health` | – | status and model name | Availability check |
| `GET /c1/meta` | – | component, mode, model, issue-date range, nutrients, unit, horizon, normals period | Labels and context (NFR-07) |
| `GET /c1/cells` | – | 12 cells: `cell_id`, name, region, lat, lon | Cell list (do not hard-code) |
| `GET /c1/geo` | – | GeoJSON FeatureCollection | Map layer |
| `GET /c1/outlook` | `issue` (required), `nutrient` (default `no3`), `lead` (default 7) | One nutrient, one lead, all 12 cells: issue and target dates, unit, season, per-cell value / change / status / trend, regional counts | Coastal Outlook map |
| `GET /c1/forecast` | `cell` (required), `issue` (required), `benchmark` (default `false`) | One cell, 7-day NO3 / PO4 / Si: lead dates, forecast, typical error, status, trend, reference values, issue-month normal, 14-day history, drivers; XGBoost benchmark if requested | Location Forecast screen |
| `GET /c1/forecast.csv` | `cell` (required), `issue` (required) | CSV, one row per nutrient × lead (12 columns) | User download |
| `GET /c1/climatology` | `region` or `cell` (optional) | Monthly climatology | Monsoon & Trends screen |
| `GET /c1/reliability` | – | Error by lead time per nutrient | About / reliability view |

### 4.4 Parameter rules

| Parameter | Rule |
|---|---|
| `issue` | `YYYY-MM-DD`, **2022-01-01 to 2025-12-24** (replay range: the test period, ending so that day 7 stays within 2025) |
| `lead` | Integer 1–7 |
| `nutrient` | `no3`, `po4` or `si` |
| `region` | `Western` or `Southern` |
| `cell` | A `cell_id` from `/c1/cells` |
| `benchmark` | Boolean |

### 4.5 Status codes

| Code | Meaning | Examples |
|---|---|---|
| 200 | Success | Valid request |
| 400 | Well-formed value outside the allowed domain. Body: `{"detail": "<message>"}` | Issue date outside the replay range; unknown `cell_id` |
| 422 | Malformed request or request-validation error. Body: standard FastAPI validation error | `issue=2024-13-40`; `lead=0` or `8`; `nutrient=chl`; missing required parameter |
| 405 | Method not allowed | `POST /c1/forecast` |
| 5xx / no response / timeout | Backend error or unavailable | Server stopped, network failure |

Evidence for these codes:
- the Step 14 API validation;
- the Step 17 NFR benchmark (`evidence/pp1/E43_nfr_reliability.csv`).

### 4.6 Producer responsibilities (Component 1 backend)

1. Keep all `/c1` endpoints read-only (GET only).
2. Reject invalid input with 400 or 422. Never return estimated or placeholder values in place of an error.
3. Serve forecasts only from the validation-selected model and only within the replay range.
4. Include metadata in responses: model, mode, issue date, lead dates and unit (NFR-07).
5. Keep `docs/c1_api_openapi.json` in step with the API.
6. Agree any breaking change with the frontend owner before release (see 4.9).

### 4.7 Frontend responsibilities (shared React Native frontend)

The rules in this section are **Requires agreement from the frontend owner (status: TBD)**.

**Error display:**
- On any non-200 response, network error or timeout, show **"forecast unavailable"** for the affected view.
- Show no partial or placeholder numbers in that case.
- Never present invalid or stale data as current. Do not display an earlier response for a different cell, issue date, nutrient or lead in place of the requested one.
- Cached responses may be shown only for exactly the same request parameters, and must show the issue date contained in the response.

**Context to show with every forecast view:**
- the issue date;
- "replay mode (hindcast forcing)";
- the unit (mmol m-3);
- the model name.

**Labels:**
- Label the response fields `actual` and `history` as **"Copernicus model-hindcast reference"**, not as observations.
- Label `typical_error` as **"typical error (RMSE by lead time)"**, not as a confidence interval.
- Label `benchmark` as the XGBoost benchmark and `no_change` as the no-change (persistence) reference.
- Status (below / normal / above) and trend (falling / stable / rising) must not rely on colour alone (NFR-11).
- In `/c1/forecast.csv`, the column `observed_mmol_m3` contains the Copernicus model-hindcast reference value, not an observation. Explain this wherever the download is offered (see 7.4).

**Timeout:** TBD – Requires agreement with the frontend owner. NFR-02 targets standard views within about 5 seconds.

### 4.8 Missing, invalid and delayed data

| Case | Rule |
|---|---|
| Missing | Out-of-range dates and unknown cells return 400, never empty or estimated forecasts. The frontend shows "forecast unavailable" (4.7). |
| Invalid request | Returns 400 or 422 with a message. The frontend shows "forecast unavailable" and may show a plain-language reason. |
| Delayed / unavailable backend | No response within the agreed timeout, or a 5xx, is treated as unavailable. Nothing is shown as a current forecast. |

### 4.9 Versioning

**API version:** the `info.version` value in `docs/c1_api_openapi.json`.

| Change | Examples | Requirement |
|---|---|---|
| Breaking | Remove or rename an endpoint, parameter or response field; change units or meaning | Agreement from the frontend owner before release (**Requires agreement**) |
| Non-breaking | New optional parameter or new response field | Frontend owner notified; OpenAPI file regenerated |

### 4.10 Security status

**Implemented:**
- GET-only routes; POST returns 405.
- Input validation (400 / 422).
- No personal data served.
- Secrets and data files excluded from Git.

Evidence: `evidence/pp1/E43_nfr_reliability.csv`.

**Not implemented:**
- Authentication and authorization: login, roles and restricted researcher functions (NFR-09). These belong to the shared backend integration stage. **Ownership: TBD – Requires agreement.**
- CORS is open (`*`) for local development only. It must be restricted before any deployment.
- No production deployment, HTTPS or production security hardening.

---

## 5. Reporting and resolving integration issues (both interfaces)

| Item | Rule |
|---|---|
| Channel | TBD – Requires agreement between owners |
| Response time | TBD – Requires agreement |
| Report contents | Interface (A or B); file `model_name` + SHA-256, or request URL and response status/body; expected result; observed result; date |

Resolution steps:
1. The producer owner reproduces the issue.
2. The producer owner fixes it on their own branch (never directly on `main`).
3. The producer owner re-runs the relevant validation (export checks, or service / API validation).
4. The fix is recorded in the change log (Section 8).
5. The consumer owner confirms the fix.

Until the fix is confirmed, the last validated version remains the reference (3.9, 3.10).

## 6. PP1 Integration Status (as of 17 Oct 2026)

- **Component 1 → Component 2 is a real, working component-to-component integration, tested before PP1.**
  - The test-period export (122,136 rows, `NeuralODE_s2026`, 13 columns, mmol m-3) is validated automatically by 10 export checks.
  - Component 2 has successfully loaded and verified the file.
- **The Component 1 FastAPI is implemented and validated:**
  - The service and API were validated in Steps 13 and 14.
  - Separately, the Step 17 NFR benchmark passed 25 of 25 hard checks (local laptop, sequential requests; not production throughput).
- **React Native consumption is the next integration step.** The shared frontend is not built yet, so Interface B has not yet been exercised by the frontend.
- All current outputs are **validated replay / hindcast-forcing mode** forecasts for the 2022–2025 test period. They are not real-time or operational forecasts.

## 7. Open items requiring agreement

| # | Item | Owner(s) | Status |
|---|---|---|---|
| 7.1 | Component 2 owner name and contact; frontend owner name and contact | Group | TBD |
| 7.2 | Consumer rules for Component 2: 3.6, consumer parts of 3.7–3.10, versioning in 3.11 | Component 2 owner | Requires agreement |
| 7.3 | Any use of `*_copernicus` in place of missing forecasts. Not an implemented or agreed fallback; target-date reference data | Component 2 owner | Requires agreement |
| 7.4 | Frontend rules (4.7), request timeout, breaking-change agreement (4.9). Also decide whether `observed_mmol_m3` in `/c1/forecast.csv` should be renamed; a rename is a breaking change for later | Frontend owner | Requires agreement |
| 7.5 | Issue channel and response time (Section 5) | All owners | Requires agreement |
| 7.6 | Authentication / authorization ownership at the shared backend stage | Group | Requires agreement |
| 7.7 | SHA-256 and handover method of the delivered file (3.4) | Component 1 | TBD – to be recorded |

## 8. Change log

| Version | Date | Change | Agreed by |
|---|---|---|---|
| 1.0 | 11 Oct 2026 | Spatial, temporal, file format, unique key, delivery plan for Component 1 → Component 2 | Component 1 and Component 2 |
| 1.1 (draft) | 17 Oct 2026 | Added the items listed under "What v1.1 adds" in Section 0. Clarified export key vs downstream join, `*_copernicus` meaning, and CSV format details. v1.0 content preserved. | Component 1; Component 2 and frontend confirmation TBD |

**Handover log:**

| Date | Contract version | model_name | Rows | SHA-256 | Recipient confirmation |
|---|---|---|---|---|---|
| Oct 2026 | 1.0 | NeuralODE_s2026 | 122,136 | TBD | Component 2 loaded and verified the file |
