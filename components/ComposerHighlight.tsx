"use client";

import { forwardRef } from "react";
import { tokenizeComposer } from "@/lib/composer-tokens";

/**
 * 叠在 textarea 下面的着色层：字号/换行与输入框一致，避免芯片 padding 把折行撑歪。
 */
export const ComposerHighlight = forwardRef<HTMLDivElement, { value: string }>(function ComposerHighlight({ value }, ref) {
  const segments = tokenizeComposer(value);
  return (
    <div ref={ref} className="composer-highlight" aria-hidden="true">
      {segments.map((segment, index) => (
        segment.kind === "text"
          ? <span key={index}>{segment.text}</span>
          : <span key={index} className={`composer-token composer-token-${segment.kind}`}>{segment.text}</span>
      ))}
    </div>
  );
});
