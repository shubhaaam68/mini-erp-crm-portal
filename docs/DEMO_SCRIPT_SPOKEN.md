# Word-for-word recording script (5–8 minutes)

**Read the bold text out loud. The indented lines are what to do with the mouse.**
Target: ~7 minutes. Live site: https://mini-erp-crm-portal-beige.vercel.app

Before recording: log in once to wake the backend, then log out. Open two browser tabs —
tab 1 = live site, tab 2 = GitHub repo. Notifications off.

---

## 0 · Intro — 25 seconds

> *Screen shows the login page. Don't move the mouse yet.*

**"Hello, this is my submission for the Full Stack Developer case study — a Mini ERP and CRM
Operations Portal. The backend is Node.js with TypeScript, Express and Prisma, using a
PostgreSQL database. The frontend is React with TypeScript. It's deployed live — the frontend
on Vercel, the API on Render, and the database on Neon. There are four roles: admin, sales,
warehouse and accounts. Let me walk you through it."**

---

## 1 · Login and dashboard — 50 seconds

> Click the email field. Type `admin@erpdemo.com`, then the password, then click **Log in**.

**"I'm logging in as the admin user. Authentication is JWT based — the token comes back from
the login endpoint and is stored on the client, then sent on every request."**

> Dashboard loads. Move the mouse slowly across the six cards at the top, left to right.

**"This is the dashboard. Total customers, open leads, products, draft challans, confirmed
challans, and low stock items — all calculated on the server in a single summary endpoint."**

> Point the mouse at the "Low stock alerts" table on the right.

**"On the right, low stock alerts. These two products are below their minimum stock level, so
the in-stock number is shown in red. Below on the left are the most recent challans."**

---

## 2 · Customer CRM — 80 seconds

> Click **Customers** in the left sidebar.

**"This is the customer CRM module. Each customer has a business name, mobile number, a type —
retail, wholesale or distributor — and a status, lead or active."**

> Click the search box, type `Mehta`, pause 2 seconds.

**"Search runs on the server, not in the browser."**

> Clear the search. Open the "All statuses" dropdown, choose **Lead**. Pause.

**"And I can filter by status — here are just the leads. This list is paginated too, you can
see the record count and page number at the bottom."**

> Reset the filter. Click **+ Add customer**.

**"Let me add a customer."**

> Fill in a name and business name but LEAVE THE MOBILE FIELD EMPTY. Click save.

**"I've deliberately left the mobile number blank. The request is rejected — this validation is
done on the server with a schema validator, and it returns a four hundred with the exact field
that failed, which the UI shows here."**

> Now type a 10-digit mobile number. Click save.

**"Now it saves."**

> Click **View** on the customer you just created.

**"On the customer detail page I can log a follow-up."**

> Add a follow-up note and a next-follow-up date. Save.

**"The follow-up is stored with my user name, my role, and the timestamp — so there's a full
history of who spoke to this customer and when."**

---

## 3 · Products, inventory and the stock rule — 90 seconds

> Click **Log out**, then log in as `warehouse@erpdemo.com`.

**"Now I'll log in as the warehouse user, to show role-based access control."**

> Click **Customers** in the sidebar. Move the mouse along a customer row.

**"Notice that as warehouse, the edit buttons on customers are gone — this role can view
customers but not change them. That's enforced on the backend as well, not just hidden in
the UI."**

> Click **Products**.

**"Products. Each one has a SKU, a category, a unit price, current stock and a minimum stock
level."**

> Point at a red stock number.

**"These red numbers are below the minimum."**

> Click the **Stock IN/OUT** button on any product.

**"Stock is never edited directly. Every change goes through a stock movement, with a reason."**

> Choose IN, quantity `50`, type a reason like `New purchase from supplier`. Submit.

**"That's an inward movement of fifty units."**

> Click **Stock Log** in the sidebar.

**"And here it is at the top of the stock log — product, in or out, quantity, reason, the user
who did it, and the time. This log is append-only, it's the audit trail."**

