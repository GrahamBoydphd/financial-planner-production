# ROADMAP: The Master Vision (Stages 1-7)

**Mission:** To build an enterprise-grade financial simulation engine that reveals the *non-ergodic* truth of startup growth for two distinct audiences: **Founders (Micro)** and **Investors (Macro)**.

---

## 1. The Strategic Trajectory (Dual Tracks)

The roadmap is not linear; it has dependencies. The **Investor Track** wraps the **Company Track**.

| Stage                  | Company Track (The "Physics")                                                                                                                                                                                                                                                                                                                                                                                          | Status (Co) | Investor Track (The "Aggregator")                                                                                                                                                                                                                                                                     | Status (Inv) |
| :--------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------- |
| **1. The Core**        | Single-User Monte Carlo & Cashflow.                                                                                                                                                                                                                                                                                                                                                                                    | **DONE**    | *N/A*                                                                                                                                                                                                                                                                                                 | **N/A**      |
| **2. The Correction**  | Pooling dynamics & Non-Ergodic math.                                                                                                                                                                                                                                                                                                                                                                                   | **DONE**    | *N/A*                                                                                                                                                                                                                                                                                                 | **N/A**      |
| **3. The Cloud (NOW)** | **Multi-Tenant User Layer.**                                                                                                                                                                                                                                                                                                                                                                                           | **DONE**    | A simple fund with $N$ companies. $n$ of them are created by the investor, $N-n$ are automatically created by the engine. Each of the companies created by the investor uses the Company Version software.<br>**Shared Auth Infrastructure.**                                                         | **DONE**     |
| **4. The Base Fund**   |                                                                                                                                                                                                                                                                                                                                                                                                                        |             | **Portfolio Wrapper:** Runs $N$ Company sims.<br>Implementation of "Waterfall".<br>Option of pooling in each fund, key investor metrics measured.<br>Do profit pooling between the N companies in the fund; and a monte carlo over M clones of the whole fund, without profit pooling between clones. | *NEXT*       |
| **5. The Economy**     | Tokenized Billing (Pay per Run).<br>Upgraded Business Modelling (BM) with more sophisticated input options and simulation parameters, and a low-level business model commentary in the output. Including  shocks, both shocks with / unique to a company, and economy-wide shocks affecting all companies, with the potential for a given shock to benefit some and harm others. Include the degree of non-ergodicity. | *PLANNED*   | A commentary comparing the likely fund performance with and without simple correction to the non-ergodic dynamics.<br><br>Add payment functionality to the cloud.                                                                                                                                     | *PLANNED*    |
| **6. The Diagnosis**   | Automated Business Model Analysis (AI).<br>Higher quality more comprehensive business model diagnosis and output. This will likely be an API call to dedicated Gemini agent with a good set of instructions                                                                                                                                                                                                            | *PLANNED*   | A full simulation of an economy of $M$ companies, $N$ of which are in the investor's fund, $n$ created by the investor.<br><br>Automated Portfolio Optimization.                                                                                                                                      | *PLANNED*    |
| **7. The Ecosystem**   | **Full Production:** Enterprise features.                                                                                                                                                                                                                                                                                                                                                                              | *TARGET*    | **Full Production:** Multi-Fund management.                                                                                                                                                                                                                                                           | *TARGET*     |

## 2. The Architectural Pattern: "The Active Wrapper"
*Crucial Design Decision for the Architect.*

The **Investor Backend** is not just a passive aggregator. It acts as a **Capital Router** between concurrent simulations.
* **Company Simulation:** $f(inputs) \rightarrow outputs$
* **Investor Simulation:** Runs $N$ instances of $f(inputs)$ simultaneously.
    * *Intervention:* It extracts free cash flow from Profitable Company $A$ and injects it into Struggling Company $B$ (via the Fund Pool).

### Track A: Company (The "Ensemble" Pool)
* **Entities:** 1 Company.
* **Simulation:** 1,000 Clones (Parallel Universes).
* **Pooling Logic:** **Horizontal Pooling.**
    * The 1,000 clones share a resource pool (0-100% configurable).
    * *Purpose:* To demonstrate the effects of ergodicity breaking on a single entity over time.
### Track B: Investor (The "Portfolio" Pool)
* **Entities:** $N$ Companies in 1 Fund.
* **Monte Carlo Simulation:** $M$ Clones of the **Entire Fund**.
* **Pooling Logic:** **Vertical Pooling.**
    * **Inside the Fund:** The $N$ companies share a resource pool (Cross-subsidization/Dividends).
    * **Between Fund Clones:** **ZERO Pooling.** Fund Clone #1 cannot bail out Fund Clone #2.

## 3. The User Authorisation
### The "3-Tier" Hierarchy (Target State)
1.  **Tenant (The Customer):**
    * *Type A: Company* (Startup).
    * *Type B: Fund* (VC Firm).
    * *Type C: Freelancer / Student: Tenant is this person.*
2.  **Department:** Optional subgroup.
3.  **User (The Actor):** The human logging in.

## 5. The "Constitution" (Irreversible Decisions)

### A. The "Frozen Core" Law
The financial logic (`projection.rs`) is **SACRED**.
* **Constraint:** Auth logic wraps *around* it. No "User" logic ever penetrates the math engine.

### B. The "Immutable Infrastructure" Law
The Production Server is **READ-ONLY**.

### C. The "Root Routing" Law
* **Client:** Always points to Root (`/`).
* **Proxy:** Caddy handles routing.

### D. The "Stateless Identity" Law
* **Decision:** Custom Stateless JWT.
* **Reasoning:** Absolute control over `tenant_id` injection.