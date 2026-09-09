# Mini ERP + CRM Operations Portal

A small ERP/CRM system for a wholesale/distribution company: customers, products,
stock, sales challans and CRM follow-ups, with role-based access for sales,
warehouse and accounts teams.

Built for the Full Stack Developer case study.

- **Backend:** Node.js, TypeScript, Express, Prisma, PostgreSQL, JWT auth, zod validation
- **Frontend:** React, TypeScript, Vite, React Router, responsive plain CSS
- **Repo layout:** `server/` (REST API) and `web/` (admin UI)

## Contents

- [Modules](#modules)
- [Test logins](#test-logins)
- [Run locally](#run-locally)
- [Environment variables](#environment-variables)
- [API reference](#api-reference)
- [Business rules](#business-rules)
- [Deployment](#deployment)
- [Assumptions](#assumptions)
- [Known limitations](#known-limitations)

## Modules

1. **Authentication and roles** — JWT login, four roles: ADMIN, SALES, WAREHOUSE, ACCOUNTS.
2. **Customer CRM** — add, edit, search, filter, detail page, follow-up notes timeline.
3. **Products and inventory** — add, edit, search, low-stock filter, stock IN/OUT with
   an append-only stock movement log (product, qty, type, reason, user, timestamp).
4. **Sales challans** — pick customer, add multiple product lines, auto challan number,
   save as Draft or Confirmed, confirm/cancel actions, product snapshot on every line.
5. **Dashboard** — counts, low-stock alerts, recent challans.

## Test logins

Password for all four accounts: **`Password@123`**

| Role | Email | Can do |
|---|---|---|
| Admin | `admin@erpdemo.com` | Everything |
| Sales | `sales@erpdemo.com` | Customers, follow-ups, challans |
| Warehouse | `warehouse@erpdemo.com` | Products, stock movements |
| Accounts | `accounts@erpdemo.com` | Read-only across all modules |

The login screen lists these accounts as one-click buttons.

## Run locally

Requirements: Node.js 18+ and a PostgreSQL database (local install, Docker, or a free
Neon/Supabase database — a hosted URL works fine for local development).

### 1. Backend

```bash
cd server
cp .env.example .env          # then edit DATABASE_URL and JWT_SECRET
npm install
npx prisma migrate deploy     # creates all tables (use `migrate dev` when changing the schema)
npm run seed                  # creates the 4 role logins + demo customers/products/challan
npm run dev                   # http://localhost:4000
```

Check it is up: `curl http://localhost:4000/health`

### 2. Frontend

```bash
cd web
cp .env.example .env          # VITE_API_URL=http://localhost:4000
npm install
npm run dev                   # http://localhost:5173
```

Open http://localhost:5173 and sign in with any account above.

> The backend only accepts browser requests from origins listed in `CORS_ORIGIN`.
> For local work keep `CORS_ORIGIN="http://localhost:5173"`.

## Environment variables

**`server/.env`**

| Variable | Purpose | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db?sslmode=require` |
| `JWT_SECRET` | Secret used to sign tokens (long random string) | `openssl rand -hex 32` |
| `JWT_EXPIRES_IN` | Token lifetime | `12h` |
| `PORT` | API port | `4000` |
| `CORS_ORIGIN` | Comma-separated allowed browser origins | `https://your-app.vercel.app` |

**`web/.env`**

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Base URL of the API, no trailing slash |

Secrets are never committed: both folders ship a `.env.example` and `.gitignore`
excludes `.env`. On hosted platforms the values are set in the dashboard, and the
server refuses to boot if `DATABASE_URL` or `JWT_SECRET` is missing.

## API reference

Base URL: `http://localhost:4000`. All routes except `/health` and `/auth/login`
need `Authorization: Bearer <token>`.

| Method | Endpoint | Roles | Notes |
|---|---|---|---|
| GET | `/health` | public | Liveness check |
| POST | `/auth/login` | public | `{ email, password }` → `{ token, user }` |
| GET | `/auth/me` | any | Current user from the token |
| GET | `/customers` | any | `?search=&status=&type=&page=&pageSize=` |
| GET | `/customers/:id` | any | Includes follow-ups and challans |
| POST | `/customers` | ADMIN, SALES | Create |
| PUT | `/customers/:id` | ADMIN, SALES | Update |
| POST | `/customers/:id/follow-ups` | ADMIN, SALES | `{ note, nextDate? }` |
| GET | `/products` | any | `?search=&category=&lowStock=true&page=&pageSize=` |
| GET | `/products/categories` | any | Distinct category list |
| GET | `/products/:id` | any | Includes last 25 movements |
| POST | `/products` | ADMIN, WAREHOUSE | Opening stock is logged as an IN movement |
| PUT | `/products/:id` | ADMIN, WAREHOUSE | Stock is not editable here |
| POST | `/products/:id/stock` | ADMIN, WAREHOUSE | `{ type: IN\|OUT, quantity, reason }` |
| GET | `/stock-movements` | any | `?productId=&type=&page=&pageSize=` |
| GET | `/challans` | any | `?search=&status=&customerId=&page=&pageSize=` |
| GET | `/challans/:id` | any | Includes line items |
| POST | `/challans` | ADMIN, SALES | `{ customerId, status, remarks?, items:[{productId, quantity}] }` |
| POST | `/challans/:id/confirm` | ADMIN, SALES | Draft → Confirmed, reduces stock |
| POST | `/challans/:id/cancel` | ADMIN, SALES | Cancels and returns stock if it was confirmed |
| GET | `/dashboard/summary` | any | Counts, low stock, recent challans |

Import `docs/postman_collection.json` into Postman: log in once and the token is
stored in a collection variable used by every other request.

**Status codes:** `200` ok, `201` created, `400` validation / insufficient stock,
`401` missing or invalid token, `403` wrong role, `404` not found, `409` invalid
state transition or duplicate, `500` unexpected.

Error shape:

```json
{ "error": { "message": "Validation failed",
             "details": [{ "field": "mobile", "message": "Enter a valid mobile number" }] } }
```

List shape:

```json
{ "data": [ ... ], "meta": { "total": 42, "page": 1, "pageSize": 10, "totalPages": 5 } }
```

## Business rules

- Challan numbers are `CH-<year>-<0001>`, generated inside the challan transaction.
- Confirming a challan reduces stock for every line and writes an OUT stock movement,
  all in one transaction — if any line is short, nothing is written.
- Stock can never go negative; an insufficient line returns `400` naming the product,
  the available quantity and the required quantity.
- Only DRAFT challans can be confirmed (`409` otherwise).
- Cancelling a CONFIRMED challan returns the stock and logs an IN movement.
- Challan lines store a product snapshot (name, SKU, category, unit price), so later
  price or name changes never rewrite issued documents.
- Product stock is never edited on the product form — only via stock IN/OUT or a
  challan, so the movement log stays complete and reconcilable.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full design and role matrix.

## Deployment

Step-by-step instructions for free hosting (Neon + Render + Vercel) are in
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md), including the optional AWS EC2 route
and how environment variables are managed on each platform.

Short version:

1. **Database** — create a free Neon/Supabase Postgres, copy the connection string.
2. **Backend on Render** — root directory `server`, build
   `npm install && npm run build && npx prisma migrate deploy && npm run seed`,
   start `npm run start`, env vars `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, then run
   Free instances have no shell, so migrate + seed run inside the build command (seed is idempotent).
3. **Frontend on Vercel** — root directory `web`, framework Vite, env var
   `VITE_API_URL=https://<your-api>.onrender.com`.
4. Set `CORS_ORIGIN` on the backend to the deployed Vercel URL and redeploy.

## Assumptions

- Customers are identified by mobile number in practice, but the schema does not
  force uniqueness because wholesale businesses often share one landline.
- Prices are stored as `Decimal(12,2)` in INR; there is no multi-currency or tax
  calculation (GST number is captured for the document, not computed).
- Purchase orders and invoices were listed in the business context but the required
  modules were auth, CRM, inventory and sales challans, so those are what is built;
  the schema leaves room for them (stock movements already carry a `reference`).
- One warehouse field per product (text `location`), not a separate warehouse table.
- Users are created by seed; there is no self-signup, which matches an internal tool.
- Deleting records is not offered — customers get an INACTIVE status and challans get
  CANCELLED, so history is preserved.

## Known limitations

- No automated test suite. The flows were verified manually through the UI and with
  the Postman collection (login, RBAC 403s, validation 400s, insufficient-stock 400,
  draft → confirm stock reduction, cancel restoring stock).
- No refresh tokens: the JWT lives 12h in `localStorage` and the user logs in again.
- No PDF export of challans, no S3 image upload, no Docker or GitHub Actions
  (all listed as optional bonus items).
- Pagination is offset-based, fine at this data size but not for very large tables.
- Search uses `contains` (case-insensitive), not full-text search.
- The dashboard computes low-stock counts in application code rather than SQL, which
  is simple and correct but would need a query for very large catalogues.
- No audit trail for customer/product edits (only stock movements are append-only).
