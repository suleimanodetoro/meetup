// components/TravelStatsCard.tsx
// The "Travel Stats" block: a filled world map of visited countries, with a
// Countries count, a % World donut, and the running figure — stolen-like-an-
// artist from the traveller-profile inspo, adapted to our palette.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { WorldMap } from './WorldMap';

// Sovereign states benchmark for the "% of world" figure.
const WORLD_TOTAL = 195;

interface TravelStatsCardProps {
  visitedCodes: string[];
  width: number;
  accent?: string;
}

function DonutRing({ percent, accent }: { percent: number; accent: string }) {
  const size = 72;
  const stroke = 7;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percent));
  const dash = (clamped / 100) * circumference;

  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke="#EDEFF2" strokeWidth={stroke} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={accent}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={`${dash} ${circumference - dash}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

export function TravelStatsCard({ visitedCodes, width, accent = '#007AFF' }: TravelStatsCardProps) {
  const count = visitedCodes.length;
  const pct = Math.min(100, Math.round((count / WORLD_TOTAL) * 100));

  return (
    <View>
      <View style={styles.mapWrap}>
        <WorldMap visited={visitedCodes} width={width} visitedFill={accent} />
      </View>

      <View style={styles.row}>
        <View style={styles.stat}>
          <Text style={[styles.num, { color: accent }]}>{count}</Text>
          <Text style={styles.label}>Countries</Text>
        </View>

        <DonutRing percent={pct} accent={accent} />

        <View style={styles.stat}>
          <Text style={[styles.num, { color: accent }]}>{pct}%</Text>
          <Text style={styles.label}>World</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingHorizontal: 8,
  },
  stat: {
    alignItems: 'center',
    minWidth: 92,
  },
  num: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 13,
    color: '#8A9099',
    marginTop: 3,
    fontWeight: '500',
  },
});
