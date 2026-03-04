import { isAuthenticated } from "@/lib/auth";
import { listDockerServices } from "@/lib/docker-client";
import { normalizeServices } from "@/lib/normalizer";
import { listProxmoxServices } from "@/lib/proxmox-client";
import { ServiceResponse, UnifiedService } from "@/lib/types";

export async function GET() {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Ikke logget ind." }, { status: 401 });
  }

  const errors: string[] = [];
  let proxmox: UnifiedService[] = [];
  let docker: UnifiedService[] = [];

  try {
    proxmox = await listProxmoxServices();
  } catch (error) {
    errors.push(`Proxmox: ${(error as Error).message}`);
  }

  try {
    docker = await listDockerServices();
  } catch (error) {
    errors.push(`Docker: ${(error as Error).message}`);
  }

  const response: ServiceResponse = {
    services: normalizeServices([...proxmox, ...docker]),
    errors,
    updatedAt: new Date().toISOString(),
  };

  return Response.json(response);
}
