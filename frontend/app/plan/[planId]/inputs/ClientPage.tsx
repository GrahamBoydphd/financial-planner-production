'use client';
export default function ClientPage({ params }: { params: { planId: string } }) {
  return <div>Plan Inputs for {params.planId}</div>;
}
