import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";

import api from "../services/api";

type ProductivityClass = "Low" | "Medium" | "High";

type HistoricalForecastResponse = {
  date: string;
  latitude: number;
  longitude: number;
  predicted_chl_mg_m3: number;
  actual_chl_mg_m3?: number | null;
  productivity_class: ProductivityClass;
  prediction_type: string;
};

const LOW_THRESHOLD = 0.2126709519;
const HIGH_THRESHOLD = 0.4330995018;

const nutrientInputs = [
  {
    key: "NO₃",
    name: "Nitrate",
    value: 0.762,
    unit: "mmol m⁻³",
    status: "Normal",
  },
  {
    key: "PO₄",
    name: "Phosphate",
    value: 0.0,
    unit: "mmol m⁻³",
    status: "Below",
  },
  {
    key: "Si",
    name: "Silicate",
    value: 3.74,
    unit: "mmol m⁻³",
    status: "Normal",
  },
];

const dayBaseSeries = [2.0, 1.82, 1.66, 1.45, 1.17, 0.918, 0.762];

function classifyProductivity(chl: number): ProductivityClass {
  if (chl < LOW_THRESHOLD) return "Low";
  if (chl <= HIGH_THRESHOLD) return "Medium";
  return "High";
}

function getProductivityColors(level: ProductivityClass) {
  switch (level) {
    case "Low":
      return {
        bg: "#E8F1FB",
        text: "#2B6CB0",
        border: "#B7D3F2",
      };
    case "Medium":
      return {
        bg: "#F6F1D8",
        text: "#8A6D1D",
        border: "#E7D68A",
      };
    case "High":
    default:
      return {
        bg: "#FDEBDC",
        text: "#C96A1A",
        border: "#F4B47B",
      };
  }
}

