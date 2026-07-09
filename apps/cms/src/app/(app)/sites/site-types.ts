export type SiteDeviceRow = {
  id: string;
  name: string;
  platform: string;
  status: string;
  lastSeenAt: string | null;
};

export type SiteCoverAsset = {
  id: string;
  name: string;
  kind: string;
  mimeType: string;
  thumbnailKey: string | null;
};

export type SiteDetail = {
  id: string;
  name: string;
  code: string | null;
  timezone: string;
  coverAsset: SiteCoverAsset | null;
  devices: SiteDeviceRow[];
  createdAt: string;
  updatedAt: string;
};
