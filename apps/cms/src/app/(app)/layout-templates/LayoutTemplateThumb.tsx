'use client';

import { layoutZoneStyle, type LayoutTemplateZone } from '@easysignage/shared-types';
import { sortZonesForCanvas, zoneColor } from '@/lib/layout-editor';

type Props = {
  zones: LayoutTemplateZone[];
  className?: string;
};

export function LayoutTemplateThumb({ zones, className }: Props) {
  const sorted = sortZonesForCanvas(zones);
  return (
    <div className={`layout-editor__template-thumb${className ? ` ${className}` : ''}`} aria-hidden>
      {sorted.map((z, i) => (
        <span
          key={z.zoneId}
          className="layout-editor__template-zone"
          style={{
            ...layoutZoneStyle(z.frame),
            background: `${zoneColor(i)}22`,
            borderColor: zoneColor(i),
          }}
        />
      ))}
    </div>
  );
}
