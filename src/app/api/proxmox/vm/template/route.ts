import { isAuthenticated } from "@/lib/auth";
import { makeVmTemplate } from "@/lib/proxmox-client";
import { z } from "zod";

const schema = z.object({
  vmid: z.number().int().positive(),
});

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Ikke logget ind." }, { status: 401 });
  }

  try {
    const input = schema.parse(await request.json());
    const task = await makeVmTemplate(input);
    return Response.json({ ok: true, task });
  } catch (error) {
    return Response.json({ error: `Kunne ikke konvertere til template: ${(error as Error).message}` }, { status: 400 });
  }
}
