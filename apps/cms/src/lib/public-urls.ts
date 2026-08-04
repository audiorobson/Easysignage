const API_PORT = 3001;
const RT_PORT = 3020;
const API_PATH = '/api/v1';

function browserHttpOrigin() {
  if (typeof window === 'undefined') return null;
  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
  return { protocol, hostname: window.location.hostname };
}

export function getApiBase() {
  const explicit = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  const browser = browserHttpOrigin();
  if (browser) {
    return `${browser.protocol}//${browser.hostname}:${API_PORT}${API_PATH}`;
  }
  return explicit ?? `http://localhost:${API_PORT}${API_PATH}`;
}

export function getRtUrl() {
  const explicit = process.env.NEXT_PUBLIC_RT_URL?.replace(/\/$/, '');
  const browser = browserHttpOrigin();
  if (browser) {
    const wsProto = browser.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProto}//${browser.hostname}:${RT_PORT}`;
  }
  return explicit ?? `ws://localhost:${RT_PORT}`;
}