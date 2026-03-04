"use client";

import { ServiceAction, ServiceResponse, UnifiedService } from "@/lib/types";
import { CSSProperties, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { SourceFilter, SourceFilterTabs } from "@/components/dashboard/SourceFilter";
import { ServiceTile } from "@/components/dashboard/ServiceTile";
import { ProxmoxPanels } from "@/components/dashboard/ProxmoxPanels";

type VmOptions = {
  selectedNode: string;
  nextVmid: string;
  nodes: string[];
  pools: string[];
  storages: string[];
  storageStats: Array<{ storage: string; avail: number; total: number; used: number }>;
  bridges: string[];
  isos: Array<{ storage: string; volid: string; label: string }>;
  presets: {
    ostype: Array<{ value: string; label: string }>;
    bios: string[];
    machine: string[];
    scsihw: string[];
    cpu: string[];
    netModel: string[];
  };
};

export function Dashboard() {
  const [filter, setFilter] = useState<SourceFilter>("all");
  const [services, setServices] = useState<UnifiedService[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [updatedAt, setUpdatedAt] = useState("");
  const [busyId, setBusyId] = useState("");
  const [showCreateVm, setShowCreateVm] = useState(false);
  const [showCreateContainer, setShowCreateContainer] = useState(false);
  const [showProxmoxTools, setShowProxmoxTools] = useState(false);
  const [vmWizardTab, setVmWizardTab] = useState<"general" | "os" | "system" | "disk" | "cpu" | "memory" | "network" | "confirm">("general");
  const [vmOptions, setVmOptions] = useState<VmOptions | null>(null);
  const [vmOptionsLoading, setVmOptionsLoading] = useState(false);
  const [vmForm, setVmForm] = useState({
    node: "host1",
    pool: "",
    vmid: "",
    name: "",
    ostype: "l26",
    ide2: "",
    machine: "q35",
    bios: "seabios",
    scsihw: "virtio-scsi-pci",
    agent: true,
    scsi0: "local-lvm:32",
    diskStorage: "local-lvm",
    diskSize: "32",
    boot: "order=scsi0;ide2;net0",
    bootdisk: "scsi0",
    cores: "2",
    sockets: "1",
    cpu: "x86-64-v2-AES",
    memory: "4096",
    balloon: "0",
    netModel: "virtio",
    bridge: "vmbr0",
    vlanTag: "",
    networkFirewall: false,
    net0: "",
    onboot: true,
  });
  const [containerForm, setContainerForm] = useState({
    name: "",
    image: "n8nio/n8n:latest",
    ports: "",
    env: "",
    cmd: "",
    restartAlways: true,
    startAfterCreate: true,
  });
  const router = useRouter();

  const loadServices = useCallback(async () => {
    const response = await fetch("/api/services", { cache: "no-store" });
    if (response.status === 401) {
      router.push("/login");
      return;
    }
    const data = (await response.json()) as ServiceResponse;
    setServices(data.services || []);
    setErrors(data.errors || []);
    setUpdatedAt(data.updatedAt || "");
  }, [router]);

  const loadVmOptions = useCallback(
    async (node?: string) => {
      setVmOptionsLoading(true);
      try {
        const query = node ? `?node=${encodeURIComponent(node)}` : "";
        const response = await fetch(`/api/proxmox/options${query}`, { cache: "no-store" });
        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error || "Kunne ikke hente valgmuligheder.");
        }
        const data = (await response.json()) as VmOptions & { ok: boolean };
        setVmOptions(data);
        setVmForm((prev) => ({
          ...prev,
          node: prev.node || data.selectedNode,
          vmid: prev.vmid || data.nextVmid,
          pool: prev.pool || "",
          diskStorage: data.storages.includes(prev.diskStorage) ? prev.diskStorage : data.storages[0] || prev.diskStorage,
          bridge: data.bridges.includes(prev.bridge) ? prev.bridge : data.bridges[0] || prev.bridge,
        }));
      } catch (error) {
        setErrors([`Kunne ikke hente VM valg: ${(error as Error).message}`]);
      } finally {
        setVmOptionsLoading(false);
      }
    },
    [setErrors]
  );

  const selectedStorageStats = useMemo(() => {
    const stats = vmOptions?.storageStats?.find((item) => item.storage === vmForm.diskStorage);
    if (!stats) return null;
    const free = formatBytes(stats.avail);
    const total = formatBytes(stats.total);
    const usedPct = stats.total > 0 ? Math.round((stats.used / stats.total) * 100) : 0;
    return { free, total, usedPct };
  }, [vmOptions, vmForm.diskStorage]);

  async function onAction(service: UnifiedService, action: ServiceAction) {
    setBusyId(`${service.id}:${action}`);
    const response = await fetch("/api/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: service.id, source: service.source, action }),
    });
    setBusyId("");
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setErrors([data.error || "Handling fejlede."]);
      return;
    }
    await loadServices();
  }

  async function createVm() {
    const builtNet0Parts = [`${vmForm.netModel}`, `bridge=${vmForm.bridge}`];
    if (vmForm.vlanTag.trim()) builtNet0Parts.push(`tag=${vmForm.vlanTag.trim()}`);
    if (vmForm.networkFirewall) builtNet0Parts.push("firewall=1");
    const builtNet0 = builtNet0Parts.join(",");
    const builtScsi0 = vmForm.scsi0.trim() || `${vmForm.diskStorage}:${vmForm.diskSize}`;

    const response = await fetch("/api/proxmox/vm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        node: vmForm.node || undefined,
        pool: vmForm.pool || undefined,
        vmid: Number(vmForm.vmid),
        name: vmForm.name,
        cores: Number(vmForm.cores),
        memory: Number(vmForm.memory),
        balloon: vmForm.balloon.trim() === "" ? undefined : Number(vmForm.balloon),
        sockets: Number(vmForm.sockets),
        cpu: vmForm.cpu,
        scsi0: builtScsi0,
        boot: vmForm.boot || undefined,
        bootdisk: vmForm.bootdisk || undefined,
        ide2: vmForm.ide2 || undefined,
        net0: vmForm.net0.trim() || builtNet0,
        machine: vmForm.machine,
        bios: vmForm.bios,
        scsihw: vmForm.scsihw,
        agent: vmForm.agent,
        ostype: vmForm.ostype,
        onboot: vmForm.onboot,
      }),
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setErrors([data.error || "VM kunne ikke oprettes."]);
      return;
    }
    setShowCreateVm(false);
    setVmWizardTab("general");
    await loadServices();
  }

  async function createContainer() {
    const payload = {
      name: containerForm.name,
      image: containerForm.image,
      ports: containerForm.ports || undefined,
      env: containerForm.env || undefined,
      cmd: containerForm.cmd || undefined,
      restartAlways: containerForm.restartAlways,
      startAfterCreate: containerForm.startAfterCreate,
    };

    const response = await fetch("/api/docker/containers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setErrors([data.error || "Container kunne ikke oprettes."]);
      return;
    }
    setShowCreateContainer(false);
    await loadServices();
  }

  async function editVm(service: UnifiedService) {
    const vmid = Number(service.id.split("-")[2]);
    const cores = window.prompt("Nye CPU cores (fx 2):", "2");
    if (!cores) return;
    const memory = window.prompt("Ny RAM i MB (fx 4096):", "4096");
    if (!memory) return;
    const name = window.prompt("Nyt navn:", service.name);
    if (!name) return;
    const response = await fetch("/api/proxmox/vm", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vmid, name, cores: Number(cores), memory: Number(memory) }),
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setErrors([data.error || "VM kunne ikke opdateres."]);
      return;
    }
    await loadServices();
  }

  async function deleteVm(service: UnifiedService) {
    if (!window.confirm(`Slet VM '${service.name}' permanent?`)) return;
    const vmid = Number(service.id.split("-")[2]);
    const response = await fetch("/api/proxmox/vm", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vmid, purge: true }),
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setErrors([data.error || "VM kunne ikke slettes."]);
      return;
    }
    await loadServices();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  useEffect(() => {
    const firstLoad = setTimeout(() => {
      loadServices().catch(() => setErrors(["Kunne ikke hente data."]));
    }, 0);
    const timer = setInterval(() => {
      loadServices().catch(() => setErrors(["Kunne ikke hente data."]));
    }, 8000);
    return () => {
      clearTimeout(firstLoad);
      clearInterval(timer);
    };
  }, [loadServices]);

  useEffect(() => {
    if (!showCreateVm) return;
    loadVmOptions(vmForm.node).catch(() => setErrors(["Kunne ikke hente VM valgmuligheder."]));
  }, [showCreateVm, vmForm.node, loadVmOptions]);

  const isLoading = !updatedAt && services.length === 0 && errors.length === 0;
  const filtered = useMemo(
    () => (filter === "all" ? services : services.filter((service) => service.source === filter)),
    [filter, services]
  );
  const stats = useMemo(() => {
    const running = filtered.filter((item) => item.status === "running").length;
    const stopped = filtered.filter((item) => item.status === "stopped").length;
    const proxmox = filtered.filter((item) => item.source === "proxmox").length;
    const docker = filtered.filter((item) => item.source === "docker").length;
    return { running, stopped, proxmox, docker, total: filtered.length };
  }, [filtered]);

  const proxmoxItems = useMemo(() => filtered.filter((item) => item.source === "proxmox"), [filtered]);
  const dockerItems = useMemo(() => filtered.filter((item) => item.source === "docker"), [filtered]);

  return (
    <main style={page}>
      <DashboardHeader
        updatedAt={updatedAt}
        onCreateVmClick={() =>
          setShowCreateVm((value) => {
            const next = !value;
            if (next) setVmWizardTab("general");
            return next;
          })
        }
        onRefreshClick={() => void loadServices()}
        onLogoutClick={() => void logout()}
      />

      <StatsCards
        total={stats.total}
        running={stats.running}
        stopped={stats.stopped}
        proxmox={stats.proxmox}
        docker={stats.docker}
      />

      <SourceFilterTabs filter={filter} onChange={setFilter} />

      {errors.length > 0 && (
        <section style={errorBox}>
          {errors.map((error) => (
            <p key={error} style={{ margin: "4px 0" }}>
              {error}
            </p>
          ))}
        </section>
      )}

      {isLoading ? (
        <section style={panel}>Henter data...</section>
      ) : filtered.length === 0 ? (
        <section style={panel}>Ingen services fundet.</section>
      ) : (
        <>
          {(filter === "all" || filter === "proxmox") && (
            <section style={{ marginBottom: 16 }}>
              <div style={sourceHeader}>
                <h2 style={sourceTitle}>Proxmox</h2>
                <span style={sourceCount}>{proxmoxItems.length} enheder</span>
              </div>
              <div style={cardGrid}>
                {proxmoxItems.map((service) => (
                  <ServiceTile key={service.id} service={service} busyId={busyId} onAction={onAction} onEdit={editVm} onDelete={deleteVm} />
                ))}
                <article
                  className="ios-card ios-lift"
                  style={createTile}
                  onClick={() => {
                    setVmWizardTab("general");
                    setShowCreateVm(true);
                  }}
                  role="button"
                  aria-label="Opret ny VM"
                  title="Opret ny VM"
                >
                  <div style={createTileIcon}>＋</div>
                  <h3 style={createTileTitle}>Opret ny VM</h3>
                  <p style={createTileText}>Lav en ny Proxmox VM direkte fra dashboardet.</p>
                </article>
                <article
                  className="ios-card ios-lift"
                  style={createTile}
                  onClick={() => setShowProxmoxTools(true)}
                  role="button"
                  aria-label="Proxmox værktøjer"
                  title="Proxmox værktøjer"
                >
                  <div style={createTileIcon}>⚙</div>
                  <h3 style={createTileTitle}>Proxmox værktøjer</h3>
                  <p style={createTileText}>Åbn avancerede funktioner i popup-vindue.</p>
                </article>
              </div>
            </section>
          )}
          {(filter === "all" || filter === "docker") && (
            <section>
              <div style={sourceHeader}>
                <h2 style={sourceTitle}>Docker</h2>
                <span style={sourceCount}>{dockerItems.length} containere</span>
              </div>
              <div style={cardGrid}>
                {dockerItems.map((service) => (
                  <ServiceTile key={service.id} service={service} busyId={busyId} onAction={onAction} onEdit={editVm} onDelete={deleteVm} />
                ))}
                <article
                  className="ios-card ios-lift"
                  style={createTile}
                  onClick={() => setShowCreateContainer(true)}
                  role="button"
                  aria-label="Opret ny container"
                  title="Opret ny container"
                >
                  <div style={createTileIcon}>＋</div>
                  <h3 style={createTileTitle}>Opret ny container</h3>
                  <p style={createTileText}>Lav en ny container direkte fra dashboardet.</p>
                </article>
              </div>
            </section>
          )}
        </>
      )}

      {showCreateVm && (
        <Modal title="Opret ny VM" onClose={() => setShowCreateVm(false)}>
          <div style={wizardTabs}>
            {[
              ["general", "General"],
              ["os", "OS"],
              ["system", "System"],
              ["disk", "Disks"],
              ["cpu", "CPU"],
              ["memory", "Memory"],
              ["network", "Network"],
              ["confirm", "Confirm"],
            ].map(([id, label]) => (
              <button
                key={id}
                className="ios-lift"
                style={{
                  ...wizardTabBtn,
                  background: vmWizardTab === id ? "var(--ios-accent)" : "rgba(183, 206, 255, 0.14)",
                  color: vmWizardTab === id ? "white" : "var(--text)",
                }}
                onClick={() => setVmWizardTab(id as typeof vmWizardTab)}
              >
                {label}
              </button>
            ))}
          </div>

          {vmOptionsLoading && <p style={{ marginTop: 0, color: "var(--muted)" }}>Henter valg fra Proxmox...</p>}

          {vmWizardTab === "general" && (
            <div style={formGrid}>
              <select value={vmForm.node} onChange={(event) => setVmForm((prev) => ({ ...prev, node: event.target.value }))} style={inputStyle}>
                {(vmOptions?.nodes || [vmForm.node]).map((node) => (
                  <option key={node} value={node}>
                    {node}
                  </option>
                ))}
              </select>
              <select value={vmForm.pool} onChange={(event) => setVmForm((prev) => ({ ...prev, pool: event.target.value }))} style={inputStyle}>
                <option value="">Ingen pool</option>
                {(vmOptions?.pools || []).map((pool) => (
                  <option key={pool} value={pool}>
                    {pool}
                  </option>
                ))}
              </select>
              <input placeholder="VMID" value={vmForm.vmid} onChange={(event) => setVmForm((prev) => ({ ...prev, vmid: event.target.value }))} style={inputStyle} />
              <input placeholder="Navn" value={vmForm.name} onChange={(event) => setVmForm((prev) => ({ ...prev, name: event.target.value }))} style={inputStyle} />
              <label style={checkLabel}>
                <input type="checkbox" checked={vmForm.onboot} onChange={(event) => setVmForm((prev) => ({ ...prev, onboot: event.target.checked }))} />
                Start ved boot
              </label>
            </div>
          )}

          {vmWizardTab === "os" && (
            <div style={formGrid}>
              <select value={vmForm.ostype} onChange={(event) => setVmForm((prev) => ({ ...prev, ostype: event.target.value }))} style={inputStyle}>
                {(vmOptions?.presets.ostype || [{ value: "l26", label: "Linux 2.6+" }]).map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <select value={vmForm.ide2} onChange={(event) => setVmForm((prev) => ({ ...prev, ide2: event.target.value }))} style={inputStyle}>
                <option value="">Ingen ISO</option>
                {(vmOptions?.isos || []).map((iso) => (
                  <option key={iso.volid} value={`${iso.volid},media=cdrom`}>
                    {iso.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {vmWizardTab === "system" && (
            <div style={formGrid}>
              <select value={vmForm.machine} onChange={(event) => setVmForm((prev) => ({ ...prev, machine: event.target.value }))} style={inputStyle}>
                {(vmOptions?.presets.machine || ["q35", "i440fx"]).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <select value={vmForm.bios} onChange={(event) => setVmForm((prev) => ({ ...prev, bios: event.target.value }))} style={inputStyle}>
                {(vmOptions?.presets.bios || ["seabios", "ovmf"]).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <select value={vmForm.scsihw} onChange={(event) => setVmForm((prev) => ({ ...prev, scsihw: event.target.value }))} style={inputStyle}>
                {(vmOptions?.presets.scsihw || ["virtio-scsi-pci"]).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <label style={checkLabel}>
                <input type="checkbox" checked={vmForm.agent} onChange={(event) => setVmForm((prev) => ({ ...prev, agent: event.target.checked }))} />
                QEMU agent
              </label>
            </div>
          )}

          {vmWizardTab === "disk" && (
            <div style={formGrid}>
              <select value={vmForm.diskStorage} onChange={(event) => setVmForm((prev) => ({ ...prev, diskStorage: event.target.value, scsi0: "" }))} style={inputStyle}>
                {(vmOptions?.storages || [vmForm.diskStorage]).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              {selectedStorageStats && (
                <div style={storageInfo}>
                  Ledig plads: {selectedStorageStats.free} / {selectedStorageStats.total} (brugt: {selectedStorageStats.usedPct}%)
                </div>
              )}
              <input placeholder="Disk størrelse i GB (fx 32)" value={vmForm.diskSize} onChange={(event) => setVmForm((prev) => ({ ...prev, diskSize: event.target.value, scsi0: "" }))} style={inputStyle} />
              <input placeholder="Boot order (fx order=scsi0;ide2;net0)" value={vmForm.boot} onChange={(event) => setVmForm((prev) => ({ ...prev, boot: event.target.value }))} style={inputStyle} />
              <input placeholder="Boot disk (fx scsi0)" value={vmForm.bootdisk} onChange={(event) => setVmForm((prev) => ({ ...prev, bootdisk: event.target.value }))} style={inputStyle} />
              <input placeholder="Avanceret disk override (valgfri)" value={vmForm.scsi0} onChange={(event) => setVmForm((prev) => ({ ...prev, scsi0: event.target.value }))} style={inputStyle} />
            </div>
          )}

          {vmWizardTab === "cpu" && (
            <div style={formGrid}>
              <input placeholder="Sockets" value={vmForm.sockets} onChange={(event) => setVmForm((prev) => ({ ...prev, sockets: event.target.value }))} style={inputStyle} />
              <input placeholder="Cores" value={vmForm.cores} onChange={(event) => setVmForm((prev) => ({ ...prev, cores: event.target.value }))} style={inputStyle} />
              <select value={vmForm.cpu} onChange={(event) => setVmForm((prev) => ({ ...prev, cpu: event.target.value }))} style={inputStyle}>
                {(vmOptions?.presets.cpu || ["x86-64-v2-AES", "host"]).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          )}

          {vmWizardTab === "memory" && (
            <div style={formGrid}>
              <input placeholder="RAM MB" value={vmForm.memory} onChange={(event) => setVmForm((prev) => ({ ...prev, memory: event.target.value }))} style={inputStyle} />
              <input placeholder="Balloon MB (0 = slukket)" value={vmForm.balloon} onChange={(event) => setVmForm((prev) => ({ ...prev, balloon: event.target.value }))} style={inputStyle} />
            </div>
          )}

          {vmWizardTab === "network" && (
            <div style={formGrid}>
              <select value={vmForm.netModel} onChange={(event) => setVmForm((prev) => ({ ...prev, netModel: event.target.value }))} style={inputStyle}>
                {(vmOptions?.presets.netModel || ["virtio", "e1000"]).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <select value={vmForm.bridge} onChange={(event) => setVmForm((prev) => ({ ...prev, bridge: event.target.value }))} style={inputStyle}>
                {(vmOptions?.bridges || [vmForm.bridge]).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <input placeholder="VLAN tag (valgfri)" value={vmForm.vlanTag} onChange={(event) => setVmForm((prev) => ({ ...prev, vlanTag: event.target.value }))} style={inputStyle} />
              <input placeholder="Avanceret net0 override (valgfri)" value={vmForm.net0} onChange={(event) => setVmForm((prev) => ({ ...prev, net0: event.target.value }))} style={inputStyle} />
              <label style={checkLabel}>
                <input type="checkbox" checked={vmForm.networkFirewall} onChange={(event) => setVmForm((prev) => ({ ...prev, networkFirewall: event.target.checked }))} />
                Firewall på netkort
              </label>
            </div>
          )}

          {vmWizardTab === "confirm" && (
            <div style={{ ...panel, marginBottom: 0, padding: 10 }}>
              <p style={{ margin: 0, color: "var(--muted)" }}>Tjek værdierne og tryk Opret VM.</p>
              <pre style={confirmPre}>
{JSON.stringify(
  {
    node: vmForm.node,
    pool: vmForm.pool || "(ingen)",
    vmid: vmForm.vmid,
    name: vmForm.name,
    ostype: vmForm.ostype,
    ide2: vmForm.ide2 || "(ingen)",
    machine: vmForm.machine,
    bios: vmForm.bios,
    scsihw: vmForm.scsihw,
    agent: vmForm.agent,
    scsi0: vmForm.scsi0,
    boot: vmForm.boot,
    bootdisk: vmForm.bootdisk,
    sockets: vmForm.sockets,
    cores: vmForm.cores,
    cpu: vmForm.cpu,
    memory: vmForm.memory,
    balloon: vmForm.balloon,
    netModel: vmForm.netModel,
    bridge: vmForm.bridge,
    vlanTag: vmForm.vlanTag || "(ingen)",
    net0Override: vmForm.net0 || "(ingen)",
    onboot: vmForm.onboot,
  },
  null,
  2
)}</pre>
            </div>
          )}

          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className="ios-lift"
              onClick={() => {
                const order = ["general", "os", "system", "disk", "cpu", "memory", "network", "confirm"] as const;
                const current = order.indexOf(vmWizardTab);
                setVmWizardTab(order[Math.max(0, current - 1)]);
              }}
              style={buttonGhost}
            >
              Tilbage
            </button>
            <button
              className="ios-lift"
              onClick={() => {
                const order = ["general", "os", "system", "disk", "cpu", "memory", "network", "confirm"] as const;
                const current = order.indexOf(vmWizardTab);
                setVmWizardTab(order[Math.min(order.length - 1, current + 1)]);
              }}
              style={buttonGhost}
            >
              Næste
            </button>
            <button className="ios-lift" onClick={() => void createVm()} style={buttonPrimary}>
              Opret VM
            </button>
          </div>
        </Modal>
      )}

      {showCreateContainer && (
        <Modal title="Opret ny container" onClose={() => setShowCreateContainer(false)}>
          <div style={formGrid}>
            <input placeholder="Navn (fx n8n)" value={containerForm.name} onChange={(event) => setContainerForm((prev) => ({ ...prev, name: event.target.value }))} style={inputStyle} />
            <input placeholder="Image (fx n8nio/n8n:latest)" value={containerForm.image} onChange={(event) => setContainerForm((prev) => ({ ...prev, image: event.target.value }))} style={inputStyle} />
            <input placeholder="Porte (fx 5678:5678)" value={containerForm.ports} onChange={(event) => setContainerForm((prev) => ({ ...prev, ports: event.target.value }))} style={inputStyle} />
            <input placeholder="Kommando (valgfri)" value={containerForm.cmd} onChange={(event) => setContainerForm((prev) => ({ ...prev, cmd: event.target.value }))} style={inputStyle} />
            <textarea placeholder="Miljøvariabler (en pr. linje, fx KEY=value)" value={containerForm.env} onChange={(event) => setContainerForm((prev) => ({ ...prev, env: event.target.value }))} style={{ ...inputStyle, minHeight: 100, resize: "vertical", gridColumn: "1 / -1" }} />
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={containerForm.restartAlways} onChange={(event) => setContainerForm((prev) => ({ ...prev, restartAlways: event.target.checked }))} />
              Genstart automatisk
            </label>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={containerForm.startAfterCreate} onChange={(event) => setContainerForm((prev) => ({ ...prev, startAfterCreate: event.target.checked }))} />
              Start med det samme
            </label>
          </div>
          <div style={{ marginTop: 10 }}>
            <button className="ios-lift" onClick={() => void createContainer()} style={buttonPrimary}>
              Opret container
            </button>
          </div>
        </Modal>
      )}

      {showProxmoxTools && (
        <Modal title="Proxmox avancerede funktioner" onClose={() => setShowProxmoxTools(false)} wide>
          <ProxmoxPanels onDone={loadServices} setErrors={setErrors} />
        </Modal>
      )}
    </main>
  );
}

function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div style={modalOverlay} onClick={onClose}>
      <section
        style={{
          ...modalCard,
          maxWidth: wide ? 980 : 760,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={modalHeader}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="ios-lift" onClick={onClose} style={modalCloseBtn}>
            Luk
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 GB";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[index]}`;
}

const page: CSSProperties = {
  padding: 22,
  maxWidth: 1300,
  margin: "0 auto",
};

const errorBox: CSSProperties = {
  marginBottom: 14,
  background: "linear-gradient(135deg, rgba(239,68,68,0.18), rgba(185,28,28,0.26))",
  border: "1px solid rgba(248,113,113,0.45)",
  padding: 12,
  borderRadius: 14,
};

const sourceHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 10,
};
const sourceTitle: CSSProperties = { margin: 0, fontSize: 22, letterSpacing: -0.3 };
const sourceCount: CSSProperties = { color: "var(--muted)", fontSize: 13 };

const cardGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 240px))",
  gap: 12,
  justifyContent: "start",
};

const panel: CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 20,
  background: "rgba(180, 203, 255, 0.14)",
  backdropFilter: "blur(22px) saturate(135%)",
  padding: 12,
  marginBottom: 14,
};

const formGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 8,
};

const wizardTabs: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginBottom: 10,
};

const wizardTabBtn: CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 12,
  padding: "7px 10px",
  cursor: "pointer",
};

const inputStyle: CSSProperties = {
  background: "rgba(183, 206, 255, 0.14)",
  border: "1px solid var(--line)",
  color: "var(--text)",
  borderRadius: 14,
  padding: "9px 11px",
};

const checkLabel: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid var(--line)",
  background: "rgba(183, 206, 255, 0.08)",
};

const storageInfo: CSSProperties = {
  gridColumn: "1 / -1",
  fontSize: 13,
  color: "var(--muted)",
  border: "1px solid var(--line)",
  background: "rgba(183, 206, 255, 0.08)",
  borderRadius: 12,
  padding: "8px 10px",
};

const buttonPrimary: CSSProperties = {
  background: "linear-gradient(135deg, #0a84ff, #5ac8fa)",
  border: "1px solid transparent",
  color: "white",
  borderRadius: 16,
  padding: "9px 13px",
  cursor: "pointer",
  boxShadow: "0 10px 24px rgba(10, 132, 255, 0.34)",
};

const buttonGhost: CSSProperties = {
  background: "rgba(193, 214, 255, 0.14)",
  border: "1px solid var(--line)",
  color: "var(--text)",
  borderRadius: 14,
  padding: "9px 13px",
  cursor: "pointer",
};

const confirmPre: CSSProperties = {
  margin: "10px 0 0",
  borderRadius: 12,
  border: "1px solid var(--line)",
  padding: 10,
  maxHeight: 240,
  overflow: "auto",
  background: "rgba(10,16,33,0.55)",
};

const createTile: CSSProperties = {
  borderRadius: 26,
  padding: 14,
  border: "1px solid var(--line)",
  backdropFilter: "blur(30px) saturate(150%)",
  boxShadow: "0 24px 52px rgba(8, 20, 52, 0.28)",
  display: "grid",
  gap: 10,
  minHeight: 220,
  aspectRatio: "1 / 1",
  alignContent: "center",
  textAlign: "center",
  cursor: "pointer",
  background: "linear-gradient(160deg, rgba(193, 219, 255, 0.3), rgba(132, 169, 245, 0.14))",
};
const createTileIcon: CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: 16,
  margin: "0 auto",
  display: "grid",
  placeItems: "center",
  fontSize: 28,
  lineHeight: 1,
  color: "#eaf2ff",
  border: "1px solid rgba(205, 219, 255, 0.58)",
  background: "rgba(240, 247, 255, 0.22)",
};
const createTileTitle: CSSProperties = { margin: 0, fontSize: 20, letterSpacing: -0.3 };
const createTileText: CSSProperties = { margin: 0, color: "var(--muted)", fontSize: 13 };

const modalOverlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(6, 12, 28, 0.62)",
  backdropFilter: "blur(6px)",
  zIndex: 999,
  display: "grid",
  placeItems: "center",
  padding: 16,
};

const modalCard: CSSProperties = {
  width: "100%",
  maxHeight: "90vh",
  overflow: "auto",
  border: "1px solid var(--line)",
  borderRadius: 20,
  background: "rgba(180, 203, 255, 0.16)",
  backdropFilter: "blur(24px) saturate(135%)",
  padding: 14,
  boxShadow: "0 28px 62px rgba(6, 16, 40, 0.5)",
};

const modalHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  marginBottom: 10,
};

const modalCloseBtn: CSSProperties = {
  background: "rgba(193, 214, 255, 0.14)",
  border: "1px solid var(--line)",
  color: "var(--text)",
  borderRadius: 14,
  padding: "8px 12px",
  cursor: "pointer",
};
