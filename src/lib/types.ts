export type ServiceSource = "docker" | "proxmox";
export type ServiceStatus = "running" | "stopped" | "unknown";
export type ServiceAction =
  | "start"
  | "stop"
  | "restart"
  | "shutdown"
  | "reset"
  | "suspend"
  | "resume";
export type ServiceType = "container" | "vm" | "lxc";

export interface UnifiedService {
  id: string;
  name: string;
  source: ServiceSource;
  type: ServiceType;
  status: ServiceStatus;
  ip: string;
  domain: string;
  host: string;
  actions: ServiceAction[];
}

export interface ServiceResponse {
  services: UnifiedService[];
  errors: string[];
  updatedAt: string;
}

export interface ProxmoxVmCreateInput {
  vmid: number;
  name: string;
  node?: string;
  pool?: string;
  cores: number;
  memory: number;
  sockets?: number;
  cpu?: string;
  balloon?: number;
  scsi0: string;
  boot?: string;
  bootdisk?: string;
  ide2?: string;
  net0: string;
  machine?: string;
  bios?: string;
  scsihw?: string;
  agent?: boolean;
  ostype?: string;
  onboot?: boolean;
}

export interface ProxmoxVmUpdateInput {
  vmid: number;
  name?: string;
  cores?: number;
  memory?: number;
  sockets?: number;
  cpu?: string;
  onboot?: boolean;
}

export interface ProxmoxVmCloneInput {
  vmid: number;
  newid: number;
  name?: string;
  target?: string;
  full?: boolean;
  storage?: string;
}

export interface ProxmoxVmMigrateInput {
  vmid: number;
  target: string;
  online?: boolean;
  withLocalDisks?: boolean;
}

export interface ProxmoxLxcCreateInput {
  vmid: number;
  hostname: string;
  cores: number;
  memory: number;
  rootfs: string;
  net0: string;
  ostemplate: string;
  unprivileged?: boolean;
  onboot?: boolean;
  password?: string;
}

export interface ProxmoxLxcUpdateInput {
  vmid: number;
  hostname?: string;
  cores?: number;
  memory?: number;
  onboot?: boolean;
}

export interface ProxmoxLxcCloneInput {
  vmid: number;
  newid: number;
  hostname?: string;
  target?: string;
  full?: boolean;
}

export interface ProxmoxLxcMigrateInput {
  vmid: number;
  target: string;
  online?: boolean;
  restart?: boolean;
}

export interface ProxmoxSnapshotInput {
  vmid: number;
  snapname: string;
  description?: string;
  source: "qemu" | "lxc";
}

export interface ProxmoxSnapshotRollbackInput {
  vmid: number;
  snapname: string;
  source: "qemu" | "lxc";
}

export interface ProxmoxTemplateInput {
  vmid: number;
}

export interface DockerContainerCreateInput {
  name: string;
  image: string;
  ports?: string;
  env?: string;
  cmd?: string;
  restartAlways?: boolean;
  startAfterCreate?: boolean;
}

export interface ProxmoxTaskInfo {
  upid?: string;
  node?: string;
  pid?: string;
  pstart?: string;
  starttime?: number;
  type?: string;
  id?: string;
  user?: string;
  status?: string;
  endtime?: number;
}

export interface ProxmoxNodeInfo {
  node: string;
  status: string;
  maxcpu?: number;
  maxmem?: number;
  cpu?: number;
  mem?: number;
}

export interface ProxmoxStorageInfo {
  storage: string;
  type: string;
  content?: string;
  enabled?: number;
  active?: number;
  avail?: number;
  used?: number;
  total?: number;
}
