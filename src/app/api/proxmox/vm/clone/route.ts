import { isAuthenticated } from "@/lib/auth";
import { cloneProxmoxVm } from "@/lib/proxmox-client";
import { z } from "zod";

const schema = z.object({
  vmid: z.number().int().positive(),
  newid: z.number().int().positive(),
  name: z.string().min(2).optional(),
  target: z.string().min(1).optional(),
  full: z.boolean().optional(),
  storage: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Ikke logget ind." }, { status: 401 });
  }

  try {
    const input = schema.parse(await request.json());
    const task = await cloneProxmoxVm(input);
    return Response.json({ ok: true, task });
  } catch (error) {
    return Response.json({ error: `Kunne ikke clone VM: ${(error as Error).message}` }, { status: 400 });
  }
}
