import { isAuthenticated } from "@/lib/auth";
import { listClusterNodes, listClusterRoles, listClusterUsers } from "@/lib/proxmox-client";

export async function GET(request: Request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Ikke logget ind." }, { status: 401 });
  }
  try {
    const url = new URL(request.url);
    const section = url.searchParams.get("section") ?? "all";

    if (section === "nodes") {
      return Response.json({ ok: true, nodes: await listClusterNodes() });
    }
    if (section === "users") {
      return Response.json({ ok: true, users: await listClusterUsers() });
    }
    if (section === "roles") {
      return Response.json({ ok: true, roles: await listClusterRoles() });
    }

    const [nodes, users, roles] = await Promise.all([
      listClusterNodes(),
      listClusterUsers(),
      listClusterRoles(),
    ]);
    return Response.json({ ok: true, nodes, users, roles });
  } catch (error) {
    return Response.json({ error: `Kunne ikke hente cluster data: ${(error as Error).message}` }, { status: 400 });
  }
}
