import { describe, expect, it } from '@jest/globals';
import { tierHasFeature, tierFeatures } from './features.js';

describe('license features', () => {
  it('Lite não inclui campanhas nem video walls', () => {
    expect(tierHasFeature('LITE', 'campaigns')).toBe(false);
    expect(tierHasFeature('LITE', 'video_walls')).toBe(false);
    expect(tierFeatures('STD')).toContain('campaigns');
  });
});
