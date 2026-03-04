import { isAuthenticated } from "@/lib/auth";
import { createSnapshot, deleteSnapshot, listSnapshots, rollbackSnapshot } from "@/lib/proxmox-client";
import { z } from "zod";

const vmidSchema = z.coerce.number().int().positive();
const createSchema = z.object({
  vmid: z.number().int().positive(),
  snapname: z.string().min(1),
  description: z.string().optional(),
});
const actionSchema = z.object({
  vmid: z.number().int().positive(),
  snapname: z.string().min(1),
  mode: z.enum(["rollback", "delete"]),
});

export async function GET(request: Request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Ikke logget ind." }, { status: 401 });
  }
  try {
    const url = new URL(request.url);
    const vmid = vmidSchema.parse(url.searchParams.get("vmid"));
    const snapshots = await listSnapshots("lxc", vmid);
    return Response.json({ ok: true, snapshots });
  } catch (error) {
    return Response.json({ error: `Kunne ikke hente snapshots: ${(error as Error).message}` }, { status: 400 });
  }
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Ikke logget ind." }, { status: 401 });
  }
  try {
    const input = createSchema.parse(await request.json());
    const task = await createSnapshot({ ...input, source: "lxc" });
    return Response.json({ ok: true, task });
  } catch (error) {
    return Response.json({ error: `Kunne ikke oprette snapshot: ${(error as Error).message}` }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Ikke logget ind." }, { status: 401 });
  }
  try {
    const input = actionSchema.parse(await request.json());
    const task =
      input.mode === "rollback"
        ? await rollbackSnapshot({ vmid: input.vmid, snapname: input.snapname, source: "lxc" })
        : await deleteSnapshot({ vmid: input.vmid, snapname: input.snapname, source: "lxc" });
    return Response.json({ ok: true, task });
  } catch (error) {
    return Response.json({ error: `Kunne ikke udføre snapshot handling: ${(error as Error).message}` }, { status: 400 });
  }
}
