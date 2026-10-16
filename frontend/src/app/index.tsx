
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
} from "react-native";

import api from "../services/api";

export default function HomeScreen() {
  const [status, setStatus] = useState("Checking backend...");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await api.get("/health");
        setStatus(response.data.status);
      } catch (error) {
        console.error("Backend connection error:", error);
        setStatus("Connection failed");
      } finally {
        setLoading(false);
      }
    };

    checkBackend();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Marine Productivity Intelligence
      </Text>

      <Text style={styles.subtitle}>
        Component 2 - CHL Forecasting
      </Text>

      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        <Text style={styles.status}>
          Backend Status: {status}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#F4F9FC",
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#123A5A",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#52758B",
    marginTop: 12,
    marginBottom: 30,
    textAlign: "center",
  },
  status: {
    fontSize: 18,
    fontWeight: "600",
    color: "#167A52",
  },
});
