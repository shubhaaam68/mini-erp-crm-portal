# Screen-recording script (mandatory submission item)

Target length: 8–12 minutes. Record with OBS / Loom at 1080p, mic on, and say what you
are doing. Have the app already running (`npm run dev` in both folders) plus a code
editor and Postman open before you hit record.

## 0. Intro (30s)
"This is a Mini ERP + CRM Operations Portal — Node, TypeScript, Express, Prisma,
PostgreSQL on the backend, React with TypeScript on the frontend. Four roles: admin,
sales, warehouse, accounts. I'll walk through the modules, then the code and the
business rules."

## 1. Login + roles (1 min)
1. Show the login screen and the four demo accounts.
2. Log in as **admin** → dashboard: counts, low-stock alerts, recent challans.

## 2. Customer CRM (2 min)
1. Customers list → search by name, then filter status = Lead.
2. **+ Add customer** → fill it in, save. Point out validation: clear the mobile field
   and show the field-level error coming from the server.
3. Open the new customer → add a follow-up note with a next date → show it in the
   timeline with your name and role.

## 3. Products and inventory (2 min)
1. Log out, log in as **warehouse**. Point out that customer edit buttons are gone.
2. Products list → note the red low-stock numbers and the "Low stock only" filter.
3. **+ Add product** with an opening stock → then **Stock IN/OUT** → record an IN of 50
   with a reason.
4. Stock Log page → the movement is at the top with product, qty, reason, user, time.
5. Try an OUT larger than the current stock → show the error: stock never goes negative.

## 4. Sales challan — the core flow (3 min)
1. Log in as **sales**.
2. **+ New challan** → select customer → add two product lines → point out that in-stock
   and unit price come from the product, and the line total and grand total update live.
3. Set a quantity above stock → the "exceeds stock" hint appears.
4. **Save as draft** → open it → show status DRAFT, the auto-generated number
   `CH-2026-000X`, and the line-item snapshot.
5. **Confirm challan** → then go to Products: stock has dropped. Stock Log: an OUT entry
   referencing the challan number.
6. Back to the challan → **Cancel challan** → stock is returned and an IN entry is logged.
7. Try to confirm a cancelled challan → 409 with a clear message.

## 5. Accounts role (30s)
Log in as **accounts** → everything is visible, no create/edit buttons anywhere.

## 6. API in Postman (1.5 min)
1. Run **Auth / Login (admin)** → token is stored automatically.
2. `GET /customers?search=&page=1&pageSize=10` → show the `data` + `meta` pagination shape.
3. Run "Create with bad data" → 400 with field-level details.
4. Log in as **sales**, then run **Products / Create** → 403 "Requires role: ADMIN or WAREHOUSE".
5. Run "Create confirmed beyond stock" → 400 naming available vs required quantity.

## 7. Code walkthrough (2 min)
1. `server/prisma/schema.prisma` — the 7 models; explain the snapshot fields on
   `Challan`/`ChallanItem` and why the stock log is append-only.
2. `server/src/routes/challans.ts` — `nextChallanNumber` and `reduceStock` inside
   `prisma.$transaction`: all-or-nothing stock changes.
3. `server/src/middleware/auth.ts` — JWT + `requireRole`.
4. `web/src/lib/api.ts` — one fetch wrapper, JWT header, error mapping.
5. `README.md` — env vars, endpoints, assumptions, known limitations.

## 8. Close (20s)
Mention deployment (Neon + Render + Vercel, documented in `docs/DEPLOYMENT.md`), the
bonus items not done, and the known limitations. Say the repo link out loud.

---

## Google Form — answers to have ready

| Field | Answer |
|---|---|
| GitHub repository | `https://github.com/<your-user>/mini-erp-crm-portal` |
| Live frontend URL | your Vercel URL (or "not deployed — local setup + recording provided") |
| Live backend API URL | your Render URL + `/health` works |
| Test credentials | `admin@erpdemo.com` / `sales@erpdemo.com` / `warehouse@erpdemo.com` / `accounts@erpdemo.com`, password `Password@123` |
| Postman collection | `docs/postman_collection.json` in the repo |
| README | root `README.md` (setup, env vars, endpoints, deployment) |
| Architecture explanation | `ARCHITECTURE.md` |
| Known limitations | "Known limitations" section at the end of `README.md` |
| Bonus items | Not implemented: Docker, GitHub Actions, PDF invoice export, S3 image upload |
