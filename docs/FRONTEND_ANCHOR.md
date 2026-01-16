# Frontend Architecture Anchor

This document was produced by Jules, auditing the V1.0 code running on the server, and serves as the "Anchor Document", the architectural reference for the `frontend/` directory.

## 1. Component Architecture

### Structure & Composition
- **Framework**: Next.js (App Router).
- **Directory Structure**:
  - `app/`: Contains page routes (e.g., `/plan/[planId]/results/page.tsx`).
  - `components/`:
    - `ui/`: Reusable base components (`Button.tsx`, `Card.tsx`). These are **custom components**, not Shadcn/ui.
    - `forms/`: Domain-specific forms for inputting financial data.
    - `Layout.tsx`: Global layout wrapper using standard Next.js patterns.
- **Styling**: **Tailwind CSS** is used exclusively.
  - Conventions: Utility classes inline (e.g., `bg-blue-600 text-white rounded`).

### Observations
- No component library (Shadcn, MUI) is installed; components are hand-rolled using Tailwind.
- `Layout` component provides the persistent navigation bar.

## 2. State & Data Fetching

### Backend Communication
- **Client**: `axios` is used via a centralized `api` object in `frontend/lib/api.ts`.
- **Base URL**: `process.env.NEXT_PUBLIC_API_URL` or defaults to `http://localhost:8000`.
- **Pattern**:
  - Components/Pages import `api` from `@/lib/api`.
  - Data is fetched inside `useEffect` hooks.
  - Mutations (POST/PUT) are handled in event handlers and typically trigger a re-fetch (e.g., via a `refreshTrigger` counter).

### State Management
- **Strategy**: **Local State**.
  - No global state manager (Redux, Zustand, Context) is observed for data.
  - State is lifted to the Page level (e.g., `ResultsPage` in `results/page.tsx`) and passed down to sub-components like `CashFlowChart` or `KPICards`.
- **Caching**: No active caching strategy (e.g., React Query, SWR) is currently implemented; data is fetched fresh on mount or update.

## 3. Visualization Logic

### Library
- **Chart.js** via `react-chartjs-2`.

### Graph Components
- **Primary Component**: `frontend/components/CashFlowChart.tsx`.
- **Logic**:
  - Handles multiple modes: `standard`, `single` (stochastic), and `monte_carlo`.
  - Implements complex logic for fan charts (percentile bands) in Monte Carlo mode using `fill` and stacked datasets.
  - Custom "diagonal hatch pattern" used for "Fantasy Debt".

### "Slider" & Interaction Logic
- **Location**: The "Non-Ergodicity" slider (and others) are located in **`frontend/app/plan/[planId]/results/page.tsx`**, not in a separate graph component or `monte-carlo/` directory.
- **Isolation**:
  - The slider controls the `poolingFraction` state variable in the parent `ResultsPage`.
  - **Mechanism**:
    1. User drags slider -> updates local state `poolingFraction`.
    2. User releases (`onMouseUp`/`onTouchEnd`) -> calls `api.updatePlan`.
    3. `api.updatePlan` success -> triggers `useEffect` to refetch the projection from the backend.
  - The graph does *not* calculate changes client-side; it purely renders the backend response.

## 4. Variable Alignment

### Backend vs. Frontend
- **Naming Convention**: The frontend strictly adheres to the **snake_case** convention returned by the Python backend.
- **Interfaces**:
  - Defined in `frontend/lib/api.ts` (e.g., `MonthlyData`, `FinancialPlan`, `SimulationResult`).
  - Fields like `cumulative_pool_received`, `total_value`, `cash_balance` are used directly in the React components without mapping to camelCase.

### Key Data Structures
- **`MonthlyData`**: Represents a single time-step (month) in the simulation.
- **`SimulationResult`**: Contains arrays for deterministic runs and percentile arrays (`p50_value`, `p90_value`) for Monte Carlo results.