> Go back to **Products**. Click **Stock IN/OUT** on a product, choose OUT, enter a quantity
> far bigger than its stock (for example `99999`). Submit.

**"Now the important business rule. I'm trying to remove more stock than exists. The server
rejects it — stock can never go negative, and it tells me exactly how much is available."**

---

## 4 · Sales challan — the core flow — 2 minutes ⭐

> Log out. Log in as `sales@erpdemo.com`. Click **Challans**, then **+ New challan**.

**"This is the core module — the sales challan. I'm logged in as the sales role now."**

> Select a customer from the dropdown. Add the first product line.

**"I pick the customer, then add product lines. When I select a product, the unit price and the
available stock are pulled from the product record automatically."**

> Add a second product line. Change a quantity and pause on the totals.

**"The line total and the grand total recalculate as I type."**

> Set one quantity higher than the available stock. Pause on the warning.

**"If I go above available stock, it warns me straight away."**

> Fix the quantity back to something valid. Click **Save as draft**.

**"I'll save this as a draft first."**

> Open the challan you just saved. Point at the challan number and the status badge.

**"The challan number is generated automatically by the server in the format
C-H-hyphen-year-hyphen-sequence, and the status is DRAFT. Importantly, the product name and
price are stored as a snapshot on the challan line — so if the price changes tomorrow, this
document still shows what was actually sold today."**

> Point at the status. Then click **Confirm challan**.

**"A draft doesn't touch inventory. Now I confirm it."**

**"Status is now CONFIRMED. Let's check the effect on stock."**

> Click **Products**. Point at the two products from the challan.

**"The stock of both products has been reduced."**

> Click **Stock Log**.

**"And there are two outward movements at the top, referencing the challan number — so I can
trace every unit that left the warehouse back to a document."**

> Go back to **Challans**, open the same challan, click **Cancel challan**.

**"Finally, if I cancel a confirmed challan, the stock has to come back."**

> Click **Stock Log** again.

**"And there it is — inward movements returning the stock. The confirm and cancel operations
both run inside a database transaction, so either the challan status and every stock change
succeed together, or nothing changes at all. There's no way to end up with a confirmed challan
and unreduced stock."**

---

## 5 · Accounts role — 20 seconds

> Log out. Log in as `accounts@erpdemo.com`. Click through **Customers**, **Products**,
> **Challans**.

**"The accounts role is read-only across the whole application — full visibility for reporting,
but no create, edit, confirm or cancel buttons anywhere."**

---

## 6 · Code and closing — 70 seconds

> Switch to the GitHub tab. Open `server/prisma/schema.prisma`. Scroll slowly.

**"Briefly on the code. The schema has seven models — users, customers, follow-ups, products,
stock movements, challans and challan items. Schema changes are versioned as Prisma migrations,
which run automatically on every deployment."**

> Open `server/src/routes/challans.ts`. Scroll to the confirm handler.

**"This is the challan route. The challan number generation and the stock reduction both happen
inside a Prisma transaction — that's what guarantees the all-or-nothing behaviour I showed."**

> Open `server/src/middleware/auth.ts`.

**"And this is the auth middleware — it verifies the JWT and then a require-role check guards
each endpoint, which is why the warehouse user couldn't edit customers."**

> Go back to the repo root page.

**"The repository is github.com/shubhaaam68/mini-erp-crm-portal. The README has the setup steps,
environment variables, all the endpoints and the deployment guide, and there's a separate
architecture document and a Postman collection in the docs folder."**

**"I've also documented the known limitations honestly — the optional bonus items, Docker,
GitHub Actions, PDF invoice export and S3 upload, are not implemented, and there's no automated
test suite. Everything required in the brief is built, deployed and working. Thank you for your
time."**

---

### If you are running over time, cut in this order
1. Section 6 code walkthrough (shorten to schema only)
2. Section 2 the follow-up note
3. Section 5 accounts role

**Never cut section 4.** Confirm reduces stock, stock never goes negative, cancel restores
stock — that is what is actually being graded.
