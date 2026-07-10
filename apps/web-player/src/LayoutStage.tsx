import { useCallback, useEffect, useRef } from 'react';
import { layoutZoneStyle, type LayoutCurrentItem } from '@easysignage/shared-types';
import { ZonePlayer } from './ZonePlayer';

type TransitionKind = 'none' | 'fade' | 'slide-left' | 'slide-right' | 'zoom';

export function LayoutStage({
  layout,
  deviceToken,
  contentRevision,
  transitionKind,
  transitionMs,
  onAllZonesReady,
}: {
  layout: LayoutCurrentItem;
  deviceToken: string;
  contentRevision: string | null;
  transitionKind: TransitionKind;
  transitionMs: number;
  onAllZonesReady?: () => void;
}) {
  const readyZonesRef = useRef(new Set<string>());
  const allReadyRef = useRef(false);

  useEffect(() => {
    readyZonesRef.current = new Set();
    allReadyRef.current = false;
  }, [layout.layoutId, layout.revision, contentRevision]);

  const onZoneReady = useCallback(
    (zoneId: string) => {
      readyZonesRef.current.add(zoneId);
      if (
        !allReadyRef.current &&
        layout.zones.every((z) => readyZonesRef.current.has(z.zoneId))
      ) {
        allReadyRef.current = true;
        onAllZonesReady?.();
      }
    },
    [layout.zones, onAllZonesReady]
  );

  return (
    <div className="player-layout-stage">
      {layout.zones.map((zone) => (
        <div
          key={zone.zoneId}
          className="player-layout-zone"
          style={layoutZoneStyle(zone.frame)}
          data-zone={zone.zoneId}
        >
          <ZonePlayer
            zone={zone}
            deviceToken={deviceToken}
            contentRevision={contentRevision}
            transitionKind={transitionKind}
            transitionMs={transitionMs}
            onReady={() => onZoneReady(zone.zoneId)}
          />
        </div>
      ))}
    </div>
  );
}
