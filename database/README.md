# Database

**Run one file:** `complete-schema.sql` in the Supabase SQL Editor.

It is self-contained and **safe to re-run**. It already includes v2–v6, keep-alive, Drive columns and storage-offload buckets.

The other `.sql` files exist only if a studio was installed *before* a given pack. Fresh installs never need them separately.

Run **only** `complete-schema.sql` in the Supabase SQL Editor for a new studio.

It creates tables, RLS, the signup trigger, hour-bank consumption, keep-alive RPC, and four starter methodologies.
