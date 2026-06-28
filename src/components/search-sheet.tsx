"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChat } from "@/lib/chat-context";
import { fetchSessionHistory } from "@/lib/session-search-client";
import {
  mergeLocalHits,
  searchLocalTranscript,
  searchMemoryTranscript,
  type LocalSearchHit,
} from "@/lib/transcript-store";
import type { SessionSearchResult } from "@/lib/search-types";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 300;
const MIN_REMOTE_QUERY = 2;

function formatTime(timestamp: number | string): string {
  const date =
    typeof timestamp === "number" ? new Date(timestamp) : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function highlightSnippet(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const lower = text.toLowerCase();
  const q = query.trim().toLowerCase();
  const idx = lower.indexOf(q);
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-sm bg-primary/15 text-foreground">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

function truncate(text: string, max = 160): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 3).trim()}...`;
}

interface SearchSheetProps {
  open: boolean;
  onClose: () => void;
}

export function SearchSheet({ open, onClose }: SearchSheetProps) {
  const { messages, scrollToMessage } = useChat();
  const [query, setQuery] = React.useState("");
  const [localHits, setLocalHits] = React.useState<LocalSearchHit[]>([]);
  const [historyHits, setHistoryHits] = React.useState<SessionSearchResult[]>([]);
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [historyError, setHistoryError] = React.useState(false);
  const [historyErrorDetail, setHistoryErrorDetail] = React.useState<string | null>(
    null
  );
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) return;
    setQuery("");
    setLocalHits([]);
    setHistoryHits([]);
    setHistoryError(false);
    setHistoryErrorDetail(null);
    setHistoryLoading(false);
    const t = window.setTimeout(() => inputRef.current?.focus(), 100);
    return () => window.clearTimeout(t);
  }, [open]);

  const updateLocal = React.useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) {
        setLocalHits([]);
        return;
      }
      const memory = searchMemoryTranscript(messages, trimmed);
      const indexed = await searchLocalTranscript(trimmed);
      setLocalHits(mergeLocalHits(memory, indexed));
    },
    [messages]
  );

  React.useEffect(() => {
    if (!open) return;
    void updateLocal(query);
  }, [open, query, updateLocal]);

  React.useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < MIN_REMOTE_QUERY) {
      setHistoryHits([]);
      setHistoryError(false);
      setHistoryErrorDetail(null);
      setHistoryLoading(false);
      return;
    }

    setHistoryLoading(true);
    setHistoryError(false);
    setHistoryErrorDetail(null);

    const timer = window.setTimeout(() => {
      void fetchSessionHistory(trimmed).then(
        ({ data, error, status, upstreamStatus }) => {
          setHistoryLoading(false);
          if (error || !data) {
            setHistoryError(true);
            setHistoryHits([]);
            const detail =
              upstreamStatus === 401
                ? "Hermes search auth failed — check HERMES_API_KEY"
                : status
                  ? `HTTP ${status}${upstreamStatus ? ` (Hermes ${upstreamStatus})` : ""}`
                  : "connection failed";
            setHistoryErrorDetail(detail);
            return;
          }
          setHistoryError(false);
          setHistoryErrorDetail(null);
          setHistoryHits(data.results);
        }
      );
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [open, query]);

  const handleLocalTap = (hit: LocalSearchHit) => {
    onClose();
    scrollToMessage(hit.id);
  };

  if (!open) return null;

  const showHint = query.trim().length === 0;
  const showNoLocal =
    query.trim().length > 0 && localHits.length === 0 && !historyLoading;
  const showNoHistory =
    query.trim().length >= MIN_REMOTE_QUERY &&
    !historyLoading &&
    !historyError &&
    historyHits.length === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/60 p-0"
      role="dialog"
      aria-label="Search session history"
      onClick={onClose}
    >
      <div
        className="mt-auto flex max-h-[92dvh] min-h-0 flex-col rounded-t-2xl border-t bg-background shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 border-b px-4 pb-3 pt-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="Close search"
            >
              <X className="size-4" />
            </Button>
            <p className="flex-1 text-center text-sm font-semibold">
              Search session history
            </p>
            <span className="size-8" aria-hidden="true" />
          </div>

          <input
            ref={inputRef}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search this device and Hermes history"
            aria-controls="search-results"
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </header>

        <div
          id="search-results"
          className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4"
          role="listbox"
        >
          {showHint && (
            <p className="text-xs text-muted-foreground">
              Search messages from this visit (local) and past PWA sessions stored
              on Hermes (remote history).
            </p>
          )}

          {(localHits.length > 0 || (query.trim() && !showHint)) && (
            <section>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Now</p>
              <div className="space-y-2">
                {localHits.map((hit) => (
                  <button
                    key={hit.id}
                    type="button"
                    role="option"
                    onClick={() => handleLocalTap(hit)}
                    className={cn(
                      "w-full rounded-lg border border-l-4 bg-muted/40 px-3 py-2 text-left transition-colors hover:bg-muted",
                      hit.role === "user" ? "border-l-primary" : "border-l-muted-foreground"
                    )}
                  >
                    <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {hit.role === "user" ? "You" : "Hermes"} · {formatTime(hit.timestamp)}
                    </p>
                    <p className="text-sm leading-snug">
                      {highlightSnippet(truncate(hit.content), query)}
                    </p>
                  </button>
                ))}
                {showNoLocal && localHits.length === 0 && (
                  <p className="text-xs text-muted-foreground">No local matches.</p>
                )}
              </div>
            </section>
          )}

          {query.trim().length >= MIN_REMOTE_QUERY && (
            <section>
              <div className="mb-2 flex items-center gap-2">
                <p className="text-xs font-medium text-muted-foreground">History</p>
                {historyLoading && (
                  <span className="text-xs text-muted-foreground animate-pulse">
                    loading
                  </span>
                )}
              </div>

              {historyError && (
                <p className="text-xs text-destructive">
                  History unavailable — {historyErrorDetail ?? "check connection"}.
                </p>
              )}

              <div className="space-y-2">
                {historyHits.map((hit, index) => (
                  <div
                    key={`${hit.sessionId}-${hit.timestamp}-${index}`}
                    role="option"
                    className="rounded-lg border border-l-4 border-l-muted-foreground bg-muted/30 px-3 py-2"
                  >
                    <p className="mb-1 text-[10px] text-muted-foreground">
                      {formatTime(hit.timestamp)} · {hit.sessionId.slice(0, 8)}…
                    </p>
                    <p className="text-sm leading-snug">
                      {highlightSnippet(hit.snippet, query)}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {hit.role === "user" ? "You" : "Hermes"}
                    </p>
                  </div>
                ))}
                {showNoHistory && (
                  <p className="text-xs text-muted-foreground">
                    No matches in session history.
                  </p>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
