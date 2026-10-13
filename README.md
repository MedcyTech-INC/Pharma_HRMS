# 🐬 Orca Labs — Pharma HRMS Frontend PWA

Enterprise Progressive Web Application (PWA) for Pharmaceutical Sales Force Management, Daily Call Reporting (DCR), and Geofenced Attendance.

Built with **React 19**, **TypeScript**, **Tailwind CSS v4**, **Vite 6**, and **Nginx**.

---

## 🚀 Quick Start with Docker

### 1. Configure Ports & Environment
Copy the `.env` template:
```bash
cp .env.example .env
```
Default ports configured to avoid conflicts:
* **Frontend Web App**: `http://localhost:9590` (Port `9590`)
* **Supabase Cloud Database**: Pointed to active PostgreSQL KVM instance

### 2. Build & Run
```bash
docker compose up -d --build
```

### 3. Check Status
```bash
docker compose ps
docker compose logs -f frontend
```

---

## 🛠️ Local Development (Without Docker)

```bash
# 1. Install dependencies
npm install

# 2. Start local dev server
npm run dev

# 3. Production build
npm run build
```

---

## 📂 Architecture Overview

* **`src/components/`**: Modular domain components (Attendance, Field Ops, Doctor Visits, Tasks, Org Hierarchy, Leaves, Chat).
* **`src/hooks/`**: Custom data hooks (`useAuth`, `useEmployees`, `useAttendance`, `useLeaves`, `useTaskModule`, etc.).
* **`src/lib/services/`**: Direct Supabase PostgreSQL query services and offline sync engines.
* **`nginx.conf`**: Production Nginx SPA reverse proxy with PWA caching controls and dynamic API forwarding.
* **`Dockerfile`**: Multi-stage Debian Bookworm build with glibc native binary support and lightweight Alpine Nginx runner.
