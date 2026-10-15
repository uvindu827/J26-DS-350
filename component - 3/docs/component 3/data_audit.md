# Data Audit 01

## Scope

Data Audit 01 inspected the eight fisheries workbooks and two environmental NetCDF files without modifying raw data. The executed notebook is `Notebooks/01_data_audit.ipynb`, and its machine-readable summaries are stored under `outputs/audit/`.

The fisheries quality statistics are based on a bounded sample of 10,000 rows from each of nine relevant sheets (90,000 sampled rows total). They are not full-dataset statistics.

## Inventory result

- Eight fisheries Excel workbooks covering the 2017–2024 file series were detected.
- One chlorophyll-a NetCDF file was detected.
- One SST/SSS NetCDF file was detected.
- All ten notebook code cells completed in Google Colab without saved error outputs.
- Nine CSV audit tables and one JSON run manifest were produced.

## Fisheries structure findings

The annual fisheries schemas are not consistent. The inspected data sheets range from 14 to 41 reported columns, with different names and representations for catch, species, dates, coordinates, grids, gear, and effort.

Specific structural issues include:

- 2017: 15 blank header positions in a 29-column sheet.
- 2019: blank headers and summary/pivot-style columns embedded toward the end of the sheet.
- 2021: repeated `id` headers and separate summary/empty sheets.
- 2022: repeated `5 degree grid` headers, a separate `values with issues` sheet, and a summary sheet.
- 2023 and 2024: separate summary sheets that must not be treated as row-level observations.

The authoritative observation sheet for each year must be confirmed before combination.

## Sample quality signals

Across the 90,000 sampled rows, the audit observed:

| Signal | Sample count |
|---|---:|
| Empty cells | 61,346 |
| Placeholder-text cells | 217,107 |
| Text cells with leading/trailing padding | 151,522 |
| Apparent duplicate rows | 11,081 |

These values identify investigation priorities. Apparent duplicate rows must not be deleted automatically because repeated species, sets, trips, or landings may be valid depending on the row definition.

## Date findings

Multiple date concepts occur across the files, including departure, arrival, set, record, and event timestamps. The audit detected:

- records extending outside the nominal file year;
- implausible parsed years such as 2107 and 2028; and
- numeric day/time fields that can be misinterpreted as timestamps near 1970.

A field-specific date parser and validity rules are required. The forecasting timestamp cannot be selected solely from a column name.

## Catch and effort findings

Candidate catch-related fields include `CATCH`, `KG`, `weight`, `qty`, and `Amount`. Their definitions and units are not yet confirmed.

Candidate effort information includes gear, hooks, net dimensions, bait, trip identifiers, and trip dates in some years. Availability and comparability vary substantially. CPUE feasibility is therefore unresolved and CPUE must not be calculated yet.

## Spatial findings

Fisheries locations appear in multiple forms:

- direction-prefixed latitude/longitude text;
- decimal coordinate fields;
- direction fields;
- one-degree and five-degree grid codes; and
- port, area, or zone labels.

Some sampled values appear suspicious or ambiguously labelled. The authoritative spatial fields and coordinate conventions must be established before environmental matching.

## Environmental findings

Both environmental datasets provide 10,346 daily time steps from 1997-09-04 through 2025-12-31 and spatially overlap.

| Dataset | Latitude range | Longitude range | Approximate grid spacing |
|---|---|---|---|
| Chlorophyll-a | 5.770831°–6.979164° N | 79.270844°–80.979172° E | 0.041667° |
| SST/SSS | 5.75°–7.00° N | 79.25°–81.00° E | 0.083333° |

The grids differ in resolution, so direct cell-by-cell merging is not justified. SST is stored as packed `thetao` values and must be decoded using the recorded scale factor, offset, and fill value. Salinity exists in the same file but is not currently an approved model input.

## Decisions not yet supported

Data Audit 01 does not yet justify:

- a final prediction target;
- CPUE calculation;
- a final temporal resolution or forecast horizon;
- a final spatial resolution;
- a fisheries-to-environmental matching method;
- automatic duplicate removal;
- automatic outlier removal; or
- model training.

## Required next decisions

Before creating the cleaning pipeline, confirm:

1. the authoritative row-level sheet for every fisheries workbook;
2. what one fisheries row represents;
3. the definitions and units of catch, weight, quantity, and amount;
4. the authoritative event date for forecasting;
5. the authoritative coordinates or grid fields;
6. whether any effort measure is comparable enough for CPUE;
7. how the 2022 issue-specific sheet should be used; and
8. fisheries provider, licence, and publication restrictions.

After those questions are resolved, the next implementation artifact should be a documented cross-year schema mapping followed by `02_data_cleaning.ipynb`.

