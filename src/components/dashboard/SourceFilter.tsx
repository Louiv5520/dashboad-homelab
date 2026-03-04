import { CSSProperties } from "react";

export type SourceFilter = "all" | "docker" | "proxmox";

export function SourceFilterTabs({
  filter,
  onChange,
}: {
  filter: SourceFilter;
  onChange: (value: SourceFilter) => void;
}) {
  return (
    <section style={segmentWrap}>
      {(["all", "docker", "proxmox"] as SourceFilter[]).map((value) => (
        <button
          key={value}
          className="ios-lift"
          onClick={() => onChange(value)}
          style={{
            ...segmentButton,
            background: filter === value ? "var(--ios-accent)" : "transparent",
            color: filter === value ? "white" : "var(--text)",
          }}
        >
          {value === "all" ? "Alle" : value === "docker" ? "Docker" : "Proxmox"}
        </button>
      ))}
    </section>
  );
}

const segmentWrap: CSSProperties = {
  display: "inline-flex",
  gap: 8,
  padding: 6,
  borderRadius: 18,
  border: "1px solid var(--line)",
  background: "rgba(200, 219, 255, 0.1)",
  backdropFilter: "blur(22px) saturate(140%)",
  marginBottom: 18,
};

const segmentButton: CSSProperties = {
  border: "none",
  borderRadius: 14,
  padding: "9px 15px",
  cursor: "pointer",
  fontWeight: 600,
};
