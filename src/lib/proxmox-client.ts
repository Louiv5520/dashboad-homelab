import {
  ProxmoxLxcCloneInput,
  ProxmoxLxcCreateInput,
  ProxmoxLxcMigrateInput,
  ProxmoxLxcUpdateInput,
  ProxmoxNodeInfo,
  ProxmoxSnapshotInput,
  ProxmoxSnapshotRollbackInput,
  ProxmoxStorageInfo,
  ProxmoxTaskInfo,
  ProxmoxTemplateInput,
  ProxmoxVmCloneInput,
  ProxmoxVmCreateInput,
  ProxmoxVmMigrateInput,
  ProxmoxVmUpdateInput,
  ServiceAction,
  ServiceStatus,
  UnifiedService,
} from "@/lib/types";

type ProxmoxListItem = {
  vmid: number;
  name?: string;
  hostname?: string;
  status?: "running" | "stopped";
};

type ProxmoxConfig = {
  baseUrl: string;
  node: string;
  tokenId: string;
  tokenSecret: string;
};

type ParamValue = string | number | boolean;

function getConfig(): ProxmoxConfig {
  const baseUrl = process.env.PROXMOX_BASE_URL;
  const node = process.env.PROXMOX_NODE;
  const tokenId = process.env.PROXMOX_TOKEN_ID;
  const tokenSecret = process.env.PROXMOX_TOKEN_SECRET;

  if (!baseUrl || !node || !tokenId || !tokenSecret) {
    throw new Error("Proxmox miljøvariabler mangler.");
  }

  return { baseUrl, node, tokenId, tokenSecret };
}

function authHeader(config: ProxmoxConfig) {
  return {
    Authorization: `PVEAPIToken=${config.tokenId}=${config.tokenSecret}`,
  };
}

async function apiRequest<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  params?: Record<string, ParamValue | undefined>
): Promise<T> {
  const config = getConfig();
  const headers: Record<string, string> = {
    ...authHeader(config),
  };

  let requestPath = path;
  let body: string | undefined;
  if (params && (method === "GET" || method === "DELETE")) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue;
      query.set(key, String(value));
    }
    const separator = path.includes("?") ? "&" : "?";
    requestPath = `${path}${separator}${query.toString()}`;
  } else if (params && (method === "POST" || method === "PUT")) {
    const form = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue;
      form.set(key, String(value));
    }
    body = form.toString();
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  }

  const response = await fetch(`${config.baseUrl}/api2/json${requestPath}`, {
    method,
    headers,
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Proxmox fejl: ${response.status} ${message}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json()) as { data: T };
  return payload.data;
}

async function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>("GET", path);
}

function taskFromData(data: unknown): ProxmoxTaskInfo {
  if (typeof data === "string") {
    return { upid: data, status: "running" };
  }
  return (data || {}) as ProxmoxTaskInfo;
}

function isIpv4(value: string) {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(value);
}

function scoreIpCandidate(ip: string, ifaceName?: string) {
  if (!isIpv4(ip)) return -9999;
  if (ip.startsWith("127.") || ip.startsWith("169.254.") || ip.startsWith("0.")) return -9999;

  let score = 0;

  if (ip.startsWith("192.168.")) score += 70;
  else if (ip.startsWith("10.")) score += 60;
  else if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) score += 50;
  else score += 20;

  const name = (ifaceName || "").toLowerCase();
  if (/^(eth|ens|enp|eno|bond|wlan)/.test(name)) score += 35;
  if (name === "lo" || name.startsWith("docker") || name.startsWith("br-") || name.startsWith("veth") || name.startsWith("virbr") || name.startsWith("cni")) {
    score -= 60;
  }

  return score;
}

function pickBestIp(candidates: Array<{ ip: string; iface?: string }>) {
  let bestIp = "";
  let bestScore = -9999;
  for (const candidate of candidates) {
    const score = scoreIpCandidate(candidate.ip, candidate.iface);
    if (score > bestScore) {
      bestScore = score;
      bestIp = candidate.ip;
    }
  }
  return bestScore < 0 ? "" : bestIp;
}

