# Data dictionary - Component 1 modelling dataset

| Column | Description | Unit | Source |
|---|---|---|---|
| date | Day (UTC-based daily aggregation) | - | - |
| cell_id / lat / lon / region | Copernicus 0.25° coastal cell and its region tag | deg | Copernicus grid |
| no3 / po4 / si | Surface nitrate / phosphate / silicate (model hindcast, no assimilation) | mmol m-3 | Copernicus GLOBAL_MULTIYEAR_BGC_001_029 |
| precip_mm | Daily total precipitation over the cell's catchments/land points | mm/day | ERA5-Land tp |
| surface_runoff_mm | Daily surface runoff (hydrological pathway proxy, not measured quickflow) | mm/day | ERA5-Land sro |
| subsurface_runoff_mm | Daily sub-surface runoff (proxy, not measured baseflow) | mm/day | ERA5-Land ssro |
| soil_moisture | Volumetric soil water, layer 1 (0-7 cm), 00 UTC | m3/m3 | ERA5-Land swvl1 |
| u10 / v10 / wind_speed | Daily mean 10 m wind components and speed | m/s | ERA5 single levels |
| precip_sum_Nd | Rainfall total over the previous N days incl. today | mm | derived |
| surface_runoff_sum_Nd / subsurface_runoff_sum_Nd | Runoff totals over the previous N days | mm | derived |
| wind_speed_mean_3d | Mean wind speed over the previous 3 days | m/s | derived |
| season / season_code | Sri Lankan season: NEM(0) FIM(1) SWM(2) SIM(3) | - | derived |
| doy_sin / doy_cos | Day of year as a seasonal cycle | - | derived |
| catchment_area_km2 / n_subbasins / n_river_outlets | Catchments assigned to the cell | km2 / count | HydroBASINS L9 |
| n_land_points / forcing_method / dist_to_land_km | How land forcing was obtained for the cell | count / - / km | derived |
| split | train / val / test (whole calendar years) | - | experiments/split_config.json |