## Dataset Variables
Variable          | Source          | Type        | Unit            | Role              | Available?
------------------|-----------------|-------------|-----------------|-------------------|-----------
Date              | Fisheries data  | Date        | —               | Temporal key      | TBD
Location          | Fisheries data  | Spatial     | —               | Spatial key       | TBD
Species           | Fisheries data  | Categorical | —               | Feature/filter    | TBD
Catch             | Fisheries data  | Numeric     | kg / tonnes     | Target/history    | TBD
Fishing Effort    | Fisheries data  | Numeric     | trips/hours/etc.| CPUE denominator  | TBD
CPUE              | Derived         | Numeric     | catch/effort    | Candidate target  | TBD
Chlorophyll-a     | Copernicus      | Numeric     | mg/m³           | Predictor         | Planned
SST               | Copernicus      | Numeric     | °C              | Predictor         | Planned
Rainfall          | ERA5            | Numeric     | mm              | Predictor         | Planned
Month             | Derived         | Integer     | 1–12            | Temporal feature  | Derived
Monsoon           | Derived         | Category    | —               | Seasonal feature  | Derived
Catch Lag 1       | Derived         | Numeric     | —               | Predictor         | Later
Chl-a Lag 1       | Derived         | Numeric     | —               | Predictor         | Later

![alt text](<Data Dictionary.png>)


