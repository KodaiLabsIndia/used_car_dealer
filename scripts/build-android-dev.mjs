import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const mobile = path.join(root, "apps/mobile");
const preview = process.argv.includes("--preview");
const sdk =
  process.env.ANDROID_HOME || path.join(homedir(), "Library/Android/sdk");
const java =
  process.env.JAVA_HOME ||
  "/Applications/Android Studio.app/Contents/jbr/Contents/Home";
if (!existsSync(sdk) || !existsSync(java))
  throw Error(
    "Install the Android SDK and JDK, then set ANDROID_HOME and JAVA_HOME.",
  );
const env = {
  ...process.env,
  ANDROID_HOME: sdk,
  JAVA_HOME: java,
  ARIHANT_INTERNAL_PREVIEW: preview ? "1" : "0",
  NODE_ENV: preview ? "production" : "development",
  GRADLE_USER_HOME: path.join(root, ".data/gradle"),
};
const run = (command, args, cwd = mobile) => {
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
};
// Always regenerate configuration before Gradle; native projects are generated.
run("npx", ["expo", "prebuild", "--platform", "android", "--no-install"]);
run(
  "./gradlew",
  [
    preview ? "app:assembleRelease" : "app:assembleDebug",
    process.argv.includes("--all-architectures")
      ? "-PreactNativeArchitectures=arm64-v8a,x86_64"
      : "-PreactNativeArchitectures=arm64-v8a",
    "--max-workers=3",
    "-Dorg.gradle.jvmargs=-Xmx3g -XX:MaxMetaspaceSize=1024m",
  ],
  path.join(mobile, "android"),
);
const artifact = path.join(
  root,
  preview
    ? "artifacts/ArihantCars-internal-preview.apk"
    : "artifacts/ArihantCars-development.apk",
);
mkdirSync(path.dirname(artifact), { recursive: true });
copyFileSync(
  path.join(
    mobile,
    preview
      ? "android/app/build/outputs/apk/release/app-release.apk"
      : "android/app/build/outputs/apk/debug/app-debug.apk",
  ),
  artifact,
);
console.log(
  `${preview ? "Internal preview (debug signed, bundled JS)" : "Development client"} APK: ${artifact}`,
);
if (process.argv.includes("--install")) {
  const adb = path.join(sdk, "platform-tools/adb"),
    serial = process.env.ANDROID_SERIAL || "emulator-5554";
  const device = (...args) => run(adb, ["-s", serial, ...args], root);
  device("install", "-r", artifact);
  if (!preview) device("reverse", "tcp:8081", "tcp:8081");
  device("reverse", "tcp:4100", "tcp:4100");
  if (preview)
    device(
      "shell",
      "am",
      "start",
      "-n",
      "com.arihantcars.operations/.MainActivity",
    );
  else
    device(
      "shell",
      "am",
      "start",
      "-a",
      "android.intent.action.VIEW",
      "-d",
      "arihant-ops://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081",
      "com.arihantcars.operations",
    );
}
