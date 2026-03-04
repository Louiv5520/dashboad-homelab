"use client";

import { CSSProperties, useState } from "react";

type Props = {
  onDone: () => Promise<void>;
  setErrors: (errors: string[]) => void;
};

async function apiCall(url: string, method: string, body?: Record<string, unknown>) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = (await response.json()) as { ok?: boolean; error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "Kald fejlede.");
  }
  return payload;
}

export function ProxmoxPanels({ onDone, setErrors }: Props) {
  const [active, setActive] = useState<"vm" | "snap" | "lxc" | "tasks" | "infra">("vm");
  const [vmid, setVmid] = useState("");
  const [cloneId, setCloneId] = useState("");
  const [targetNode, setTargetNode] = useState("");
  const [snapName, setSnapName] = useState("");
  const [lxcId, setLxcId] = useState("");
  const [storageName, setStorageName] = useState("");
  const [taskUpid, setTaskUpid] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  async function run(label: string, fn: () => Promise<Record<string, unknown>>) {
    try {
      const out = await fn();
      setResult({ action: label, ...out });
      setErrors([]);
      await onDone();
    } catch (error) {
      setErrors([`${label} fejlede: ${(error as Error).message}`]);
    }
  }

  return (
    <section style={panelWrap}>
      <h2 style={title}>Proxmox avancerede funktioner</h2>
      <p style={muted}>Vælg en sektion, udfyld felterne, og kør handlingen.</p>

      <div style={tabs}>
        <TabButton label="VM" active={active === "vm"} onClick={() => setActive("vm")} />
        <TabButton label="Snapshots" active={active === "snap"} onClick={() => setActive("snap")} />
        <TabButton label="LXC" active={active === "lxc"} onClick={() => setActive("lxc")} />
        <TabButton label="Tasks" active={active === "tasks"} onClick={() => setActive("tasks")} />
        <TabButton label="Infra" active={active === "infra"} onClick={() => setActive("infra")} />
      </div>

      {active === "vm" && (
        <div style={box}>
          <div style={row}>
            <input style={input} placeholder="VMID" value={vmid} onChange={(event) => setVmid(event.target.value)} />
            <input style={input} placeholder="Nyt VMID (clone)" value={cloneId} onChange={(event) => setCloneId(event.target.value)} />
            <input style={input} placeholder="Target node (migrate)" value={targetNode} onChange={(event) => setTargetNode(event.target.value)} />
          </div>
          <div style={row}>
            <button className="ios-lift" style={btn} onClick={() => run("Clone VM", () => apiCall("/api/proxmox/vm/clone", "POST", { vmid: Number(vmid), newid: Number(cloneId) }))}>Clone</button>
            <button className="ios-lift" style={btn} onClick={() => run("Migrate VM", () => apiCall("/api/proxmox/vm/migrate", "POST", { vmid: Number(vmid), target: targetNode, online: true }))}>Migrate</button>
            <button className="ios-lift" style={btn} onClick={() => run("Template VM", () => apiCall("/api/proxmox/vm/template", "POST", { vmid: Number(vmid) }))}>Template</button>
          </div>
        </div>
      )}

      {active === "snap" && (
        <div style={box}>
          <div style={row}>
            <input style={input} placeholder="VMID" value={vmid} onChange={(event) => setVmid(event.target.value)} />
            <input style={input} placeholder="Snapshot navn" value={snapName} onChange={(event) => setSnapName(event.target.value)} />
          </div>
          <div style={row}>
            <button className="ios-lift" style={btn} onClick={() => run("Create VM snapshot", () => apiCall("/api/proxmox/snapshots/vm", "POST", { vmid: Number(vmid), snapname: snapName }))}>Create</button>
            <button className="ios-lift" style={btn} onClick={() => run("Rollback VM snapshot", () => apiCall("/api/proxmox/snapshots/vm", "PUT", { vmid: Number(vmid), snapname: snapName, mode: "rollback" }))}>Rollback</button>
            <button className="ios-lift" style={btn} onClick={() => run("Delete VM snapshot", () => apiCall("/api/proxmox/snapshots/vm", "PUT", { vmid: Number(vmid), snapname: snapName, mode: "delete" }))}>Delete</button>
          </div>
        </div>
      )}

      {active === "lxc" && (
        <div style={box}>
          <div style={row}>
            <input style={input} placeholder="LXC VMID" value={lxcId} onChange={(event) => setLxcId(event.target.value)} />
            <input style={input} placeholder="Nyt VMID (clone)" value={cloneId} onChange={(event) => setCloneId(event.target.value)} />
            <input style={input} placeholder="Target node (migrate)" value={targetNode} onChange={(event) => setTargetNode(event.target.value)} />
          </div>
          <div style={row}>
            <button className="ios-lift" style={btn} onClick={() => run("Clone LXC", () => apiCall("/api/proxmox/lxc/clone", "POST", { vmid: Number(lxcId), newid: Number(cloneId) }))}>Clone</button>
            <button className="ios-lift" style={btn} onClick={() => run("Migrate LXC", () => apiCall("/api/proxmox/lxc/migrate", "POST", { vmid: Number(lxcId), target: targetNode, online: true }))}>Migrate</button>
          </div>
        </div>
      )}

      {active === "tasks" && (
        <div style={box}>
          <div style={row}>
            <input style={input} placeholder="Task UPID" value={taskUpid} onChange={(event) => setTaskUpid(event.target.value)} />
          </div>
          <div style={row}>
            <button className="ios-lift" style={btn} onClick={() => run("Hent node tasks", () => apiCall("/api/proxmox/tasks?limit=30", "GET"))}>Liste</button>
            <button className="ios-lift" style={btn} onClick={() => run("Hent task status", () => apiCall(`/api/proxmox/tasks?upid=${encodeURIComponent(taskUpid)}&withLog=1`, "GET"))}>Status + log</button>
          </div>
        </div>
      )}

      {active === "infra" && (
        <div style={box}>
          <div style={row}>
            <input style={input} placeholder="Storage (fx local-lvm)" value={storageName} onChange={(event) => setStorageName(event.target.value)} />
          </div>
          <div style={row}>
            <button className="ios-lift" style={btn} onClick={() => run("Hent storage", () => apiCall("/api/proxmox/storage", "GET"))}>Storage liste</button>
            <button className="ios-lift" style={btn} onClick={() => run("Hent storage content", () => apiCall(`/api/proxmox/storage?storage=${encodeURIComponent(storageName)}`, "GET"))}>Storage content</button>
            <button className="ios-lift" style={btn} onClick={() => run("Hent cluster", () => apiCall("/api/proxmox/cluster", "GET"))}>Cluster data</button>
          </div>
        </div>
      )}

      {result && <pre style={pre}>{JSON.stringify(result, null, 2)}</pre>}
    </section>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      className="ios-lift"
      onClick={onClick}
      style={{
        ...tabBtn,
        background: active ? "var(--ios-accent)" : "rgba(193, 214, 255, 0.14)",
        color: active ? "white" : "var(--text)",
      }}
    >
      {label}
    </button>
  );
}

