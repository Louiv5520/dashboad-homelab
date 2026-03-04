import { CSSProperties } from "react";

function InfoCard({ label, value, tone }: { label: string; value: string; tone: "blue" | "green" | "orange" | "purple" }) {
  const tones: Record<string, string> = {
    blue: "linear-gradient(135deg, rgba(10,132,255,0.9), rgba(91,176,255,0.72))",
    green: "linear-gradient(135deg, rgba(52,199,89,0.88), rgba(88,214,123,0.68))",
    orange: "linear-gradient(135deg, rgba(255,159,10,0.9), rgba(255,195,89,0.72))",
    purple: "linear-gradient(135deg, rgba(175,82,222,0.9), rgba(145,105,255,0.72))",
  };

  return (
    <div style={{ ...infoCard, background: tones[tone] }}>
      <p style={{ margin: 0, opacity: 0.86 }}>{label}</p>
      <strong style={{ fontSize: 26 }}>{value}</strong>
    </div>
  );
}

export function StatsCards({
  total,
  running,
  stopped,
  proxmox,
  docker,
}: {
  total: number;
  running: number;
  stopped: number;
  proxmox: number;
  docker: number;
}) {
  return (
    <section style={statsGrid}>
      <InfoCard label="Totalt" value={String(total)} tone="blue" />
      <InfoCard label="Kører" value={String(running)} tone="green" />
      <InfoCard label="Stoppet" value={String(stopped)} tone="orange" />
      <InfoCard label="Proxmox / Docker" value={`${proxmox} / ${docker}`} tone="purple" />
    </section>
  );
}

const statsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  marginBottom: 16,
};

const infoCard: CSSProperties = {
  borderRadius: 22,
  padding: 16,
  color: "white",
  boxShadow: "0 16px 34px rgba(6, 18, 48, 0.34)",
  display: "grid",
  gap: 4,
};
