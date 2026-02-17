
### 🏛️ The "Universe" Architecture (Integrated)

We will implement your request by creating a shared **Simulation Kernel** that can be orchestrated by two different Managers (Company vs. Fund).

#### 1. The Core Abstraction: `Universe`

A `Universe` is a self-contained economic reality.

- **Data Structure**: `struct Universe { companies: Vec<SimState>, shared_pool: f64 }`
    
- **Company Level**: The Universe contains `[Company A]`. We simulate 1,000 Universes.
    
- **Fund Level**: The Universe contains `[Company A, Company B, Company C]`. We simulate 1,000 Universes.
    

#### 2. The Shared Kernel: `Individual Company Iterator`

We must extract the simulation math from the huge loop in `projection.rs` into a pure, stateless function (or method on `SimState`).

- **Function**: `step_one_month(...)`
    
- **Input**: `Month Index`, `Current State`, `Inputs (Revenue, OpEx, etc.)`
    
- **Output**: `Operating Profit`, `Poolable Income` (The amount available to be taxed by the pool).
    
- **Logic**: Applies Growth $\rightarrow$ Revenue $\rightarrow$ OpEx $\rightarrow$ Staffing $\rightarrow$ Shocks $\rightarrow$ Cash Balance.
    

#### 3. The Two Orchestrators (The Managers)

This is where your logic regarding **Pooling Topology** is applied.

|**Feature**|**Company Manager (Ensemble)**|**Fund Manager (Portfolio)**|
|---|---|---|
|**Topology**|1,000 Universes, 1 Company each.|1,000 Universes, $N$ Companies each.|
|**Pooling Source**|Harvest from Universe $1..1000$.|Harvest from Company $1..N$ _inside_ Universe $K$.|
|**Pooling Dest.**|Redistribute to Universe $1..1000$.|Redistribute to Company $1..N$ _inside_ Universe $K$.|
|**Physics**|**Inter-Universe Physics** (Ergodicity).|**Intra-Universe Physics** (Cross-Collateralization).|

---

### 🔍 Gap Analysis & Decisions

1. **Re-Run Triggers ("On Demand" Execution)**
    
    - **Your Requirement:** "Only re-run if user requests via button... not if dividend policy changes."
        
    - **Gap:** Currently, the backend calculates everything on every request.
        
    - **Decision:** We will handle this in the **API Layer**. The Frontend will only call the heavy `POST /simulation/run` endpoint when the button is pressed. The standard `GET` will only return the deterministic (fast) view or cached results.
        
2. **Refactor vs. Patch**
    
    - **Your View:** "Completely refactor."
        
    - **My View:** Agreed. We cannot just "add" this to `projection.rs`. We need to **extract** the logic into `backend/src/engine/`.
        
    - **Strategy:** We will create `backend/src/engine/kernel.rs` (The Iterator) and `backend/src/engine/orchestrator.rs` (The Managers).
        

---

### 🛠️ Execution Plan: The "Big Refactor"

We will proceed in three logical steps to avoid breaking the build while migrating.

#### **Step 1: Extract the Kernel (The "Individual Company Iterator")**

We strip the logic out of `projection.rs` into a standalone, reusable function that works on `f64`.

#### **Step 2: Build the Orchestrators**

We implement the `CompanyManager` (restoring current behavior but cleaner) and the `FundManager` (new functionality) using the shared Kernel.

#### **Step 3: Wire the API**

We expose the new entry points in `main.rs` and update the handlers.


# Fund plan using the same api logic as company plans

OK, we're getting closer to pinning it down. Any reflections on the directory structure below that the frontend has set up? 

I notice now a clear difference in the directory structure. This may be at the heart of the issue. There is a distinct tree for the company pages vs. the plan projection pages. But only a single tree *without* fund_plan_id for the fund; both the input and the plan are in the same path without a plan id. Now the potential weakness for the company one is that the plan_id has no company id; and the serious weakness for the fund is that there is no tree with the fund_plan_id. 

## Frontend response:
You have absolutely nailed it. This directory structure is the **smoking gun**.

You have identified the exact architectural divergence that causes the "Company" simulation to work perfectly and the "Fund" simulation to fail/reset.

### The Root Cause: URL = Context

The URL tells the application "What object am I looking at?"

**1. The Company Side (Success)**

- **Path:** `app/plan/[planId]/results`
    
- **Context:** The URL contains the **Plan ID** (Scenario).
    
- **Data Flow:** The frontend uses `planId` to fetch the specific **Scenario**.
    
- **Result:** The Scenario object contains `pooling_fraction: 0.20`. The slider loads at 20%. **It works.**
    

**2. The Fund Side (Failure)**

- **Path:** `app/fund/[fundId]/results`
    
- **Context:** The URL contains the **Fund ID** (Container).
    
- **Data Flow:** The frontend uses `fundId` to fetch the generic **Fund Entity**.
    
