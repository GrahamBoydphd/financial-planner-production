import { redirect } from "next/navigation";

export default function FundPlanRoot({ params }: { params: { fundPlanId: string } }) {
  redirect(`/fund-plan/${params.fundPlanId}/results`);
}
