'use client';

import type { ScheduleRuleRow } from './types';
import { colorForId, formatMinutes, ISO_DAY_OPTIONS } from './schedule-utils';

const DAY_H = 520;
const LABEL_W = 44;

type Props = {
  rules: ScheduleRuleRow[];
  title: string;
};

export function ScheduleTimeline({ rules, title }: Props) {
  return (
    <div
      style={{
        borderRadius: 'var(--radius-md, 14px)',
        border: '1px solid var(--color-border, #e2e8f0)',
        overflow: 'hidden',
        background: 'var(--color-surface, #fff)',
      }}
    >
      <div
        style={{
          padding: '0.75rem 1rem',
          borderBottom: '1px solid var(--color-border, #e2e8f0)',
          fontWeight: 600,
          fontSize: '0.9375rem',
        }}
      >
        {title}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `${LABEL_W}px repeat(7, minmax(100px, 1fr))`,
            minWidth: 780,
          }}
        >
          <div
            style={{
              borderRight: '1px solid var(--color-border, #e2e8f0)',
              background: 'var(--color-surface-muted, #f1f5f9)',
            }}
          />
          {ISO_DAY_OPTIONS.map((d) => (
            <div
              key={d.value}
              style={{
                padding: '0.5rem',
                textAlign: 'center',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--color-text-muted, #64748b)',
                borderRight:
                  d.value === 7 ? undefined : '1px solid var(--color-border, #e2e8f0)',
                background: 'var(--color-surface-muted, #f1f5f9)',
              }}
            >
              {d.short}
            </div>
          ))}

          <div
            style={{
              gridColumn: '1',
              position: 'relative',
              height: DAY_H,
              borderRight: '1px solid var(--color-border, #e2e8f0)',
            }}
          >
            {Array.from({ length: 13 }, (_, i) => i * 2).map((hour) => (
              <div
                key={hour}
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: `${(hour * 60 / 1440) * 100}%`,
                  borderTop: '1px solid rgba(148, 163, 184, 0.35)',
                  fontSize: 10,
                  color: 'var(--color-text-muted, #64748b)',
                  paddingLeft: 4,
                }}
              >
                {String(hour).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {ISO_DAY_OPTIONS.map((d) => {
            const dayRules = rules.filter((r) => r.dayOfWeek === d.value);
            return (
              <div
                key={d.value}
                style={{
                  position: 'relative',
                  height: DAY_H,
                  borderRight:
                    d.value === 7 ? undefined : '1px solid var(--color-border, #e2e8f0)',
                  background:
                    d.value >= 6
                      ? 'rgba(241, 245, 249, 0.35)'
                      : 'transparent',
                }}
              >
                {dayRules.map((r) => {
                  const top = (r.startMin / 1440) * 100;
                  const h = ((r.endMin - r.startMin) / 1440) * 100;
                  const bg = colorForId(r.playlistId);
                  return (
                    <div
                      key={r.id}
                      title={`${r.playlist.name} · ${formatMinutes(r.startMin)}–${formatMinutes(r.endMin)} · ${r.enabled ? 'ativo' : 'inativo'}`}
                      style={{
                        position: 'absolute',
                        left: 4,
                        right: 4,
                        top: `${top}%`,
                        height: `${Math.max(h, 2)}%`,
                        background: bg,
                        color: '#fff',
                        borderRadius: 6,
                        padding: '2px 6px',
                        fontSize: 10,
                        lineHeight: 1.25,
                        overflow: 'hidden',
                        boxShadow: '0 1px 3px rgba(15,23,42,0.2)',
                        opacity: r.enabled ? 1 : 0.45,
                      }}
                    >
                      {r.playlist.name}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <p
        className="text-muted"
        style={{ margin: 0, padding: '0.5rem 1rem', fontSize: '0.75rem' }}
      >
        Eixo vertical: 24h. Blocos = playlist no intervalo. Cores por playlist.
      </p>
    </div>
  );
}
