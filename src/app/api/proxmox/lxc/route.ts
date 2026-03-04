import { isAuthenticated } from "@/lib/auth";
import { createProxmoxLxc, deleteProxmoxLxc, updateProxmoxLxc } from "@/lib/proxmox-client";
import { z } from "zod";

const createSchema = z.object({
  vmid: z.number().int().positive(),
  hostname: z.string().min(2),
  cores: z.number().int().min(1).max(64),
  memory: z.number().int().min(128),
  rootfs: z.string().min(3),
  net0: z.string().min(3),
  ostemplate: z.string().min(3),
  unprivileged: z.boolean().optional(),
  onboot: z.boolean().optional(),
  password: z.string().min(1).optional(),
});

const updateSchema = z.object({
  vmid: z.number().int().positive(),
  hostname: z.string().min(2).optional(),
  cores: z.number().int().min(1).max(64).optional(),
  memory: z.number().int().min(128).optional(),
  onboot: z.boolean().optional(),
});

const deleteSchema = z.object({
  vmid: z.number().int().positive(),
  purge: z.boolean().optional(),
});

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Ikke logget ind." }, { status: 401 });
  }
  try {
    const input = createSchema.parse(await request.json());
    const task = await createProxmoxLxc(input);
    return Response.json({ ok: true, task });
  } catch (error) {
    return Response.json({ error: `Kunne ikke oprette LXC: ${(error as Error).message}` }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Ikke logget ind." }, { status: 401 });
  }
  try {
    const input = updateSchema.parse(await request.json());
    const task = await updateProxmoxLxc(input);
    return Response.json({ ok: true, task });
  } catch (error) {
    return Response.json({ error: `Kunne ikke opdatere LXC: ${(error as Error).message}` }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Ikke logget ind." }, { status: 401 });
  }
  try {
    const input = deleteSchema.parse(await request.json());
    const task = await deleteProxmoxLxc(input.vmid, input.purge ?? true);
    return Response.json({ ok: true, task });
  } catch (error) {
    return Response.json({ error: `Kunne ikke slette LXC: ${(error as Error).message}` }, { status: 400 });
  }
}
