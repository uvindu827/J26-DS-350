\# Integration contract: Component 1 (nutrients) → Component 2 (chlorophyll-a)



Version 1.0 – agreed 11 Oct 2026 – status: agreed by both components (cell IDs and grid centres verified)



\## Spatial

\- 12 coastal Copernicus 0.25° cells, Western + Southern Sri Lanka (box 5.75–7.0°N, 79.25–81.0°E)

\- Cell list and IDs: `data/processed/cells.csv` (cell centres on 0.25° multiples, e.g. N6.75\_E79.75)

\- Join key: `cell\_id`

\- Negombo / Hambantota not required (box not widened)



\## Temporal

\- Daily time step; dates in ISO format YYYY-MM-DD

\- Lead times: 1–7 days

\- Shared split: train 1997-09-04 → 2017-12-31 | validation 2018–2021 | test 2022–2025

\- Component 2 trains on original Copernicus nutrients; Component 1 forecasts are used on the test period

\- Both components evaluated in hindcast-forcing mode (reanalysis forcing over the forecast window)



\## File format

CSV (Parquet optional), one row per cell × issue\_date × lead time:



| Column | Meaning | Unit |

|---|---|---|

| cell\_id | Coastal cell ID | – |

| latitude, longitude | Cell centre | degrees |

| issue\_date | Day the forecast is made (t0) | date |

| lead\_time\_days | 1–7 | days |

| target\_date | Day being forecast (issue\_date + lead) | date |

| no3, po4, si | Forecast nutrients | mmol m-3 |

| no3\_copernicus, po4\_copernicus, si\_copernicus | Original Copernicus values for reference | mmol m-3 |

| model\_name | Model that produced the forecast | – |

| (after PP1) \*\_lower, \*\_upper | Uncertainty bounds | mmol m-3 |


Unique row key: `cell_id + issue_date + lead_time_days` (equivalently `cell_id + target_date + lead_time_days`).
Each target_date appears once per lead time (7 times per cell). Component 2 filters to one lead
time before joining on `cell_id + target_date`.

Missing values: empty / NaN.



\## Delivery

\- Sample file (test period, baseline model): by \~16 Oct 2026

\- Final file (selected model): after model selection, Dec 2026

