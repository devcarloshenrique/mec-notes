import React, { Fragment } from "react";

function renderInline(text: string, keyPrefix: string) {
  const nodes: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|`([^`]+?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        <Fragment key={`${keyPrefix}-t${i}`}>
          {text.slice(lastIndex, match.index)}
        </Fragment>
      );
    }
    if (match[2] !== undefined) {
      nodes.push(
        <strong key={`${keyPrefix}-b${i}`} className="font-semibold text-foreground">
          {match[2]}
        </strong>
      );
    } else if (match[3] !== undefined) {
      nodes.push(
        <code
          key={`${keyPrefix}-c${i}`}
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-primary font-medium"
        >
          {match[3]}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
    i++;
  }
  if (lastIndex < text.length) {
    nodes.push(
      <Fragment key={`${keyPrefix}-t${i}`}>
        {text.slice(lastIndex)}
      </Fragment>
    );
  }
  return nodes;
}

export function MarkdownPreview({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let listBuffer: { checked: boolean | null; text: string }[] = [];
  let codeBuffer: string[] = [];
  let inCode = false;

  const flushList = (key: string) => {
    if (listBuffer.length === 0) return;
    const items = listBuffer;
    listBuffer = [];
    blocks.push(
      <ul key={key} className="my-2 space-y-1.5">
        {items.map((it, idx) => (
          <li
            key={idx}
            className="flex items-start gap-2 text-[13px] leading-relaxed text-muted-foreground"
          >
            {it.checked === null ? (
              <span
                className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/70"
                aria-hidden
              />
            ) : (
              <span
                className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-[4px] border select-none ${
                  it.checked
                    ? "border-primary bg-primary text-primary-foreground font-bold text-[10px]"
                    : "border-border bg-background/50 text-transparent"
                }`}
                aria-hidden
              >
                {it.checked ? "✓" : ""}
              </span>
            )}
            <span className={it.checked ? "line-through opacity-60" : ""}>
              {renderInline(it.text, `li-${key}-${idx}`)}
            </span>
          </li>
        ))}
      </ul>
    );
  };

  lines.forEach((raw, index) => {
    const line = raw;

    if (line.trim().startsWith("```")) {
      if (inCode) {
        blocks.push(
          <pre
            key={`code-${index}`}
            className="my-3 overflow-x-auto rounded-lg border border-border bg-[#13151b] p-3 font-mono text-[12.5px] leading-relaxed text-foreground/90"
          >
            <code>{codeBuffer.join("\n")}</code>
          </pre>
        );
        codeBuffer = [];
        inCode = false;
      } else {
        flushList(`list-${index}`);
        inCode = true;
      }
      return;
    }
    if (inCode) {
      codeBuffer.push(line);
      return;
    }

    const checkbox = line.match(/^\s*-\s\[( |x|X)\]\s+(.*)$/);
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const ordered = line.match(/^\s*\d+\.\s+(.*)$/);
    if (checkbox) {
      listBuffer.push({
        checked: checkbox[1].toLowerCase() === "x",
        text: checkbox[2],
      });
      return;
    }
    if (bullet) {
      listBuffer.push({ checked: null, text: bullet[1] });
      return;
    }
    if (ordered) {
      listBuffer.push({ checked: null, text: ordered[1] });
      return;
    }
    flushList(`list-${index}`);

    if (line.startsWith("### ")) {
      blocks.push(
        <h3 key={index} className="mt-4 mb-1 text-sm font-semibold text-foreground">
          {renderInline(line.slice(4), `h3-${index}`)}
        </h3>
      );
    } else if (line.startsWith("## ")) {
      blocks.push(
        <h2 key={index} className="mt-4 mb-1.5 text-base font-semibold text-foreground">
          {renderInline(line.slice(3), `h2-${index}`)}
        </h2>
      );
    } else if (line.startsWith("# ")) {
      blocks.push(
        <h1
          key={index}
          className="mt-1 mb-2 text-lg font-bold tracking-tight text-foreground text-balance"
        >
          {renderInline(line.slice(2), `h1-${index}`)}
        </h1>
      );
    } else if (line.startsWith("> ")) {
      blocks.push(
        <blockquote
          key={index}
          className="my-2 border-l-2 border-primary/60 pl-3 text-[13px] italic text-muted-foreground bg-muted/20 py-1 rounded-r"
        >
          {renderInline(line.slice(2), `q-${index}`)}
        </blockquote>
      );
    } else if (line.trim() === "") {
      blocks.push(<div key={index} className="h-2" aria-hidden />);
    } else {
      blocks.push(
        <p key={index} className="text-[13px] leading-relaxed text-muted-foreground">
          {renderInline(line, `p-${index}`)}
        </p>
      );
    }
  });
  flushList("list-end");

  return <div className="max-w-none">{blocks}</div>;
}
