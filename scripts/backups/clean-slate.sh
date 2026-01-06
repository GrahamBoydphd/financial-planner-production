#!/bin/bash

# 1. Clean up: Delete the dynamic route folders entirely to remove any hidden/ghost files
rm -rf frontend/app/company/\[companyId\]
rm -rf frontend/app/fund/\[fundId\]
rm -rf frontend/app/plan/\[planId\]

# 2. Re-create Directories
mkdir -p frontend/app/company/\[companyId\]
mkdir -p frontend/app/fund/\[fundId\]
mkdir -p frontend/app/plan/\[planId\]/inputs
mkdir -p frontend/app/plan/\[planId\]/results

# 3. Create the Client Pages (The UI Code)
# --- ClientPage for Company ---
cat > frontend/app/company/[companyId]/ClientPage.tsx << 'EOF'
'use client';
export default function ClientPage({ params }: { params: { companyId: string } }) {
  return <div>Company Details for {params.companyId}</div>;
}
EOF

# --- ClientPage for Fund ---
cat > frontend/app/fund/[fundId]/ClientPage.tsx << 'EOF'
'use client';
export default function ClientPage({ params }: { params: { fundId: string } }) {
  return <div>Fund Details for {params.fundId}</div>;
}
EOF

# --- ClientPage for Plan Inputs ---
cat > frontend/app/plan/[planId]/inputs/ClientPage.tsx << 'EOF'
'use client';
export default function ClientPage({ params }: { params: { planId: string } }) {
  return <div>Plan Inputs for {params.planId}</div>;
}
EOF

# --- ClientPage for Plan Results ---
cat > frontend/app/plan/[planId]/results/ClientPage.tsx << 'EOF'
'use client';
export default function ClientPage({ params }: { params: { planId: string } }) {
  return <div>Plan Results for {params.planId}</div>;
}
EOF

# 4. Create the Server Pages (The Static Export Fix)
# --- Page for Company ---
cat > frontend/app/company/[companyId]/page.tsx << 'EOF'
import ClientPage from './ClientPage';

export async function generateStaticParams() {
  return [];
}

export default function Page({ params }: { params: { companyId: string } }) {
  return <ClientPage params={params} />;
}
EOF

# --- Page for Fund ---
cat > frontend/app/fund/[fundId]/page.tsx << 'EOF'
import ClientPage from './ClientPage';

export async function generateStaticParams() {
  return [];
}

export default function Page({ params }: { params: { fundId: string } }) {
  return <ClientPage params={params} />;
}
EOF

# --- Page for Plan Inputs ---
cat > frontend/app/plan/[planId]/inputs/page.tsx << 'EOF'
import ClientPage from './ClientPage';

export async function generateStaticParams() {
  return [];
}

export default function Page({ params }: { params: { planId: string } }) {
  return <ClientPage params={params} />;
}
EOF

# --- Page for Plan Results ---
cat > frontend/app/plan/[planId]/results/page.tsx << 'EOF'
import ClientPage from './ClientPage';

export async function generateStaticParams() {
  return [];
}

export default function Page({ params }: { params: { planId: string } }) {
  return <ClientPage params={params} />;
}
EOF

# 5. Create .dockerignore to prevent dirty context (CRITICAL FIX)
cat > .dockerignore << 'EOF'
# Git
.git
.gitignore

# Node
node_modules
npm-debug.log

# Next.js
.next
out
build

# Rust
target
**/*.rs.bk

# Env
.env
EOF

echo "✅ Clean slate applied. Ghost files removed, fresh wrappers created, .dockerignore added."
