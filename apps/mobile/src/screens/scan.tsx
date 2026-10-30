import React, { useRef } from "react";
import { Alert, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { z } from "zod";
import { colors } from "@arihant/design-tokens";
import type { ScreenProps } from "../navigation";
import { GarageHeader } from "../components/header";
import { Button, Text, s } from "../components/ui";
import { useApp } from "../state/app-context";
export function ScanScreen({ navigation }: ScreenProps<"Scan">) {
  const { t, language } = useApp(),
    [permission, request] = useCameraPermissions(),
    scanned = useRef(false);
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <GarageHeader back title={t("scan")} />
      {permission?.granted ? (
        <CameraView
          style={{ flex: 1 }}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={({ data }) => {
            if (scanned.current) return;
            scanned.current = true;
            const candidate = data.startsWith("arihant-ops://car/")
              ? data.slice("arihant-ops://car/".length)
              : data;
            const id = z.uuid().safeParse(candidate);
            if (id.success) navigation.replace("Car", { id: id.data });
            else
              Alert.alert(
                t("scan"),
                language === "hi"
                  ? "यह कार का QR नहीं है।"
                  : "This QR does not identify a car.",
                [
                  {
                    text: t("retry"),
                    onPress: () => {
                      scanned.current = false;
                    },
                  },
                ],
              );
          }}
        >
          <View
            pointerEvents="none"
            style={{ flex: 1, justifyContent: "center", padding: 40 }}
          >
            <View
              style={{
                height: "70%",
                maxHeight: 300,
                width: "100%",
                maxWidth: 400,
                alignSelf: "center",
                borderWidth: 2,
                borderColor: "#ef777d",
                borderRadius: 20,
              }}
            />
          </View>
        </CameraView>
      ) : (
        <View style={[s.content, { flex: 1, justifyContent: "center" }]}>
          <Text>{t("noCamera")}</Text>
          <Button label={t("allowCamera")} onPress={() => void request()} />
        </View>
      )}
      <View
        style={[
          s.content,
          { width: "100%", maxWidth: 640, alignSelf: "center" },
        ]}
      >
        <Button
          label={t("cars")}
          secondary
          icon="search-outline"
          onPress={() => navigation.replace("Cars")}
        />
      </View>
    </View>
  );
}
