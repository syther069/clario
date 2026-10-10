import { redirect } from "next/navigation";

export default function BudgetsPage() {
  redirect("/?mode=personal&view=budgets");
}
