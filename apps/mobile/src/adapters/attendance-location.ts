import * as Location from "expo-location";
export async function attendanceLocation() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return {};
    const fix = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), 12000);
      }),
    ]);
    return fix
      ? {
          latitude: fix.coords.latitude,
          longitude: fix.coords.longitude,
          accuracyM: fix.coords.accuracy,
          mocked: fix.mocked ?? false,
        }
      : {};
  } catch {
    return {};
  } finally {
    if (timer) clearTimeout(timer);
  }
}
