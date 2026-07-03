
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





# Stage 4: added additional phases to cashflow streams.
This is a fantastic milestone. Your frontend architect is going to love having a clear, definitive contract to work from.

Here is the comprehensive handover document. You can copy and paste this directly to them. It covers the structural paradigm shift, the strict business rules, the data payloads, and exactly how legacy data is handled.

# 🚀 Frontend Architect Handover: Multi-Phase Simulation Engine

## 1. The Architectural Paradigm Shift

The backend Monte Carlo simulation engine has been upgraded from a static, flat-stream model to a **dynamic, path-dependent state machine**.

A single revenue or expense stream no longer has a fixed "growth rate" or "cost percentage" at its root. Instead, data is now structured in a strict **3-Tier Hierarchy**:

1. **Root Item** (The core stream definition and global settings)
    
2. **Phases** (An ordered array of timeline or value-based stages)
    
3. **Volatility Configs** (The specific stochastic parameters attached to _each_ phase)
    

Whenever the user creates, reads, or updates a stream, the frontend must assemble and manage this nested 3-tier structure.

## 2. Core Business Rules & Triggers

The most critical UI change is that the user must now define a **Trigger Strategy** at the root level, which dictates how the simulation transitions between phases.

- **`trigger_strategy` is Global:** The user must choose either `"time_based"` or `"value_based"`. This choice lives on the root item and applies to _all_ phases within that stream. You cannot mix time-based and value-based triggers inside a single stream.
    
- **Phase 1 is the Baseline:** Every stream must have at least one phase (`phase_sequence: 1`). For Phase 1, trigger parameters are effectively ignored because it is the starting state, but passing `trigger_month: 1` is standard practice.
    
- **Time-Based Rules:** If the strategy is `"time_based"`, subsequent phases require a `trigger_month` (integer, e.g., 24 for Month 24). The threshold/operator fields can be sent as `null`.
    
- **Value-Based Rules:** If the strategy is `"value_based"`, subsequent phases require a `trigger_threshold` (string, e.g., `"50000.00"`) and a `trigger_operator` (either `"greater_than"` or `"less_than"`). The `trigger_month` field can be sent as `null`.
    

## 3. Data Types & The "Fortress Standard"

To prevent floating-point precision loss during JSON serialization, **all financial decimals and percentages must be sent and received as exact Strings** (e.g., `"3.5"`, not `3.5`).

- **Integers** like `start_month`, `end_month`, and `phase_sequence` remain actual JSON numbers (`1`, `120`).
    
- **Nulls** are now safely accepted by the backend for inactive trigger fields (e.g., sending `trigger_month: null` when using a value-based strategy).
    

## 4. Handling Legacy Database Entries

You do not need to build complex "legacy upgrade" logic on the frontend. The backend database migration has already transformed all legacy flat records into the new multi-phase format.

- **What you will receive:** When you `GET` an older stream, the backend will automatically return it with a `phases` array containing exactly one phase (`phase_sequence: 1`).
    
- **What you need to do:** Simply load this single phase into your new UI component. From the user's perspective, it will look like a standard stream that hasn't configured any advanced Phase 2 or Phase 3 triggers yet. When they save it, they will just send back the array, adding new phases if they desire.
    

## 5. API Payload Contracts

### The Request Payload (Creating / Updating)

When submitting a `POST` or `PUT`, the payload must look like this. Notice that `growth_rate_percent` and `cost_of_revenue_percent` have moved entirely inside the `phases` objects.

JSON

```
{
  "plan_id": "8a2b5ad2-49c0-4eff-9127-29ef09b271fa",
  "revenue_name": "Dynamic Enterprise Contracts",
  "source": "Direct B2B Sales",
  "start_month": 1,
  "end_month": 120,
  "initial_amount": "10000.00",
  "frequency": "monthly",
  
  "trigger_strategy": "value_based", 
  
  "phases": [
    {
      "phase_sequence": 1,
      "trigger_month": null,
      "trigger_threshold": null,
      "trigger_operator": null,
      "growth_rate_percent": "3.5",
      "cost_of_revenue_percent": "12.5",
      "volatility_configs": [
        {
          "mode_name": "compounding_growth",
          "volatility_type": "nrig",
          "vol_input_mode": "simple",
          "target_mean": "3.5",
          "vol_fatness_level": "normal",
          "vol_skew_level": "symmetric",
          "vol_width_level": "medium"
        }
      ]
    },
    {
      "phase_sequence": 2,
      "trigger_month": null,
      "trigger_threshold": "50000.00",
      "trigger_operator": "greater_than",
      "growth_rate_percent": "5.0",
      "cost_of_revenue_percent": "10.0",
      "volatility_configs": [
        {
          "mode_name": "compounding_growth",
          "volatility_type": "nrig",
          "vol_input_mode": "simple",
          "target_mean": "5.0",
          "vol_fatness_level": "normal",
          "vol_skew_level": "symmetric",
          "vol_width_level": "medium"
        }
      ]
    }
  ]
}
```

