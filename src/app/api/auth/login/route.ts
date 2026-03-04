import { createSession, setSessionCookie, verifyLogin } from "@/lib/auth";
import { z } from "zod";

const bodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const payload = bodySchema.parse(await request.json());
    const valid = verifyLogin(payload.username, payload.password);

    if (!valid) {
      return Response.json({ error: "Forkert brugernavn eller kode." }, { status: 401 });
    }

    const token = await createSession(payload.username);
    await setSessionCookie(token);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Kunne ikke logge ind." }, { status: 400 });
  }
}
