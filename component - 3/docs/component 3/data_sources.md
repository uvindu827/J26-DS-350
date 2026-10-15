# Component 3 Data Sources

## Purpose

This document records the source inventory used for Component 3. It does not define final modelling fields or approve a preprocessing method. Those decisions remain evidence-driven and are documented separately.

## Fisheries logbook data

| Item | Observed information |
|---|---|
| Format | Eight Excel workbooks (`.xlsx`) |
| File series | 2017 through 2024 |
| Approximate total size | 329.6 MB |
| Content | Row-level fisheries/logbook information plus summary or issue-specific sheets in some workbooks |
| Provider | Confirmation pending |
| Licence/access conditions | Confirmation pending; treat as restricted until clarified |

Files observed during Data Audit 01:

- `2017 Log Data.xlsx`
- `2018 Log data.xlsx`
- `2019 Log data.xlsx`
- `2020 Log Data.xlsx`
- `2021 LOGBOOK data final.xlsx`
- `2022 Log Data.xlsx`
- `2023 Log Data.xlsx`
- `2024 Log Data.xlsx`

The schemas differ substantially across years. File-year labels do not prove that every record belongs to that calendar year; actual date fields require validation.

## Chlorophyll-a data

| Item | Observed information |
|---|---|
| File | `Chla_Western_Southern_SriLanka_daily.nc` |
| Format | NetCDF (`.nc`) |
| Approximate size | 49.8 MB |
| Product metadata | Copernicus Marine / CMEMS metadata embedded in the file |
| Primary variable | `CHL` |
| Unit | `milligram m-3` |
| Temporal coverage | 1997-09-04 to 2025-12-31, daily |
| Spatial coverage | 5.770831°–6.979164° N; 79.270844°–80.979172° E |
| Grid | 30 latitude × 42 longitude cells; approximately 0.041667° spacing |
| Missing-value convention | `-999` |

The product identifier, citation, licence, and provider attribution must be preserved from the embedded metadata when the final report and redistribution policy are prepared.

## SST/SSS data

| Item | Observed information |
|---|---|
| File | `SST_SSS_Western_Southern_SriLanka_daily.nc` |
| Format | NetCDF (`.nc`) |
| Approximate size | 14.0 MB |
| Product metadata | Copernicus Marine / Mercator Ocean metadata embedded in the file |
| Approved Component 3 variable | `thetao` (sea-water potential temperature) |
| Unit | `degrees_C` |
| Additional variable | `so` (salinity); not currently approved as a Component 3 input |
| Temporal coverage | 1997-09-04 to 2025-12-31, daily |
| Spatial coverage | 5.75°–7.00° N; 79.25°–81.00° E |
| Grid | 16 latitude × 22 longitude cells; approximately 0.083333° spacing |
| Depth | One level at approximately 0.494 m |
| Packed values | `thetao` and `so` require their recorded scale factors, offsets, and fill values |

## Storage and security

The source datasets are stored outside Git. The Colab workflow reads them from a private Google Drive folder under `MyDrive/FishGuard-C3/data/raw`. Private links, credentials, tokens, raw records, and restricted data must not be committed.

## Pending provenance questions

- Confirm the fisheries data provider and authorized use.
- Confirm whether fisheries records may be summarized in public research outputs.
- Confirm official definitions and units for catch, quantity, effort, coordinates, grids, and dates.
- Record stable public product pages or dataset identifiers for the environmental sources.
