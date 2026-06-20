// components/WorldMap.tsx
// A filled-country world map (choropleth). Renders the simplemaps world outline
// and fills the countries the user has visited. Path data lives in the
// auto-generated worldMapData.ts (keyed by ISO-3166-1 alpha-2).
import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { WORLD_VIEWBOX, WORLD_PATHS } from './worldMapData';

interface WorldMapProps {
  /** ISO-2 country codes the user has visited (case-insensitive). */
  visited: Iterable<string>;
  /** Rendered width in px; height is derived from the map's aspect ratio. */
  width: number;
  visitedFill?: string;
  baseFill?: string;
  stroke?: string;
}

function WorldMapBase({
  visited,
  width,
  visitedFill = '#007AFF',
  baseFill = '#E6E8EB',
  stroke = '#FFFFFF',
}: WorldMapProps) {
  const set = React.useMemo(
    () => new Set(Array.from(visited, (c) => (c || '').toUpperCase())),
    [visited]
  );
  const [, , vbW, vbH] = WORLD_VIEWBOX.split(' ').map(Number);
  const height = (width * vbH) / vbW;

  return (
    <Svg width={width} height={height} viewBox={WORLD_VIEWBOX}>
      {WORLD_PATHS.map((p, i) => (
        <Path
          key={i}
          d={p.d}
          fill={p.c && set.has(p.c) ? visitedFill : baseFill}
          stroke={stroke}
          strokeWidth={0.5}
        />
      ))}
    </Svg>
  );
}

export const WorldMap = React.memo(WorldMapBase);
