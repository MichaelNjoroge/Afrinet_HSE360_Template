import * as React from "react";
import { List } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const bulletPrefix = "• ";

const BulletTextarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<typeof Textarea>>(
  ({ className, onKeyDown, ...props }, forwardedRef) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    React.useImperativeHandle(forwardedRef, () => textareaRef.current as HTMLTextAreaElement);

    const replaceSelection = (value: string, start: number, end: number) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.setRangeText(value, start, end, "end");
      textarea.focus();
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    };

    const addBullets = () => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const { selectionStart, selectionEnd, value } = textarea;
      const lineStart = value.lastIndexOf("\n", Math.max(0, selectionStart - 1)) + 1;
      const nextBreak = value.indexOf("\n", selectionEnd);
      const lineEnd = nextBreak === -1 ? value.length : nextBreak;
      const selectedLines = value.slice(lineStart, lineEnd).split("\n");
      const allBulleted = selectedLines.every(
        (line) => !line.trim() || line.startsWith(bulletPrefix),
      );
      const updated = selectedLines
        .map((line) => {
          if (!line.trim()) return line;
          return allBulleted ? line.replace(/^•\s?/, "") : `${bulletPrefix}${line}`;
        })
        .join("\n");
      replaceSelection(updated || bulletPrefix, lineStart, lineEnd);
    };

    return (
      <div className="overflow-hidden rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
        <div className="flex items-center border-b border-input bg-muted/40 px-2 py-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={addBullets}
            aria-label="Add or remove bullet points"
            title="Add or remove bullet points"
          >
            <List className="size-4" />
            Bullets
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">Enter continues the list</span>
        </div>
        <Textarea
          ref={textareaRef}
          className={cn("rounded-none border-0 shadow-none focus-visible:ring-0", className)}
          onKeyDown={(event) => {
            onKeyDown?.(event);
            if (event.defaultPrevented || event.key !== "Enter") return;
            const textarea = event.currentTarget;
            const lineStart = textarea.value.lastIndexOf("\n", textarea.selectionStart - 1) + 1;
            const currentLine = textarea.value.slice(lineStart, textarea.selectionStart);
            if (!currentLine.startsWith(bulletPrefix)) return;
            event.preventDefault();
            replaceSelection(`\n${bulletPrefix}`, textarea.selectionStart, textarea.selectionEnd);
          }}
          {...props}
        />
      </div>
    );
  },
);

BulletTextarea.displayName = "BulletTextarea";

export { BulletTextarea };
