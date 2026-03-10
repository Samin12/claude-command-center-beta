'use client';
import { useState, useEffect, useRef } from 'react';

interface ApiKeyDialogProps {
  onSave: (anthropicKey: string, socialDataKey: string) => void;
  onCancel: () => void;
  initialAnthropicKey?: string;
  initialSocialDataKey?: string;
}

const FONT = '"Press Start 2P", "Courier New", monospace';

const C = {
  borderOuter: '#585858',
  listBg: '#F8F0C8',
  listBorder: '#B89830',
  titleBar: '#C06828',
  titleBarLight: '#E09040',
  titleText: '#FFF',
  textDark: '#484848',
  textMuted: '#908858',
};

export const STORAGE_KEYS = {
  anthropic: 'pokaimon-anthropic-key',
  socialData: 'pokaimon-socialdata-key',
} as const;

export function getStoredKeys() {
  if (typeof window === 'undefined') return { anthropic: '', socialData: '' };
  return {
    anthropic: localStorage.getItem(STORAGE_KEYS.anthropic) || '',
    socialData: localStorage.getItem(STORAGE_KEYS.socialData) || '',
  };
}

export function saveKeys(anthropicKey: string, socialDataKey: string) {
  if (anthropicKey) {
    localStorage.setItem(STORAGE_KEYS.anthropic, anthropicKey);
  } else {
    localStorage.removeItem(STORAGE_KEYS.anthropic);
  }
  if (socialDataKey) {
    localStorage.setItem(STORAGE_KEYS.socialData, socialDataKey);
  } else {
    localStorage.removeItem(STORAGE_KEYS.socialData);
  }
}

export default function ApiKeyDialog({ onSave, onCancel, initialAnthropicKey = '', initialSocialDataKey = '' }: ApiKeyDialogProps) {
  const [anthropicKey, setAnthropicKey] = useState(initialAnthropicKey);
  const [socialDataKey, setSocialDataKey] = useState(initialSocialDataKey);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [onCancel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!anthropicKey.trim()) return;
    onSave(anthropicKey.trim(), socialDataKey.trim());
  };

  const inputStyle: React.CSSProperties = {
    fontFamily: 'monospace',
    fontSize: 11,
    width: '100%',
    padding: '8px 10px',
    border: `2px solid ${C.listBorder}`,
    borderRadius: 4,
    background: '#FFF',
    color: C.textDark,
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
      <div style={{
        fontFamily: FONT,
        imageRendering: 'pixelated' as const,
        border: `4px solid ${C.borderOuter}`,
        borderRadius: 8,
        background: C.listBg,
        padding: 4,
        width: 480,
        maxWidth: '90vw',
      }}>
        <div style={{
          border: `3px solid ${C.listBorder}`,
          borderRadius: 4,
          padding: 16,
        }}>
          {/* Title */}
          <div style={{
            background: `linear-gradient(180deg, ${C.titleBarLight} 0%, ${C.titleBar} 100%)`,
            border: `2px solid ${C.borderOuter}`,
            borderRadius: 4,
            padding: '6px 12px',
            marginBottom: 14,
          }}>
            <span style={{
              color: C.titleText,
              fontSize: 11,
              fontWeight: 'bold',
              letterSpacing: '1px',
              textShadow: '1px 1px 0 rgba(0,0,0,0.3)',
            }}>
              API KEYS
            </span>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Anthropic key */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 9, color: C.textDark, display: 'block', marginBottom: 4, letterSpacing: '0.5px' }}>
                ANTHROPIC API KEY *
              </label>
              <input
                ref={inputRef}
                type="password"
                value={anthropicKey}
                onChange={e => setAnthropicKey(e.target.value)}
                placeholder="sk-ant-..."
                style={inputStyle}
              />
            </div>

            {/* SocialData key */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 9, color: C.textMuted, display: 'block', marginBottom: 4, letterSpacing: '0.5px' }}>
                SOCIALDATA API KEY (optional)
              </label>
              <input
                type="password"
                value={socialDataKey}
                onChange={e => setSocialDataKey(e.target.value)}
                placeholder="Enables Twitter/X data"
                style={inputStyle}
              />
              <div style={{ fontSize: 7, color: C.textMuted, marginTop: 3, lineHeight: 1.6 }}>
                Enables real Twitter data for richer worlds
              </div>
            </div>

            {/* Info */}
            <div style={{
              fontSize: 7,
              color: C.textMuted,
              lineHeight: 1.8,
              marginBottom: 14,
              padding: '6px 8px',
              background: 'rgba(0,0,0,0.04)',
              borderRadius: 4,
            }}>
              Keys are stored in your browser only.
              They are sent directly to the APIs and never stored on our server.
            </div>

            {/* Buttons */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onCancel}
                style={{
                  flex: 1, fontFamily: FONT, fontSize: 10, fontWeight: 'bold',
                  padding: 8, border: `3px solid ${C.borderOuter}`, borderRadius: 4,
                  background: C.listBg, color: C.textDark, cursor: 'pointer',
                }}
              >
                CANCEL
              </button>
              <button
                type="submit"
                disabled={!anthropicKey.trim()}
                style={{
                  flex: 1, fontFamily: FONT, fontSize: 10, fontWeight: 'bold',
                  padding: 8, border: `3px solid ${C.borderOuter}`, borderRadius: 4,
                  background: anthropicKey.trim() ? '#4ade80' : '#ccc',
                  color: anthropicKey.trim() ? '#000' : '#888',
                  cursor: anthropicKey.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                SAVE
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
