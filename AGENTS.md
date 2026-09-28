<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules

- Emma's AI chat runs through one TanStack server route at `src/routes/api/chat.ts` delegating to `src/lib/chat.server.ts`; all gateway keys, prompts and tools stay server-side.
- Studio catalog data (packages, locations, time slots) lives in `src/lib/studio-data.ts` so the page and the AI tools quote identical prices and names.
- Database access uses the service-role client only inside server functions/routes (`src/lib/studio.functions.ts`, `chat.server.ts`); the chat/booking tables have no public RLS policies by design.
