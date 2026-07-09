import { getLocalScheduleContext } from './schedule-engine.service';

describe('getLocalScheduleContext', () => {
  it('maps Monday 09:30 in Europe/Lisbon', () => {
    const d = new Date('2026-04-06T08:30:00.000Z');
    const ctx = getLocalScheduleContext(d, 'Europe/Lisbon');
    expect(ctx.dayOfWeek).toBe(1);
    expect(ctx.minutes).toBe(9 * 60 + 30);
  });
});
