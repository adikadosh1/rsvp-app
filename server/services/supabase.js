import { createClient } from "@supabase/supabase-js";

function normalizeSupabaseUrl(rawUrl) {
  if (!rawUrl) return rawUrl;
  return rawUrl.replace(/\/rest\/v1\/?$/, "");
}

const supabaseUrl = normalizeSupabaseUrl(process.env.SUPABASE_URL);
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
}

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false }
});

export async function uploadInvitationImage(fileBuffer, eventId, mimeType = "image/jpeg") {
  const extension = mimeType.split("/")[1] || "jpg";
  const filePath = `${eventId}/${Date.now()}-invitation.${extension}`;

  const { error } = await supabase.storage
    .from(process.env.SUPABASE_STORAGE_BUCKET || "invitation-images")
    .upload(filePath, fileBuffer, {
      contentType: mimeType,
      upsert: false
    });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage
    .from(process.env.SUPABASE_STORAGE_BUCKET || "invitation-images")
    .getPublicUrl(filePath);

  return data.publicUrl;
}
