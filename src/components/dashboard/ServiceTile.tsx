import { ServiceAction, UnifiedService } from "@/lib/types";
import { CSSProperties, ReactNode, useState } from "react";
import { actionLabels, primaryActions } from "@/components/dashboard/action-config";

function statusColor(status: UnifiedService["status"]) {
  if (status === "running") return "var(--ok)";
  if (status === "stopped") return "var(--warn)";
  return "var(--bad)";
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("ssh://")) return trimmed;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `http://${trimmed}`;
}

function isSshUrl(value?: string) {
  return Boolean(value && value.startsWith("ssh://"));
}

function Meta({ label, value, href }: { label: string; value: string; href?: string }) {
  const ssh = isSshUrl(href);

  return (
    <div style={metaItem}>
      <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>{label}</p>
      {href ? (
        <a
          href={href}
          target={ssh ? undefined : "_blank"}
          rel={ssh ? undefined : "noreferrer"}
          style={metaLink}
          title={value}
          onClick={(event) => {
            if (!ssh) return;
            event.preventDefault();
            window.location.assign(href);
          }}
        >
          {value}
        </a>
      ) : (
        <p style={metaValue} title={value}>
          {value}
        </p>
      )}
    </div>
  );
}

export function ServiceTile({
  service,
  sshUser,
  onSshUserChange,
  busyId,
  onAction,
  onEdit,
  onDelete,
}: {
  service: UnifiedService;
  sshUser: string;
  onSshUserChange: (value: string) => void;
  busyId: string;
  onAction: (service: UnifiedService, action: ServiceAction) => Promise<void>;
  onEdit: (service: UnifiedService) => Promise<void>;
  onDelete: (service: UnifiedService) => Promise<void>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const sourceLabel = service.source === "proxmox" ? "Proxmox" : "Docker";
  const extraActions =
    service.source === "proxmox"
      ? (["restart", "shutdown", "reset", "suspend", "resume"] as ServiceAction[])
      : (["restart"] as ServiceAction[]);
  const safeSshUser = sshUser.trim() || "root";
  const proxmoxSshUrl = service.source === "proxmox" && service.ip ? `ssh://${safeSshUser}@${service.ip}` : "";
  const linkUrl = normalizeUrl(proxmoxSshUrl || service.domain);
  const metaValue = service.source === "proxmox" && service.ip ? `${safeSshUser}@${service.ip}` : service.domain || "-";

  const extraOptions = [
    ...extraActions.map((action) => ({ value: action, label: actionLabels[action] })),
    ...(service.source === "proxmox" && service.type === "vm"
      ? [
          { value: "edit", label: "Rediger VM" },
          { value: "delete", label: "Slet VM" },
        ]
      : []),
  ];

  async function handleExtraAction(value: string) {
    if (!value) return;
    if (value === "edit") {
      await onEdit(service);
      setMenuOpen(false);
      return;
    }
    if (value === "delete") {
      await onDelete(service);
      setMenuOpen(false);
      return;
    }
    await onAction(service, value as ServiceAction);
    setMenuOpen(false);
  }

  return (
    <article className="ios-card ios-lift" style={{ ...serviceCard, zIndex: menuOpen ? 40 : 1 }}>
      <div style={widgetBar}>
        <span style={widgetIcon} title={sourceLabel}>
          {service.source === "proxmox" ? <IconServer /> : <IconContainer />}
        </span>
        <span style={widgetText}>{sourceLabel}</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 20 }}>{service.name}</h3>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 13 }}>
            {service.type.toUpperCase()} · {service.host || "-"}
          </p>
        </div>
        <span style={{ ...statusPill, background: statusColor(service.status) }}>{service.status}</span>
      </div>

      <div style={metaGrid}>
        <Meta label="IP" value={service.ip || "-"} />
        <Meta label={service.source === "proxmox" ? "SSH" : "URL"} value={metaValue} href={linkUrl || undefined} />
      </div>

      <div style={actionsWrap}>
        {primaryActions.map((action) => (
          <button
            key={action}
            className="ios-icon-btn ios-lift"
            onClick={() => onAction(service, action)}
            disabled={busyId === `${service.id}:${action}`}
            style={iconButton}
            aria-label={actionLabels[action]}
            title={actionLabels[action]}
          >
            {busyId === `${service.id}:${action}` ? "…" : <ActionIcon action={action} />}
          </button>
        ))}
        <button
          className="ios-icon-btn ios-lift"
          onClick={() => setMenuOpen((value) => !value)}
          style={iconButton}
          aria-label="Flere handlinger"
          title="Flere handlinger"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          <IconMenu />
        </button>
        {menuOpen && (
          <div style={menuPopup} role="menu" aria-label="Flere handlinger">
            {service.source === "proxmox" && (
              <div style={menuSection}>
                <p style={menuLabel}>SSH bruger</p>
                <input
                  type="text"
                  value={safeSshUser}
                  onChange={(event) => onSshUserChange(event.target.value)}
                  style={menuInput}
                  placeholder="fx root"
                />
              </div>
            )}
            {extraOptions.map((option) => (
              <button
                key={option.value}
                style={menuItem}
                onClick={() => void handleExtraAction(option.value)}
                role="menuitem"
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

const serviceCard: CSSProperties = {
  position: "relative",
  borderRadius: 26,
  padding: 14,
  border: "1px solid var(--line)",
  background: "linear-gradient(160deg, rgba(232, 242, 255, 0.34), rgba(151, 178, 246, 0.13))",
  backdropFilter: "blur(30px) saturate(150%)",
  boxShadow: "0 24px 52px rgba(8, 20, 52, 0.28)",
  display: "grid",
  gap: 10,
  minHeight: 220,
  aspectRatio: "1 / 1",
  alignContent: "space-between",
};

const statusPill: CSSProperties = {
  color: "white",
  borderRadius: 999,
  padding: "4px 10px",
  fontSize: 11,
  fontWeight: 700,
  alignSelf: "start",
  textTransform: "uppercase",
  boxShadow: "0 6px 16px rgba(0,0,0,0.28)",
};

const metaGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
};

const metaItem: CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 12,
  padding: 8,
  background: "rgba(226, 238, 255, 0.18)",
  minWidth: 0,
};

const metaValue: CSSProperties = {
  margin: "3px 0 0",
  fontWeight: 600,
  fontSize: 12,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const metaLink: CSSProperties = {
  display: "block",
  marginTop: 3,
  fontWeight: 600,
  fontSize: 12,
  color: "#cfe7ff",
  textDecoration: "none",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const actionsWrap: CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
  position: "relative",
  zIndex: 2,
};

const widgetBar: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const widgetIcon: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 10,
  display: "grid",
  placeItems: "center",
  background: "rgba(240, 247, 255, 0.35)",
  border: "1px solid rgba(230, 240, 255, 0.55)",
};

const widgetText: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--muted)",
  textTransform: "uppercase",
  letterSpacing: 0.9,
};

const iconButton: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 12,
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
  fontSize: 14,
  lineHeight: 1,
  background: "rgba(154, 189, 255, 0.2)",
  border: "1px solid rgba(173, 198, 255, 0.48)",
  color: "#f0f6ff",
};

