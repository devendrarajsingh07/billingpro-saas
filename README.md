# 🚀 Enterprise SaaS Billing & ERP Platform

A full-stack, multi-tenant SaaS Billing, Invoicing, Inventory, and ERP Platform built with **Node.js, Express, SQLite (better-sqlite3), React 19, Vite, and Tailwind CSS**.

Designed for small-to-medium businesses (SMBs) and enterprises to manage multi-tenant billing, automated recurring invoices, stock/inventory movements, purchase orders, customer collections, and payment gateway integrations.

---

## ✨ Features & Architecture

### 🏢 Multi-Tenant Architecture
- **Tenant Scope Isolation**: Strict database-level isolation per company (`company_id`) enforced across all queries and repositories.
- **Role-Based Access Control (RBAC)**: Fine-grained permissions supporting standard roles: `Owner`, `Admin`, `Manager`, `Accountant`, `Viewer`.
- **Subscription Tier Limits**: Plan gating (`Free`, `Pro`, `Enterprise`) restricting resource counts (users, products, invoices/month) via server-side middleware.

### 🧾 Invoicing & Subscriptions
- **GST-Ready Invoices**: Automatic tax calculations, per-item and invoice-level discounts, auto-generated sequence numbers (`INV-2026-000001-xxxx`).
- **Automated Recurring Invoices**: Daily cron scheduler generating due invoices from active templates (`Weekly`, `Monthly`, `Quarterly`, `Yearly`).
- **PDF Generation & Email Delivery**: Instant PDF invoice generation attached to customizable emails via Nodemailer / SMTP.
- **Overdue Reminders**: Automated daily cron checking overdue invoices and dispatching payment reminders.

### 💳 Payments & Gateways
- **Razorpay Integration**: Server-side order creation, HMAC-SHA256 signature verification, and automated invoice status updates.
- **ACID-Compliant Payment Ledger**: Overpayment guards, partial payment tracking, and real-time customer balance updates (`total_paid`, `outstanding`).

### 📦 Inventory & Purchase Orders
- **Stock Tracking**: Automated stock deductions on invoice payment and auto-restock on cancellation.
- **Stockout Velocity Forecast**: Predictive trailing-average inventory forecasting for low-stock warnings.
- **Purchase Order Workflow**: Complete lifecycle tracking (`Draft` ➔ `Sent` ➔ `Received` ➔ `Cancelled`) with stock movements.

### 🔐 Security & Auth
- **JWT Authentication & Token Rotation**: Access & Refresh token architecture with secure token invalidation.
- **OAuth 2.0**: Native Google & OAuth integration with email linking.
- **Two-Factor Authentication (TOTP 2FA)**: Time-based One-Time Passwords via `speakeasy` and QR codes.
- **Account Lockout & Rate Limiting**: Exponential backoff on failed logins, brute-force rate limiters.

---

## 🛠️ Technology Stack

### Backend (`/server`)
- **Runtime**: Node.js v20+
- **Framework**: Express.js
- **Database**: SQLite3 via `better-sqlite3` (ACID synchronous driver with WAL mode)
- **Authentication**: `jsonwebtoken`, `bcryptjs`, `speakeasy` (TOTP 2FA), `google-auth-library`
- **PDF & QR**: `pdfkit`, `qrcode`
- **Payments**: `razorpay`
- **Background Tasks**: `node-cron`
- **Logging**: `winston`, `morgan`
- **Documentation**: Swagger UI (`swagger-ui-express`, `swagger-jsdoc`)

### Frontend (`/client`)
- **Framework**: React 19 (Vite)
- **Styling**: Tailwind CSS v4, Lucide Icons, Framer Motion
- **State & Forms**: `react-hook-form`, React Context API
- **HTTP Client**: Axios with automatic 401 token refresh interceptors
- **Data Visualization**: Recharts
- **Notifications**: `react-hot-toast`

---

## 📁 Repository Structure

