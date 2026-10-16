# Preprocessing Decisions and Cross-Year Mapping

## Purpose

This document records what the audit and staged-cleaning evidence supports before cross-year harmonization. Because provider definitions are not currently available, it also records the researcher's conservative working assumptions. These assumptions are reproducible and must be disclosed as limitations rather than presented as confirmed NARA definitions.

## Completed safe transformations

The executed `02_data_cleaning.ipynb` created unique headers, retained source lineage, standardized text whitespace and placeholder tokens, added candidate parsed fields and review flags, and saved each configured sheet separately as Parquet. The 2022 `values with issues` sheet remains isolated.

It did not overwrite raw files, remove outliers, calculate CPUE, or integrate environmental data.

## Cross-year mapping used for harmonization

| Year | Species | Catch-weight | Quantity | Event-date candidates | Coordinate candidates | Vessel | Gear |
|---:|---|---|---|---|---|---|---|
| 2017 | `catch` | `kg` | `qty` | reconstructed year/month/day | latitude=`latti`, longitude=`longi` | `reg_num` | `gear` |
| 2018 | `fish_name` | `kg` | `amount` | `y`/`m`/`d` | `lat`, `long` | `boat_no` | `catch_type` |
| 2019 | `fish_name` | `kg` | `amount` | year + `month` + `date_of_set` | `latitude`, `longetude` | `boat_no` | `catch_type` |
| 2020 | `name` | `weight` | `qty` | `dateandtime` | latitude=`latttitude`, longitude=`longitude` | `vessel_id` | `geartype` |
| 2021 | `name` | `weight` | `qty` | `date_time` | `start_n`, `start_e` | `vessel_id` | `geartype` |
| 2022 main | `name` | `weight` | `qty` | `date_time` | `lattude`, `longitude` | `vessel_id` | `geartype` |
| 2022 issues | `name` | `weight` | `qty` | `date_time` | `lattitude`, `longitude` | `vessel_id` | `geartype` |
| 2023 | `name` | `weight` | `qty` | `date_time` | `start_n`, `start_e` | `vessel_id` | `geartype` |
| 2024 | `name` | `weight` | `qty` | `date_time` | `start_n`, `start_e` | `vessel_id` | `geartype` |

Original columns remain in the staged Parquet files, so these choices can be revised if authoritative definitions become available.

## Evidence requiring interpretation

The full cleaning run staged 2,630,944 rows and reconciled every row. It recorded 196,100 unparsed date candidates, 216,294 numeric coordinates outside generic ranges, and 308,785 rows matching another row across staged source fields. These are review counts, not exclusion counts. Direction-formatted coordinates can be non-numeric while still encoding valid positions.

## Decision register

| Decision | Current position | Status |
|---|---|---|
| Row definition | Treat each row as a species catch line within a fishing event/trip | Working assumption |
| Species mapping | `catch` -> `fish_name` -> `name` | Adopted |
| Catch weight | Treat `kg` and `weight` as kilograms; do not convert values | Working assumption |
| Quantity | Treat `qty`/`amount` as a count-like supplementary variable, not the target | Working assumption |
| Event timestamp | Use the most direct set/catch timestamp available for each year | Adopted provisionally |
| Coordinates | Follow source latitude/longitude labels; parse explicit direction-prefixed degree-minute forms; flag ambiguous compact numeric encodings | Adopted provisionally |
| Study area | Restrict model candidates to a provisional Western Province coastal rectangle clipped to the common environmental grids | Adopted provisionally |
| Duplicates | Retain in the all-records artifact; exclude exact canonical duplicates only from model candidates | Adopted |
| Outliers | Retain and flag until investigated | Retain/flag |
| 2022 issue sheet | Retain in all records; exclude from model candidates | Adopted |
| Effort and CPUE | Do not calculate without a comparable effort definition | Blocked by metadata |
| Environmental match | Decide after harmonized coverage and NetCDF grids are inspected | Pending integration |

## Working assumptions adopted for this research iteration

1. `kg` and `weight` are kilograms, without numerical conversion.
2. Catch weight is the provisional prediction target. CPUE is not calculated because comparable effort metadata is unavailable.
3. `qty` and `amount` are retained as count-like candidates but are not required for model eligibility.
4. Dates outside 2017-2024 are flagged invalid.
5. Latitude and longitude follow their source labels. The earlier reversed-label assumption was rejected after the first full-run diagnostic produced implausible polar clusters.
6. South latitude is negative and north latitude is positive. Existing longitude signs are preserved; west/east markers are applied when present.
7. Compact numeric coordinates outside ordinary degree ranges are flagged as ambiguous and are not decoded without format evidence.
8. Model candidates must lie within the provisional Western Province coastal study window: 6.30-6.979164 degrees north and 79.270844-80.30 degrees east. This rectangle is clipped to the common environmental grids and is not claimed to be an official administrative polygon.
9. Exact canonical duplicates are excluded only from the model-candidate artifact. The complete harmonized artifact remains lossless at row level.
10. Grid codes are preserved but are not used to manufacture coordinates.

## Next implementation gate

Run `02b_semantic_harmonization.ipynb` after `02_data_cleaning.ipynb`. Review its eligibility counts, coordinate coverage, and date coverage before running `03_data_integration.ipynb`. If authoritative definitions later become available, update this register and rerun from the harmonization stage.
