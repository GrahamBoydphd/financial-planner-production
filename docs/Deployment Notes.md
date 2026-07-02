
# stage 4 adding 2nd volatility and cashflow stages

Because we are stripping columns and restructuring core tables, treating production deployment with "fortress-level" care is the only way to fly.

The beautiful thing about using **SQLx migrations** is that they are natively version-controlled and incremental. When we deploy to Scaleway, you won't have to manually execute SQL patches or worry about transcription errors—the SQLx CLI will look at the server's database, see exactly which migrations haven't run yet, and apply them sequentially in a single atomic transaction.

Here is the exact structural summary you should record in a `deployment_notes.md` file right now to capture this week's architectural leap.

# 📝 Scaleway Deployment Blueprint: Dual-Stochastic & Phase-Shift Upgrades

## 🗓️ Overview of Structural Changes (July 2026)

This week, the backend database structure was refactored from a **single flat stream architecture** into a **dynamic, relational state-machine matrix**.

- **Impact Level:** High (Data-destructive to old flat schemas, but features automated data-bridge backfilling).
    
- **Target Environment:** Scaleway Managed PostgreSQL / Compute DB instance.
    

## 🗄️ 1. The Migration Registry

When deploying to the server, these two migrations _must_ execute in this exact sequence. SQLx handles this automatically via timestamps:

### 🔹 Migration A: `20260701125157_dual_stochasticity.sql`

- **What it did:** Created separate `revenue_item_volatility_policies` and `expense_item_volatility_policies` tables.
    
- **Data Migration:** Safely extracted all existing single-volatility metrics out of the primary stream items and moved them to the new relational tables.
    
- **Cleanup:** Dropped the old flat `vol_` columns from the main tables.
    

### 🔹 Migration B: `20260702072440_phase_shift_architecture.sql`

- **What it did:** Created the `revenue_item_phases` and `expense_item_phases` behavior engine tables. Added `trigger_strategy` to primary tables.
    
- **Data Migration:** Automatically packaged all existing historical streams into an initial "Phase 1" record (starting at Month 1). It then re-routed the volatility policy tables to point to these new Phase records instead of the root items.
    
- **Cleanup:** Dropped the root `growth_rate_percent`, `cost_of_revenue_percent`, and `pct_of_revenue` columns from the primary shells, as they are now managed dynamically inside phases.
    

## 🚨 2. Pre-Deployment Safety Protocol (The "Do Not Skip" Steps)

Before running the code update or migrations on the Scaleway server, execute a hard snapshot backup of the live production database. If anything goes sideways during the data transformation, we can restore the exact state in seconds.

Bash

```
# Run this from your terminal or Scaleway access point to dump the production state
pg_dump -H your_scaleway_db_host -U your_user -d your_production_db_name > production_pre_phase_shift_backup.sql
```

## 🚀 3. Live Server Execution Steps

Once the production environment is backed up and the new code binary is pulled onto the Scaleway box, run the database migrations from the backend root folder before starting the application:

Bash

```
# 1. Verify what migrations the server is missing compared to your codebase
sqlx migrate info

# 2. Execute the data transformations atomically
sqlx migrate run
```

### ⚠️ Critical Deployment Coordination Guardrail

> **Deploy Backend and Frontend in a Strict Window:** Because the database drops the old root columns (`growth_rate_percent`, legacy `vol_` types), the _old_ frontend app code will instantly crash or send bad payloads if a user tries to create/edit an item before the frontend is updated.
> 
> You must deploy the backend binary and the new frontend UI elements simultaneously, or temporarily put up a "Maintenance Mode" splash page for the 2 minutes it takes to run the migration and restart the services.