- **The Gap:** As we established, the Fund Entity _does not_ contain the slider setting (we moved it to the Plan).
    
- **Result:** The frontend finds no slider data on the Fund object. It defaults to 0. **It resets.**
    

points directly to a Plan object containing settings. Right side: "Fund Route" where /fund/[id] points to a Fund object (Container) which has no settings, leaving the Plan object (Scenario) disconnected and unloaded.]

### Why the "Company Weakness" is minor

You noted: _"The potential weakness for the company one is that the plan_id has no company id."_

- **Why it's okay:** In the database, a `FinancialPlan` knows its `company_id`. So when you fetch Plan `123`, the backend can easily look up "This belongs to Company A." The link is preserved.
    

### Why the "Fund Weakness" is fatal

You noted: _"The serious weakness for the fund is that there is no tree with the fund_plan_id."_

- **Why it breaks:** By nesting `results` directly under `[fundId]`, the frontend is forcing a **One-to-One** relationship (One Fund = One Simulation).
    
- **The Reality:** Your backend is built for a **One-to-Many** relationship (One Fund = Many Scenarios).
    
- **The Conflict:** The frontend has no "slot" in the URL to specify _which_ of the many scenarios it should be loading.
    

### The Fix

The Frontend Architect needs to mirror the Company structure for Funds. The structure _should_ be:

Plaintext

```
frontend/app/fund-plan/[fundPlanId]/
├── inputs/
└── results/
    └── page.tsx
```

**If they do this:**

1. The URL becomes `/fund-plan/UUID-OF-SAVED-SCENARIO/results`.
    
2. The Frontend fetches that specific Plan.
    
3. The Plan has `pooling_fraction: 0.20`.
    
4. The slider works instantly.
    

**Verdict:** You are right to stop. The backend work is correct and finished. The "Technical Debt" you feel is actually just the Frontend lagging behind the architecture—it is trying to fit a "Scenario-based" backend into a "Single-Entity" frontend route.

I then responded with this prompt: "Ok, we have fixed the frontend directories now to be the same logic for company and fund.

Should we make any changes now on the backend side so that the api can fetch plans only using the fundPlanId?"

You made the right move. Aligning the directory structure (and thus the URL routing) is the key to solving the persistence issues.

To answer your question: **Yes, we should make one specific backend change** to fully support this new structure and match the Company-level logic.

### 1. Data Fetching (Already Works)

You **do not** need to change the fetching logic.

- **Endpoint:** `GET /api/funds/plans/:id`
    
- **Status:** It already accepts the ID directly and does not require the parent Fund ID in the URL.
    
- **Frontend Action:** The frontend at `/fund-plan/[fundPlanId]` can call this immediately to get the name and the slider setting (`pooling_fraction`).
    

### 2. Simulation (Needs Update)

This is where the mismatch currently exists.

- **Company Logic:** The frontend calls `GET /api/plans/:id/projection` using the **Plan ID**.
    
- **Current Fund Logic:** The frontend must call `GET /api/funds/:fundId/simulation` using the **Fund ID**.
    

**The Friction:**

With your new directory structure, the frontend page only has the `fundPlanId`. To run the simulation currently, it would have to:

1. Fetch the Plan.
    
2. Read the `fund_id` from it.
    
3. Construct a new URL for the simulation endpoint.
    

**The Fix:**

We should expose a simulation endpoint that accepts the **Plan ID** directly, exactly like the Company side.

### ｧ CLI Command: Add Plan-Based Simulation Route

This task adds `GET /api/funds/plans/:id/simulation`. It allows the frontend to run the simulation using just the ID from the URL, without needing to know the Fund ID.

Bash

```
./scripts/do_task.sh 'CONTEXT: Aligning Fund Simulation API with Company Plan API.
GOAL: Create a simulation endpoint that accepts a "fund_plan_id" directly, matching the new frontend route structure.

ACTION:
1. Update "backend/src/handlers/fund_simulation.rs":
   - Create a new handler function: `run_fund_plan_simulation`.
   - Arguments: `Path(plan_id)`.
   - Logic:
     a. Fetch the `FundPlan` using `plan_id`.
     b. Extract `fund_id` and `pooling_fraction` (and `selected_plans`) from the plan.
     c. Call the existing simulation logic (or refactor `run_fund_simulation` to be a shared internal function) using that `fund_id` and the plan details.
     d. Ensure "ergodicity_correction" (slider override) is still respected.

2. Update "backend/src/main.rs":
   - Register the new route: `.route("/api/funds/plans/:id/simulation", get(handlers::fund_simulation::run_fund_plan_simulation))`

CONSTRAINTS: 
- This makes the backend "Plan-Centric" like the frontend.
- Ensure strict tenant isolation (check tenant_id on the plan fetch).' backend/src/handlers/fund_simulation.rs backend/src/main.rs docs/ARCHITECTURAL_CONTEXT_CLI.md
```

