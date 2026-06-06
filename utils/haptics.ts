export function triggerLightHaptic() {
  void import('expo-haptics')
    .then((Haptics) => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light))
    .catch(() => {});
}