async function getGuestIp(node: string, vmid: number, kind: "qemu" | "lxc") {
  try {
    const endpoint =
      kind === "qemu"
        ? `/nodes/${node}/qemu/${vmid}/agent/network-get-interfaces`
        : `/nodes/${node}/lxc/${vmid}/interfaces`;

    const data = await apiGet<{
      result?: Array<{ name?: string; "ip-addresses"?: Array<{ "ip-address"?: string; "ip-address-type"?: string }> }>;
      data?: Array<{ name?: string; inet?: string }>;
    }>(endpoint);

    const candidates: Array<{ ip: string; iface?: string }> = [];

    if ("result" in data && Array.isArray(data.result)) {
      for (const iface of data.result) {
        for (const ip of iface["ip-addresses"] ?? []) {
          const value = ip["ip-address"];
          const type = ip["ip-address-type"];
          if (value && value.includes(".") && (!type || type === "ipv4")) {
            candidates.push({ ip: value, iface: iface.name });
          }
        }
      }
    }

    if ("data" in data && Array.isArray(data.data)) {
      for (const item of data.data) {
        if (item.inet && item.inet.includes(".")) {
          candidates.push({ ip: item.inet, iface: item.name });
        }
      }
    }

    return pickBestIp(candidates);
  } catch {
    return "";
  }

  return "";
}

async function getVmCloudInitIp(node: string, vmid: number) {
  try {
    const config = await apiGet<Record<string, unknown>>(`/nodes/${node}/qemu/${vmid}/config`);
    const keys = ["ipconfig0", "ipconfig1", "ipconfig2", "ipconfig3"];
    for (const key of keys) {
      const value = String(config[key] || "");
      const match = value.match(/ip=(\d{1,3}(?:\.\d{1,3}){3})/);
      if (match?.[1]) return match[1];
    }
  } catch {
    return "";
  }
  return "";
}

function buildSshUrl(ip: string) {
  if (!ip) return "";
  return `ssh://${ip}`;
}

function toStatus(value?: string): ServiceStatus {
  return value === "running" ? "running" : "stopped";
}

export async function listProxmoxServices(): Promise<UnifiedService[]> {
  const config = getConfig();
  const [vms, lxcs] = await Promise.all([
    apiGet<ProxmoxListItem[]>(`/nodes/${config.node}/qemu`),
    apiGet<ProxmoxListItem[]>(`/nodes/${config.node}/lxc`),
  ]);

  const vmServices = await Promise.all(
    vms.map(async (vm) => {
      const runtimeIp = await getGuestIp(config.node, vm.vmid, "qemu");
      const fallbackIp = runtimeIp ? "" : await getVmCloudInitIp(config.node, vm.vmid);
      const ip = runtimeIp || fallbackIp;
      return {
        id: `proxmox-vm-${vm.vmid}`,
        name: vm.name ?? `VM ${vm.vmid}`,
        source: "proxmox" as const,
        type: "vm" as const,
        status: toStatus(vm.status),
        ip,
        domain: buildSshUrl(ip),
        host: config.node,
        actions: ["start", "stop", "restart", "shutdown", "reset", "suspend", "resume"] as ServiceAction[],
      };
    })
  );

  const lxcServices = await Promise.all(
    lxcs.map(async (ct) => {
      const ip = await getGuestIp(config.node, ct.vmid, "lxc");
      return {
        id: `proxmox-lxc-${ct.vmid}`,
        name: ct.name ?? ct.hostname ?? `LXC ${ct.vmid}`,
        source: "proxmox" as const,
        type: "lxc" as const,
        status: toStatus(ct.status),
        ip,
        domain: buildSshUrl(ip),
        host: config.node,
        actions: ["start", "stop", "restart", "shutdown", "suspend", "resume"] as ServiceAction[],
      };
    })
  );

  return [...vmServices, ...lxcServices];
}

export async function runProxmoxAction(serviceId: string, action: ServiceAction) {
  const config = getConfig();
  const parts = serviceId.split("-");
  const kind = parts[1];
  const vmid = parts[2];

  if (!kind || !vmid) {
    throw new Error("Ugyldigt Proxmox service-id.");
  }

  const target = kind === "vm" ? "qemu" : "lxc";
  const actionMap: Record<ServiceAction, string> = {
    start: "start",
    stop: "stop",
    restart: "reboot",
    shutdown: "shutdown",
    reset: target === "qemu" ? "reset" : "reboot",
    suspend: "suspend",
    resume: "resume",
  };

  const upid = await apiRequest<string>(
    "POST",
    `/nodes/${config.node}/${target}/${vmid}/status/${actionMap[action]}`
  );
  return taskFromData(upid);
}