### Final Architecture

With this change, your system is perfectly symmetrical:

|**Context**|**Frontend URL**|**Backend Fetch**|**Backend Sim**|
|---|---|---|---|
|**Company**|`/plan/[id]`|`GET /api/plans/[id]`|`GET /api/plans/[id]/projection`|
|**Fund**|`/fund-plan/[id]`|`GET /api/funds/plans/[id]`|`GET /api/funds/plans/[id]/simulation`|

This will make the frontend code significantly cleaner and fix the "resetting" bugs permanently.



**CORRECTED MEMO: Fund Simulation API Contract (Plan-Centric)**

**To:** Frontend Architect **From:** Backend Engineering **Subject:** Final API Contract for Fund Simulation (Matches Company Logic)

We have moved to a **Plan-Centric** architecture to fix the persistence issues. Do **not** use the old `/api/funds/:id/simulation` endpoint.

To run a simulation for a specific scenario (Plan), use the following contract which mirrors the Company-level logic.

### 1. The Endpoint

**`GET /api/funds/plans/:fundPlanId/simulation`**

- **`:fundPlanId`** -> The UUID of the _Fund Plan_ (Scenario) the user is currently viewing.
    

### 2. Query Parameters (Runtime Overrides)

|Parameter|Type|Required?|Description|
|---|---|---|---|
|**`months`**|`Integer`|**YES**|The simulation duration (e.g., `60`). This is a UI-state variable, not stored in the DB.|
|**`ergodicity_correction`**|`String`|No|**Slider Override.** If the user is dragging the slider but hasn't saved, send the value here (e.g., `"0.20"`). If omitted, the backend uses the saved value from the Plan.|

Export to Sheets

### 3. What you NO LONGER need to send

- ❌ `fund_id`: The backend derives this from the Plan ID.
    
- ❌ `fund_plan_id` (as a query param): It is now in the URL path.
    
- ❌ `fund_pooling_fraction`: Legacy parameter, superseded.
    

### 4. Example Request

**Scenario:** User is on "Optimistic Case" (Plan ID: `123...`), selects "5 Years" (60 months), and drags the slider to "20%".

HTTP

```
GET /api/funds/plans/12345-uuid-67890/simulation?months=60&ergodicity_correction=0.20
```

### 5. Why this works

This structure forces the backend to load the specific **Scenario** context (Selected Companies & Pooling Settings) associated with that ID, preventing the "reset to default" bug.

---

### Summary for You

You **do not** need to change any backend code.

1. **`main.rs`** has the route.
    
2. **`fund_simulation.rs`** has the logic.
    

The Frontend simply needs to update their API call to use this new route (`/api/funds/plans/...`) instead of the old one (`/api/funds/...`). This will align the Fund logic perfectly with the Company logic.

It is **not removed**, but it is effectively **deprecated/legacy** in favor of `ergodicity_correction`.

Let's look at the `SimParams` struct in your `fund_simulation.rs` file:

Rust

```
#[derive(Deserialize)]
pub struct SimParams {
    pub fund_plan_id: Option<Uuid>,
    pub months: Option<i32>,
    pub stop_insolvency: Option<bool>,
    pub include_initial_capital: Option<bool>,
    pub fund_pooling_fraction: Option<String>, // <--- STILL EXISTS
    pub ergodicity_correction: Option<String>, // <--- NEW STANDARD
    pub events_active: Option<bool>,
}
```

### How the logic works (in `run_fund_plan_simulation`)

The backend logic prioritizes `ergodicity_correction` for the _Orchestrator_ (the actual simulation math), but it still looks at `fund_pooling_fraction` for the _SimState_ (company-level memory).

1. **Orchestrator (The Math):**
    
    - **Priority 1:** `ergodicity_correction` (Slider Override).
        
    - **Priority 2:** The value saved in the Database (`fund_plan.pooling_fraction`).
        
    - **Logic:** This is the value that actually controls the pooling in the simulation.
        
2. **SimState (The "Memory"):**
    
    - **Priority 1:** `fund_pooling_fraction` (Legacy param).
        
    - **Priority 2:** The value saved in the Database (`fund_plan.pooling_fraction`).
        

### The Verdict for the Frontend Architect

You are right to question "removed." It is safer to say **"Superseded."**

- **Preferred:** Send `ergodicity_correction` (e.g., "0.20"). This drives the simulation logic.
    
- **Legacy/Fallback:** If they send `fund_pooling_fraction` (e.g., "20"), the backend will likely still parse it, but it divides by 100 logic might be inconsistent with the new direct string logic.
    

**Revised Instruction:** _"Use `ergodicity_correction` for the slider value (as a fraction string, e.g., '0.20'). The old `fund_pooling_fraction` parameter is still in the code for backward compatibility but should be avoided for new features."_

