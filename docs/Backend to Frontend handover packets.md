
# Packet 1:  The Handoff Packet (For the Frontend Architect)

I have prepared this summary. When you start the next session with the Frontend Architect, you can simply hand them this briefing so they know exactly what to build against.

### Backend API Briefing (v1.0)
 

**Base URL:** `http://localhost:8000`

  

**Authentication:**

- **Mechanism:** JWT (Bearer Token).

- **Header:** `Authorization: Bearer <token>`

- **Login:** `POST /api/auth/login` -> Returns `{ "token": "...", "user_id": "...", "tenant_id": "..." }`

- **Register:** `POST /api/auth/register` -> Returns same as login.

  

**Core Resources (Protected):**

- **Plans:** `GET/POST /api/plans`, `GET/PUT/DELETE /api/plans/:id`

- **Projection:** `GET /api/plans/:id/projection` (The Heavy Calculation)

- **Companies/Funds:** Standard CRUD.

  

**Data Types (Critical):**

- **Currency:** All monetary values are Strings in JSON (e.g., `"100.50"`) to preserve `Decimal` precision.

- **Dates:** Format is `YYYY-MM-DD`.**



# Packet 2:  Final Architectural Handoff
This is the **Final Architectural Handoff** for the Frontend. It summarizes every contract, data type, and security rule the Frontend must respect to successfully talk to the new "Fortress" Backend.

Status: The Backend is now fully strict, multi-tenant, and type-safe.

Implication: Any request that deviates from these rules will be rejected with 401 Unauthorized, 422 Unprocessable Entity, or 500 Internal Server Error (Database Constraint Violation).

---

### 1. 🔐 Authentication & Security (The "Gatekeeper")

The Frontend **must** manage the session state explicitly.

- **Header Rule:** Every request (except `/auth/*`) **MUST** include:
    
    HTTP
    
    ```
    Authorization: Bearer <token_string>
    ```
    
- **Token Source:** The `token` comes from the Login/Register response.
    
- **Session Storage:** Store the `token`, `user_id`, and `tenant_id` immediately upon login.
    

#### **Endpoints**

|**Action**|**Endpoint**|**Payload (JSON)**|**Critical Notes**|
|---|---|---|---|
|**Login**|`POST /api/auth/login`|`{ "username": "...", "password": "..." }`|Returns `token`, `user_id`, `tenant_id`.|
|**Register**|`POST /api/auth/register`|`{ "username": "...", "password": "...", "email": "...", "full_name": "..." }`|**All fields are mandatory.** `email` must be unique. `full_name` is required.|

---

### 2. 🧱 Data Types (The "Golden Rules")

Rust's `serde` is unforgiving. The Frontend must send data exactly as described.

- **Money / Decimals:** Send as **Strings** (e.g., `"150000.50"`).
    
    - _Why:_ Sending raw numbers (150000.50) can cause floating-point errors. The backend expects a String to parse into `Decimal`.
        
- **Dates:** Send as **Strings** in ISO format: `"YYYY-MM-DD"`.
    
    - _Example:_ `"2024-01-01"` (Day is usually required even if monthly).
        
- **IDs (UUID):** Send as standard UUID Strings.
    
- **Enums:** Send as `snake_case` strings (e.g., `"monte_carlo"`, `"fixed_count"`).
    

---

### 3. 🏗️ "Container" Resources (Funds, Companies, Plans)

These create the structure. **Crucial:** You never send `tenant_id` or `user_id` manually anymore. The Backend injects them from the Token.

#### **Funds**

- **Create:** `POST /api/funds`
    
- **Payload:** `{ "name": "Fund Name" }`
    
- **Note:** Automatically links to the logged-in User and Tenant.
    

#### **Companies**

- **Create:** `POST /api/companies`
    
- **Payload:** `{ "fund_id": "<UUID>", "name": "Company Name", "industry": "...", "business_model": "..." }`
    
- **Note:** `fund_id` is required. Backend links it to the Tenant.
    

#### **Plans**

