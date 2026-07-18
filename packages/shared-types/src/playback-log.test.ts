import {
  isPlaybackEventInput,
  isPlaybackEventType,
  isPlaybackItemType,
  playbackEventTypeLabelPt,
  playbackItemTypeLabelPt,
} from './playback-log.js';

describe('isPlaybackEventType / isPlaybackItemType', () => {
  it('aceita valores válidos', () => {
    expect(isPlaybackEventType('started')).toBe(true);
    expect(isPlaybackEventType('error')).toBe(true);
    expect(isPlaybackItemType('wall_tile')).toBe(true);
  });

  it('rejeita valores inválidos', () => {
    expect(isPlaybackEventType('paused')).toBe(false);
    expect(isPlaybackItemType('video')).toBe(false);
    expect(isPlaybackEventType(123)).toBe(false);
  });
});

describe('isPlaybackEventInput', () => {
  it('valida um evento mínimo bem formado', () => {
    expect(
      isPlaybackEventInput({
        itemType: 'asset',
        eventType: 'started',
        startedAt: new Date().toISOString(),
      })
    ).toBe(true);
  });

  it('rejeita eventos sem itemType/eventType/startedAt', () => {
    expect(isPlaybackEventInput({ eventType: 'started' })).toBe(false);
    expect(isPlaybackEventInput({ itemType: 'asset', eventType: 'started' })).toBe(false);
    expect(isPlaybackEventInput(null)).toBe(false);
    expect(isPlaybackEventInput('not-an-object')).toBe(false);
  });
});

describe('labels em pt-PT', () => {
  it('cobre todos os PlaybackEventType', () => {
    expect(playbackEventTypeLabelPt('started')).toBe('Iniciado');
    expect(playbackEventTypeLabelPt('completed')).toBe('Concluído');
    expect(playbackEventTypeLabelPt('skipped')).toBe('Ignorado');
    expect(playbackEventTypeLabelPt('error')).toBe('Erro');
  });

  it('cobre todos os PlaybackItemType', () => {
    expect(playbackItemTypeLabelPt('asset')).toBe('Mídia');
    expect(playbackItemTypeLabelPt('playlist')).toBe('Playlist');
    expect(playbackItemTypeLabelPt('layout')).toBe('Layout');
    expect(playbackItemTypeLabelPt('wall_tile')).toBe('Video wall');
    expect(playbackItemTypeLabelPt('widget')).toBe('Widget');
  });
});
