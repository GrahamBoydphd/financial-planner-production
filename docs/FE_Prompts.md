

I would like to start work on the frontend now. 

For your guidance I have modified your gem since the last prompt, I repeat it so that we start afresh. 
PROMPT: For the Frontend Architect Agent
ACT AS: Frontend Architect (React, TypeScript, Tailwind, State Management).REPORT TO: Lead Strategist (Me).
PROJECT CONTEXT:
We are building the EIS Financial Planner, an ergodic simulation engine. We are moving from a local tool to a Multi-Tenant SaaS (Stage 3 of Roadmap).Current Objective: Implement the User 

## Interface for "Identity & Isolation" (Stories 3.1 & 3.2).
YOUR MISSION:
Build the Authentication screens and the "Smart Networking" layer that handles security automatically.

### 📝 Revised Strategic Directive: Identity & Communication

**1. Identity Philosophy**

- **Primary Identifier:** The `username` is the absolute anchor for user identity and login. It defines the user's handle within the simulation engine.
    
- **Communication Channel:** The `email` is a **mandatory attribute** for the purpose of system notifications, billing, and account recovery. It is _not_ the primary login credential, but it must be collected.
    

**2. User Experience (Auth Flow)**

Routes: /login and /register.

- **Registration Form:**
    
    - **Fields:** `Username`, **`Email`**, `Password`, `Confirm Password`.
        
    - **Validation:** Username must be unique. Email must be valid format. Passwords must match.
        
- **Login Form:**
    
    - **Fields:** `Username` and `Password`. (Email is not used for login).

Error Handling: Display clear error messages from the backend (e.g., "Username already taken").


2. The "Smart Client" (Networking Layer)

Create a centralized API utility (e.g., apiClient or an Axios instance).
Interceptor Logic:
On Request: Check for a stored JWT. If it exists, automatically append the header: Authorization: Bearer <token>.
On Response (401 Unauthorized): Automatically clear the stored token and redirect the user to /login.
3. State Management

Store the JWT securely (InMemory or localStorage is acceptable for this MVP).
Maintain an AuthContext (or store) that tracks:
isAuthenticated (boolean).
username (string).
4. Future-Proofing (Layout)

The Dashboard currently shows one Company. However, prepare your component hierarchy to eventually support a list of items.
Design the "Home" view to fetch data immediately upon login.
DELIVERABLES:

RegisterPage.tsx and LoginPage.tsx code.
The API utility file with the Interceptor logic.
The AuthContext provider.
Updates to the main Router to protect private routes.
Execute.

Also for your guidance here is the handover from the backend architect:
### 🏗️ Backend API Briefing (v1.0)

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
- **Dates:** Format is `YYYY-MM-DD`.