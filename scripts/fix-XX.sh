# 1. Fix Company Page
cat > frontend/app/company/[companyId]/page.tsx << 'EOF'
import ClientPage from './ClientPage';

export async function generateStaticParams() {
  return [];
}

export default function Page({ params }: { params: { companyId: string } }) {
  return <ClientPage params={params} />;
}
EOF

# 2. Fix Fund Page
cat > frontend/app/fund/[fundId]/page.tsx << 'EOF'
import ClientPage from './ClientPage';

export async function generateStaticParams() {
  return [];
}

export default function Page({ params }: { params: { fundId: string } }) {
  return <ClientPage params={params} />;
}
EOF

# 3. Fix Plan Inputs Page
cat > frontend/app/plan/[planId]/inputs/page.tsx << 'EOF'
import ClientPage from './ClientPage';

export async function generateStaticParams() {
  return [];
}

export default function Page({ params }: { params: { planId: string } }) {
  return <ClientPage params={params} />;
}
EOF

# 4. Fix Plan Results Page (The one currently failing)
cat > frontend/app/plan/[planId]/results/page.tsx << 'EOF'
import ClientPage from './ClientPage';

export async function generateStaticParams() {
  return [];
}

export default function Page({ params }: { params: { planId: string } }) {
  return <ClientPage params={params} />;
}
EOF
