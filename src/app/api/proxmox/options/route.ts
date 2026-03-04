import { isAuthenticated } from "@/lib/auth";
import {
  getNextVmid,
  listClusterNodes,
  listNodeNetworks,
  listNodeStorages,
  listPools,
  listStorageContent,
} from "@/lib/proxmox-client";

export async function GET(request: Request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Ikke logget ind." }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const nodeParam = (url.searchParams.get("node") || "").trim();

    const [nodes, pools, storages, nextVmid] = await Promise.all([
      listClusterNodes(),
      listPools(),
      listNodeStorages(),
      getNextVmid(),
    ]);

    const selectedNode = nodeParam || nodes.find((item) => item.status === "online")?.node || nodes[0]?.node || "";
    const networks = selectedNode ? await listNodeNetworks(selectedNode) : [];

    const bridgeOptions = networks
      .filter((item) => item.type === "bridge" && item.iface)
      .map((item) => item.iface as string);

    const isoLists = await Promise.all(
      storages
        .filter((storage) => storage.active === 1)
        .map(async (storage) => {
          try {
            const content = await listStorageContent(storage.storage, "iso");
            return content
              .filter((entry) => String(entry.content || "") === "iso")
              .map((entry) => {
                const volid = String(entry.volid || "");
                return {
                  storage: storage.storage,
                  volid,
                  label: volid || `${storage.storage}:iso`,
                };
              });
          } catch {
            return [];
          }
        })
    );

    return Response.json({
      ok: true,
      selectedNode,
      nextVmid: String(nextVmid),
      nodes: nodes.map((item) => item.node),
      pools: pools.map((item) => item.poolid),
      storages: storages.filter((item) => item.active === 1).map((item) => item.storage),
      storageStats: storages
        .filter((item) => item.active === 1)
        .map((item) => ({
          storage: item.storage,
          avail: item.avail ?? 0,
          total: item.total ?? 0,
          used: item.used ?? 0,
        })),
      bridges: bridgeOptions,
      isos: isoLists.flat(),
      presets: {
        ostype: [
          { value: "l26", label: "Linux 2.6+" },
          { value: "win11", label: "Windows 11/2022+" },
          { value: "win10", label: "Windows 10/2016/2019" },
        ],
        bios: ["seabios", "ovmf"],
        machine: ["q35", "i440fx"],
        scsihw: ["virtio-scsi-pci", "lsi", "megasas", "pvscsi"],
        cpu: ["x86-64-v2-AES", "host", "kvm64"],
        netModel: ["virtio", "e1000", "rtl8139", "vmxnet3"],
      },
    });
  } catch (error) {
    return Response.json({ error: `Kunne ikke hente VM valgmuligheder: ${(error as Error).message}` }, { status: 400 });
  }
}
