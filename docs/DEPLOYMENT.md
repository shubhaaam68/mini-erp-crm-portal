# Deployment guide

Two supported paths:

- **A — Free hosting (recommended):** Neon (Postgres) + Render (API) + Vercel (UI)
- **B — AWS EC2 (bonus):** one Ubuntu server running the API behind Nginx + PM2

Both are documented below, along with how environment variables are managed.

---

## A. Free hosting

### 1. Database — Neon (or Supabase / Render Postgres)

1. Create a free project at neon.tech → a database is created for you.
2. Copy the **pooled** connection string. It looks like:
   `postgresql://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require`
3. Keep it safe — this is the only secret the API really needs besides the JWT secret.

### 2. Backend — Render

1. New → **Web Service** → connect the GitHub repo.
2. Settings:
   - **Root Directory:** `server`
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build && npx prisma migrate deploy && npm run seed`
     (the free instance type has **no shell/SSH**, so migrations and seeding run in the build;
     the seed is idempotent and does nothing once data exists)
   - **Start Command:** `npm run start`
3. Environment variables (Render dashboard → Environment):

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | the Neon connection string |
   | `JWT_SECRET` | output of `openssl rand -hex 32` |
   | `JWT_EXPIRES_IN` | `12h` |
   | `CORS_ORIGIN` | your Vercel URL, e.g. `https://erp-portal.vercel.app` |
   | `NODE_ENV` | `production` |

   `PORT` is injected by Render automatically and the app reads it.
4. Deploy and watch the log for `Seed complete.` — the tables and the four role logins are
   created by the build command above. Free instances have no shell/SSH; on a paid instance you
   could instead run `npx prisma migrate deploy && npm run seed` once from the **Shell** tab.

5. Verify: `https://<your-service>.onrender.com/health` returns `{"status":"ok"}`.

> `npm run build` runs `prisma generate` before `tsc`, so the Prisma client is always
> generated for the deploy platform. `postinstall` also runs `prisma generate` as a
> safety net.
>
> Render's free tier sleeps after inactivity — the first request after a pause takes
> ~30 seconds. That is expected, not a bug.

### 3. Frontend — Vercel

1. New Project → import the same repo.
2. Settings:
   - **Root Directory:** `web`
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Environment variable: `VITE_API_URL = https://<your-service>.onrender.com`
4. Deploy. `web/vercel.json` already rewrites all paths to `index.html`, so deep links
   such as `/challans/<id>` work on refresh.

Vite inlines `VITE_*` variables at build time, so changing `VITE_API_URL` requires a
redeploy (not just a restart).

### 4. Close the loop

Set `CORS_ORIGIN` on Render to the final Vercel domain (comma-separate if you also
want preview domains), redeploy the backend, then log in from the live site.

---

## B. AWS EC2 (optional bonus)

How the server is set up, end to end:

```bash
# 1. Launch an Ubuntu 22.04 t3.micro; security group: allow 22 (your IP), 80, 443.
ssh -i key.pem ubuntu@<ec2-public-ip>

# 2. Node 20 + build tools + Nginx + PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx git
sudo npm i -g pm2

# 3. Get the code
git clone https://github.com/<user>/mini-erp-crm-portal.git
cd mini-erp-crm-portal/server
npm install

# 4. Environment variables live in a root-owned .env, never in git
sudo tee /etc/erp-portal.env >/dev/null <<'EOF'
DATABASE_URL=postgresql://...
JWT_SECRET=...
PORT=4000
CORS_ORIGIN=https://your-frontend-domain
NODE_ENV=production
EOF
sudo chmod 600 /etc/erp-portal.env
cp /etc/erp-portal.env .env   # or load with pm2 --env-file

# 5. Migrate, seed, build, run under PM2
npx prisma migrate deploy && npm run seed
npm run build
pm2 start dist/index.js --name erp-api
pm2 startup && pm2 save          # survives reboots

# 6. Nginx reverse proxy on port 80
sudo tee /etc/nginx/sites-available/erp >/dev/null <<'EOF'
server {
  listen 80;
  server_name api.example.com;
  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
EOF
sudo ln -s /etc/nginx/sites-available/erp /etc/nginx/sites-enabled/erp
sudo nginx -t && sudo systemctl reload nginx

# 7. HTTPS
sudo snap install --classic certbot
sudo certbot --nginx -d api.example.com
```

The database can be Amazon RDS for PostgreSQL (set `DATABASE_URL` accordingly, allow
the EC2 security group in the RDS group) or the same free Neon instance.

Frontend on AWS: `cd web && npm run build`, upload `dist/` to an S3 bucket with static
website hosting and put CloudFront in front of it, with an error-document rewrite to
`index.html` for client-side routing.

---

## How environment variables are managed

- Nothing secret is committed. `server/.env` and `web/.env` are git-ignored; both
  folders ship a `.env.example` documenting every key.
- Locally: copy `.env.example` → `.env` and fill it in.
- Render / Vercel: values are set in the platform dashboard and injected at runtime
  (Render) or build time (Vercel's `VITE_*`).
- EC2: a root-owned `/etc/erp-portal.env` with `chmod 600`, loaded by PM2.
- `server/src/lib/env.ts` validates on boot and throws a clear error if
  `DATABASE_URL` or `JWT_SECRET` is missing, so a misconfigured deploy fails fast
  instead of failing on the first request.

## Post-deploy checklist

1. `GET /health` returns ok.
2. Log in on the live frontend as each of the four demo accounts.
3. Warehouse user: add a product, record stock IN — it appears in the stock log.
4. Sales user: create a draft challan, confirm it — stock drops and an OUT movement
   is logged; try a quantity above stock and confirm you get a clear error.
5. Accounts user: confirm the create/edit buttons are hidden and the API returns 403.
