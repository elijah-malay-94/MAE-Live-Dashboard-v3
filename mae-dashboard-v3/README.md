# MAE Live Dashboard v3

## Overview

MAE DataLogger Live Dashboard v3 is a comprehensive monitoring platform for geophysical data acquisition devices.

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

