# Component 3 Data

This directory documents the data lifecycle for Component 3. Large, restricted, or generated datasets are intentionally excluded from Git.

## Directory roles

| Directory | Purpose | Git policy |
|---|---|---|
| `raw/` | Immutable source files received or downloaded from providers | Data files excluded |
| `interim/` | Reproducible outputs from cleaning and standardization | Data files excluded |
| `processed/` | Final modelling datasets produced by documented pipelines | Data files excluded |
| `external/` | Approved supporting datasets from external sources | Data files excluded |

The intended lineage is:

```text
raw → interim → processed → model training and evaluation
```

Raw files must never be edited in place. Notebooks and scripts should create new artifacts under `interim/` or `processed/`.

## Storage

The working datasets are stored outside the Git repository. The current Colab workflow expects the following Google Drive structure:

```text
MyDrive/FishGuard-C3/
├── data/
│   ├── raw/
│   │   ├── Fisheries/
│   │   ├── chlorophyll_a/
│   │   └── sst/
│   ├── interim/
│   └── processed/
├── models/
└── outputs/
```

No private Drive link, credential, access token, or raw record should be committed. See `docs/component 3/data_sources.md` for the dataset inventory and `docs/component 3/data_audit.md` for observed audit findings.

