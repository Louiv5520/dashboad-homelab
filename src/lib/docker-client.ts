import Docker from "dockerode";
import { DockerContainerCreateInput, ServiceStatus, UnifiedService } from "@/lib/types";

function getDockerClient() {
  const host = process.env.DOCKER_HOST;
  const socketPath = process.env.DOCKER_SOCKET_PATH;

  if (host) {
    const url = new URL(host);
    const protocol =
      url.protocol === "tcp:" || url.protocol === "http:" ? "http" : "https";

    return new Docker({
      host: url.hostname,
      port: Number(url.port || 2375),
      protocol,
    });
  }

  return new Docker({
    socketPath: socketPath || "/var/run/docker.sock",
  });
}

function extractDomain(labels: Record<string, string>) {
  const traefikRule = labels["traefik.http.routers.main.rule"];
  if (traefikRule?.includes("Host(")) {
    const match = traefikRule.match(/Host\(`?([^`)]+)`?\)/);
    if (match?.[1]) return match[1];
  }

  return (
    labels["com.centurylinklabs.watchtower.enable_domain"] ||
    labels["homelab.domain"] ||
    ""
  );
}

function extractIp(networks: Record<string, { IPAddress?: string }> | undefined) {
  if (!networks) return "";
  const values = Object.values(networks);
  for (const network of values) {
    if (network?.IPAddress) return network.IPAddress;
  }
  return "";
}

function isIpv4(value: string) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(value);
}

function extractHostFromUrl(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

function pickBestIpForUi({
  domain,
  dockerHost,
  internalIp,
  ports,
}: {
  domain: string;
  dockerHost: string;
  internalIp: string;
  ports: Array<{ PublicPort?: number }>;
}) {
  const hostFromDomain = extractHostFromUrl(domain);
  if (isIpv4(hostFromDomain)) {
    return hostFromDomain;
  }

  const hasPublishedPorts = ports.some((port) => typeof port.PublicPort === "number");
  if (hasPublishedPorts && isIpv4(dockerHost)) {
    return dockerHost;
  }

  return internalIp;
}

function dockerHostLabel() {
  const host = process.env.DOCKER_HOST;
  if (!host) return "local-docker";

  try {
    return new URL(host).hostname || host;
  } catch {
    const cleaned = host
      .replace(/^tcp:\/\//, "")
      .replace(/^http:\/\//, "")
      .replace(/^https:\/\//, "");
    return cleaned.split(":")[0] || host;
  }
}

function buildAccessUrl(
  labels: Record<string, string>,
  ports: Array<{ PrivatePort?: number; PublicPort?: number; Type?: string }>,
  dockerHost: string
) {
  const domain = extractDomain(labels);
  if (domain) {
    if (domain.startsWith("http://") || domain.startsWith("https://")) {
      return domain;
    }
    const hasTlsHint =
      labels["traefik.http.routers.main.tls"] === "true" ||
      labels["traefik.http.routers.main.entrypoints"]?.includes("websecure");
    return `${hasTlsHint ? "https" : "http"}://${domain}`;
  }

  const published = ports.filter((port) => typeof port.PublicPort === "number");
  if (published.length === 0) return "";

  const preferred =
    published.find((port) => port.PublicPort === 443) ||
    published.find((port) => port.PublicPort === 80) ||
    published[0];

  const publicPort = preferred.PublicPort as number;
  const protocol = publicPort === 443 ? "https" : "http";
  const omitPort = (protocol === "http" && publicPort === 80) || (protocol === "https" && publicPort === 443);
  return `${protocol}://${dockerHost}${omitPort ? "" : `:${publicPort}`}`;
}

export async function listDockerServices(): Promise<UnifiedService[]> {
  const docker = getDockerClient();
  const containers = await docker.listContainers({ all: true });
  const dockerHost = dockerHostLabel();
  const toStatus = (value?: string): ServiceStatus =>
    value === "running" ? "running" : "stopped";

  return containers.map((container): UnifiedService => {
    const inspect = container.NetworkSettings;
    const labels = container.Labels || {};
    const rawName = container.Names?.[0] || container.Id.slice(0, 12);
    const domain = buildAccessUrl(labels, container.Ports || [], dockerHost);
    const internalIp = extractIp(inspect?.Networks);
    const ipForUi = pickBestIpForUi({
      domain,
      dockerHost,
      internalIp,
      ports: container.Ports || [],
    });

    return {
      id: `docker-${container.Id}`,
      name: rawName.replace(/^\//, ""),
      source: "docker",
      type: "container",
      status: toStatus(container.State),
      ip: ipForUi,
      domain,
      host: dockerHost,
      actions: ["start", "stop", "restart"],
    };
  });
}

export async function runDockerAction(serviceId: string, action: "start" | "stop" | "restart") {
  const docker = getDockerClient();
  const id = serviceId.replace(/^docker-/, "");
  const container = docker.getContainer(id);

  if (action === "start") await container.start();
  if (action === "stop") await container.stop();
  if (action === "restart") await container.restart();
}

function parsePorts(ports?: string) {
  const entries = (ports || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const exposedPorts: Record<string, object> = {};
  const portBindings: Record<string, { HostPort: string }[]> = {};

  for (const entry of entries) {
    const [hostPort, containerPort] = entry.split(":").map((value) => value?.trim());
    if (!hostPort || !containerPort) {
      throw new Error(`Ugyldigt port-format: '${entry}'. Brug fx 5678:5678`);
    }

    if (!/^\d+$/.test(hostPort) || !/^\d+$/.test(containerPort)) {
      throw new Error(`Port skal være tal: '${entry}'`);
    }

    const containerKey = `${containerPort}/tcp`;
    exposedPorts[containerKey] = {};
    portBindings[containerKey] = [{ HostPort: hostPort }];
  }

  return { exposedPorts, portBindings };
}

function parseEnv(env?: string) {
  return (env || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseCmd(cmd?: string) {
  return (cmd || "")
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);
}

export async function createDockerContainer(input: DockerContainerCreateInput) {
  const docker = getDockerClient();
  const { exposedPorts, portBindings } = parsePorts(input.ports);
  const env = parseEnv(input.env);
  const cmd = parseCmd(input.cmd);

  const container = await docker.createContainer({
    name: input.name,
    Image: input.image,
    Env: env.length > 0 ? env : undefined,
    Cmd: cmd.length > 0 ? cmd : undefined,
    ExposedPorts: Object.keys(exposedPorts).length > 0 ? exposedPorts : undefined,
    HostConfig: {
      PortBindings: Object.keys(portBindings).length > 0 ? portBindings : undefined,
      RestartPolicy: input.restartAlways ? { Name: "always" } : { Name: "no" },
    },
  });

  if (input.startAfterCreate ?? true) {
    await container.start();
  }

  return { id: container.id };
}
