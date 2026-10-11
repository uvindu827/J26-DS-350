"""Inspect Copernicus nutrient NetCDF files and save a first map."""

from pathlib import Path
import xarray as xr
import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt

files = sorted(Path("data/raw/copernicus").glob("*.nc"))

print(f"Found {len(files)} file(s)\n")

if len(files) == 0:
    raise FileNotFoundError(
        "No .nc files found inside data/raw/copernicus"
    )

for f in files:
    print("=" * 90)
    print(f"FILE: {f.name}")
    print(f"SIZE: {f.stat().st_size / 1e6:.2f} MB")

    ds = xr.open_dataset(f)

    print("\nDATASET STRUCTURE:")
    print(ds)

    print("\nVARIABLES AND UNITS:")

    for v in ds.data_vars:
        print(
            f"  {v}: "
            f"units={ds[v].attrs.get('units', 'Not specified')} "
            f"name={ds[v].attrs.get('long_name', ds[v].attrs.get('standard_name', 'Not specified'))}"
        )

    print("\nCOORDINATES:")

    for c in ds.coords:
        vals = ds[c].values

        try:
            print(
                f"  {c}: first={vals.min()} "
                f"last={vals.max()} "
                f"count={vals.size}"
            )
        except Exception:
            print(f"  {c}: count={vals.size}")

ds = xr.open_dataset(files[0])

var = list(ds.data_vars)[0]

print(f"\nCreating first map using variable: {var}")

da = ds[var]

for dim in da.dims:
    if dim.lower() not in (
        "latitude",
        "longitude",
        "lat",
        "lon"
    ):
        da = da.isel({dim: 0})

da.plot(figsize=(7, 6))

plt.title(
    f"{var} - first available time step\n"
    "Western/Southern Sri Lanka"
)

output_path = Path(
    "evidence/pp1/E03_first_nutrient_map.png"
)

output_path.parent.mkdir(
    parents=True,
    exist_ok=True
)

plt.savefig(
    output_path,
    dpi=150,
    bbox_inches="tight"
)

plt.close()

print(f"\nSaved map to: {output_path}")
print("\nNutrient inspection completed successfully.")