"""Download ERA5-Land daily forcing (00:00 UTC accumulations) for Sri Lanka, 1997-2025."""

from pathlib import Path
import cdsapi

OUT = Path("data/raw/era5_land")
OUT.mkdir(parents=True, exist_ok=True)

VARIABLES = [
    "total_precipitation",
    "surface_runoff",
    "sub_surface_runoff",
    "volumetric_soil_water_layer_1",
]

AREA = [10.0, 79.5, 5.8, 82.0]  # North, West, South, East

client = cdsapi.Client()


def get(year, months, days, target):
    if target.exists():
        print(f"skip {target.name} (already downloaded)")
        return

    print(f"requesting {target.name} ...")

    client.retrieve(
        "reanalysis-era5-land",
        {
            "variable": VARIABLES,
            "year": str(year),
            "month": months,
            "day": days,
            "time": ["00:00"],
            "data_format": "netcdf",
            "download_format": "unarchived",
            "area": AREA,
        },
        str(target),
    )


ALL_MONTHS = [f"{m:02d}" for m in range(1, 13)]
ALL_DAYS = [f"{d:02d}" for d in range(1, 32)]

for year in range(1997, 2026):
    get(year, ALL_MONTHS, ALL_DAYS, OUT / f"era5land_{year}.nc")

# 1 Jan 2026 00:00 contains the accumulation ending at that time
get(2026, ["01"], ["01"], OUT / "era5land_2026_0101.nc")

print("ERA5-Land download finished.")