const panelWrap: CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 20,
  background: "rgba(180, 203, 255, 0.14)",
  backdropFilter: "blur(22px) saturate(135%)",
  padding: 12,
  marginBottom: 14,
  display: "grid",
  gap: 10,
};

const title: CSSProperties = { margin: 0, fontSize: 22 };
const muted: CSSProperties = { margin: 0, color: "var(--muted)" };
const row: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8 };
const tabs: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8 };
const box: CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 14,
  padding: 10,
  background: "rgba(160, 188, 255, 0.08)",
  display: "grid",
  gap: 8,
};
const tabBtn: CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 12,
  padding: "7px 10px",
  cursor: "pointer",
};
const input: CSSProperties = {
  background: "rgba(183, 206, 255, 0.14)",
  border: "1px solid var(--line)",
  color: "var(--text)",
  borderRadius: 14,
  padding: "9px 11px",
  minWidth: 160,
};
const btn: CSSProperties = {
  background: "rgba(193, 214, 255, 0.14)",
  border: "1px solid var(--line)",
  color: "var(--text)",
  borderRadius: 14,
  padding: "9px 11px",
  cursor: "pointer",
};
const pre: CSSProperties = {
  margin: 0,
  borderRadius: 12,
  border: "1px solid var(--line)",
  padding: 10,
  maxHeight: 240,
  overflow: "auto",
  background: "rgba(10,16,33,0.55)",
};
