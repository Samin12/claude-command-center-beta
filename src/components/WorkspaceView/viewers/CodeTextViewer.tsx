'use client';

import { Highlight, themes } from 'prism-react-renderer';
import { getLanguageFromPath } from '@/components/AgentWorld/constants';
import { useStore } from '@/store';

interface CodeTextViewerProps {
  filePath: string;
  content: string;
  mode: 'edit' | 'preview';
  onChange: (value: string) => void;
}

export default function CodeTextViewer({ filePath, content, mode, onChange }: CodeTextViewerProps) {
  const { darkMode } = useStore();

  if (mode === 'edit') {
    return (
      <textarea
        value={content}
        onChange={(event) => onChange(event.target.value)}
        className="h-full w-full resize-none border-none bg-bg-primary p-5 font-mono text-sm leading-6 text-foreground outline-none"
        spellCheck={false}
      />
    );
  }

  return (
    <div className="h-full overflow-auto bg-bg-primary p-4">
      <Highlight code={content || ' '} language={getLanguageFromPath(filePath)} theme={darkMode ? themes.vsDark : themes.vsLight}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre className={`${className} min-h-full overflow-x-auto rounded-xl border border-border-primary p-4 text-sm`} style={style}>
            {tokens.map((line, index) => (
              <div key={index} {...getLineProps({ line })}>
                {line.map((token, tokenIndex) => (
                  <span key={tokenIndex} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}
