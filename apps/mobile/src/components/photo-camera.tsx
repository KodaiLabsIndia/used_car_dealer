import React, { useEffect, useRef, useState } from "react";
import { Modal, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Text, s } from "./ui";
import { useApp } from "../state/app-context";
import { CaptureLayout } from "./layout";
export function PhotoCamera({
  visible,
  onClose,
  onPhoto,
}: {
  visible: boolean;
  onClose: () => void;
  onPhoto: (photo: {
    uri: string;
    width: number;
    height: number;
  }) => Promise<void>;
}) {
  const { t } = useApp(),
    [permission, request] = useCameraPermissions(),
    camera = useRef<CameraView>(null),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    insets = useSafeAreaInsets();
  useEffect(() => {
    setReady(false);
    setError("");
  }, [visible]);
  async function take() {
    if (!camera.current || !ready || busy) return;
    setBusy(true);
    setError("");
    try {
      const photo = await camera.current.takePictureAsync({
        quality: 1,
        skipProcessing: false,
      });
      if (photo) {
        await onPhoto(photo);
        onClose();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!visible) return null;
  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "#070707",
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        <CaptureLayout
          camera={
            permission?.granted ? (
              <View style={{ flex: 1 }}>
                <CameraView
                  ref={camera}
                  style={{ flex: 1 }}
                  facing="back"
                  mode="picture"
                  onCameraReady={() => setReady(true)}
                  onMountError={(event) => {
                    setReady(false);
                    setError(event.message);
                  }}
                />
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    justifyContent: "center",
                    alignItems: "center",
                    padding: 28,
                  }}
                  pointerEvents="none"
                >
                  <View
                    style={{
                      width: "100%",
                      maxWidth: 600,
                      height: "70%",
                      maxHeight: 350,
                      borderRadius: 20,
                      borderWidth: 2,
                      borderColor: "#f0787e",
                    }}
                  />
                </View>
              </View>
            ) : (
              <View style={[s.content, { flex: 1, justifyContent: "center" }]}>
                <Text>{t("noCamera")}</Text>
                <Button
                  label={t("allowCamera")}
                  onPress={() => void request()}
                />
              </View>
            )
          }
          controls={
            <>
              {error ? <Text style={{ color: "#ffb8bf" }}>{error}</Text> : null}
              {permission?.granted ? (
                <Button
                  label={t("takePhoto")}
                  icon="camera-outline"
                  busy={busy}
                  disabled={!ready}
                  onPress={() => void take()}
                />
              ) : null}
              <Button
                label={t("back")}
                secondary
                disabled={busy}
                onPress={onClose}
              />
            </>
          }
        />
      </View>
    </Modal>
  );
}
