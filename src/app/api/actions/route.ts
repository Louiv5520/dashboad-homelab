import { isAuthenticated } from "@/lib/auth";
import { runDockerAction } from "@/lib/docker-client";
import { runProxmoxAction } from "@/lib/proxmox-client";
import { z } from "zod";

const schema = z.object({
  id: z.string().min(1),
  source: z.enum(["docker", "proxmox"]),
  action: z.enum(["start", "stop", "restart", "shutdown", "reset", "suspend", "resume"]),
});

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Ikke logget ind." }, { status: 401 });
  }

  try {
    const input = schema.parse(await request.json());

    if (input.source === "docker") {
      const dockerActions = ["start", "stop", "restart"] as const;
      if (!dockerActions.includes(input.action as (typeof dockerActions)[number])) {
        throw new Error("Docker understøtter kun start/stop/restart.");
      }
      await runDockerAction(input.id, input.action as (typeof dockerActions)[number]);
    } else {
      await runProxmoxAction(input.id, input.action);
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: `Kunne ikke udføre handling: ${(error as Error).message}` },
      { status: 400 }
    );
  }
}
