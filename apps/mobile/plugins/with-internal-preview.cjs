const { withAndroidManifest } = require("@expo/config-plugins");
module.exports = function withInternalPreview(config) {
  return withAndroidManifest(config, (result) => {
    const application = result.modResults.manifest.application[0];
    // A local training preview uses the operator's HTTP API. Ordinary release
    // configuration requires encrypted transport; debug has its own manifest.
    application.$["android:usesCleartextTraffic"] =
      process.env.ARIHANT_INTERNAL_PREVIEW === "1" ? "true" : "false";
    return result;
  });
};
