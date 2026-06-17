const { withPodfile } = require('@expo/config-plugins');

/**
 * Disable fmt's `consteval` path so iOS builds don't break.
 *
 * React Native 0.79 vendors fmt 11.0.2 (via RCT-Folly). Under Xcode 16 / Apple
 * clang 16 fmt's compiler detection enables `FMT_USE_CONSTEVAL 1`, and that makes
 * `FMT_STRING(...)` a consteval call that fails to compile inside fmt's own
 * format-inl.h ("call to consteval function ... is not a constant expression",
 * xcodebuild error 65). Forcing FMT_USE_CONSTEVAL off restores a normal constexpr
 * path with no behavior change for us.
 *
 * We patch fmt/base.h from the Podfile's post_install hook (not a one-off edit)
 * because `ios/` is gitignored and regenerated from scratch by `expo prebuild
 * --clean` and by EAS — a hand edit to ios/Pods would be wiped on every install.
 * post_install runs after every `pod install`, so the fix is always re-applied.
 */
const FMT_FIX = [
  '',
  '    # fmt consteval build fix (RN 0.79 + Xcode 16) — see plugins/withFmtConstevalFix.js',
  "    fmt_base = File.join(installer.sandbox.root, 'fmt', 'include', 'fmt', 'base.h')",
  '    if File.exist?(fmt_base)',
  '      contents = File.read(fmt_base)',
  "      patched = contents.gsub('#  define FMT_USE_CONSTEVAL 1', '#  define FMT_USE_CONSTEVAL 0')",
  '      if contents != patched',
  '        File.write(fmt_base, patched)',
  "        Pod::UI.puts '[withFmtConstevalFix] Disabled FMT_USE_CONSTEVAL in fmt/base.h'",
  '      end',
  '    end',
].join('\n');

module.exports = function withFmtConstevalFix(config) {
  return withPodfile(config, (cfg) => {
    const podfile = cfg.modResults;
    if (podfile.contents.includes('fmt consteval build fix')) return cfg;
    // Inject at the top of the existing `post_install do |installer|` block.
    podfile.contents = podfile.contents.replace(
      /post_install do \|installer\|\n/,
      (match) => match + FMT_FIX + '\n'
    );
    return cfg;
  });
};
