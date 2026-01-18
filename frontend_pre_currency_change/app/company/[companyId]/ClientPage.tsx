'use client';
export default function ClientPage({ params }: { params: { companyId: string } }) {
  return <div>Company Details for {params.companyId}</div>;
}
