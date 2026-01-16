'use client';
export default function ClientPage({ params }: { params: { fundId: string } }) {
  return <div>Fund Details for {params.fundId}</div>;
}