export async function createProxmoxVm(input: ProxmoxVmCreateInput) {
  const config = getConfig();
  const node = input.node || config.node;
  const upid = await apiRequest<string>("POST", `/nodes/${node}/qemu`, {
    vmid: input.vmid,
    name: input.name,
    pool: input.pool,
    cores: input.cores,
    memory: input.memory,
    balloon: input.balloon,
    sockets: input.sockets ?? 1,
    cpu: input.cpu ?? "x86-64-v2-AES",
    scsi0: input.scsi0,
    boot: input.boot,
    bootdisk: input.bootdisk,
    ide2: input.ide2,
    net0: input.net0,
    machine: input.machine,
    bios: input.bios,
    scsihw: input.scsihw,
    agent: input.agent === undefined ? undefined : input.agent ? 1 : 0,
    ostype: input.ostype ?? "l26",
    onboot: input.onboot ? 1 : 0,
  });
  return taskFromData(upid);
}

export async function updateProxmoxVm(input: ProxmoxVmUpdateInput) {
  const config = getConfig();
  const upid = await apiRequest<string>("PUT", `/nodes/${config.node}/qemu/${input.vmid}/config`, {
    name: input.name,
    cores: input.cores,
    memory: input.memory,
    sockets: input.sockets,
    cpu: input.cpu,
    onboot: input.onboot === undefined ? undefined : input.onboot ? 1 : 0,
  });
  return taskFromData(upid);
}

export async function deleteProxmoxVm(vmid: number, purge = true) {
  const config = getConfig();
  const upid = await apiRequest<string>("DELETE", `/nodes/${config.node}/qemu/${vmid}`, {
    purge: purge ? 1 : 0,
  });
  return taskFromData(upid);
}

export async function cloneProxmoxVm(input: ProxmoxVmCloneInput) {
  const config = getConfig();
  const upid = await apiRequest<string>("POST", `/nodes/${config.node}/qemu/${input.vmid}/clone`, {
    newid: input.newid,
    name: input.name,
    target: input.target,
    full: input.full ?? true ? 1 : 0,
    storage: input.storage,
  });
  return taskFromData(upid);
}

export async function migrateProxmoxVm(input: ProxmoxVmMigrateInput) {
  const config = getConfig();
  const upid = await apiRequest<string>("POST", `/nodes/${config.node}/qemu/${input.vmid}/migrate`, {
    target: input.target,
    online: input.online ? 1 : 0,
    withLocalDisks: input.withLocalDisks ? 1 : 0,
  });
  return taskFromData(upid);
}

export async function makeVmTemplate(input: ProxmoxTemplateInput) {
  const config = getConfig();
  const upid = await apiRequest<string>("POST", `/nodes/${config.node}/qemu/${input.vmid}/template`);
  return taskFromData(upid);
}

export async function createProxmoxLxc(input: ProxmoxLxcCreateInput) {
  const config = getConfig();
  const upid = await apiRequest<string>("POST", `/nodes/${config.node}/lxc`, {
    vmid: input.vmid,
    hostname: input.hostname,
    cores: input.cores,
    memory: input.memory,
    rootfs: input.rootfs,
    net0: input.net0,
    ostemplate: input.ostemplate,
    unprivileged: input.unprivileged ?? true ? 1 : 0,
    onboot: input.onboot ? 1 : 0,
    password: input.password,
  });
  return taskFromData(upid);
}

export async function updateProxmoxLxc(input: ProxmoxLxcUpdateInput) {
  const config = getConfig();
  const upid = await apiRequest<string>("PUT", `/nodes/${config.node}/lxc/${input.vmid}/config`, {
    hostname: input.hostname,
    cores: input.cores,
    memory: input.memory,
    onboot: input.onboot === undefined ? undefined : input.onboot ? 1 : 0,
  });
  return taskFromData(upid);
}

