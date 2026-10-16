# Component 3 Data Dictionary

## Status

This is a living dictionary based on Data Audit 01 and the first staged-cleaning run. An observed field name does not confirm its scientific meaning or unit. Items marked **Pending confirmation** must not be used as final modelling variables.

## Fisheries semantic concepts

| Concept | Observed source fields | Type | Unit | Intended role | Status |
|---|---|---|---|---|---|
| Species or catch category | `catch` (2017), `fish_name` (2018–2019), `name` (2020–2024) | Text | Not applicable | Grouping/filter | Strong structural match; definition pending |
| Catch-weight candidate | `kg` (2017–2019), `weight` (2020–2024) | Numeric candidate | Pending confirmation | Target/history candidate | Cross-year unit equivalence not confirmed |
| Quantity candidate | `qty` (2017, 2020–2024), `amount` (2018–2019) | Numeric candidate | Pending confirmation | Supporting variable | Meaning not confirmed |
| Vessel identifier | `reg_num`, `boat_no`, `vessel_id` | Text identifier | Not applicable | Grouping/lineage | Identifier consistency pending |
| Trip or record identifier | `lb_number`, `rec_no`, `id`, `trip_id` | Text/numeric identifier | Not applicable | Row/trip lineage | Row-level meaning unresolved |
| Gear | `gear`, `catch_type`, `geartype`, `gear_type` | Text category | Not applicable | Feature/effort context | Harmonization pending |
| Departure time | `departure_date`, `departure_date_time` | Date/time candidate | Date/time | Trip context | Available in most years; validity varies |
| Arrival time | `arrival_date`, `arrival_date_time` | Date/time candidate | Date/time | Trip context | Available in most years; validity varies |
| Fishing/set time | `y`/`m`/`d`, `date_of_set`, `dateandtime`, `date_time` | Mixed representation | Date/time | Temporal key candidate | Final event timestamp unresolved |
| Latitude candidate | Year-specific text/numeric latitude-like fields | Text or numeric | Degrees/encoded text pending | Spatial key candidate | Requires year-specific parsing |
| Longitude candidate | Year-specific text/numeric longitude-like fields | Text or numeric | Degrees/encoded text pending | Spatial key candidate | Requires year-specific parsing |
| Spatial grid | One-degree, five-degree, and other grid-code fields | Numeric/text code | Definition pending | Spatial key candidate | Grid definitions unresolved |
| Port | Departure/arrival port fields | Text category | Not applicable | Spatial/trip context | Label standardization pending |
| Fishing effort | Hooks, net dimensions, gear configuration, trip duration candidates | Mixed | Multiple/unconfirmed | CPUE denominator candidate | Incomplete and non-comparable; not approved |
| CPUE | Not present as a trusted source field | Derived | Catch per approved effort unit | Preferred target candidate | Blocked pending effort feasibility |

## Environmental variables

| Variable | Dataset field | Type | Unit | Coverage | Intended role | Status |
|---|---|---|---|---|---|---|
| Chlorophyll-a | `CHL` | Float | `milligram m-3` | Daily, 1997-09-04 to 2025-12-31 | Predictor | Observed; aggregation pending |
| Sea-surface temperature | `thetao` at one surface depth | Packed integer decoded to float | `degrees_C` | Daily, 1997-09-04 to 2025-12-31 | Predictor | Scale/offset/fill decoding required |
| Salinity | `so` | Packed integer decoded to float | `1e-3` | Daily, 1997-09-04 to 2025-12-31 | Not currently approved | Present but outside current input scope |

## Planned derived variables

| Variable | Derivation | Status |
|---|---|---|
| Canonical event date | Year-specific fishing-event fields selected in semantic harmonization | Working assumption; validity flagged |
| Canonical location | Parsed labelled coordinates within the provisional Western Province coastal window and common environmental grids | Working assumption; rectangular boundary and ambiguous encodings documented |
| Catch/weight | `kg`/`weight` treated as kilograms without conversion | Working assumption; provider confirmation unavailable |
| Effort | Approved comparable effort measure | Feasibility unresolved |
| CPUE | Approved catch divided by approved effort | Not calculated |
| Month/season/monsoon | Derived from approved event date | Later |
| Catch and environmental lags | Leakage-safe historical features | Later |

## Missing-value and transformation policy

- Raw values remain immutable.
- Explicit placeholder text is converted to missing only in staged artifacts and counted.
- Source file, sheet, year label, and row-number lineage are retained.
- Parsing adds candidate columns and review flags instead of silently replacing uncertain values.
- No duplicate, outlier, invalid-date, or suspicious-coordinate row is removed without an approved rule and documented evidence.

