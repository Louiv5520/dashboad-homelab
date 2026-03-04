import { CSSProperties } from "react";

export function DashboardHeader({
  updatedAt,
  onCreateVmClick,
  onRefreshClick,
  onLogoutClick,
}: {
  updatedAt: string;
  onCreateVmClick: () => void;
  onRefreshClick: () => void;
  onLogoutClick: () => void;
}) {
  return (
    <header style={header}>
      <div>
        <h1 style={title}>Homelab Dashboard</h1>
        <p style={subtitle}>
          Sidst opdateret: {updatedAt ? new Date(updatedAt).toLocaleString("da-DK") : "-"}
        </p>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="ios-lift" onClick={onCreateVmClick} style={buttonPrimary}>
          Ny VM
        </button>
        <button className="ios-lift" onClick={onRefreshClick} style={buttonGhost}>
          Opdater
        </button>
        <button className="ios-lift" onClick={onLogoutClick} style={buttonGhost}>
          Log ud
        </button>
      </div>
    </header>
  );
}

const header: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 16,
  flexWrap: "wrap",
  background: "rgba(192, 215, 255, 0.1)",
  border: "1px solid var(--line)",
  borderRadius: 22,
  padding: 14,
  backdropFilter: "blur(24px) saturate(145%)",
};

const title: CSSProperties = {
  margin: 0,
  fontSize: 34,
  letterSpacing: -0.6,
  fontWeight: 650,
};

const subtitle: CSSProperties = {
  margin: "6px 0 0",
  color: "var(--muted)",
};

const buttonGhost: CSSProperties = {
  background: "rgba(193, 214, 255, 0.14)",
  border: "1px solid var(--line)",
  color: "var(--text)",
  borderRadius: 16,
  padding: "9px 13px",
  cursor: "pointer",
  backdropFilter: "blur(16px) saturate(130%)",
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
