"""Validation utility - check that every coastal cell survives each processing step."""
from pathlib import Path
import pandas as pd

P = Path("data/processed")

cells = pd.read_csv(P / "cells.csv")
coastal = set(cells.loc[cells["is_coastal"], "cell_id"].astype(str))

mapping = pd.read_csv(P / "era5land_points_to_cells.csv")

forcing = pd.read_parquet(P / "forcing_era5land_daily.parquet")

print("Coastal cells in cells.csv            :", len(coastal))
print("Cells in points-to-cells mapping file  :", mapping["cell_id"].nunique())
print("Cells in ERA5-Land forcing file        :", forcing["cell_id"].nunique())

print("\nLand points per cell and method:")
print(mapping.groupby(["cell_id", "method"]).size().to_string())

print("\nMissing from mapping file :", sorted(coastal - set(mapping["cell_id"].astype(str))))
print("Missing from forcing file :", sorted(coastal - set(forcing["cell_id"].astype(str))))