const menuPopup: CSSProperties = {
  position: "absolute",
  top: 38,
  right: 0,
  zIndex: 1000,
  minWidth: 140,
  borderRadius: 12,
  border: "1px solid rgba(205, 219, 255, 0.52)",
  background: "rgba(18, 28, 58, 0.94)",
  backdropFilter: "blur(20px) saturate(145%)",
  boxShadow: "0 16px 28px rgba(0, 0, 0, 0.32)",
  padding: 4,
  display: "grid",
  gap: 2,
};

const menuItem: CSSProperties = {
  border: "none",
  background: "transparent",
  color: "var(--text)",
  fontSize: 12,
  textAlign: "left",
  borderRadius: 8,
  padding: "8px 10px",
  cursor: "pointer",
};

const menuSection: CSSProperties = {
  display: "grid",
  gap: 6,
  padding: "6px 8px 8px",
  borderBottom: "1px solid rgba(205, 219, 255, 0.24)",
  marginBottom: 4,
};

const menuLabel: CSSProperties = {
  margin: 0,
  fontSize: 11,
  color: "var(--muted)",
  textTransform: "uppercase",
  letterSpacing: 0.6,
};

const menuInput: CSSProperties = {
  background: "rgba(154, 189, 255, 0.16)",
  border: "1px solid rgba(173, 198, 255, 0.48)",
  color: "var(--text)",
  borderRadius: 10,
  padding: "6px 8px",
  fontSize: 12,
  minWidth: 130,
  outline: "none",
};

function ActionIcon({ action }: { action: ServiceAction }) {
  if (action === "start") return <IconPlay />;
  if (action === "stop") return <IconStop />;
  if (action === "restart") return <IconRestart />;
  if (action === "shutdown") return <IconPower />;
  if (action === "reset") return <IconReset />;
  if (action === "suspend") return <IconPause />;
  return <IconResume />;
}

function IconWrap({ children }: { children: ReactNode }) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function IconPlay() {
  return (
    <IconWrap>
      <path d="M8 5l11 7-11 7z" />
    </IconWrap>
  );
}
function IconStop() {
  return (
    <IconWrap>
      <rect x="7" y="7" width="10" height="10" rx="2" />
    </IconWrap>
  );
}
function IconRestart() {
  return (
    <IconWrap>
      <path d="M20 12a8 8 0 1 1-2.3-5.7" />
      <path d="M20 4v6h-6" />
    </IconWrap>
  );
}
function IconPower() {
  return (
    <IconWrap>
      <path d="M12 3v8" />
      <path d="M6.8 6.8a8 8 0 1 0 10.4 0" />
    </IconWrap>
  );
}
function IconReset() {
  return (
    <IconWrap>
      <path d="M4 12a8 8 0 0 1 13.7-5.7" />
      <path d="M20 12a8 8 0 0 1-13.7 5.7" />
      <path d="M18 3v6h-6" />
      <path d="M6 21v-6h6" />
    </IconWrap>
  );
}
function IconPause() {
  return (
    <IconWrap>
      <path d="M9 6v12" />
      <path d="M15 6v12" />
    </IconWrap>
  );
}
function IconResume() {
  return (
    <IconWrap>
      <path d="M8 5l11 7-11 7z" />
    </IconWrap>
  );
}
function IconMenu() {
  return (
    <IconWrap>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </IconWrap>
  );
}
function IconServer() {
  return (
    <IconWrap>
      <rect x="3" y="4" width="18" height="6" rx="2" />
      <rect x="3" y="14" width="18" height="6" rx="2" />
      <path d="M7 7h.01" />
      <path d="M7 17h.01" />
    </IconWrap>
  );
}
function IconContainer() {
  return (
    <IconWrap>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 6v12" />
      <path d="M14 6v12" />
    </IconWrap>
  );
}
