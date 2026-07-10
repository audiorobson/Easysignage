export const CAMPAIGN_CONTENT_SOURCE = 'campaign';

export const CAMPAIGN_STATUSES = ['draft', 'active', 'paused', 'ended'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_SCOPES = ['device', 'group', 'site', 'all'] as const;
export type CampaignScope = (typeof CAMPAIGN_SCOPES)[number];

export function campaignStatusLabelPt(status: string): string {
  switch (status) {
    case 'draft':
      return 'Rascunho';
    case 'active':
      return 'Ativa';
    case 'paused':
      return 'Pausada';
    case 'ended':
      return 'Terminada';
    default:
      return status;
  }
}

export function campaignScopeLabelPt(scope: string): string {
  switch (scope) {
    case 'device':
      return 'Device';
    case 'group':
      return 'Grupo';
    case 'site':
      return 'Site';
    case 'all':
      return 'Todos os devices';
    default:
      return scope;
  }
}
