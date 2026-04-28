'use client';

import { useEffect } from 'react';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    const isChunkError =
      error.name === 'ChunkLoadError' ||
      /loading chunk/i.test(error.message) ||
      /loading css chunk/i.test(error.message);

    if (isChunkError) {
      window.location.reload();
    }
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: '#080a0a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          fontFamily: "'IBM Plex Mono', monospace",
          color: 'rgba(255,255,255,0.4)',
          fontSize: 12,
          letterSpacing: '1px',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#00ff88', marginBottom: 12, fontSize: 10, letterSpacing: '3px' }}>
            [ RELOADING ]
          </div>
          <div>Loading AudFlo...</div>
        </div>
      </body>
    </html>
  );
}
