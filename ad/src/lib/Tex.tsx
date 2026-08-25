import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { C } from '../design/tokens';

export const Tex: React.FC<{
  tex: string;
  size: number;
  color?: string;
  display?: boolean;
  style?: React.CSSProperties;
}> = ({ tex, size, color = C.ink, display = false, style }) => {
  const html = useMemo(
    () =>
      katex.renderToString(tex, {
        throwOnError: true,
        displayMode: display,
        output: 'html',
        strict: false,
        trust: false,
      }),
    [tex, display],
  );
  return (
    <span
      style={{ fontSize: size, color, lineHeight: 1.25, ...style }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
