import React, { useRef } from "react";
import { Alert, Linking, StyleSheet, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { z } from "zod";
import { colors } from "@arihant/design-tokens";
import type { ScreenProps } from "../navigation";
import { GarageHeader } from "../components/header";
import { Button, Text, s } from "../components/ui";
import { useApp } from "../state/app-context";
export function ScanScreen({ navigation }: ScreenProps<"Scan">) {
  const { t, language } = useApp(),
    tr = (en: string, hi: string, mr: string) =>
      language === "mr" ? mr : language === "hi" ? hi : en,
    [permission, request] = useCameraPermissions(),
    scanned = useRef(false);
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <GarageHeader back title={t("scan")} />
      {permission?.granted ? (
        <View style={{ flex: 1, minHeight: 100 }}>
          <CameraView
            style={StyleSheet.absoluteFill}
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
                  tr(
                    "This QR does not identify an Arihant car.",
                    "यह अरिहंत की गाड़ी का QR नहीं है।",
                    "हा अरिहंतच्या गाडीचा QR नाही.",
                  ),
                  [
                    {
                      text: t("retry"),
                      onPress: () => {
                        scanned.current = false;
                      },
                    },
                  ],
                  { cancelable: false },
                );
            }}
          />
          <View
            pointerEvents="none"
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              padding: 24,
              gap: 18,
            }}
          >
            <View
              style={{
                height: "60%",
                maxHeight: 280,
                width: "80%",
                maxWidth: 360,
                borderWidth: 2,
                borderColor: "#EF9EA6",
                borderRadius: 20,
              }}
            />
            <Text
              style={{
                backgroundColor: "#191919E8",
                padding: 12,
                borderRadius: 10,
                textAlign: "center",
              }}
            >
              {tr(
                "Place the car’s QR inside the frame.",
                "गाड़ी का QR इस चौखट में रखें।",
                "गाडीचा QR या चौकटीत ठेवा.",
              )}
            </Text>
          </View>
        </View>
      ) : (
        <View
          style={[
            s.content,
            {
              flex: 1,
              justifyContent: "center",
              width: "100%",
              maxWidth: 640,
              alignSelf: "center",
            },
          ]}
        >
          <Text>
            {tr("Camera access is off", "कैमरा बंद है", "कॅमेरा बंद आहे")}
          </Text>
          <Text style={s.muted}>
            {tr(
              "Allow the camera to scan, or find the car by registration below.",
              "स्कैन करने के लिए कैमरा चालू करें या नीचे गाड़ी नंबर से खोजें।",
              "स्कॅनसाठी कॅमेरा सुरू करा किंवा खाली गाडी क्रमांक शोधा.",
            )}
          </Text>
          <Button
            label={
              permission?.canAskAgain === false
                ? tr("Open settings", "सेटिंग खोलें", "सेटिंग्ज उघडा")
                : t("allowCamera")
            }
            onPress={() => {
              if (permission?.canAskAgain === false)
                void Linking.openSettings();
              else void request();
            }}
          />
        </View>
      )}
      <View
        style={[
          s.content,
          { width: "100%", maxWidth: 640, alignSelf: "center" },
        ]}
      >
        <Button
          label={tr("Find a car", "गाड़ी खोजें", "गाडी शोधा")}
          secondary
          icon="search-outline"
          onPress={() => navigation.replace("Cars")}
        />
      </View>
    </View>
  );
}
