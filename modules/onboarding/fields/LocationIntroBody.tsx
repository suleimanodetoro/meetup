import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { ClipPath, Defs, G, Image as SvgImage, Path } from 'react-native-svg';

import { authColors, authSpace } from '~/utils/authTheme';

const VB_WIDTH = 390;
const VB_HEIGHT = 320;

// Full-width wavy ribbon. The lobes are intentionally uneven so the mask
// reads as a moving path through a city, not as two mirrored circles.
const BLOB_PATH =
  'M -24 110 C 26 52, 78 102, 121 94 C 164 86, 171 52, 211 54 C 257 56, 263 99, 306 100 C 348 101, 366 56, 414 84 L 414 220 C 356 260, 329 214, 291 222 C 252 231, 236 272, 197 264 C 157 256, 151 212, 111 213 C 64 214, 40 260, -24 222 Z';

const HERO_IMAGE_URI =
  'https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg?auto=compress&cs=tinysrgb&w=900';

export function LocationIntroBody() {
  return (
    <View style={styles.container}>
      <View style={styles.heroWrap} accessibilityIgnoresInvertColors>
        <Svg
          width="100%"
          viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          style={styles.heroSvg}>
          <Defs>
            <ClipPath id="blob">
              <Path d={BLOB_PATH} />
            </ClipPath>
          </Defs>
          <G clipPath="url(#blob)">
            <SvgImage
              href={{ uri: HERO_IMAGE_URI }}
              width={VB_WIDTH}
              height={VB_HEIGHT}
              preserveAspectRatio="xMidYMin slice"
            />
          </G>
        </Svg>
      </View>

      <View style={styles.copy}>
        <Text style={styles.title}>Share your world, meet better</Text>
        <Text style={styles.body}>
          Waypoint works best when we know where you are based now. We use your current city to show
          nearby people, plans, and trips that fit your everyday life.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  heroWrap: {
    marginHorizontal: -authSpace.xl,
    marginTop: authSpace.sm,
  },
  heroSvg: {
    aspectRatio: VB_WIDTH / VB_HEIGHT,
  },
  copy: {
    paddingBottom: authSpace.lg,
  },
  title: {
    color: authColors.textPrimary,
    fontSize: 38,
    lineHeight: 43,
    letterSpacing: -0.6,
    fontWeight: '800',
    marginBottom: authSpace.lg,
  },
  body: {
    color: authColors.textPrimary,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '500',
  },
});
