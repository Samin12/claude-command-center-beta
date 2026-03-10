'use client';
import { useState, useEffect } from 'react';

interface GeneratingOverlayProps {
  status: string;
}

const FONT = '"Press Start 2P", "Courier New", monospace';

export default function GeneratingOverlay({ status }: GeneratingOverlayProps) {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="absolute inset-0 z-40 flex flex-col items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
    >
      {/* Pixel art world icon */}
      <div style={{
        width: 64,
        height: 64,
        marginBottom: 24,
        imageRendering: 'pixelated' as const,
        display: 'grid',
        gridTemplateColumns: 'repeat(8, 8px)',
        gridTemplateRows: 'repeat(8, 8px)',
      }}>
        {/* Simple 8x8 pixel art world/globe */}
        {[
          0,0,1,1,1,1,0,0,
          0,1,2,1,2,2,1,0,
          1,2,2,1,2,2,2,1,
          1,1,2,2,2,1,2,1,
          1,2,1,2,1,2,2,1,
          1,2,2,2,2,1,1,1,
          0,1,2,2,1,2,1,0,
          0,0,1,1,1,1,0,0,
        ].map((v, i) => (
          <div key={i} style={{
            width: 8, height: 8,
            backgroundColor: v === 0 ? 'transparent' : v === 1 ? '#2d6a4f' : '#52b788',
          }} />
        ))}
      </div>

      {/* Status text */}
      <div style={{
        fontFamily: FONT,
        fontSize: 14,
        color: '#4ade80',
        textAlign: 'center',
        textShadow: '0 0 10px rgba(74,222,128,0.5)',
        marginBottom: 12,
        letterSpacing: '1px',
      }}>
        {status}{dots}
      </div>

      {/* Progress bar */}
      <div style={{
        width: 240,
        height: 6,
        backgroundColor: '#1a1a2e',
        borderRadius: 3,
        overflow: 'hidden',
        border: '1px solid #333',
      }}>
        <div style={{
          height: '100%',
          backgroundColor: '#4ade80',
          borderRadius: 3,
          animation: 'generating-progress 2s ease-in-out infinite',
        }} />
      </div>

      <style>{`
        @keyframes generating-progress {
          0% { width: 5%; }
          50% { width: 85%; }
          100% { width: 5%; }
        }
      `}</style>

      {/* Hint text */}
      <div style={{
        fontFamily: FONT,
        fontSize: 8,
        color: '#666',
        marginTop: 24,
        letterSpacing: '0.5px',
      }}>
        This may take 20-30 seconds
      </div>
    </div>
  );
}
