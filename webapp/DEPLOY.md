# Greenhouse Monitor: Deployment Guide (Windows)

## How Everything Connects

```
YOUR WINDOWS PC (development)
  VS Code + PlatformIO (firmware)
  VS Code + Node.js (dashboard app)

YOUR HETZNER VPS (89.167.32.214, Ubuntu)
  Mosquitto MQTT broker ─── already running
  Telegraf ─────────────── already running
  InfluxDB ─────────────── already running
  Node.js API server ───── NEW (we deploy this)
  React dashboard ──────── NEW (served by Node.js)

ESP32 AT LEPAA GREENHOUSE
  Sensors → MQTT/TLS → Mosquitto → Telegraf → InfluxDB
                                                  ↑
                                    Node.js reads FROM here
                                                  ↓
                                    Browser ← React Dashboard
```

The firmware is NOT affected. Your ESP32 talks to Mosquitto over MQTT.
The Node.js server reads data from InfluxDB and serves the dashboard.
These are two separate paths that share InfluxDB as the data store.


## PART 1: Set Up Windows Development Environment

### 1.1 Install Node.js on Windows

Download Node.js 20 LTS from: https://nodejs.org/en/download
Run the installer. Accept all defaults.

Open PowerShell and verify:

```powershell
node --version
npm --version
```

You should see v20.x.x and 10.x.x.


### 1.2 Get the Project Files

Option A: If you downloaded greenhouse-app.tar.gz from Claude

Extract the archive. You get a greenhouse-app folder.
Place it wherever you keep projects, for example:

```
C:\Users\Victor\Projects\greenhouse-app\
```

Option B: Start fresh from your GitHub repo

```powershell
cd C:\Users\Victor\Projects
git clone https://github.com/drbetique/Smart-GreenHouse-Monitor.git
```

Then copy the greenhouse-app folder contents into your repo under
a new "dashboard" or "web" folder.


### 1.3 Install Dependencies (Windows)

Open PowerShell in the project root:

```powershell
cd C:\Users\Victor\Projects\greenhouse-app

# Install server dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..
```

Note: better-sqlite3 requires build tools on Windows. If you see errors:

```powershell
npm install --global windows-build-tools
```

Or install Visual Studio Build Tools from:
https://visualstudio.microsoft.com/visual-cpp-build-tools/

Select "Desktop development with C++" workload.


### 1.4 Create Environment File

Copy the template:

```powershell
copy .env.example .env
```

Open .env in VS Code and set these values:

```
PORT=3001
NODE_ENV=development

JWT_SECRET=paste-a-random-string-here-at-least-32-chars
JWT_EXPIRES_IN=24h

INFLUX_URL=http://89.167.32.214:8086
INFLUX_TOKEN=8wfgT8AWjF978HyXrZ8VLrEUBsy3VVuwwadBp89upkRd9n4ARWven-BqWjnufjSX0jUlujSA_oZbwLZayZJzyw==
INFLUX_ORG=hamk-thesis
INFLUX_BUCKET=greenhouse

ADMIN_EMAIL=victor@hamk.fi
ADMIN_PASSWORD=YourStrongPassword123!
```

For JWT_SECRET, generate a random string. Open PowerShell:

```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 40 | ForEach-Object {[char]$_})
```

Copy the output and paste it as JWT_SECRET.


### 1.5 Create Admin User

```powershell
npm run seed
```

Output: [SEED] Created admin user: victor@hamk.fi


### 1.6 Test Locally

Open two PowerShell terminals:

Terminal 1 (API server):
```powershell
cd C:\Users\Victor\Projects\greenhouse-app
npm run dev:server
```

Terminal 2 (React frontend):
```powershell
cd C:\Users\Victor\Projects\greenhouse-app
npm run dev:client
```

Open browser: http://localhost:5173
Log in with your admin email and password.

The Vite dev server proxies API calls to Node.js at port 3001.
You should see the login page. After login, the dashboard loads.

At this point, sensor data comes from InfluxDB on your VPS
(because INFLUX_URL points to 89.167.32.214).

If port 8086 is blocked on the VPS firewall, temporarily open it:

```bash
# SSH into VPS first
ssh root@89.167.32.214
ufw allow 8086/tcp
```

We close this port again after deploying to the VPS.


## PART 2: Deploy to VPS (Production)

### 2.1 Install Node.js on VPS

SSH into your server:

```powershell
ssh root@89.167.32.214
```

Install Node.js 20:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs
node --version
```


### 2.2 Upload Project to VPS

From your Windows machine, use scp (or WinSCP):

Option A: Using scp in PowerShell

```powershell
cd C:\Users\Victor\Projects
scp -r greenhouse-app root@89.167.32.214:/opt/greenhouse-app
```

Option B: Using WinSCP (GUI)

Download WinSCP from https://winscp.net
Connect to 89.167.32.214 with your SSH key.
Drag the greenhouse-app folder to /opt/ on the server.

Option C: Using Git on the VPS

```bash
cd /opt
git clone https://github.com/drbetique/Smart-GreenHouse-Monitor.git greenhouse-app
```


### 2.3 Install Dependencies on VPS

```bash
cd /opt/greenhouse-app
npm install

