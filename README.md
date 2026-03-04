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

## Kør på server (ren Docker)

1. Hent projektet på serveren:

```bash
git clone https://github.com/Louiv5520/dashboad-homelab.git
cd dashboad-homelab
```

2. Lav miljøfil:

```bash
cp .env.example .env
```

3. Udfyld `.env` med dine rigtige værdier.
   - Ved login-problemer på HTTP (uden HTTPS): sæt `AUTH_COOKIE_SECURE=false`.
   - Hvis du bruger remote Docker API: sæt `APP_DOCKER_HOST` (fx `http://192.168.1.118:2375`) og lad `DOCKER_SOCKET_PATH` være tom.
   - Hvis dashboard skal tale med lokal Docker på serveren: lad `APP_DOCKER_HOST` være tom og brug `DOCKER_SOCKET_PATH=/var/run/docker.sock`.

4. Start:

```bash
docker compose up -d --build
```

5. Opdater senere:

```bash
git pull
docker compose up -d --build
```
