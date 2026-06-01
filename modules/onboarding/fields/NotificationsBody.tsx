import { Image, StyleSheet, Text, View } from 'react-native';
import { authColors, authSpace, authType } from '~/utils/authTheme';

const waypointLogo = require('~/assets/ios-light.png');

/**
 * Educational body for the final notifications step. No input — the
 * Continue button (labelled "Enable Notifications") triggers permission
 * request + schedule sync inside the step's `commit`.
 */
export function NotificationsBody() {
  return (
    <View style={styles.container}>
      <View style={styles.illustration}>
        <View style={styles.phone}>
          <View style={styles.phoneNotch} />
          <View style={styles.feedCardLarge}>
            <View style={styles.logoTile}>
              <Image source={waypointLogo} style={styles.logoImage} resizeMode="cover" />
            </View>
            <View style={styles.feedCopy}>
              <View style={styles.feedLineWide} />
              <View style={styles.feedLineShort} />
            </View>
          </View>
          <View style={styles.feedCardSmall}>
            <View style={styles.logoTileSmall}>
              <Image source={waypointLogo} style={styles.logoImage} resizeMode="cover" />
            </View>
            <View style={styles.feedCopy}>
              <View style={styles.feedLineMedium} />
              <View style={styles.feedLineTiny} />
            </View>
          </View>
        </View>

        <View style={styles.notificationCard}>
          <View style={styles.notificationLogo}>
            <Image source={waypointLogo} style={styles.logoImage} resizeMode="cover" />
          </View>
          <View style={styles.notificationCopy}>
            <Text style={styles.notificationTitle}>Waypoint</Text>
            <Text style={styles.notificationText} numberOfLines={2}>
              Bank holiday plans are starting nearby.
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.title}>Turn on notifications</Text>
      <Text style={styles.body}>
        Get updates about places to explore, reminders to check in, and your friend activity. You
        can manage notification settings anytime.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: authSpace.lg,
  },
  illustration: {
    height: 310,
    marginBottom: authSpace.xxl,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  phone: {
    width: 260,
    height: 230,
    borderTopLeftRadius: 48,
    borderTopRightRadius: 48,
    borderWidth: 10,
    borderBottomWidth: 0,
    borderColor: authColors.textSecondary,
    backgroundColor: authColors.accentSoft,
    overflow: 'hidden',
    paddingTop: 42,
    paddingHorizontal: authSpace.lg,
  },
  phoneNotch: {
    position: 'absolute',
    top: 18,
    left: 82,
    right: 82,
    height: 8,
    borderRadius: 4,
    backgroundColor: authColors.borderSubtle,
  },
  feedCardLarge: {
    height: 58,
    borderRadius: 16,
    backgroundColor: authColors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: authSpace.md,
    marginBottom: authSpace.md,
  },
  feedCardSmall: {
    height: 50,
    borderRadius: 14,
    backgroundColor: authColors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: authSpace.md,
    opacity: 0.9,
  },
  logoTile: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: authSpace.md,
    overflow: 'hidden',
  },
  logoTileSmall: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: authSpace.md,
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  feedCopy: {
    flex: 1,
    gap: authSpace.sm,
  },
  feedLineWide: {
    width: '86%',
    height: 10,
    borderRadius: 5,
    backgroundColor: authColors.borderSubtle,
  },
  feedLineMedium: {
    width: '72%',
    height: 9,
    borderRadius: 5,
    backgroundColor: authColors.borderSubtle,
  },
  feedLineShort: {
    width: '52%',
    height: 10,
    borderRadius: 5,
    backgroundColor: authColors.accentBorder,
  },
  feedLineTiny: {
    width: '38%',
    height: 9,
    borderRadius: 5,
    backgroundColor: authColors.accentBorder,
  },
  notificationCard: {
    position: 'absolute',
    top: 70,
    left: 16,
    right: 16,
    minHeight: 82,
    borderRadius: 18,
    backgroundColor: authColors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    padding: authSpace.md,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 7,
  },
  notificationLogo: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: authSpace.md,
    overflow: 'hidden',
  },
  notificationCopy: {
    flex: 1,
  },
  notificationTitle: {
    color: authColors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  notificationText: {
    color: authColors.textPrimary,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  title: {
    color: authColors.textPrimary,
    fontSize: authType.headline.fontSize,
    lineHeight: authType.headline.lineHeight,
    letterSpacing: authType.headline.letterSpacing,
    fontWeight: authType.headline.fontWeight,
    marginBottom: authSpace.md,
  },
  body: {
    color: authColors.textSecondary,
    fontSize: authType.body.fontSize,
    lineHeight: authType.body.lineHeight,
  },
});
