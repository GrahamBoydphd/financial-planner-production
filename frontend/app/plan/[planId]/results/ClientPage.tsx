'use client';
export default function ClientPage({ params }: { params: { planId: string } }) {
  return <div>Plan Results for {params.planId}</div>;
}
