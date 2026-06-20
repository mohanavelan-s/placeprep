# PlacePrep Cloud Deployment

## Frontend

- Deploy the React app on Vercel.
- Set `VITE_API_URL=https://your-backend-domain/api`.
- Optionally set `VITE_API_FALLBACK_URLS` to comma-separated backup API origins for faster diagnosis if the primary URL stops resolving.

## Backend

- Deploy the Node.js API from `server/` on Render or Railway.
- Public signup is enabled by default. Set `INVITE_ONLY_ACCESS=true` only if you need to temporarily close free registration.
- Set `CLIENT_URLS` to the deployed frontend origin.
- Set `APP_URL` to the public frontend URL used in invite links.
- `OWNER_EMAILS` defaults to `mohanavelan2006@gmail.com`; any matching account is promoted to admin with full college-tier access during signup, login/profile reads, and startup schema sync.
- Keep `SMTP_FORCE_IPV4=true` on hosts that do not route IPv6; Gmail SMTP can otherwise resolve to IPv6 and fail before delivery starts.

## Razorpay Billing

- Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` on the backend host.
- Set `RAZORPAY_PRO_MONTHLY_AMOUNT=29900` for the INR 299/month Pro checkout.
- Set `RAZORPAY_PRO_ANNUAL_AMOUNT=249900` for the INR 2,499/year Pro checkout.
- Amounts use the smallest currency unit, so INR 299 is `29900`.
- Keep `RAZORPAY_COLLEGE_AMOUNT` blank unless college checkout should be one fixed self-serve annual price. For quotes, collect payment separately or set the negotiated annual amount before checkout; INR 15,000/year is `1500000`, and INR 2,00,000/year is `20000000`.
- The Checkout endpoint is `POST /api/billing/checkout`; it creates a Razorpay order and returns the browser checkout payload.
- Standard Razorpay aliases are also available as `POST /api/create-order` and `POST /api/verify-payment`.
- The browser verifies completed checkout through `POST /api/billing/verify`.
- The Razorpay webhook endpoint is `POST /api/billing/webhook`.
- Webhooks verify `x-razorpay-signature`, record event ids for idempotency, persist payment/order state, and reconcile paid access into user tiers.

## Database

- Use managed PostgreSQL such as Supabase Postgres.
- Point `DATABASE_URL` at the managed database.

## Storage

- Configure Cloudinary to store images, resumes, and APK uploads.
- Without Cloudinary, the API falls back to local storage and is not suitable for multi-instance production.

## Invite Access

- Use `BOOTSTRAP_ADMIN_INVITE_CODE` and `BOOTSTRAP_USER_INVITE_CODE` if you want one fixed admin invite and one fixed user invite at startup. `BOOTSTRAP_INVITE_CODE` remains as a legacy single-code fallback.
- Admin users can generate additional invites from Settings.

## Android

- Build the Android app from `/android`.
- Upload the generated `app-release.apk` from the admin Android panel in Settings.