export async function deleteProxmoxLxc(vmid: number, purge = true) {
  const config = getConfig();
  const upid = await apiRequest<string>("DELETE", `/nodes/${config.node}/lxc/${vmid}`, {
    purge: purge ? 1 : 0,
  });
  return taskFromData(upid);
}

export async function cloneProxmoxLxc(input: ProxmoxLxcCloneInput) {
  const config = getConfig();
  const upid = await apiRequest<string>("POST", `/nodes/${config.node}/lxc/${input.vmid}/clone`, {
    newid: input.newid,
    hostname: input.hostname,
    target: input.target,
    full: input.full ?? true ? 1 : 0,
  });
  return taskFromData(upid);
}

export async function migrateProxmoxLxc(input: ProxmoxLxcMigrateInput) {
  const config = getConfig();
  const upid = await apiRequest<string>("POST", `/nodes/${config.node}/lxc/${input.vmid}/migrate`, {
    target: input.target,
    online: input.online ? 1 : 0,
    restart: input.restart ? 1 : 0,
  });
  return taskFromData(upid);
}

export async function listSnapshots(source: "qemu" | "lxc", vmid: number) {
  const config = getConfig();
  return apiGet<Array<{ name: string; snaptime?: number; description?: string; vmstate?: number }>>(
    `/nodes/${config.node}/${source}/${vmid}/snapshot`
  );
}

export async function createSnapshot(input: ProxmoxSnapshotInput) {
  const config = getConfig();
  const upid = await apiRequest<string>("POST", `/nodes/${config.node}/${input.source}/${input.vmid}/snapshot`, {
    snapname: input.snapname,
    description: input.description,
  });
  return taskFromData(upid);
}

export async function rollbackSnapshot(input: ProxmoxSnapshotRollbackInput) {
  const config = getConfig();
  const upid = await apiRequest<string>(
    "POST",
    `/nodes/${config.node}/${input.source}/${input.vmid}/snapshot/${input.snapname}/rollback`
  );
  return taskFromData(upid);
}

export async function deleteSnapshot(input: ProxmoxSnapshotRollbackInput) {
  const config = getConfig();
  const upid = await apiRequest<string>(
    "DELETE",
    `/nodes/${config.node}/${input.source}/${input.vmid}/snapshot/${input.snapname}`
  );
  return taskFromData(upid);
}

export async function listNodeTasks(limit = 50) {
  const config = getConfig();
  return apiGet<ProxmoxTaskInfo[]>(`/nodes/${config.node}/tasks?limit=${limit}`);
}

export async function getTaskStatus(upid: string) {
  const config = getConfig();
  return apiGet<ProxmoxTaskInfo>(`/nodes/${config.node}/tasks/${encodeURIComponent(upid)}/status`);
}

export async function getTaskLog(upid: string) {
  const config = getConfig();
  return apiGet<Array<{ n: number; t: string }>>(`/nodes/${config.node}/tasks/${encodeURIComponent(upid)}/log`);
}

export async function listNodeStorages() {
  const config = getConfig();
  return apiGet<ProxmoxStorageInfo[]>(`/nodes/${config.node}/storage`);
}

export async function listStorageContent(storage: string, content = "images,rootdir,backup,iso,vztmpl,snippets") {
  const config = getConfig();
  return apiGet<Array<Record<string, unknown>>>(
    `/nodes/${config.node}/storage/${storage}/content?content=${encodeURIComponent(content)}`
  );
}

export async function listClusterNodes() {
  return apiGet<ProxmoxNodeInfo[]>("/nodes");
}

export async function listClusterUsers() {
  return apiGet<Array<{ userid: string; enable?: number; expire?: number }>>("/access/users");
}

export async function listClusterRoles() {
  return apiGet<Array<{ roleid: string; privs?: string }>>("/access/roles");
}

export async function listPools() {
  return apiGet<Array<{ poolid: string; comment?: string }>>("/pools");
}

export async function getNextVmid() {
  return apiGet<string | number>("/cluster/nextid");
}

export async function listNodeNetworks(node?: string) {
  const config = getConfig();
  const resolvedNode = node || config.node;
  return apiGet<Array<{ iface?: string; type?: string; active?: number }>>(`/nodes/${resolvedNode}/network`);
}
