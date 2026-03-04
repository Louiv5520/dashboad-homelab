import { clearSessionCookie, isAuthenticated } from "@/lib/auth";

export async function POST() {
  if (await isAuthenticated()) {
    await clearSessionCookie();
  }

  return Response.json({ ok: true });
}
