import { auth } from "@/auth";
import { isCustomIdAvailable } from "@/lib/birthday-profile";

export async function GET(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const customId = new URL(request.url).searchParams
    .get("customId")
    ?.trim()
    .toLowerCase();
  if (!customId || !/^[a-z0-9_]{3,20}$/.test(customId)) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }

  const available = await isCustomIdAvailable(customId, session.user.id);
  return Response.json({ available }, { headers: { "Cache-Control": "no-store" } });
}
