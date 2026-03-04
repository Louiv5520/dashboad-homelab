import { isAuthenticated } from "@/lib/auth";
import { getTaskLog, getTaskStatus, listNodeTasks } from "@/lib/proxmox-client";
import { z } from "zod";

const limitSchema = z.coerce.number().int().min(1).max(200);

export async function GET(request: Request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Ikke logget ind." }, { status: 401 });
  }
  try {
    const url = new URL(request.url);
    const upid = url.searchParams.get("upid");
    const withLog = url.searchParams.get("withLog") === "1";

    if (upid) {
      const status = await getTaskStatus(upid);
      const log = withLog ? await getTaskLog(upid) : [];
      return Response.json({ ok: true, status, log });
    }

    const limit = limitSchema.parse(url.searchParams.get("limit") ?? "50");
    const tasks = await listNodeTasks(limit);
    return Response.json({ ok: true, tasks });
  } catch (error) {
    return Response.json({ error: `Kunne ikke hente tasks: ${(error as Error).message}` }, { status: 400 });
  }
}
