# Homelab Dashboard

Dashboard til at se og styre Proxmox og Docker fra et sted.

## Lokal udvikling

1. Kopier `.env.example` til `.env`.
2. Udfyld dine værdier.
3. Kør:

```bash
npm install
npm run dev
```

## Docker drift

```bash
docker compose --env-file .env up -d --build
```

Dashboard kører på port `3000`.
