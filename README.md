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

1. Start a local HTTP server:

```bash
python3 -m http.server 8000
```

2. Open `http://localhost:8000` in your browser.

3. For mock mode (no backend required), the dashboard will use simulated data.

### API Endpoints

The system integrates with the following API endpoints:

- `/work` - Job CRUD operations
- `/work_status` - Job status updates
- `/work_device` - Device-job associations
- `/devices` - Device management

### Development

- `js/api.js` - API integration and mock data
- `js/works.js` - Job management UI logic
- `js/config.js` - Device configuration
- `index.html` - Main application
