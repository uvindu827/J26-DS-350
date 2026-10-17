# FishGuard AI – Component 1 frontend (Coastal Nutrients)

React Native + Expo (SDK 57) app that shows the Component 1 nutrient forecasts (NO₃, PO₄, Si)
from the existing FastAPI backend (`/c1`). The app only reads real API data; it contains no
mock or placeholder forecast values.

Current output is **replay / hindcast-forcing mode** for 2022–2025. It is not a live or
operational forecast.

## Run locally (web)

1. Start the backend from the repository root (conda env `fishguard-c1`):
   `python -m uvicorn api.main:app --host 127.0.0.1 --port 8000`
2. In `frontend/`, create `.env` from `.env.example` (first time only).
3. Start Expo: `npx expo start --web` (opens http://localhost:8081).

After changing `.env`, restart with `npx expo start -c`.

## Screens

| Route | Screen | Status |
|---|---|---|
| `/` | Coastal Outlook (`/c1/meta`, `/c1/cells`, `/c1/geo`, `/c1/outlook`) | Step 1 |
| `/forecast?cell=…&issue=…` | Location Forecast | placeholder (Step 2) |
| `/trends` | Monsoon & Trends | placeholder |
| `/about` | About this forecast | placeholder |
| `/connection` | Backend connection check (diagnostics, not in the menu) | Step 0 |

## Structure

```
src/app/          routes (Expo Router); _layout.tsx loads fonts, header and shared state
src/screens/      screen components
src/components/   common/ (header, cards, pills, tags, states), map/ (SVG coast map), outlook/
src/api/          API client, endpoint functions, response types, structure checks, request hook
src/state/        shared selections (issue date, nutrient, outlook day, selected cell)
src/config/       API base URL and timeout
src/theme/        colours, IBM Plex typography, spacing (from the FishGuard C1 design artifact)
src/utils/        formatting, date helpers and the scientific labels used across the app
```

## Scientific labelling rules

- Copernicus nutrient values (`actual`, `history`, CSV `observed_mmol_m3`) are
  **model-hindcast reference values**, not in-situ observations.
- ERA5 / ERA5-Land drivers are **reanalysis**, not observations.
- `typical_error` is the **test-period RMSE by lead day**, not a confidence interval.
- On any API error the screen shows "unavailable" and never shows stale or partial data.

See `docs/integration_contract_c1_c2.md` (Interface B) in the repository root.
