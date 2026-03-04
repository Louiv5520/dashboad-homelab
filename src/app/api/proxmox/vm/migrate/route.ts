import { isAuthenticated } from "@/lib/auth";
import { migrateProxmoxVm } from "@/lib/proxmox-client";
import { z } from "zod";

const schema = z.object({
  vmid: z.number().int().positive(),
  target: z.string().min(1),
  online: z.boolean().optional(),
  withLocalDisks: z.boolean().optional(),
});

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Ikke logget ind." }, { status: 401 });
  }

  try {
    const input = schema.parse(await request.json());
    const task = await migrateProxmoxVm(input);
    return Response.json({ ok: true, task });
  } catch (error) {
    return Response.json({ error: `Kunne ikke migrere VM: ${(error as Error).message}` }, { status: 400 });
  }
}
