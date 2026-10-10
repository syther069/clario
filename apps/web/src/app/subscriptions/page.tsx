import { redirect } from "next/navigation";

export default function SubscriptionsPage() {
  redirect("/?mode=personal&view=recurring");
}
