# Component 1 nutrient forecasts for Component 2

File: `c1_nutrient_forecasts_test_2022_2025.csv`  |  Contract: `docs/integration_contract_c1_c2.md` v1.0  |  Model: `NeuralODE_s2026`

- Rows: 122,136 = 12 cells x 1,454 issue dates x 7 lead times
- Issue dates: 2022-01-01 to 2025-12-24
- Target dates: 2022-01-02 to 2025-12-31 (shared test period)
- Units: mmol m-3 for all nutrient columns; dates ISO YYYY-MM-DD; no missing values
- Unique row key: cell_id + issue_date + lead_time_days. Each target_date appears 7 times per cell
  (once per lead time) - filter to one lead_time_days before joining on cell_id + target_date.
- no3/po4/si: Component 1 forecasts. *_copernicus: original Copernicus GLOBAL_MULTIYEAR_BGC_001_029
  surface values for the same cell and target_date (reference).
- Mode: hindcast-forcing (reanalysis forcing over the forecast window).
- Model selection: Neural ODE run with the lowest validation loss among 3 seeds; test data not used.
- Training/validation years (1997-2021) are not included: Component 2 uses original Copernicus
  nutrients for those years, as agreed in the contract.
