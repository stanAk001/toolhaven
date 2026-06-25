# Toolhaven — multi-category affiliate platform (PERN)

A full-stack affiliate tools directory: PostgreSQL + Express + React + Node, with a
data-driven category system (add a category or tool in the DB and the whole site updates —
no code changes). Editorial "honest guide" design, plain-English tool pitches, working
comparison, blog, newsletter, contact form, and affiliate-click tracking.

```
toolhaven/
├── docker-compose.yml      # local Postgres
├── backend/                # Express API + Prisma
│   ├── prisma/
│   │   ├── schema.prisma   # full schema (11 tables)
│   │   └── seed.js         # 6 categories, 12 tools, 3 posts, testimonials
│   └── src/
│       ├── server.js       # app entry (helmet, cors, rate-limit)
│       ├── lib/prisma.js
│       ├── middleware/error.js
│       └── routes/         # categories, tools, reviews, blog, newsletter, contact, clicks
└── frontend/               # Vite + React + Router + Tailwind
    └── src/
        ├── api/client.js   # axios wrappers
        ├── lib/helpers.jsx # icon map, affiliate redirect, data hook
        ├── components/     # Navbar, Footer, ToolCard, CategoryCard, Stars…
        └── pages/          # Home, ToolsDirectory, CategoryPage, ToolDetail,
                            #   Compare, Blog, BlogPost, About, Contact
```

## 1. Start the database

```bash
docker compose up -d        # Postgres on localhost:5432 (user/pass/db = toolhaven)
```
No Docker? Create a database and put its connection string in `backend/.env`.

## 2. Backend

```bash
cd backend
cp .env.example .env        # adjust DATABASE_URL if needed
npm install
npm run migrate             # create tables (prisma migrate dev)
npm run seed                # load categories, tools, posts
npm run dev                 # API on http://localhost:4000
```
Quick check: `curl http://localhost:4000/api/tools` should return JSON.
Inspect data visually with `npm run studio` (Prisma Studio) — this replaces pgAdmin,
or point pgAdmin at the same `localhost:5432` connection.

## 3. Frontend

```bash
cd frontend
cp .env.example .env        # VITE_API_URL defaults to http://localhost:4000/api
npm install
npm run dev                 # site on http://localhost:5173
```

## API reference

| Method | Route | Purpose |
|--------|-------|---------|
| GET  | `/api/categories` | all categories + tool counts |
| GET  | `/api/categories/:slug` | one category + its tools + related posts |
| GET  | `/api/tools` | filter/search/sort/paginate (`category, search, minRating, maxPrice, priceType, sort, page, limit`) |
| GET  | `/api/tools/compare?slugs=a,b,c` | up to 3 tools for the compare table |
| GET  | `/api/tools/:slug` | full tool page (features, specs, reviews, testimonials, related) |
| GET  | `/api/blog` · `/api/blog/:slug` | posts list + single post |
| POST | `/api/reviews` | submit a review |
| POST | `/api/newsletter/subscribe` | add subscriber + category prefs |
| POST | `/api/contact` | contact form |
| POST | `/api/affiliate-clicks` | log a click, returns the affiliate URL to open |
| GET  | `/api/affiliate-clicks/stats` | click totals by category/tool (admin) |

## Adding a category or tool (no code)

Open Prisma Studio (`npm run studio`) → add a `Category` (give it a `slug`, `name`,
`iconKey`, and two hex colors) → add `Tool` rows pointing at it. The homepage card,
directory section, filters, and category page all appear automatically.

`iconKey` values map to lucide icons in `frontend/src/lib/helpers.jsx`
(`Sparkles, TrendingUp, Zap, Palette, Code2, Megaphone`). Add more to that map as needed.

## Deploy

- **Frontend → Vercel:** root `frontend`, build `npm run build`, output `dist`,
  set `VITE_API_URL` to your live API URL.
- **Backend → Railway/Render:** deploy `backend`, add a Postgres add-on, set
  `DATABASE_URL` and `CORS_ORIGIN` (your Vercel URL). Run `prisma migrate deploy` then the seed.

## What's stubbed vs. done

Done and working end-to-end: every page, every GET/POST route, filtering, comparison,
affiliate click logging, the full data model, and seed data.

Left as clear extension points: JWT admin auth (routes for create/update are easy to add
behind a check), Nodemailer wiring in `contact.js`, image hosting (tools use monogram tiles
for now), and SEO/schema/sitemap generation.
