import React, { useEffect, useRef, useState } from "react";
import { Modal, View } from "react-native";
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from "expo-camera";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Text, ErrorNotice } from "./ui";
import { useApp } from "../state/app-context";
import { CaptureLayout } from "./layout";
export function VideoCamera({
  visible,
  onClose,
  onVideo,
}: {
  visible: boolean;
  onClose: () => void;
  onVideo: (uri: string) => Promise<void>;
}) {
  const { language } = useApp(),
    hi = language === "hi",
    camera = useRef<CameraView>(null),
    [permission, requestPermission] = useCameraPermissions(),
    [mic, requestMic] = useMicrophonePermissions();
  const [recording, setRecording] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    setReady(false);
    setError("");
  }, [visible]);
  async function record() {
    if (!camera.current || !ready || recording) return;
    setError("");
    try {
      setRecording(true);
      const clip = await camera.current.recordAsync({ maxDuration: 30 });
      setRecording(false);
      if (clip) {
        onClose();
        await onVideo(clip.uri);
      }
    } catch (e) {
      setRecording(false);
      setError((e as Error).message);
    }
  }
  if (!visible) return null;
  return (
    <Modal
      visible={visible}
      onRequestClose={() => {
        if (recording) camera.current?.stopRecording();
        else onClose();
      }}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: "#090909" }}>
        <CaptureLayout
          camera={
            permission?.granted && mic?.granted ? (
              <View style={{ flex: 1 }}>
                <CameraView
                  ref={camera}
                  style={{ flex: 1 }}
                  mode="video"
                  videoQuality="720p"
                  facing="back"
                  onCameraReady={() => setReady(true)}
                  onMountError={(event) => {
                    setReady(false);
                    setError(event.message);
                  }}
                />
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: 16,
                    backgroundColor: "#0008",
                  }}
                >
                  <Text>
                    {hi
                      ? "नंबर प्लेट दिखाएँ, फिर समस्या दिखाएँ।"
                      : "Show the car identity, then show the issue."}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={{ flex: 1, justifyContent: "center", padding: 20 }}>
                <Text>
                  {hi
                    ? "वीडियो के लिए कैमरा और माइक की अनुमति दें।"
                    : "Allow camera and microphone access to record a clip."}
                </Text>
              </View>
            )
          }
          controls={
            <>
              <Text style={{ fontSize: 22 }}>
                {hi
                  ? "छोटा वीडियो · अधिकतम 30 सेकंड"
                  : "Short clip · up to 30 seconds"}
              </Text>
              {error ? <ErrorNotice message={error} /> : null}
              {!permission?.granted ? (
                <Button
                  label={hi ? "कैमरा की अनुमति दें" : "Allow camera"}
                  onPress={() => void requestPermission()}
                />
              ) : !mic?.granted ? (
                <>
                  <Text>
                    {hi
                      ? "इंजन की आवाज़ और आपकी बात रिकॉर्ड करने के लिए माइक चाहिए।"
                      : "Allow the microphone to record engine sounds and your explanation."}
                  </Text>
                  <Button
                    label={hi ? "माइक की अनुमति दें" : "Allow microphone"}
                    onPress={() => void requestMic()}
                  />
                </>
              ) : null}
              {recording ? (
                <Button
                  label={hi ? "रिकॉर्डिंग रोकें" : "Stop recording"}
                  onPress={() => camera.current?.stopRecording()}
                />
              ) : (
                <Button
                  label={hi ? "रिकॉर्ड करें" : "Record clip"}
                  icon="videocam-outline"
                  disabled={!permission?.granted || !mic?.granted || !ready}
                  onPress={() => void record()}
                />
              )}
              <Button
                secondary
                label={hi ? "बंद करें" : "Close"}
                disabled={recording}
                onPress={onClose}
              />
            </>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}
