"use client";

import * as React from "react";
import { MessageScrollerProvider, MessageScroller, MessageScrollerViewport, MessageScrollerContent, MessageScrollerItem, MessageScrollerButton } from "@/components/ui/message-scroller";
import { Message, MessageContent, MessageHeader } from "@/components/ui/message";
import { Bubble, BubbleContent, BubbleGroup } from "@/components/ui/bubble";
import { Attachment, AttachmentMedia, AttachmentContent, AttachmentTitle, AttachmentDescription, AttachmentGroup, AttachmentActions } from "@/components/ui/attachment";
import { Marker, MarkerIcon, MarkerContent } from "@/components/ui/marker";
import { PushNotifications } from "@/components/push-notifications";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Paperclip, Square, Loader2, Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";

// Types matching Hermes agent event schema
type MessageRole = "user" | "assistant" | "system";
type AttachmentType = "image" | "file" | "audio";

interface AttachmentMeta {
  id: string;
  name: string;
  type: AttachmentType;
  size?: string;
  url?: string;
}

interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  attachments?: AttachmentMeta[];
  timestamp: string;
  isStreaming?: boolean;
}

interface EventMarker {
  id: string;
  type: "typing" | "system" | "tool_call" | "status";
  content: string;
  timestamp: string;
}

function ChatInput({ onSend, disabled }: { onSend: (text: string) => void; disabled: boolean }) {
  const [text, setText] = React.useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2 rounded-2xl border bg-background p-2 shadow-sm">
      <Button type="button" variant="ghost" size="icon" className="shrink-0 rounded-full">
        <Paperclip className="size-4" />
      </Button>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Message Hermes..."
        className="max-h-32 min-h-[40px] resize-none border-0 bg-transparent p-2 shadow-none focus-visible:ring-0"
        disabled={disabled}
      />
      <Button type="submit" size="icon" disabled={!text.trim() || disabled} className="shrink-0 rounded-full">
        <Send className="size-4" />
      </Button>
    </form>
  );
}

function StreamingIndicator() {
  return (
    <Message align="start">
      <MessageHeader>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Bot className="size-3" />
          Hermes
        </span>
      </MessageHeader>
      <MessageContent>
        <Bubble variant="muted" align="start">
          <BubbleContent className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            <span className="text-xs text-muted-foreground">Streaming response...</span>
          </BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  );
}

function ChatInner() {
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
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = React.useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  React.useEffect(() => {
    scrollToBottom();
  }, [messages, markers, scrollToBottom]);

  const handleSend = async (text: string) => {
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

    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: messages }),
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

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantPlaceholder.id ? { ...m, isStreaming: false } : m
        )
      );
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
            ? { ...m, content: "Error: Unable to reach Hermes backend.", isStreaming: false }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-[100dvh] flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
            <Bot className="size-4 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-semibold">Hermes Agent</h1>
            <p className="text-xs text-muted-foreground">PWA Reference Implementation</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" />
            Online
          </Button>
        </div>
      </header>

      <PushNotifications />

      {/* Messages */}
      <MessageScroller className="flex-1">
        <MessageScrollerViewport>
          <MessageScrollerContent className="px-4 pt-4 pb-4">
            {markers.map((marker) => (
              <MessageScrollerItem key={marker.id} scrollAnchor={!!marker.timestamp}>
                <Marker variant={marker.type === "system" ? "border" : "default"}>
                  <MarkerIcon>
                    <Square className="size-3" />
                  </MarkerIcon>
                  <MarkerContent>{marker.content}</MarkerContent>
                </Marker>
              </MessageScrollerItem>
            ))}

            {messages.map((msg) => (
              <MessageScrollerItem key={msg.id} scrollAnchor={msg.role === "user"}>
                <Message align={msg.role === "user" ? "end" : "start"}>
                  <MessageHeader>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {msg.role === "user" ? (
                        <><User className="size-3" /> You</>
                      ) : (
                        <><Bot className="size-3" /> Hermes</>
                      )}
                    </span>
                  </MessageHeader>
                  <MessageContent>
                    <BubbleGroup>
                      <Bubble variant={msg.role === "user" ? "default" : "muted"} align={msg.role === "user" ? "end" : "start"}>
                        <BubbleContent>
                          <div className={cn("whitespace-pre-wrap", msg.isStreaming && "animate-pulse")}>
                            {msg.content}
                            {msg.isStreaming && <span className="ml-1 inline-block size-1.5 animate-pulse rounded-full bg-primary" />}
                          </div>
                          {msg.attachments && msg.attachments.length > 0 && (
                            <AttachmentGroup className="mt-2">
                              {msg.attachments.map((att) => (
                                <Attachment key={att.id} state="done">
                                  <AttachmentMedia variant="icon">
                                    <Paperclip className="size-4" />
                                  </AttachmentMedia>
                                  <AttachmentContent>
                                    <AttachmentTitle>{att.name}</AttachmentTitle>
                                    {att.size && <AttachmentDescription>{att.size}</AttachmentDescription>}
                                  </AttachmentContent>
                                  <AttachmentActions>
                                    <Button variant="ghost" size="icon-xs" data-slot="attachment-action">
                                      <Paperclip className="size-3" />
                                    </Button>
                                  </AttachmentActions>
                                </Attachment>
                              ))}
                            </AttachmentGroup>
                          )}
                        </BubbleContent>
                      </Bubble>
                    </BubbleGroup>
                  </MessageContent>
                </Message>
              </MessageScrollerItem>
            ))}
            {isLoading && messages[messages.length - 1]?.isStreaming && (
              <MessageScrollerItem>
                <StreamingIndicator />
              </MessageScrollerItem>
            )}
          </MessageScrollerContent>
        </MessageScrollerViewport>

        {/* Scroll controls */}
        <MessageScrollerButton direction="end" />
      </MessageScroller>

      {/* Input */}
      <div className="border-t bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <ChatInput onSend={handleSend} disabled={isLoading} />
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Press Enter to send • Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <MessageScrollerProvider defaultScrollPosition="last-anchor">
      <ChatInner />
    </MessageScrollerProvider>
  );
}
