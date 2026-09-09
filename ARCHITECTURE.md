# Architecture

## Overview

A two-part application inside one repository:

```
mini-erp-crm-portal/
├── server/   Node.js + TypeScript + Express + Prisma + PostgreSQL  (REST API)
└── web/      React + TypeScript + Vite + React Router              (admin UI)
```

The browser never talks to the database. All access goes through the REST API,
which enforces authentication, role permissions, validation and business rules.

```
React (Vite)  ──HTTPS/JSON──>  Express API  ──Prisma──>  PostgreSQL
   JWT in localStorage             RBAC + zod validation      transactions
```

## Backend layers

| Layer | Location | Responsibility |
|---|---|---|
| Entry point | `server/src/index.ts` | Express app, CORS, JSON body parsing, route mounting, error handling |
| Routes | `server/src/routes/*.ts` | One file per module (auth, customers, products, stock movements, challans, dashboard) |
| Middleware | `server/src/middleware/*` | `authenticate` (JWT), `requireRole` (RBAC), `validateBody` (zod), central error handler |
| Helpers | `server/src/lib/*` | Prisma client, env loading, `HttpError` + pagination helpers |
| Data model | `server/prisma/schema.prisma` | 7 models, enums, indexes, migrations |

Every handler is wrapped in `asyncHandler`, so a thrown `HttpError` becomes a
consistent JSON error body: `{ "error": { "message": "...", "details": [...] } }`.

## Data model

- `User` — name, email, bcrypt password hash, role (ADMIN / SALES / WAREHOUSE / ACCOUNTS)
- `Customer` — CRM fields incl. type, status, follow-up date, notes
- `FollowUp` — timeline of notes per customer, with author
- `Product` — SKU (unique), category, unit price, current stock, min stock alert, location
- `StockMovement` — append-only log: product, quantity, IN/OUT, reason, reference, author, timestamp
- `Challan` — challan number (unique), customer **snapshot** (name/mobile/GST), status, totals, author, timestamps
- `ChallanItem` — product **snapshot** (name, SKU, category, unit price) + quantity + line total

Snapshots matter: renaming a product or changing its price later does not rewrite
history on documents that were already issued.

## Key business rules (all enforced server-side)

1. **Challan numbering** — `CH-<year>-<0001>`, generated inside the same
   transaction as the challan so numbers cannot collide or skip.
2. **Confirming a challan** reduces stock for every line *and* writes a
   `StockMovement` (type OUT, reason "Sales challan … confirmed") in one
   transaction. If any line is short, the whole transaction rolls back.
3. **Stock can never go negative** — checked per line before the decrement;
   insufficient stock returns `400` with the product name, available and
   required quantity.
4. **Only DRAFT challans can be confirmed** (`409` otherwise).
5. **Cancelling a CONFIRMED challan returns the stock** and logs an IN movement,
   so the stock log always reconciles with `Product.currentStock`.
6. **Product stock is never edited directly** through the product form; it only
   moves through the stock IN/OUT endpoint or a challan, so the log is complete.

## Role permissions

| Action | ADMIN | SALES | WAREHOUSE | ACCOUNTS |
|---|---|---|---|---|
| View everything | ✅ | ✅ | ✅ | ✅ |
| Add / edit customers, follow-ups | ✅ | ✅ | ❌ | ❌ |
| Create / confirm / cancel challans | ✅ | ✅ | ❌ | ❌ |
| Add / edit products, stock IN/OUT | ✅ | ❌ | ✅ | ❌ |

ACCOUNTS is intentionally read-only (reconciliation role).

## Frontend

- `lib/api.ts` — single fetch wrapper: attaches the JWT, parses errors into
  `ApiError` (message + field-level details), clears the session on `401`.
- `lib/auth.tsx` — `AuthProvider` context; revalidates the stored token against
  `/auth/me` on load, exposes `can(...roles)` for permission-aware UI.
- `components/Layout.tsx` — sidebar shell + page titles; `Protected` route guard.
- Pages: Login, Dashboard, Customers, CustomerDetail, Products, StockMovements,
  Challans, ChallanDetail.
- Plain CSS (`styles.css`) with design tokens and a mobile breakpoint at 860px —
  no UI library, so the styling is auditable.

Server-side validation errors are mapped back onto the matching form fields
instead of being shown as one generic message.
