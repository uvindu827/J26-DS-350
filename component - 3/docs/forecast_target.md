# Component 3 Forecast Target Definition

## Research Component
Fisheries Intelligence Using Environmental Signals and Historical Catch Data with Machine Learning

## Main Research Goal
To forecast localized future fish catch availability and fishery trends using
historical fisheries records together with environmental and seasonal signals.

## Primary Prediction Target
The preferred prediction target is future CPUE (Catch Per Unit Effort), where
reliable fishing-effort information is available.

CPUE is preferred because raw catch can increase simply because more vessels,
trips, fishing hours, or gear were used.

## Fallback Target
If reliable fishing-effort information is unavailable, historical catch will be
used to construct an appropriate catch-availability target after normalization
and exploratory analysis.

## Prediction Type
Primary approach:
Regression forecasting

Possible output:
- Predicted CPUE
- Predicted catch availability value
- Fish trend: Increasing / Stable / Decreasing

A categorical Low / Medium / High catch-availability output may later be derived
from the continuous prediction for decision-support visualization.

## Candidate Input Features

### Fisheries Features
- Historical catch
- Fishing effort
- CPUE
- Species / fishery category
- Gear type where available
- Location
- Historical lag values
- Rolling catch / CPUE statistics

### Environmental Features
- Chlorophyll-a
- Sea Surface Temperature
- Rainfall
- Seasonal / monsoon information
- Additional ocean variables only if justified by data availability and literature

## Temporal Features
- Year
- Month
- Season
- Monsoon
- Historical lag values
- Rolling averages

## Spatial Information
Predictions should be localized to the smallest reliable spatial unit supported
by the fisheries dataset.

The exact spatial unit will be finalized after inspecting the available data.

## Forecast Horizon
The final forecast horizon will be selected after identifying the temporal
resolution of the fisheries dataset.

Examples:
- Next month, if monthly records are available
- Next week, if sufficiently reliable weekly records are available

## Important Boundary
Component 3 does not attempt to predict exact fish population numbers.

It forecasts measurable fisheries outcomes such as catch availability,
catch trends, and CPUE where reliable effort data are available.

Stock depletion and primary sustainability-risk modelling remain outside the
main responsibility of Component 3.

## Current Status
Provisional definition – to be finalized after dataset inspection.