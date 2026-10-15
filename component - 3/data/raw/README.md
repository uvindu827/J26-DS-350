# Raw Data

This directory represents immutable source data. The actual files are stored outside Git because of their size and potential access restrictions.

## Expected sources

| Dataset | Files | Format | Observed coverage |
|---|---:|---|---|
| Fisheries logbooks | 8 annual files | Excel (`.xlsx`) | 2017–2024 file series |
| Chlorophyll-a | 1 file | NetCDF (`.nc`) | Daily, 1997-09-04 to 2025-12-31 |
| SST/SSS | 1 file | NetCDF (`.nc`) | Daily, 1997-09-04 to 2025-12-31 |

Expected subdirectories in external storage:

```text
raw/
├── Fisheries/
├── chlorophyll_a/
└── sst/
```

## Rules

- Never overwrite, rename, clean, or manually edit source files.
- Never commit raw records to Git.
- Preserve original filenames and provider metadata.
- Treat observed fields and units as provisional until documented in the data dictionary.
- Generate all cleaning results under `../interim/`.

Run `Notebooks/01_data_audit.ipynb` to verify the current inventory and create reproducible audit summaries.

