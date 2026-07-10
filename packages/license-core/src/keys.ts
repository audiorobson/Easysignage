/** Chave pública de desenvolvimento — NÃO usar em produção comercial. */
export const DEV_LICENSE_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA2C3giGc2VMPrTvuyQfs4EAYhBQmWECEidQeHNDaZdQc=
-----END PUBLIC KEY-----
`;

/** Caminho por omissão para chave pública de produção no server box. */
export const DEFAULT_PRODUCTION_PUBLIC_KEY_FILE = '/config/license-public.pem';
