import { createServerFn } from "@tanstack/react-start";
import type { UIMessage } from "ai";
import { z } from "zod";

import { TIME_SLOTS, upcomingDates } from "@/lib/studio-data";

const sessionSchema = z.object({ sessionKey: z.string() });

export type BookingSummary = {
  reference: string;
  packageName: string;
  price: number;
  location: string;
  date: string;
  time: string;
  clientName: string;
  clientEmail: string;
};

export type AvailabilityDay = {
  date: string;
  weekday: string;
  label: string;
  times: { time: string; open: boolean }[];
};

export const loadConversation = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => sessionSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const conversation = await supabaseAdmin
      .from("conversations")
      .select("id")
      .eq("session_key", data.sessionKey)
      .maybeSingle();

    if (!conversation.data?.id) return { messagesJson: "[]" };

    const { data: rows, error } = await supabaseAdmin
      .from("messages")
      .select("id, sdk_message_id, role, parts")
      .eq("conversation_id", conversation.data.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to load messages:", error.message);
      return { messagesJson: "[]" };
    }

    const messages = (rows ?? []).map((row) => ({
      id: row.sdk_message_id ?? row.id,
      role: row.role as UIMessage["role"],
      parts: (row.parts ?? []) as UIMessage["parts"],
    })) as UIMessage[];

    return { messagesJson: JSON.stringify(messages) };
  });

export const getAvailability = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: taken } = await supabaseAdmin
    .from("bookings")
    .select("session_date, session_time")
    .eq("status", "confirmed");

  const days: AvailabilityDay[] = upcomingDates(8).map((day) => ({
    date: day.iso,
    weekday: day.weekday,
    label: day.label,
    times: TIME_SLOTS.map((time) => ({
      time,
      open: !(taken ?? []).some((b) => b.session_date === day.iso && b.session_time === time),
    })),
  }));

  return { days };
});

export const getLatestBooking = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => sessionSchema.parse(data))
  .handler(async ({ data }): Promise<{ booking: BookingSummary | null }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { formatSessionDate } = await import("@/lib/studio-data");

    const conversation = await supabaseAdmin
      .from("conversations")
      .select("id")
      .eq("session_key", data.sessionKey)
      .maybeSingle();

    if (!conversation.data?.id) return { booking: null };

    const { data: row } = await supabaseAdmin
      .from("bookings")
      .select("*")
      .eq("conversation_id", conversation.data.id)
      .eq("status", "confirmed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row) return { booking: null };

    return {
      booking: {
        reference: row.id.slice(0, 8).toUpperCase(),
        packageName: row.package_name,
        price: row.price_usd,
        location: row.location,
        date: formatSessionDate(row.session_date),
        time: row.session_time,
        clientName: row.client_name,
        clientEmail: row.client_email,
      },
    };
  });
