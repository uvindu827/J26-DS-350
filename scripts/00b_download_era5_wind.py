"""
Step 00b - Download ERA5 10 m wind (u10, v10) around Sri Lanka, 1997-2025.

Dataset : ERA5 hourly data on single levels (reanalysis-era5-single-levels)
Times   : 00, 06, 12, 18 UTC (averaged later into daily wind)
Area    : whole island + sea margin, so the domain can be widened later
          without re-downloading. Only coastal-cell values are used in modelling.
Output  : data/raw/era5/era5_wind_<year>.nc
"""
from pathlib import Path
import cdsapi

OUT = Path("data/raw/era5")
OUT.mkdir(parents=True, exist_ok=True)

AREA = [10.5, 79.0, 5.5, 82.5]  # North, West, South, East
YEARS = range(1997, 2026)       # 1997 to 2025 inclusive

client = cdsapi.Client()

for year in YEARS:
    target = OUT / f"era5_wind_{year}.nc"
    if target.exists():
        print(f"skip {target.name} (already downloaded)")
        continue
    print(f"requesting {target.name} ...")
    client.retrieve(
        "reanalysis-era5-single-levels",
        {
            "product_type": ["reanalysis"],
            "variable": ["10m_u_component_of_wind", "10m_v_component_of_wind"],
            "year": str(year),
            "month": [f"{m:02d}" for m in range(1, 13)],
            "day": [f"{d:02d}" for d in range(1, 32)],
            "time": ["00:00", "06:00", "12:00", "18:00"],
            "data_format": "netcdf",
            "download_format": "unarchived",
            "area": AREA,
        },
        str(target),
    )
    print(f"saved {target.name}")

print("ERA5 wind download finished.")