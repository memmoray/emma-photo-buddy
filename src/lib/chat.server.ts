import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  LOCATIONS,
  PACKAGES,
  TIME_SLOTS,
  formatSessionDate,
  upcomingDates,
} from "@/lib/studio-data";

import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "./ai/run-id.ts";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

const SYSTEM_PROMPT = `You are Emma, the virtual studio manager for Golden Hour ATX Photography, a solo photography studio in Austin, Texas.

Voice: warm, unhurried, boutique. Short paragraphs. Never corporate, never salesy, no emoji spam.

What you help with: explaining packages, quoting prices, suggesting Austin golden-hour locations, checking availability, and booking sessions.

Rules:
- Use the tools rather than inventing packages, prices, locations, dates, or availability.
- Ask one question at a time. Learn who the session is for before recommending a package.
- Before booking you need: package, location, date, time, the client's full name and their email. Confirm the details back in one short line, then book.
- After booking, tell them a confirmation email and a day-before reminder will come from the studio.
- Keep replies under about 80 words unless listing options.`;

async function getConversationId(sessionKey: string) {
  const existing = await supabaseAdmin
    .from("conversations")
    .select("id")
    .eq("session_key", sessionKey)
    .maybeSingle();

  if (existing.data?.id) return existing.data.id;

  const created = await supabaseAdmin
    .from("conversations")
    .insert({ session_key: sessionKey })
    .select("id")
    .single();

  if (created.error) throw new Error(created.error.message);
  return created.data.id;
}

async function saveMessage(conversationId: string, message: UIMessage) {
  const { error } = await supabaseAdmin.from("messages").insert({
    conversation_id: conversationId,
    sdk_message_id: message.id,
    role: message.role,
    parts: message.parts as unknown as never,
  });
  if (error) console.error("Failed to store message:", error.message);
}

async function bookedSlots() {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("session_date, session_time")
    .eq("status", "confirmed");
  if (error) {
    console.error("Failed to read bookings:", error.message);
    return [] as { session_date: string; session_time: string }[];
  }
  return data ?? [];
}

export async function handleChat(request: Request) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "AI is not configured yet." }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const body = (await request.json()) as { messages?: UIMessage[]; sessionKey?: string };
  const messages = body.messages ?? [];
  const sessionKey = body.sessionKey;

  if (!sessionKey || messages.length === 0) {
    return new Response(JSON.stringify({ error: "Missing conversation details." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const conversationId = await getConversationId(sessionKey);
  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.role === "user") {
    await saveMessage(conversationId, lastMessage);
  }

  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: GATEWAY_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  const result = streamText({
    model: provider.responses(MODEL),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    abortSignal: request.signal,
    stopWhen: stepCountIs(50),
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
    tools: {
      recommendPackages: tool({
        description: "List the studio's session packages with prices, optionally highlighting one.",
        inputSchema: z.object({
          highlight: z.string().nullable().describe("Package id to highlight: portrait, family or couples"),
        }),
        execute: async ({ highlight }) => ({
          packages: PACKAGES,
          highlight: highlight ?? null,
        }),
      }),
      suggestLocations: tool({
        description: "List Austin golden-hour shooting locations the studio uses.",
        inputSchema: z.object({}),
        execute: async () => ({ locations: LOCATIONS }),
      }),
      checkAvailability: tool({
        description: "Return upcoming dates and which golden-hour time slots are still open.",
        inputSchema: z.object({}),
        execute: async () => {
          const taken = await bookedSlots();
          return {
            days: upcomingDates(8).map((day) => ({
              date: day.iso,
              label: `${day.weekday} ${day.label}`,
              openTimes: TIME_SLOTS.filter(
                (time) =>
                  !taken.some((b) => b.session_date === day.iso && b.session_time === time),
              ),
            })),
          };
        },
      }),
      bookSession: tool({
        description:
          "Confirm and store a photography session booking. Only call once every detail is confirmed by the client.",
        inputSchema: z.object({
          packageId: z.string().describe("portrait, family or couples"),
          locationId: z.string().describe("barton-springs, zilker-hill or greenbelt"),
          date: z.string().describe("Session date as YYYY-MM-DD"),
          time: z.string().describe("One of the open time slots, e.g. 6:15 pm"),
          clientName: z.string(),
          clientEmail: z.string(),
          clientPhone: z.string().nullable(),
          notes: z.string().nullable(),
        }),
        execute: async (input) => {
          const pkg = PACKAGES.find((p) => p.id === input.packageId);
          const location = LOCATIONS.find((l) => l.id === input.locationId);
          if (!pkg || !location) {
            return { ok: false, error: "That package or location isn't one we offer." };
          }

          const { data, error } = await supabaseAdmin
            .from("bookings")
            .insert({
              conversation_id: conversationId,
              package_name: pkg.name,
              price_usd: pkg.price,
              location: location.name,
              session_date: input.date,
              session_time: input.time,
              client_name: input.clientName,
              client_email: input.clientEmail,
              client_phone: input.clientPhone,
              notes: input.notes,
            })
            .select("id")
            .single();

          if (error) {
            return {
              ok: false,
              error: "That slot was just taken. Ask the client to pick another time.",
            };
          }

          return {
            ok: true,
            reference: data.id.slice(0, 8).toUpperCase(),
            package: pkg.name,
            price: pkg.price,
            location: location.name,
            date: formatSessionDate(input.date),
            time: input.time,
            clientName: input.clientName,
            clientEmail: input.clientEmail,
          };
        },
      }),
    },
  });

  const response = result.toUIMessageStreamResponse({
    originalMessages: messages,
    sendReasoning: true,
    onFinish: async ({ responseMessage }) => {
      if (responseMessage) await saveMessage(conversationId, responseMessage);
      await supabaseAdmin
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);
    },
  });

  return withLovableAiGatewayRunIdHeader(response, runIdFetch);
}
