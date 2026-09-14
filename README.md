# VLXD Sales — Backend (NestJS)

API quản lý bán hàng vật liệu xây dựng. NestJS + Prisma + PostgreSQL (Neon), deploy Render.
Khớp `docs.md` §18–29.

## Tech stack

NestJS 10 · TypeScript · Prisma 5 · PostgreSQL (Neon) · JWT (access + refresh) · Swagger/OpenAPI · class-validator.

## Nguyên tắc dữ liệu

- **Tiền = `BigInt` (số nguyên đồng VND)** — không dùng float. Response serialize BigInt → number.
- **Backend tự tính tiền** (đơn hàng, công nợ) — không tin client (docs §17).
- **Sổ công nợ `customer_ledger`** append-only là nguồn sự thật; `customer.currentDebt` denormalized cập nhật trong cùng transaction.
- **Snapshot** `productName/unit/unitPrice` vào `sale_items` — sửa/xóa sản phẩm không ảnh hưởng đơn cũ.
- **Không xóa vật lý** đơn/khách/sản phẩm: dùng `status` (soft delete) và `SaleStatus.CANCELLED`.
- **Idempotency**: `clientRequestId` chống double-submit khi mạng chập chờn.

## Chạy local

```bash
cd Be
cp .env.example .env          # điền DATABASE_URL / DIRECT_URL từ Neon
npm install
npx prisma generate
npx prisma migrate dev --name init   # tạo bảng trên Neon
npm run db:seed               # tạo tài khoản owner (SEED_OWNER_*)
npm run start:dev             # http://localhost:3000 — Swagger: /api/docs
```

## Modules & API (prefix `/api`)

| Module | Route | Ghi chú |
|---|---|---|
| auth | `POST /auth/login`, `/auth/refresh`, `GET /auth/me` | JWT access+refresh |
| users | `/users` | chỉ OWNER; không lộ passwordHash |
| customers | `/customers` | search, lọc `debtOnly`, detail có summary công nợ |
| categories | `/categories` | CRUD |
| products | `/products` | search, lọc `categoryId`, giá vốn/giá bán |
| price-lists | `/price-lists`, `/:id/items`, `/:id/price/:productId` | nhiều mức giá |
| sales | `POST /sales`, `GET /sales`, `/:id`, `PATCH /:id/cancel` | transaction + ledger |
| payments | `POST /payments`, `GET /payments` | ghi thu tiền + ledger |
| debts | `/debts/customers`, `/debts/customers/:id/ledger` | sổ công nợ |
| dashboard | `GET /dashboard/summary` | số liệu hôm nay |
| reports | `/reports/revenue/{daily,monthly,by-customer}`, `/reports/debt` | báo cáo |
| health | `GET /health` | Render health check |

Phân quyền: guard JWT toàn cục (trừ `@Public`), `@Roles(...)` theo vai trò OWNER/ADMIN/SALE.

## Deploy — Neon + Render (tối ưu chi phí)

**1. Neon (DB, free tier):** tạo project → lấy 2 chuỗi kết nối:
- `DATABASE_URL` = **Pooled** (có `-pooler`, thêm `&pgbouncer=true&connection_limit=5`) — cho runtime.
- `DIRECT_URL` = **Direct** — cho `prisma migrate`.

**2. Render (backend, free plan):** dùng `render.yaml` (Blueprint) — trỏ repo, đặt `rootDir: Be`.
- Build: `npm ci && npx prisma generate && npm run build`
- Start: `npx prisma migrate deploy && node dist/main`
- Nhập tay trên Render Dashboard (Environment): `DATABASE_URL`, `DIRECT_URL`, `CORS_ORIGINS`.
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` được Render sinh tự động.
- Health check: `/health`.

**Mẹo chi phí:** Neon scale-to-zero (ngủ khi không dùng) + Render free web service = ~$0 khi lưu lượng thấp.
Free plan Render "ngủ" sau 15 phút không request → lần gọi đầu chậm; nâng plan khi cần luôn sẵn sàng.
Backup: Neon có PITR sẵn; định kỳ `pg_dump` off-site nếu muốn chắc.

## Scripts

`npm run start:dev` · `build` · `start:prod` · `typecheck` · `prisma:migrate` · `prisma:deploy` · `db:seed`
