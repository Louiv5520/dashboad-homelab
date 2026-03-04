import { isAuthenticated } from "@/lib/auth";
import { createProxmoxVm, deleteProxmoxVm, updateProxmoxVm } from "@/lib/proxmox-client";
import { z } from "zod";

const createSchema = z.object({
  vmid: z.number().int().positive(),
  name: z.string().min(2),
  node: z.string().min(1).optional(),
  pool: z.string().min(1).optional(),
  cores: z.number().int().min(1).max(64),
  memory: z.number().int().min(256),
  sockets: z.number().int().min(1).max(8).optional(),
  cpu: z.string().min(1).optional(),
  balloon: z.number().int().min(0).optional(),
  scsi0: z.string().min(3),
  boot: z.string().min(1).optional(),
  bootdisk: z.string().min(1).optional(),
  ide2: z.string().min(1).optional(),
  net0: z.string().min(3),
  machine: z.string().min(1).optional(),
  bios: z.string().min(1).optional(),
  scsihw: z.string().min(1).optional(),
  agent: z.boolean().optional(),
  ostype: z.string().optional(),
  onboot: z.boolean().optional(),
});

const updateSchema = z.object({
  vmid: z.number().int().positive(),
  name: z.string().min(2).optional(),
  cores: z.number().int().min(1).max(64).optional(),
  memory: z.number().int().min(256).optional(),
  sockets: z.number().int().min(1).max(8).optional(),
  cpu: z.string().min(1).optional(),
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
    const task = await createProxmoxVm(input);
    return Response.json({ ok: true, task });
  } catch (error) {
    return Response.json({ error: `Kunne ikke oprette VM: ${(error as Error).message}` }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Ikke logget ind." }, { status: 401 });
  }

  try {
    const input = updateSchema.parse(await request.json());
    const task = await updateProxmoxVm(input);
    return Response.json({ ok: true, task });
  } catch (error) {
    return Response.json({ error: `Kunne ikke opdatere VM: ${(error as Error).message}` }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Ikke logget ind." }, { status: 401 });
  }

  try {
    const input = deleteSchema.parse(await request.json());
    const task = await deleteProxmoxVm(input.vmid, input.purge ?? true);
    return Response.json({ ok: true, task });
  } catch (error) {
    return Response.json({ error: `Kunne ikke slette VM: ${(error as Error).message}` }, { status: 400 });
  }
}
