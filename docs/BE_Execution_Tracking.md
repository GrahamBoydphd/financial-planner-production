
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