function formatDateLabel(dateString?: string) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatChl(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toFixed(3);
}

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1100;
  const isTablet = width >= 760;

  const [backendStatus, setBackendStatus] = useState("Checking backend...");
  const [statusLoading, setStatusLoading] = useState(true);

  const [forecastLoading, setForecastLoading] = useState(true);
  const [forecastError, setForecastError] = useState("");
  const [forecast, setForecast] = useState<HistoricalForecastResponse | null>(
    null
  );

  const [selectedDay, setSelectedDay] = useState(7);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const healthResponse = await api.get("/health");
        setBackendStatus(healthResponse.data.status ?? "healthy");
      } catch (error) {
        console.error("Backend health error:", error);
        setBackendStatus("Connection failed");
      } finally {
        setStatusLoading(false);
      }

      try {
        const forecastResponse = await api.get("/api/forecast/historical", {
          params: {
            date: "2021-10-05",
            latitude: 5.8333335,
            longitude: 79.333336,
          },
        });

        setForecast(forecastResponse.data);
      } catch (error) {
        console.error("Historical forecast error:", error);
        setForecastError("Failed to load CHL historical forecast.");
      } finally {
        setForecastLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const selectedDayValue = useMemo(() => {
    const series = [...dayBaseSeries];
    if (forecast?.predicted_chl_mg_m3) {
      series[6] = forecast.predicted_chl_mg_m3;
    }

    const chl = series[selectedDay - 1];
    return {
      chl,
      status: classifyProductivity(chl),
      trend: selectedDay === 1 ? "Issued" : "Falling",
    };
  }, [forecast, selectedDay]);

  const outlookRows = useMemo(() => {
    const series = [...dayBaseSeries];
    if (forecast?.predicted_chl_mg_m3) {
      series[6] = forecast.predicted_chl_mg_m3;
    }

    return series.map((value, index) => ({
      day: index + 1,
      chl: value,
      status: classifyProductivity(value),
      trend: index === 0 ? "Issued" : "Falling",
    }));
  }, [forecast]);

  const currentProductivity: ProductivityClass =
    forecast?.productivity_class ?? selectedDayValue.status;

  const currentColors = getProductivityColors(currentProductivity);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      {/* Top header */}
      <View style={styles.topBar}>
        <View style={styles.brandWrap}>
          <Text style={styles.brand}>FishGuard AI</Text>
          <Text style={styles.brandSub}>Component 2 · CHL Forecasting</Text>
        </View>

        <View style={styles.navWrap}>
          <Text style={styles.navItem}>Coastal nutrients</Text>
          <Text style={[styles.navItem, styles.navItemActive]}>
            Coastal outlook
          </Text>
          <Text style={styles.navItem}>Productivity</Text>
          <Text style={styles.navItem}>About forecast</Text>
        </View>
      </View>

      {/* Toolbar / date + backend status */}
      <View
        style={[
          styles.toolbar,
          { flexDirection: isTablet ? "row" : "column", gap: 12 },
        ]}
      >
        <View style={styles.issueCard}>
          <Text style={styles.smallLabel}>FORECAST ISSUED ON</Text>
          <View style={styles.issueRow}>
            <TouchableOpacity style={styles.dayNavButton}>
              <Text style={styles.dayNavButtonText}>-7</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dayNavButton}>
              <Text style={styles.dayNavButtonText}>-1</Text>
            </TouchableOpacity>

            <View style={styles.issueDateChip}>
              <Text style={styles.issueDateText}>
                {formatDateLabel(forecast?.date)}
              </Text>
            </View>

            <TouchableOpacity style={styles.dayNavButton}>
              <Text style={styles.dayNavButtonText}>+1</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dayNavButton}>
              <Text style={styles.dayNavButtonText}>+7</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.issueHint}>
            Historical prototype using validated CHL prediction output
          </Text>
        </View>

        <View style={styles.backendBadgeCard}>
          {statusLoading ? (
            <ActivityIndicator size="small" color="#157A7A" />
          ) : (
            <>
              <View style={styles.statusDot} />
              <Text style={styles.backendBadgeText}>
                Backend {backendStatus}
              </Text>
            </>
          )}
        </View>
      </View>

      {/* Page title */}
      <View style={styles.sectionHeader}>
        <Text style={styles.pageTitle}>Chlorophyll-a coastal outlook</Text>
        <Text style={styles.pageSubtitle}>
          Western & Southern Sri Lanka · Nutrient-informed marine productivity
          intelligence
        </Text>
      </View>

      {/* Day selector */}
      <View
        style={[
          styles.daySelectorWrap,
          { flexDirection: isTablet ? "row" : "column", gap: 12 },
        ]}
      >
        <View>
          <Text style={styles.smallLabel}>OUTLOOK DAY</Text>
          <View style={styles.daySelectorRow}>
            {[1, 2, 3, 4, 5, 6, 7].map((day) => (
              <TouchableOpacity
                key={day}
                style={[
                  styles.dayButton,
                  selectedDay === day && styles.dayButtonActive,
                ]}
                onPress={() => setSelectedDay(day)}
              >
                <Text
                  style={[
                    styles.dayButtonText,
                    selectedDay === day && styles.dayButtonTextActive,
                  ]}
                >
                  {day}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.rightPill}>
          <Text style={styles.rightPillText}>
            CHL & productivity dashboard
          </Text>
        </View>
      </View>

      {/* Main dashboard row */}
      <View
        style={[
          styles.dashboardRow,
          { flexDirection: isDesktop ? "row" : "column" },
        ]}
      >
        {/* Left large panel */}
        <View style={[styles.largePanel, { marginRight: isDesktop ? 18 : 0 }]}>
          <Text style={styles.cardTitle}>
            Selected coastal CHL forecast · day {selectedDay}
          </Text>
          <Text style={styles.cardSubTitle}>
            Historical validated record · direct structure for future Component 1
            integration
          </Text>

          {forecastLoading ? (
            <View style={styles.loaderWrap}>
              <ActivityIndicator size="large" color="#123A5A" />
              <Text style={styles.loadingText}>Loading forecast...</Text>
            </View>
          ) : forecastError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{forecastError}</Text>
            </View>
          ) : (
            <>
              <View
                style={[
                  styles.heroCard,
                  {
                    borderColor: currentColors.border,
                    backgroundColor: currentColors.bg,
                  },
                ]}
              >
                <View style={styles.heroLeft}>
                  <Text style={styles.heroLabel}>Predicted CHL</Text>
                  <Text style={[styles.heroValue, { color: currentColors.text }]}>
                    {formatChl(
                      selectedDay === 7
                        ? forecast?.predicted_chl_mg_m3
                        : selectedDayValue.chl
                    )}
                  </Text>
                  <Text style={styles.heroUnit}>mg/m³</Text>
                </View>

                <View style={styles.heroRight}>
                  <View
                    style={[
                      styles.productivityBadge,
                      {
                        backgroundColor: currentColors.bg,
                        borderColor: currentColors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.productivityBadgeText,
                        { color: currentColors.text },
                      ]}
                    >
                      {selectedDay === 7
                        ? forecast?.productivity_class ?? "—"
                        : selectedDayValue.status}{" "}
                      Productivity
                    </Text>
                  </View>

                  <Text style={styles.heroMeta}>
                    Date:{" "}
                    <Text style={styles.heroMetaStrong}>
                      {formatDateLabel(forecast?.date)}
                    </Text>
                  </Text>
                  <Text style={styles.heroMeta}>
                    Coordinates:{" "}
                    <Text style={styles.heroMetaStrong}>
                      {forecast?.latitude?.toFixed(4) ?? "—"},{" "}
                      {forecast?.longitude?.toFixed(4) ?? "—"}
                    </Text>
                  </Text>
                  <Text style={styles.heroMeta}>
                    Actual CHL:{" "}
                    <Text style={styles.heroMetaStrong}>
                      {formatChl(forecast?.actual_chl_mg_m3)} mg/m³
                    </Text>
                  </Text>
                </View>
              </View>

              {/* Nutrient input cards */}
              <Text style={[styles.cardTitle, { marginTop: 18 }]}>
                Component 1 nutrient inputs
              </Text>
              <Text style={styles.cardSubTitle}>
                Displayed in the same workflow style as Component 1. These are
                the nutrient inputs that support Component 2 CHL forecasting.
              </Text>

              <View
                style={[
                  styles.nutrientGrid,
                  { flexDirection: isTablet ? "row" : "column" },
                ]}
              >
                {nutrientInputs.map((item) => (
                  <View key={item.key} style={styles.nutrientCard}>
                    <View style={styles.nutrientHeader}>
                      <Text style={styles.nutrientTitle}>
                        {item.name} ({item.key})
                      </Text>
                      <View style={styles.smallStatusPill}>
                        <Text style={styles.smallStatusPillText}>
                          {item.status}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.nutrientValue}>
                      {item.value.toFixed(3)}
                    </Text>
                    <Text style={styles.nutrientUnit}>{item.unit}</Text>
                  </View>
                ))}
              </View>

              {/* Mini insight row */}
              <View
                style={[
                  styles.insightRow,
                  { flexDirection: isTablet ? "row" : "column" },
                ]}
              >
                <View style={styles.insightCard}>
                  <Text style={styles.insightTitle}>Forecast type</Text>
                  <Text style={styles.insightValue}>
                    {forecast?.prediction_type ?? "historical_test"}
                  </Text>
                </View>

                <View style={styles.insightCard}>
                  <Text style={styles.insightTitle}>Backend source</Text>
                  <Text style={styles.insightValue}>FastAPI + XGBoost</Text>
                </View>

                <View style={styles.insightCard}>
                  <Text style={styles.insightTitle}>Selected outlook day</Text>
                  <Text style={styles.insightValue}>Day {selectedDay}</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Right side panels */}
        <View style={styles.sidePanel}>
          <View style={styles.sideCard}>
            <Text style={styles.cardTitle}>Regional summary · day {selectedDay}</Text>
            <View style={styles.summaryBlock}>
              <Text style={styles.summaryTitle}>Western coast</Text>
              <Text style={styles.summaryText}>CHL hotspot monitoring active</Text>
              <View style={styles.summaryPills}>
                <View style={styles.summaryPill}>
                  <Text style={styles.summaryPillText}>High zones 3</Text>
                </View>
                <View style={styles.summaryPill}>
                  <Text style={styles.summaryPillText}>Medium zones 2</Text>
                </View>
                <View style={styles.summaryPill}>
                  <Text style={styles.summaryPillText}>Low zones 1</Text>
                </View>
              </View>
            </View>

            <View style={[styles.summaryBlock, { marginTop: 16 }]}>
              <Text style={styles.summaryTitle}>Southern coast</Text>
              <Text style={styles.summaryText}>
                Moderate-to-high productivity spread
              </Text>
              <View style={styles.summaryPills}>
                <View style={styles.summaryPill}>
                  <Text style={styles.summaryPillText}>High zones 4</Text>
                </View>
                <View style={styles.summaryPill}>
                  <Text style={styles.summaryPillText}>Medium zones 3</Text>
                </View>
                <View style={styles.summaryPill}>
                  <Text style={styles.summaryPillText}>Low zones 2</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.sideCard}>
            <Text style={styles.cardTitle}>Selected cell details</Text>
            <Text style={styles.sideValueBig}>
              {formatChl(
                selectedDay === 7
                  ? forecast?.predicted_chl_mg_m3
                  : selectedDayValue.chl
              )}{" "}
              mg/m³
            </Text>
            <Text style={styles.sideMeta}>
              CHL forecast for the selected grid cell
            </Text>

            <View
              style={[
                styles.selectedClassBox,
                {
                  backgroundColor: currentColors.bg,
                  borderColor: currentColors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.selectedClassText,
                  { color: currentColors.text },
                ]}
              >
                {selectedDay === 7
                  ? forecast?.productivity_class ?? "—"
                  : selectedDayValue.status}
              </Text>
            </View>

            <Text style={styles.sideMeta}>
              Historical actual: {formatChl(forecast?.actual_chl_mg_m3)} mg/m³
            </Text>
            <Text style={styles.sideMeta}>
              Coordinates: {forecast?.latitude?.toFixed(4) ?? "—"},{" "}
              {forecast?.longitude?.toFixed(4) ?? "—"}
            </Text>
          </View>
        </View>
      </View>

      {/* Outlook table */}
      <View style={styles.tableCard}>
        <Text style={styles.cardTitle}>CHL day-by-day outlook</Text>
        <Text style={styles.cardSubTitle}>
          7-day CHL trend style inspired by the Component 1 forecast layout
        </Text>

        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, styles.colDay]}>DAY</Text>
          <Text style={[styles.tableHeaderCell, styles.colForecast]}>
            FORECAST
          </Text>
          <Text style={[styles.tableHeaderCell, styles.colStatus]}>STATUS</Text>
          <Text style={[styles.tableHeaderCell, styles.colTrend]}>TREND</Text>
        </View>

        {outlookRows.map((row) => {
          const colors = getProductivityColors(row.status);
          return (
            <View
              key={row.day}
              style={[
                styles.tableRow,
                row.day === selectedDay && styles.tableRowSelected,
              ]}
            >
              <Text style={[styles.tableCell, styles.colDay]}>
                {row.day}
              </Text>
              <Text style={[styles.tableCell, styles.colForecast]}>
                {row.chl.toFixed(3)} mg/m³
              </Text>

              <View style={[styles.colStatus, styles.statusCellWrap]}>
                <View
                  style={[
                    styles.tableStatusBadge,
                    {
                      backgroundColor: colors.bg,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tableStatusBadgeText,
                      { color: colors.text },
                    ]}
                  >
                    {row.status}
                  </Text>
                </View>
              </View>

              <Text style={[styles.tableCell, styles.colTrend]}>
                {row.trend}
              </Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#EEF3F7",
  },
  pageContent: {
    paddingBottom: 28,
  },

  topBar: {
    backgroundColor: "#0C233A",
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  brandWrap: {
    gap: 3,
  },
  brand: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
  },
  brandSub: {
    color: "#B9C8D6",
    fontSize: 13,
    fontWeight: "500",
  },
  navWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  navItem: {
    color: "#D3DEE8",
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#13324F",
  },
  navItemActive: {
    backgroundColor: "#294A68",
    color: "#FFFFFF",
    fontWeight: "700",
  },

  toolbar: {
    paddingHorizontal: 20,
    paddingTop: 18,
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  issueCard: {
    backgroundColor: "#F8FBFD",
    borderWidth: 1,
    borderColor: "#DCE7EF",
    borderRadius: 16,
    padding: 16,
    flex: 1,
    minWidth: 280,
  },
  smallLabel: {
    color: "#6E7E8E",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  issueRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  dayNavButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D6E0E9",
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  dayNavButtonText: {
    color: "#345269",
    fontSize: 13,
    fontWeight: "700",
  },
  issueDateChip: {
    backgroundColor: "#F1F5F8",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  issueDateText: {
    color: "#123A5A",
    fontWeight: "700",
    fontSize: 14,
  },
  issueHint: {
    marginTop: 10,
    fontSize: 12,
    color: "#788998",
  },
  backendBadgeCard: {
    backgroundColor: "#E5F5F1",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#D0ECE6",
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#159570",
  },
  backendBadgeText: {
    color: "#1A6B57",
    fontWeight: "700",
    fontSize: 13,
  },

  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  pageTitle: {
    fontSize: 38,
    fontWeight: "800",
    color: "#123A5A",
    lineHeight: 44,
  },
  pageSubtitle: {
    marginTop: 6,
    fontSize: 15,
    color: "#5F7588",
  },

  daySelectorWrap: {
    paddingHorizontal: 20,
    paddingBottom: 18,
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  daySelectorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dayButton: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D4DFE8",
    justifyContent: "center",
    alignItems: "center",
  },
  dayButtonActive: {
    backgroundColor: "#0C233A",
    borderColor: "#0C233A",
  },
  dayButtonText: {
    color: "#294A68",
    fontWeight: "700",
  },
  dayButtonTextActive: {
    color: "#FFFFFF",
  },
  rightPill: {
    backgroundColor: "#DFF2EE",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#D0ECE6",
  },
  rightPillText: {
    color: "#236D63",
    fontWeight: "700",
    fontSize: 13,
  },

  dashboardRow: {
    paddingHorizontal: 20,
    alignItems: "stretch",
  },
  largePanel: {
    flex: 2.1,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DCE7EF",
    padding: 18,
    marginBottom: 18,
  },
  sidePanel: {
    flex: 1,
    gap: 18,
  },
  sideCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DCE7EF",
    padding: 18,
    marginBottom: 18,
  },

  cardTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#173A53",
  },
  cardSubTitle: {
    marginTop: 4,
    marginBottom: 14,
    color: "#728698",
    fontSize: 13,
    lineHeight: 18,
  },

  loaderWrap: {
    paddingVertical: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#5E7385",
  },
  errorBox: {
    backgroundColor: "#FFF1F0",
    borderColor: "#F3C6C3",
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  errorText: {
    color: "#B0473D",
    fontWeight: "600",
  },

  heroCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 18,
  },
  heroLeft: {
    minWidth: 180,
  },
  heroLabel: {
    fontSize: 14,
    color: "#6B7F90",
    fontWeight: "600",
  },
  heroValue: {
    fontSize: 46,
    fontWeight: "800",
    marginTop: 8,
    lineHeight: 52,
  },
  heroUnit: {
    fontSize: 16,
    color: "#5F7282",
    fontWeight: "600",
    marginTop: 4,
  },
  heroRight: {
    minWidth: 220,
    flex: 1,
    gap: 8,
  },
  productivityBadge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 4,
  },
  productivityBadgeText: {
    fontWeight: "800",
    fontSize: 13,
  },
  heroMeta: {
    fontSize: 13,
    color: "#637789",
  },
  heroMetaStrong: {
    color: "#173A53",
    fontWeight: "700",
  },

  nutrientGrid: {
    gap: 14,
    alignItems: "stretch",
  },
  nutrientCard: {
    flex: 1,
    backgroundColor: "#F8FBFD",
    borderWidth: 1,
    borderColor: "#DCE7EF",
    borderRadius: 16,
    padding: 16,
  },
  nutrientHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    alignItems: "center",
    marginBottom: 12,
  },
  nutrientTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#173A53",
  },
  smallStatusPill: {
    backgroundColor: "#F1F5F8",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  smallStatusPillText: {
    color: "#587185",
    fontSize: 12,
    fontWeight: "700",
  },
  nutrientValue: {
    fontSize: 34,
    fontWeight: "800",
    color: "#123A5A",
  },
  nutrientUnit: {
    marginTop: 4,
    fontSize: 12,
    color: "#728698",
  },

  insightRow: {
    marginTop: 16,
    gap: 12,
  },
  insightCard: {
    flex: 1,
    backgroundColor: "#F8FBFD",
    borderWidth: 1,
    borderColor: "#DCE7EF",
    borderRadius: 14,
    padding: 14,
  },
  insightTitle: {
    fontSize: 12,
    color: "#6F8292",
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  insightValue: {
    fontSize: 15,
    color: "#173A53",
    fontWeight: "700",
  },

  summaryBlock: {
    backgroundColor: "#F8FBFD",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DCE7EF",
    padding: 14,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#173A53",
  },
  summaryText: {
    fontSize: 13,
    color: "#6C8090",
    marginTop: 6,
  },
  summaryPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  summaryPill: {
    backgroundColor: "#F1F5F8",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  summaryPillText: {
    fontSize: 12,
    color: "#4B667C",
    fontWeight: "700",
  },

  sideValueBig: {
    fontSize: 34,
    fontWeight: "800",
    color: "#123A5A",
    marginTop: 8,
  },
  sideMeta: {
    fontSize: 13,
    color: "#6D8091",
    marginTop: 6,
    lineHeight: 18,
  },
  selectedClassBox: {
    marginTop: 14,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  selectedClassText: {
    fontWeight: "800",
    fontSize: 15,
  },

  tableCard: {
    marginHorizontal: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DCE7EF",
    padding: 18,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E3EBF2",
    paddingBottom: 10,
    marginTop: 10,
  },
  tableHeaderCell: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6E8191",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF3F7",
  },
  tableRowSelected: {
    backgroundColor: "#F6FAFC",
    borderRadius: 10,
  },
  tableCell: {
    fontSize: 14,
    color: "#173A53",
    fontWeight: "600",
  },
  colDay: {
    width: "12%",
  },
  colForecast: {
    width: "30%",
  },
  colStatus: {
    width: "30%",
  },
  colTrend: {
    width: "28%",
  },
  statusCellWrap: {
    justifyContent: "center",
  },
  tableStatusBadge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tableStatusBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
});