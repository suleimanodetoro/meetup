module.exports = function (api) {
  api.cache(true);
  const plugins = [];

  // Strip console.* from production bundles. Today every call is console.error /
  // console.warn and several leak Supabase error payloads + user ids into release
  // device logs. Gated on env so dev keeps its logs. (Real failures should route
  // through Sentry — see Phase 3 — which runs before this strips the call.)
  if (process.env.NODE_ENV === 'production' || process.env.BABEL_ENV === 'production') {
    plugins.push('transform-remove-console');
  }

  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],

    plugins,
  };
};