### The Response Payload (Reading / Editing)

When you `GET` a stream, or receive the response from a `POST`/`PUT`, the backend will return the exact same structure, but injected with the generated UUIDs and timestamps.

**Crucial Mapping Note for Updates:** When editing an existing stream, ensure your frontend preserves and sends back the `id` fields for the phases and volatility configs, so the backend updates the existing rows rather than creating duplicates.

JSON

```
{
  "id": "cb0c7b4b-957f-4ddd-935f-0d33e7c5269b",
  "plan_id": "8a2b5ad2-49c0-4eff-9127-29ef09b271fa",
  "revenue_name": "Dynamic Enterprise Contracts",
  "trigger_strategy": "value_based",
  "phases": [
    {
      "id": "f1dc1ec5-5dea-4723-b10f-66884ea2ba9d",
      "revenue_item_id": "cb0c7b4b-957f-4ddd-935f-0d33e7c5269b",
      "phase_sequence": 1,
      "trigger_month": null,
      "trigger_threshold": null,
      "growth_rate_percent": "3.5",
      "volatility_configs": [
        {
          "id": "cfdade5b-a8fb-4810-a7cd-81c50b3d0594",
          "phase_id": "f1dc1ec5-5dea-4723-b10f-66884ea2ba9d",
          "mode_name": "compounding_growth",
          "target_mean": "3.5"
          // ... (other configs)
        }
      ]
    }
  ]
}
```


Your memory is absolutely razor-sharp! You caught the exact detail where the frontend architect slightly misunderstood the data flow.

You are 100% correct: **`trigger_strategy` will never come back as `null` on a `GET` request.** Because of the database's strict `NOT NULL` constraint, the backend actively intercepts any `null` sent during creation and hard-saves it as `"time_based"`.

Aside from that one detail, the frontend architect's enthusiasm and overall plan are fantastic. They are completely aligned on the broader architecture.

Here is a breakdown of their points and the exact correction you can hand back to them for Point 3.

### 🟢 What the Frontend Got Perfectly Right

- **Point 1 & 2 (Ripping out inference & binding to truth):** Spot on. The UI should be a pure, dumb reflection of the backend state.
    
- **Point 4 (ID inheritance):** Absolutely critical. Their plan to map and preserve `p.id` and pass `volatility_configs` entirely unchanged is exactly what the backend needs to execute a clean `UPDATE` instead of accidentally creating duplicate database rows.
    

### 🛑 The Correction for Point 3

The architect wrote: _"If a stream only has 1 phase (strategy is null)... we instantly default the strategy..."_

**Why this is incorrect:** The API will _never_ hand them a `null` strategy. If a user creates a single-phase stream and the frontend sends a `null` strategy, the backend intercepts it, saves `"time_based"` to the database, and will forever return `"time_based"` on all future `GET` requests for that item.

**The Fix:** They don't need to invent a default state when the user clicks "+ Add Phase" because the backend already provided a valid state in the JSON payload!

### 📋 What to Send Back to the Frontend Architect

You can copy and paste this directly to them to clear up Point 3:

> "Love the plan! We are 100% aligned on Points 1, 2, and 4.
> 
> I just have one strict correction for **Point 3**: The API will **never** return `trigger_strategy: null` on a `GET` request. Because the database has a strict constraint, the backend automatically saves single-phase streams as `"time_based"`.
> 
> Therefore, when you fetch a 1-phase stream, the payload will explicitly say `"trigger_strategy": "time_based"`.
> 
> **Your revised Point 3 logic should just be:** > * Hide the dropdown if `phases.length === 1`.
> 
> - When the user clicks '+ Add Phase', just unhide the dropdown. You don't need to set a default state because it is already securely populated with the string the backend gave you!"
>