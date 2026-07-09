import type { ReactNode } from 'react';

export default function EmbedLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        margin: 0,
        background: '#020617',
      }}
    >
      {children}
    </div>
  );
}
