/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { createClient } from "npm:@supabase/supabase-js@2.42.7";
import type { Database, Tables } from "../../src/types";

type InboxRecord = Tables<"inbox">;
interface WebhookPayload {
  type: "UPDATE";
  table: string;
  record: InboxRecord;
  schema: "public";
  old_record: null | InboxRecord;
}

const supabase = createClient<Database>(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const model = new Supabase.ai.Session("gte-small");

function getCommaSeparatedList(data) {
  return Object.entries(data)
    .map(
      ([key, value]) =>
        `${key}: ${Array.isArray(value) ? value.join(", ") : value}`
    )
    .join(", ");
}

Deno.serve(async (req) => {
  const payload: WebhookPayload = await req.json();
  const { meta, id, status } = payload.record;

  // Check if meta data is saved, meta is saved with a async background job
  // That parses the document using Google Document AI
  // packages/jobs/src/inbox/document.ts
  if (status !== "processing" && meta) {
    return new Response("Not ready to generate embeddings");
  }

  const content = getCommaSeparatedList(meta);
  const embedding = await model.run(content, {
    mean_pool: true,
    normalize: true,
  });

  const { error } = await supabase
    .from("inbox")
    .update({
      embedding: JSON.stringify(embedding),
      status: "pending",
    })
    .eq("id", id);

  if (error) {
    console.warn(error.message);
  }

  return new Response("Updated");
});
