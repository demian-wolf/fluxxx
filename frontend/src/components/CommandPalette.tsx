import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { destinations, quickActions, type Destination } from "@/lib/navigation";

const all: Destination[] = [...quickActions, ...destinations];

function score(item: Destination, q: string): boolean {
  if (!q) return true;
  const hay = `${item.label} ${item.section} ${item.keywords ?? ""}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((token) => hay.includes(token));
}

export function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const opener = () => setOpen(true);
    window.addEventListener("keydown", handler);
    window.addEventListener("open-command-palette", opener);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("open-command-palette", opener);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const results = useMemo(
    () => all.filter((item) => score(item, query)),
    [query],
  );

  useEffect(() => {
    setCursor(0);
  }, [query]);

  if (!open) return null;

  const go = (item: Destination) => {
    setOpen(false);
    navigate(item.to);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = results[cursor];
      if (item) go(item);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]"
      onMouseDown={() => setOpen(false)}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />
      <div
        className="relative w-full max-w-xl overflow-hidden rounded-xl border border-line bg-bg-raised shadow-glow animate-fade-in"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-4 w-4 shrink-0 text-ink-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Jump to anything…"
            className="w-full bg-transparent py-4 text-sm text-ink placeholder:text-ink-faint focus:outline-none"
          />
          <kbd className="hidden shrink-0 rounded border border-line bg-bg-soft px-1.5 py-0.5 font-mono text-[10px] text-ink-faint sm:block">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-ink-muted">
              No matches for "{query}"
            </p>
          ) : (
            results.map((item, i) => {
              const Icon = item.icon;
              const isActive = i === cursor;
              return (
                <button
                  key={item.to}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => go(item)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition",
                    isActive ? "bg-flux-cyan/10 text-ink" : "text-ink-muted",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isActive ? "text-flux-cyan" : "text-ink-faint",
                    )}
                  />
                  <span className="flex-1 font-medium text-ink">
                    {item.label}
                  </span>
                  <span className="text-[11px] uppercase tracking-wide text-ink-faint">
                    {item.section}
                  </span>
                  {isActive && (
                    <CornerDownLeft className="h-3.5 w-3.5 text-ink-faint" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