```
.
├── client/                     # Vite + React Frontend
│   ├── src/
│   │   ├── components/         # Reusable UI components (Modal, Input, Button, etc.)
│   │   ├── context/            # AuthContext, ThemeContext, CompanyContext
│   │   ├── hooks/              # Custom hooks (useApi, usePagination, useDebounce)
│   │   ├── layouts/            # Topbar, Sidebar, Main Layout
│   │   ├── pages/              # Invoices, Customers, Products, Inventory, Reports, Settings
│   │   └── services/           # Axios instance & API wrapper services
│   ├── Dockerfile
│   └── vite.config.js
│
├── server/                     # Node.js + Express Backend API
│   ├── config/                 # Env, Database, Plan Limits, Swagger specs
│   ├── controllers/            # Request handlers (Invoice, Auth, Payment, Customer, etc.)
│   ├── cron/                   # Scheduled background jobs (Recurring invoices, Reminders)
│   ├── database/               # SQLite database file storage
│   ├── events/                 # EventBus pub-sub handlers (Audit log, Notifications)
│   ├── middleware/             # Authenticate, Authorize, PlanLimit, RateLimiter, ErrorHandler
│   ├── migrations/             # Auto-executing SQL schema migrations
│   ├── repositories/           # Data-access layer extending BaseRepository
│   ├── routes/v1/              # API REST routes (v1)
│   ├── services/               # Core business logic layer
│   ├── utils/                  # ApiError, Number Generators, PDF Generator, Logger
│   ├── Dockerfile
│   └── server.js
│
├── docker-compose.yml          # Production multi-container composition
├── DEPLOYMENT.md               # Detailed deployment instructions
└── README.md
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher

### 1. Setup Backend Server

```bash
cd server
npm install

# Copy environment variables template
cp .env.example .env
```

Edit `server/.env` with your desired configuration (JWT secrets, SMTP settings, etc.).

Start the backend development server:
```bash
npm run dev
```
*The server starts on `http://localhost:5001`. API documentation is available at `http://localhost:5001/api-docs`.*

### 2. Setup Frontend Client

Open a new terminal:
```bash
cd client
npm install

# Start Vite dev server
npm run dev
```
*The client app starts on `http://localhost:5173`.*

---

## 🐳 Docker Deployment

To build and run the entire platform in production mode using Docker:

```bash
# Ensure server/.env is created and configured
cp server/.env.example server/.env

# Build and start services
docker compose up -d --build
```

- **Frontend**: `http://localhost` (Port 80)
- **Backend API**: `http://localhost:5001` (Port 5001)

Refer to [DEPLOYMENT.md](DEPLOYMENT.md) for full production deployment guidelines, database backups, and reverse proxy configuration.

---

## 🔑 Environment Variables Reference (`server/.env`)

| Variable | Description | Default / Example |
|---|---|---|
| `PORT` | Server listening port | `5001` |
| `NODE_ENV` | Environment mode (`development`, `production`, `test`) | `development` |
| `JWT_SECRET` | Secret key for signing access tokens | *Strong random string* |
| `JWT_REFRESH_SECRET` | Secret key for signing refresh tokens | *Strong random string* |
| `JWT_ACCESS_EXPIRE` | Access token lifespan | `15m` |
| `JWT_REFRESH_EXPIRE` | Refresh token lifespan | `7d` |
| `SMTP_HOST` | Email SMTP host | `smtp.gmail.com` |
| `SMTP_PORT` | Email SMTP port | `587` |
| `SMTP_USER` | Email SMTP username | `your-email@gmail.com` |
| `SMTP_PASS` | Email SMTP password / app key | `your-app-password` |
| `RAZORPAY_KEY_ID` | Razorpay API Key ID | `rzp_test_xxxx` |
| `RAZORPAY_KEY_SECRET` | Razorpay API Secret | `xxxx` |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | `xxxx.apps.googleusercontent.com` |

---

## 🧪 Testing & Code Quality

Run the automated backend test suite:

```bash
cd server
npm test
```

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
