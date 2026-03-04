import { isAuthenticated } from "@/lib/auth";
import { listNodeStorages, listStorageContent } from "@/lib/proxmox-client";
import { z } from "zod";

const storageSchema = z.string().min(1);

export async function GET(request: Request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Ikke logget ind." }, { status: 401 });
  }
  try {
    const url = new URL(request.url);
    const storage = url.searchParams.get("storage");

    if (!storage) {
      const storages = await listNodeStorages();
      return Response.json({ ok: true, storages });
    }

    const selectedStorage = storageSchema.parse(storage);
    const content = await listStorageContent(selectedStorage);
    return Response.json({ ok: true, storage: selectedStorage, content });
  } catch (error) {
    return Response.json({ error: `Kunne ikke hente storage data: ${(error as Error).message}` }, { status: 400 });
  }
}
