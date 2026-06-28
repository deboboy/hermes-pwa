"use client";

import * as React from "react";
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
} from "@/components/ui/message-scroller";
import { Message, MessageContent, MessageHeader } from "@/components/ui/message";
import { Bubble, BubbleContent, BubbleGroup } from "@/components/ui/bubble";
import {
  Attachment,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentActions,
} from "@/components/ui/attachment";
import { Marker, MarkerIcon, MarkerContent } from "@/components/ui/marker";
import { PushNotifications } from "@/components/push-notifications";
import { SearchSheet } from "@/components/search-sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChatProvider, useChat, type ChatMessage } from "@/lib/chat-context";
import { Send, Paperclip, Square, Loader2, Bot, User, Search } from "lucide-react";
import { cn } from "@/lib/utils";

function ChatInput({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled: boolean;
}) {
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
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 rounded-2xl border bg-background p-2 shadow-sm"
    >
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
      <Button
        type="submit"
        size="icon"
        disabled={!text.trim() || disabled}
        className="shrink-0 rounded-full"
      >
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

function MessageListItem({
  msg,
  highlight,
}: {
  msg: ChatMessage;
  highlight: boolean;
}) {
  return (
    <MessageScrollerItem key={msg.id} scrollAnchor={msg.role === "user"}>
      <div data-message-id={msg.id} className={cn(highlight && "rounded-lg ring-2 ring-primary/40")}>
        <Message align={msg.role === "user" ? "end" : "start"}>
          <MessageHeader>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {msg.role === "user" ? (
                <>
                  <User className="size-3" /> You
                </>
              ) : (
                <>
                  <Bot className="size-3" /> Hermes
                </>
              )}
            </span>
          </MessageHeader>
          <MessageContent>
            <BubbleGroup>
              <Bubble
                variant={msg.role === "user" ? "default" : "muted"}
                align={msg.role === "user" ? "end" : "start"}
              >
                <BubbleContent>
                  <div
                    className={cn(
                      "whitespace-pre-wrap",
                      msg.isStreaming && "animate-pulse"
                    )}
                  >
                    {msg.content}
                    {msg.isStreaming && (
                      <span className="ml-1 inline-block size-1.5 animate-pulse rounded-full bg-primary" />
                    )}
                  </div>
                </BubbleContent>
              </Bubble>
            </BubbleGroup>
          </MessageContent>
        </Message>
      </div>
    </MessageScrollerItem>
  );
}

function ChatInner() {
  const {
    messages,
    markers,
    isLoading,
    highlightMessageId,
    searchOpen,
    setSearchOpen,
    handleSend,
  } = useChat();

  return (
    <div className="flex h-[100dvh] flex-col">
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
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setSearchOpen(true)}
            aria-label="Search session history"
          >
            <Search className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" />
            Online
          </Button>
        </div>
      </header>

      <PushNotifications />

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
              <MessageListItem
                key={msg.id}
                msg={msg}
                highlight={highlightMessageId === msg.id}
              />
            ))}

            {isLoading && messages[messages.length - 1]?.isStreaming && (
              <MessageScrollerItem>
                <StreamingIndicator />
              </MessageScrollerItem>
            )}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton direction="end" />
      </MessageScroller>

      <div className="border-t bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <ChatInput onSend={handleSend} disabled={isLoading} />
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>

      <SearchSheet open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

export default function ChatPage() {
  return (
    <ChatProvider>
      <MessageScrollerProvider defaultScrollPosition="last-anchor">
        <ChatInner />
      </MessageScrollerProvider>
    </ChatProvider>
  );
}
