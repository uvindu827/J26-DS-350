# Preprocessing Decisions and Cross-Year Mapping

## Purpose

This document records what the audit and staged-cleaning evidence supports before cross-year harmonization. It separates observed structure from methodological decisions that still require confirmation.

## Completed safe transformations

The executed `02_data_cleaning.ipynb` created unique headers, retained source lineage, standardized text whitespace and placeholder tokens, added candidate parsed fields and review flags, and saved each configured sheet separately as Parquet. The 2022 `values with issues` sheet remains isolated.

It did not overwrite raw files, delete rows, remove outliers, combine years, calculate CPUE, or integrate environmental data.

## Provisional cross-year mapping

| Year | Species | Catch-weight | Quantity | Event-date candidates | Coordinate candidates | Vessel | Gear |
|---:|---|---|---|---|---|---|---|
| 2017 | `catch` | `kg` | `qty` | `arrival_date`, `departure_date` | `longi`, `latti` (labels questionable) | `reg_num` | `gear` |
| 2018 | `fish_name` | `kg` | `amount` | `y`/`m`/`d`, `date_of_set`, trip dates | `lat`, `long`, `latitude`, `longetude` | `boat_no` | `catch_type` |
| 2019 | `fish_name` | `kg` | `amount` | `month`, `date_of_set`, trip dates | `latitude`, `longetude` | `boat_no` | `catch_type` |
| 2020 | `name` | `weight` | `qty` | `dateandtime`, `departure_date_time` | `latttitude`, `longitude`, direction | `vessel_id` | `geartype` |
| 2021 | `name` | `weight` | `qty` | `date_time`, `enddateandtime`, trip dates | `start_n`, `start_e`, `end_n`, `end_e` | `vessel_id` | `geartype`, `gear_type` |
| 2022 main | `name` | `weight` | `qty` | `date_time`, trip dates | `lattude`, `longitude`, direction | `vessel_id` | `geartype` |
| 2022 issues | `name` | `weight` | `qty` | `date_time`, trip dates | `lattitude`, `longitude`, direction | `vessel_id` | `geartype` |
| 2023 | `name` | `weight` | `qty` | `date_time` | `start_n`, `start_e` | `vessel_id` | `geartype` |
| 2024 | `name` | `weight` | `qty` | `date_time` | `start_n`, `start_e` | `vessel_id` | `geartype` |

This table identifies candidates only. It does not authorize harmonization or unit conversion.

## Evidence requiring interpretation

The full cleaning run staged 2,630,944 rows and reconciled every row. It recorded 196,100 unparsed date candidates, 216,294 numeric coordinates outside generic ranges, and 308,785 rows matching another row across staged source fields. Extensive non-numeric coordinate candidates also occur.

These are review counts, not exclusion counts. Direction-formatted coordinates can be non-numeric while still encoding valid positions.

## Decision register

| Decision | Current position | Evidence needed | Status |
|---|---|---|---|
| Observation sheets | Main sheets listed above; 2022 issue records separate | Provider/source confirmation | Provisional |
| Row definition | Likely species/catch record within an event or trip, varying by year | Identifier and repeated-row analysis | Unresolved |
| Species mapping | `catch` → `fish_name` → `name` | Provider/category definitions and label profiling | Provisional |
| Catch-weight mapping | `kg` → `weight` | Unit confirmation and distribution checks | Unresolved |
| Quantity mapping | `qty`/`amount` | Definition and unit confirmation | Unresolved |
| Event timestamp | Prefer fishing/set time when valid; trip dates provide context | Year-specific completeness/validity | Unresolved |
| Coordinates | Use year-specific parsers before selecting canonical coordinates | Coordinate conventions and grid definitions | Unresolved |
| Duplicate treatment | Retain until a transactional row key is established | Row definition and candidate-key analysis | Retain/flag |
| Outlier treatment | Retain and flag until investigated | Domain thresholds/source validation | Retain/flag |
| 2022 issue sheet | Keep isolated | Meaning and correction status | Isolated |
| Effort and CPUE | Do not calculate | Comparable effort definition, unit, completeness | Blocked |
| Environmental aggregation | Do not aggregate | Approved fisheries timestamp/resolution | Blocked |
| Spatial environmental match | Do not join | Approved coordinates/grid and matching method | Blocked |

## Required confirmation before harmonization

1. What does one row represent in each annual workbook?
2. Are `kg` and `weight` consistently kilograms?
3. Do `qty` and `amount` represent fish count or another measurement?
4. Which field represents the actual fishing/set event date in each year?
5. In 2017, are `longi` and `latti` labelled in reverse?
6. How should direction fields be applied to the coordinates?
7. What do the one-degree, five-degree, and other grid codes represent?
8. Which repeated rows are valid species-within-event records versus accidental duplicates?
9. What is the status of the 2022 `values with issues` sheet?
10. Is any effort measure scientifically comparable across enough years for CPUE?

## Next implementation gate

Do not create a combined modelling dataset until the catch-weight unit, event timestamp, spatial fields, and row definition are approved. Once confirmed, revise `02_data_cleaning.ipynb` with explicit year-specific transformations, regenerate the staged artifacts, and then proceed to `03_data_integration.ipynb`.
