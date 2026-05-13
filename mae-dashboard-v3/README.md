# MAE Live Dashboard v3

## Grafana embed (real live data)

Grafana Cloud pages (like `*.grafana.net`) typically send `X-Frame-Options: DENY`, so they **cannot** be embedded in an `<iframe>` from this dashboard.

To embed **real live data**, run **Grafana OSS self-hosted** and enable embedding.

### Run Grafana OSS locally (Docker Desktop)

1) Install **Docker Desktop** (WSL2).
2) From this project folder, run:

```bash
docker compose -f docker-compose.grafana-oss.yml up -d
```

3) Open Grafana at `http://localhost:3002`
   - Login: `admin / admin` (you will be prompted to change password)

If you want other people on your local network to view the dashboard, share the URL with your machine IP instead of `localhost`, for example:

- `http://192.168.1.10:3002/d/c69c69c4-00bd-4db3-9374-1db4d443b3b0/mae-datalogger-monitor-v2`

### Connect Grafana OSS to InfluxDB

In Grafana:

- **Connections → Data sources → Add data source → InfluxDB**

InfluxDB 2.x (Flux) typical fields:

- **URL**: `http://host.docker.internal:8086` (InfluxDB on the same PC)
- **Organization**: your org
- **Token**: your token
- **Default bucket**: your bucket

Click **Save & test**.

### Import your existing dashboard (optional)

In Grafana Cloud: open the dashboard → **Share → Export → Download JSON**

In Grafana OSS: **Dashboards → New → Import** → upload the JSON.

### Point this web dashboard to your self-hosted Grafana

Edit `js/config.js` and set:

- `window.MAE_GRAFANA_EMBED_URL` (iframe URL)
- `window.MAE_GRAFANA_OPEN_URL` (open-in-new-tab URL)

Default is local Grafana at `http://localhost:3000`.