- **Create:** `POST /api/plans`
    
- **Payload:** `{ "company_id": "<UUID>", "name": "Base Case", "start_month": "2024-01-01" }`
    
- **Note:** `company_id` is required.
    

---

### 4. 📊 Financial Items (Revenue, Expenses, etc.)

These are the "rows" in the Excel sheet. They **must** link to a `plan_id`.

**Security Rule:** The `plan_id` sent in the payload MUST belong to the user's Tenant. If you try to add revenue to someone else's plan ID, you get `404 Not Found`.

#### **Revenue Items**

- **Create:** `POST /api/revenue`
    
- **Payload:**
    
    JSON
    
    ```
    {
      "plan_id": "<UUID>",
      "name": "SaaS Subscriptions",
      "source": "B2B",
      "start_month": 1,
      "end_month": 60,
      "initial_amount": "10000.00",
      "growth_rate_percent": "5.0",
      "frequency": "monthly",
      "cost_of_revenue_percent": "20.0"
      // Optional Volatility Params: "volatility_type", "vol_mean", etc.
    }
    ```
    

#### **Expense Items**

- **Create:** `POST /api/expenses`
    
- **Payload:** Same structure as Revenue, but with `category` instead of `source`.
    
    - Field: `pct_of_revenue` (Optional, String Decimal).
        

#### **Staffing Roles** (Updated!)

- **Create:** `POST /api/staffing`
    
- **Payload:**
    
    JSON
    
    ```
    {
      "plan_id": "<UUID>",
      "role_name": "Engineer",
      "annual_salary": "120000.00",
      "start_month": 1,
      "target_count": 5,           // Integer
      "hiring_plan": "fixed_count", // or "monthly_rate"
      "hiring_rate": 1,            // Optional Integer
      "annual_increase": "3.0"
    }
    ```
    

#### **Capital Injections**

- **Create:** `POST /api/capital`
    
- **Payload:** `{ "plan_id": "...", "name": "Seed Round", "amount": "5000000.00", "month": 1 }`
    

---

### 5. 📜 Policies & Configuration (Singletons)

These follow "Upsert" logic (One per plan).

#### **Dividends**

- **Upsert:** `POST /api/dividends`
    
- **Payload:** `{ "plan_id": "...", "is_enabled": true, "safety_threshold": "100000.00", "payout_ratio": "0.5" }`
    

#### **Credit Facilities**

- **Upsert:** `POST /api/credit`
    
- **Payload:** `{ "plan_id": "...", "facility_limit": "1000000.00", "interest_rate": "0.05", "is_annual_rate": true }`
    

#### **Treasury / Capital Growth**

- **Upsert:** `POST /api/capital-growth`
    
- **Payload:** `{ "plan_id": "...", "volatility_type": "brownian", "vol_mean": "0.05", "vol_scale": "0.1" }`
    

---

### 6. 🧮 The Calculation Engine (Projection)

This is the big output.

- **Endpoint:** `GET /api/plans/:id/projection`
    
- **Query Parameters:**
    
    - `?months=60` (Integer)
        
    - `?initial_cash=500000.00` (String Decimal)
        
    - `?mode=monte_carlo` (or `single`)
        
    - `?stop_insolvency=false` (Boolean)
        

---

### 7. 🚨 Error Dictionary

If the Frontend sees these errors, here is what they mean:

- **401 Unauthorized:**
    
    - **Cause:** Token missing, expired, or invalid.
        
    - **Fix:** Redirect to Login.
        
- **422 Unprocessable Entity:**
    
    - **Cause:** Bad JSON. Likely sent a Number instead of String-Decimal, or missing a mandatory field (like `full_name`).
        
    - **Fix:** Check the Payload shape against the "Data Types" section above.
        
- **404 Not Found:**
    
    - **Cause:** Trying to access/edit a Plan/Fund/Company that does not belong to your Tenant.
        
- **500 Internal Server Error:**
    
    - **Cause:** Database Constraint Violation. Usually happens if you try to create a User with a duplicate Email.



