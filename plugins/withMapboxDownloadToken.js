const mapboxPlugin = require('@rnmapbox/maps/app.plugin.js');
const withMapbox = mapboxPlugin.default ?? mapboxPlugin;

// Expo serializes app.config plugins/options into the public app manifest.
// Read the download credential inside the plugin so it only enters native
// prebuild mods (Podfile / Gradle), never the serialized plugin options.
module.exports = function withMapboxDownloadToken(config, options = {}) {
  return withMapbox(config, {
    ...options,
    RNMapboxMapsDownloadToken: process.env.MAPBOX_DOWNLOAD_TOKEN || '',
  });
};
