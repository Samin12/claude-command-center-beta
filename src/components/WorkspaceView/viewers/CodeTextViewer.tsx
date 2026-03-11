'use client';

import { Highlight, themes } from 'prism-react-renderer';
import { getLanguageFromPath } from '@/components/AgentWorld/constants';

interface CodeTextViewerProps {
  filePath: string;
  content: string;
  mode: 'edit' | 'preview';
  onChange: (value: string) => void;
}

export default function CodeTextViewer({ filePath, content, mode, onChange }: CodeTextViewerProps) {
  if (mode === 'edit') {
    return (
      <textarea
        value={content}
        onChange={(event) => onChange(event.target.value)}
        className="h-full w-full resize-none border-none bg-[#0b1016] p-5 font-mono text-sm leading-6 text-white outline-none"
        spellCheck={false}
      />
    );
  }

  return (
    <div className="h-full overflow-auto bg-[#0b1016] p-4">
      <Highlight code={content || ' '} language={getLanguageFromPath(filePath)} theme={themes.vsDark}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre className={`${className} min-h-full overflow-x-auto rounded-xl border border-white/5 p-4 text-sm`} style={style}>
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
