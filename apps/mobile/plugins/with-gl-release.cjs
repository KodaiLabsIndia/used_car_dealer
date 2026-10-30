const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("node:fs");
const path = require("node:path");

// SDK 58 expo-gl's GLView extends TextureView, so Expo's ExpoView constructor
// keep rule misses it. Reflection/JNI then fail in R8 release builds.
// https://github.com/expo/expo/issues/51948 — remove when fixed upstream.
module.exports = function withGlRelease(config) {
  return withDangerousMod(config, [
    "android",
    async (result) => {
      const file = path.join(
        result.modRequest.platformProjectRoot,
        "app/proguard-rules.pro",
      );
      const rule = "-keep class expo.modules.gl.** { *; }";
      const current = fs.readFileSync(file, "utf8");
      if (!current.includes(rule))
        fs.writeFileSync(
          file,
          `${current}\n# expo-gl reflection and JNI (SDK 58)\n${rule}\n`,
        );
      return result;
    },
  ]);
};
