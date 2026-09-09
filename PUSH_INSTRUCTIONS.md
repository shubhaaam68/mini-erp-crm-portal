# How to push this to GitHub

Run these from inside the extracted `mini-erp-crm-portal/` folder. They create a small,
sensible commit history instead of one giant "initial commit".

```bash
git init -b main
git config user.name  "Your Name"
git config user.email "your@email.com"

# 1. project scaffolding
git add .gitignore README.md ARCHITECTURE.md PUSH_INSTRUCTIONS.md docs/
git commit -m "docs: project README, architecture notes, deployment guide and Postman collection"

# 2. database schema
git add server/prisma server/package.json server/package-lock.json server/tsconfig.json server/.env.example server/.gitignore
git commit -m "feat(server): project setup with Prisma schema and initial migration"

# 3. api foundations
git add server/src/lib server/src/middleware server/src/index.ts
git commit -m "feat(server): express app, JWT auth, role guard, zod validation and error handling"

# 4. api modules
git add server/src/routes server/src/seed.ts
git commit -m "feat(server): customers, products, stock movements, challans and dashboard APIs"

# 5. frontend
git add web/
git commit -m "feat(web): react admin UI for CRM, inventory, stock log and sales challans"

# 6. anything left
git add -A && git commit -m "chore: remaining project files" || true

# push (create the empty repo on GitHub first, without a README)
git remote add origin https://github.com/<your-username>/mini-erp-crm-portal.git
git push -u origin main
```

Nothing secret is in the repo: `.env` files are git-ignored and only `.env.example`
files are committed. Do not commit your real `DATABASE_URL` or `JWT_SECRET`.

After pushing, deploy with `docs/DEPLOYMENT.md`, then record the walkthrough using
`docs/DEMO_SCRIPT.md` and fill in the Google Form with the answers listed at the end
of that file.
