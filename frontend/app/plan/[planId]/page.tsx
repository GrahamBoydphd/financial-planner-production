import { redirect } from "next/navigation";

export default function PlanRoot({ params }: { params: { planId: string } }) {
  redirect(`/plan/${params.planId}/inputs`);
}
