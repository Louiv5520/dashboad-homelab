import { isAuthenticated } from "@/lib/auth";
import { cloneProxmoxLxc } from "@/lib/proxmox-client";
import { z } from "zod";

const schema = z.object({
  vmid: z.number().int().positive(),
  newid: z.number().int().positive(),
  hostname: z.string().min(2).optional(),
  target: z.string().min(1).optional(),
  full: z.boolean().optional(),
});

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Ikke logget ind." }, { status: 401 });
  }
  try {
    const input = schema.parse(await request.json());
    const task = await cloneProxmoxLxc(input);
    return Response.json({ ok: true, task });
  } catch (error) {
    return Response.json({ error: `Kunne ikke clone LXC: ${(error as Error).message}` }, { status: 400 });
  }
}
