"use client";

import type { CSSProperties } from "react";

/**
 * 路径标签：左侧省略，保留尾段。rtl 容器把省略号推到左边；
 * 内层 plaintext 隔离避免标点被重排。
 */
export function PathLabel({ text, style }: { text: string; style?: CSSProperties }) {
  return (
    <span
      style={{
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        display: "block",
        minWidth: 0,
        lineHeight: 1.35,
        direction: "rtl",
        textAlign: "left",
        ...style,
      }}
    >
      <span style={{ unicodeBidi: "plaintext" }}>{text}</span>
    </span>
  );
}
