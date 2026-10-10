import { redirect } from "next/navigation";

export default function ReceiptsPage() {
  redirect("/?mode=personal&view=receipts");
}
