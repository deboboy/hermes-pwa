"use client";

import * as React from "react";
import { getOrCreateSessionId, persistSessionId } from "@/lib/session-id";
import {
  appendTranscript,
  loadTranscriptForSession,
  transcriptToChatMessages,
} from "@/lib/transcript-store";

export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  isStreaming?: boolean;
}

export interface EventMarker {
  id: string;
  type: "typing" | "system" | "tool_call" | "status";
  content: string;
  timestamp: string;
}

type ChatContextValue = {
  messages: ChatMessage[];
  markers: EventMarker[];
  isLoading: boolean;
  sessionId: string;
  highlightMessageId: string | null;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  handleSend: (text: string) => Promise<void>;
  scrollToMessage: (messageId: string) => void;
};

const ChatContext = React.createContext<ChatContextValue | null>(null);

function persistChatMessage(
  msg: ChatMessage,
  sessionId: string
): void {
  if (msg.role !== "user" && msg.role !== "assistant") return;
  if (msg.isStreaming || !msg.content.trim()) return;
  void appendTranscript({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    timestamp: new Date(msg.timestamp).getTime(),
    sessionId,
  });
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I'm Hermes. How can I help you today?",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [markers, setMarkers] = React.useState<EventMarker[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [sessionId, setSessionId] = React.useState("");
  const [highlightMessageId, setHighlightMessageId] = React.useState<string | null>(
    null
  );
  const [searchOpen, setSearchOpen] = React.useState(false);
  const sessionIdRef = React.useRef("");
  const restoredRef = React.useRef(false);

  React.useEffect(() => {
    const sid = getOrCreateSessionId();
    setSessionId(sid);
    sessionIdRef.current = sid;

    if (restoredRef.current) return;
    restoredRef.current = true;

    void loadTranscriptForSession(sid).then((records) => {
      if (records.length === 0) return;
      setMessages(transcriptToChatMessages(records));
    });
  }, []);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlSession = params.get("session")?.trim();
    if (!urlSession) return;
    persistSessionId(urlSession);
    setSessionId(urlSession);
    sessionIdRef.current = urlSession;
    void loadTranscriptForSession(urlSession).then((records) => {
      if (records.length > 0) {
        setMessages(transcriptToChatMessages(records));
      }
    });
  }, []);

  const scrollToMessage = React.useCallback((messageId: string) => {
    const el = document.querySelector(`[data-message-id="${messageId}"]`);
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightMessageId(messageId);
      window.setTimeout(() => setHighlightMessageId(null), 2000);
    }
  }, []);

  const handleSend = React.useCallback(async (text: string) => {
    const sid = sessionIdRef.current || getOrCreateSessionId();
    sessionIdRef.current = sid;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    const assistantPlaceholder: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
      isStreaming: true,
    };

    let historyForApi: ChatMessage[] = [];
    setMessages((prev) => {
      historyForApi = prev.filter(
        (m) => (m.role === "user" || m.role === "assistant") && !m.isStreaming
      );
      persistChatMessage(userMessage, sid);
      return [...prev, userMessage, assistantPlaceholder];
    });
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Hermes-Session-Id": sid,
        },
        body: JSON.stringify({
          message: text,
          history: historyForApi,
          sessionId: sid,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantPlaceholder.id
              ? { ...m, content: accumulated, isStreaming: true }
              : m
          )
        );
      }

      setMessages((prev) => {
        const next = prev.map((m) =>
          m.id === assistantPlaceholder.id
            ? { ...m, content: accumulated, isStreaming: false }
            : m
        );
        const finished = next.find((m) => m.id === assistantPlaceholder.id);
        if (finished) persistChatMessage(finished, sid);
        return next;
      });
    } catch (error) {
      console.error("Chat error:", error);
      const errorMarker: EventMarker = {
        id: crypto.randomUUID(),
        type: "status",
        content: "Connection failed. Please check backend.",
        timestamp: new Date().toISOString(),
      };
      setMarkers((prev) => [...prev, errorMarker]);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantPlaceholder.id
            ? {
                ...m,
                content: "Error: Unable to reach Hermes backend.",
                isStreaming: false,
              }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value = React.useMemo(
    () => ({
      messages,
      markers,
      isLoading,
      sessionId,
      highlightMessageId,
      searchOpen,
      setSearchOpen,
      handleSend,
      scrollToMessage,
    }),
    [
      messages,
      markers,
      isLoading,
      sessionId,
      highlightMessageId,
      searchOpen,
      handleSend,
      scrollToMessage,
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const ctx = React.useContext(ChatContext);
  if (!ctx) {
    throw new Error("useChat must be used within ChatProvider");
  }
  return ctx;
}
