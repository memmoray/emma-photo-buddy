import { useChat } from "@ai-sdk/react";
import { useQuery } from "@tanstack/react-query";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarCheck, Camera, Check, MapPin, RotateCcw } from "lucide-react";

import emmaPortrait from "@/assets/emma.jpg";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import type { StudioLocation, StudioPackage } from "@/lib/studio-data";
import { useSessionKey } from "@/lib/session";
import { loadConversation } from "@/lib/studio.functions";

const OPENERS = [
  "What packages do you offer?",
  "Where should we shoot in Austin?",
  "What's open this weekend?",
];

function PackageResult({ output }: { output: { packages: StudioPackage[]; highlight: string | null } }) {
  return (
    <div className="flex flex-wrap gap-2">
      {output.packages.map((pkg) => (
        <span
          key={pkg.id}
          className={
            output.highlight === pkg.id
              ? "rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary"
              : "rounded-full border border-border bg-cream px-3 py-1.5 text-xs font-medium"
          }
        >
          {pkg.name} · ${pkg.price}
        </span>
      ))}
    </div>
  );
}

function LocationResult({ output }: { output: { locations: StudioLocation[] } }) {
  return (
    <ul className="space-y-1.5">
      {output.locations.map((loc) => (
        <li key={loc.id} className="flex items-start gap-2 text-xs">
          <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <span>
            <span className="font-medium">{loc.name}</span>{" "}
            <span className="text-muted-foreground">{loc.blurb}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function AvailabilityResult({
  output,
}: {
  output: { days: { date: string; label: string; openTimes: string[] }[] };
}) {
  return (
    <div className="space-y-2">
      {output.days.slice(0, 4).map((day) => (
        <div key={day.date} className="flex flex-wrap items-center gap-2 text-xs">
          <span className="w-20 shrink-0 font-mono uppercase tracking-[0.14em] text-muted-foreground">
            {day.label}
          </span>
          {day.openTimes.map((time) => (
            <span key={time} className="rounded-full border border-border bg-cream px-2.5 py-1">
              {time}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function BookingResult({ output }: { output: Record<string, unknown> }) {
  if (!output.ok) {
    return <p className="text-xs text-destructive">{String(output.error ?? "Booking failed.")}</p>;
  }
  return (
    <div className="flex items-start gap-2 text-xs">
      <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
      <span>
        <span className="font-medium">{String(output.package)}</span> · {String(output.location)} ·{" "}
        {String(output.date)} at {String(output.time)} · ref {String(output.reference)}
      </span>
    </div>
  );
}

const TOOL_LABELS: Record<string, { label: string; icon: typeof Camera }> = {
  "tool-recommendPackages": { label: "Looking at packages", icon: Camera },
  "tool-suggestLocations": { label: "Picking locations", icon: MapPin },
  "tool-checkAvailability": { label: "Checking the calendar", icon: CalendarCheck },
  "tool-bookSession": { label: "Reserving the session", icon: Check },
};

function ToolPartView({ part }: { part: Record<string, unknown> }) {
  const type = String(part.type);
  const meta = TOOL_LABELS[type];
  const state = part.state as
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error"
    | undefined;
  const output = part.output as Record<string, unknown> | undefined;

  return (
    <Tool defaultOpen={false} className="border-border bg-cream/70">
      <ToolHeader
        title={meta?.label ?? type.replace("tool-", "")}
        type={type as never}
        state={state ?? "input-available"}
      />
      <ToolContent>
        <ToolInput input={part.input} />
        <ToolOutput
          errorText={part.errorText as string | undefined}
          output={
            output ? (
              type === "tool-recommendPackages" ? (
                <PackageResult output={output as never} />
              ) : type === "tool-suggestLocations" ? (
                <LocationResult output={output as never} />
              ) : type === "tool-checkAvailability" ? (
                <AvailabilityResult output={output as never} />
              ) : (
                <BookingResult output={output} />
              )
            ) : undefined
          }
        />
      </ToolContent>
    </Tool>
  );
}

function ChatSurface({
  sessionKey,
  initialMessages,
  onReset,
  onBookingChange,
}: {
  sessionKey: string;
  initialMessages: UIMessage[];
  onReset: () => void;
  onBookingChange: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat", body: { sessionKey } }),
    [sessionKey],
  );

  const { messages, sendMessage, status, stop } = useChat({
    id: sessionKey,
    messages: initialMessages,
    transport,
    onError: (err) => setError(err.message || "Emma couldn't reply just now."),
    onFinish: () => onBookingChange(),
  });

  const busy = status === "submitted" || status === "streaming";

  const focusComposer = useCallback(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    focusComposer();
  }, [focusComposer, sessionKey]);

  useEffect(() => {
    if (!busy) focusComposer();
  }, [busy, focusComposer]);

  const send = (text: string) => {
    if (!text.trim() || busy) return;
    setError(null);
    sendMessage({ text });
  };

  useEffect(() => {
    const onAsk = (event: Event) => {
      const text = (event as CustomEvent<string>).detail;
      if (!text || busy) return;
      setError(null);
      sendMessage({ text });
      focusComposer();
    };
    window.addEventListener("emma:ask", onAsk);
    return () => window.removeEventListener("emma:ask", onAsk);
  }, [busy, focusComposer, sendMessage]);

  const handleSubmit = (message: PromptInputMessage) => {
    send(message.text ?? "");
  };

  return (
    <div className="rounded-3xl border border-border/80 bg-cream/60 p-5 ring-1 ring-foreground/5 backdrop-blur-xl md:p-6">
      <div className="flex items-center justify-between border-b border-border/70 pb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={emmaPortrait}
              alt="Emma, studio manager at Golden Hour ATX"
              width={40}
              height={40}
              loading="lazy"
              className="size-10 rounded-full object-cover"
            />
            <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-primary ring-2 ring-cream" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-medium">Emma</p>
            <p className="text-[11px] text-muted-foreground">Online now</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
        >
          <RotateCcw className="size-3" />
          Start new session
        </button>
      </div>

      <Conversation className="h-[26rem]">
        <ConversationContent className="px-0 py-5">
          {messages.length === 0 ? (
            <div className="flex gap-3 animate-soft">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/15 font-display text-sm italic text-primary">
                E
              </span>
              <p className="max-w-[80%] rounded-2xl rounded-tl-sm border border-border/60 bg-cream px-4 py-3 text-sm leading-relaxed">
                Hi! I'm Emma. Tell me a little about the session you have in mind and I'll point you
                to the right package.
              </p>
            </div>
          ) : null}

          {messages.map((message) => (
            <Message key={message.id} from={message.role} className="gap-3">
              {message.role === "assistant" ? (
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/15 font-display text-sm italic text-primary">
                  E
                </span>
              ) : null}
              <MessageContent
                className={
                  message.role === "user"
                    ? "max-w-[80%] rounded-2xl rounded-tr-sm bg-foreground px-4 py-3 text-sm leading-relaxed text-cream"
                    : "max-w-[85%] space-y-3 bg-transparent px-0 py-0 text-sm leading-relaxed"
                }
              >
                {message.parts.map((part, index) => {
                  if (part.type === "text") {
                    return message.role === "user" ? (
                      <span key={index}>{part.text}</span>
                    ) : (
                      <MessageResponse
                        key={index}
                        className="rounded-2xl rounded-tl-sm border border-border/60 bg-cream px-4 py-3"
                      >
                        {part.text}
                      </MessageResponse>
                    );
                  }
                  if (part.type.startsWith("tool-")) {
                    return <ToolPartView key={index} part={part as never} />;
                  }
                  return null;
                })}
              </MessageContent>
            </Message>
          ))}

          {status === "submitted" ? (
            <div className="flex gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/15 font-display text-sm italic text-primary">
                E
              </span>
              <Shimmer className="py-2 text-sm">Emma is thinking…</Shimmer>
            </div>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {messages.length === 0 ? (
        <div className="flex flex-wrap gap-2 pb-4">
          {OPENERS.map((opener) => (
            <button
              key={opener}
              type="button"
              onClick={() => send(opener)}
              className="rounded-full border border-border bg-cream px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/40 hover:text-primary"
            >
              {opener}
            </button>
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="pb-3 text-xs text-destructive">
          {error} You can send your message again in a moment.
        </p>
      ) : null}

      <div className="border-t border-border/70 pt-4">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputTextarea
            ref={textareaRef}
            placeholder="Type a message to Emma…"
            autoFocus
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit size="icon-sm" status={status} onClick={busy ? () => stop() : undefined} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}

export function EmmaChat({ onBookingChange }: { onBookingChange: () => void }) {
  const { sessionKey, reset } = useSessionKey();

  const history = useQuery({
    queryKey: ["conversation", sessionKey],
    queryFn: () => loadConversation({ data: { sessionKey: sessionKey as string } }),
    enabled: Boolean(sessionKey),
  });

  if (!sessionKey || history.isLoading || !history.data) {
    return (
      <div className="flex h-[36rem] items-center justify-center rounded-3xl border border-border/80 bg-cream/60 ring-1 ring-foreground/5 backdrop-blur-xl">
        <Shimmer className="text-sm">Waking Emma up…</Shimmer>
      </div>
    );
  }

  return (
    <ChatSurface
      key={sessionKey}
      sessionKey={sessionKey}
      initialMessages={history.data.messages}
      onReset={() => {
        reset();
        onBookingChange();
      }}
      onBookingChange={onBookingChange}
    />
  );
}