cd client
npm install
```


### 2.4 Build React Frontend

```bash
cd /opt/greenhouse-app/client
npx vite build
```

This creates client/dist/ folder with optimized static files.
Node.js serves these directly in production mode.


### 2.5 Configure Production Environment

```bash
cd /opt/greenhouse-app
cp .env.example .env
nano .env
```

Set production values:

```
PORT=3001
NODE_ENV=production

JWT_SECRET=<generate: openssl rand -hex 32>
JWT_EXPIRES_IN=24h

INFLUX_URL=http://localhost:8086
INFLUX_TOKEN=8wfgT8AWjF978HyXrZ8VLrEUBsy3VVuwwadBp89upkRd9n4ARWven-BqWjnufjSX0jUlujSA_oZbwLZayZJzyw==
INFLUX_ORG=hamk-thesis
INFLUX_BUCKET=greenhouse

ADMIN_EMAIL=victor@hamk.fi
ADMIN_PASSWORD=YourStrongPassword123!
```

Key difference from development:
- NODE_ENV=production (serves React build from client/dist/)
- INFLUX_URL=http://localhost:8086 (InfluxDB is on the same machine)


### 2.6 Create Admin User on VPS

```bash
npm run seed
```


### 2.7 Test the Server

```bash
node server/index.js
```

From your Windows browser, visit: http://89.167.32.214:3001
You should see the login page. Sign in with admin credentials.

Press Ctrl+C to stop the test.


### 2.8 Set Up pm2 (Process Manager)

pm2 keeps the server running after you close SSH.
It auto-restarts on crashes and on VPS reboot.

```bash
npm install -g pm2
cd /opt/greenhouse-app
pm2 start server/index.js --name greenhouse-monitor
pm2 save
pm2 startup
```

The pm2 startup command prints a command. Copy and run it.
This ensures the server starts automatically after VPS reboot.

Useful pm2 commands:

```bash
pm2 logs greenhouse-monitor     # view live logs
pm2 restart greenhouse-monitor  # restart after code changes
pm2 stop greenhouse-monitor     # stop the server
pm2 status                      # check running processes
```


### 2.9 Set Up Nginx Reverse Proxy

Nginx routes traffic from port 80 to Node.js on port 3001.

```bash
apt install -y nginx
```

Create config:

```bash
nano /etc/nginx/sites-available/greenhouse
```

Paste this:

```nginx
server {
    listen 80;
    server_name 89.167.32.214;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable and start:

```bash
ln -s /etc/nginx/sites-available/greenhouse /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
```


### 2.10 Update Firewall

```bash
ufw allow 80/tcp
ufw status
```

Now close direct access to InfluxDB (Node.js proxies it):

```bash
ufw delete allow 8086/tcp
```

Your final open ports:
- 22: SSH
- 80: HTTP (Nginx → Node.js → React + API)
- 8883: MQTT/TLS (ESP32 to Mosquitto)


### 2.11 Verify Everything Works

From your Windows browser: http://89.167.32.214

You should see the greenhouse login page.
Log in with your admin credentials.
The dashboard loads with data from InfluxDB.

From the admin panel (/users), create accounts for:
- Your thesis supervisor (viewer role)
- Greenhouse operators (operator role)


## PART 3: Connect Dashboard to Live InfluxDB Data

Your React dashboard currently uses simulated data (generateData function).
To switch to real data, replace the data loading in your dashboard component.

Remove these functions:
- generateData()
- generateStatus()

Replace with API calls in useEffect:

```javascript
// At the top of your dashboard file
import { api } from "../api";

// Replace the data loading useEffect:
useEffect(() => {
  async function loadData() {
    try {
      const result = await api.getSensors({ start: sd, end: ed });
      setAllData(result.data.map(d => ({
        ...d,
        timeLabel: new Date(d.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        dateLabel: new Date(d.time).toLocaleDateString([], { month: "short", day: "numeric" }),
        ts: new Date(d.time).getTime(),
      })));
    } catch (err) {
      console.error("Failed to load sensor data:", err);
    }
  }
  loadData();
}, [sd, ed]);

// Replace status loading:
useEffect(() => {
  async function loadStatus() {
    try {
      const result = await api.getStatus();
      if (result.online) setStatus(result.status);
    } catch (err) {
      console.error("Failed to load status:", err);
    }
  }
  loadStatus();
  const iv = setInterval(loadStatus, 60000);
  return () => clearInterval(iv);
}, []);
```

The API supports these query parameters:
- /api/data/sensors?start=2026-02-01T00:00:00Z&end=2026-02-09T23:59:59Z
- /api/data/sensors?sensor=co2,temperature (filter specific sensors)
- /api/data/sensors?aggregate=5m (downsample for long ranges)
- /api/data/latest (most recent single reading)
- /api/data/status (device health)
- /api/data/export?start=...&end=... (CSV download)


## PART 4: How the Firmware Fits In

Nothing changes in your ESP32 firmware. Here is the data flow:

```
ESP32 Firmware (PlatformIO project)
  ├── Reads sensors every 60s
  ├── Publishes to: greenhouse/lepaa/sensors (JSON payload)
  ├── Publishes to: greenhouse/lepaa/status (every 5 min)
  ├── Connects to: 89.167.32.214:8883 (MQTT/TLS)
  └── Backs up to SD card when offline

Mosquitto (already running on VPS)
  ├── Receives MQTT messages from ESP32
  └── Passes to local subscribers

Telegraf (already running on VPS)
  ├── Subscribes to: greenhouse/lepaa/#
  ├── Parses JSON payloads
  └── Writes to InfluxDB

InfluxDB (already running on VPS)
  ├── Stores all sensor + status data
  ├── 90-day retention policy
  └── Queried by Node.js API <── THIS IS THE NEW PIECE

Node.js API (NEW)
  ├── Reads from InfluxDB using Flux queries
  ├── Manages users in SQLite
  ├── Authenticates with JWT
  └── Serves React dashboard

React Dashboard (NEW)
  ├── Login page (admin creates all accounts)
  ├── Sensor charts with date range selection
  ├── Device status panel
  ├── Alert configuration
  └── User management (admin only)
```

The ESP32 firmware you built in Phase 1-2 sends data to Mosquitto.
Telegraf moves it to InfluxDB. The new Node.js server reads from
InfluxDB and shows it in the browser. Two independent paths sharing
one database.

When you flash the ESP32 and deploy it at Lepaa, data flows
automatically through the entire pipeline without any changes to
the web application.


## PART 5: Updating After Deployment

When you make changes to the dashboard on your Windows PC:

```powershell
# Build the React frontend
cd client
npx vite build
cd ..
```

Upload to VPS:

```powershell
scp -r client/dist root@89.167.32.214:/opt/greenhouse-app/client/dist
```

Restart on VPS:

```bash
ssh root@89.167.32.214
pm2 restart greenhouse-monitor
```

For server-side changes:

```powershell
scp -r server root@89.167.32.214:/opt/greenhouse-app/server
```

Then:

```bash
ssh root@89.167.32.214
cd /opt/greenhouse-app
npm install     # if dependencies changed
pm2 restart greenhouse-monitor
```


## Quick Reference: All Services on VPS

| Service    | Port  | Status Command                     |
|------------|-------|------------------------------------|
| SSH        | 22    | systemctl status sshd              |
| Nginx      | 80    | systemctl status nginx             |
| Mosquitto  | 8883  | systemctl status mosquitto         |
| InfluxDB   | 8086  | systemctl status influxdb          |
| Telegraf   | -     | systemctl status telegraf          |
| Node.js    | 3001  | pm2 status greenhouse-monitor      |

All logs:
```bash
pm2 logs greenhouse-monitor          # Node.js API
journalctl -u mosquitto --since today  # MQTT broker
journalctl -u telegraf --since today   # Telegraf
journalctl -u influxdb --since today   # InfluxDB
journalctl -u nginx --since today      # Nginx
```


## User Roles

| Role     | Dashboard | Alert Config | User Management | Export |
|----------|-----------|--------------|-----------------|--------|
| viewer   | Read-only | View only    | No              | Yes    |
| operator | Read-only | Edit         | No              | Yes    |
| admin    | Read-only | Edit         | Full access     | Yes    |

No public signup. Admin creates all users via the /users page.


## API Endpoints

Authentication:
  POST /api/auth/login             Sign in, returns JWT
  GET  /api/auth/me                Current user info
  PUT  /api/auth/password          Change own password

User Management (admin only):
  GET    /api/auth/users           List all users
  POST   /api/auth/users/create    Create user with role
  PUT    /api/auth/users/:id/role  Change role
  PUT    /api/auth/users/:id/status  Enable/disable account
  DELETE /api/auth/users/:id       Delete user

Sensor Data (any authenticated user):
  GET /api/data/sensors            Query sensor data (start, end, sensor, aggregate)
  GET /api/data/latest             Most recent reading
  GET /api/data/status             Device health
  GET /api/data/export             CSV download with msg_id

Alert Config:
  GET /api/data/alerts/config      Get thresholds (all users)
  PUT /api/data/alerts/config      Update thresholds (admin/operator)
  GET /api/data/alerts/history     Alert log (all users)
