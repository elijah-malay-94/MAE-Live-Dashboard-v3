# MAE Live Dashboard v3

## Job Management System

This dashboard includes a comprehensive job management system with CRUD operations, device association, and location search functionality.

### Features

- Create, read, update, and delete jobs
- Associate devices with jobs
- Location search using OpenMaps API
- Real-time status updates
- Mock mode for testing without backend

### Running the Dashboard

The app files live in `mae-dashboard-v3/` (next to this README).

```bash
cd mae-dashboard-v3
python3 -m http.server 8000
```

Or run `START_SERVER.bat` (Windows) or `START_SERVER.sh` from that folder.

Open `http://localhost:8000` in your browser. For mock mode (no backend required), the dashboard will use simulated data.

### API Endpoints

The system integrates with the following API endpoints:

- `/work` - Job CRUD operations
- `/work_status` - Job status updates
- `/work_device` - Device-job associations
- `/devices` - Device management

### Development

Paths are relative to `mae-dashboard-v3/`:

- `js/api.js` - API integration and mock data
- `js/works.js` - Job management UI logic
- `js/config.js` - Device configuration
- `index.html` - Main application
