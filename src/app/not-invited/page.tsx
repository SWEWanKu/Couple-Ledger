import type { Metadata } from "next";
import { PrivateRouteBlocked } from "@/components/auth/PrivateRouteBlocked";

export const metadata: Metadata = {
  title: "还没有登上共同小岛 | Couple Ledger"
};

export default function NotInvitedPage() {
  return <PrivateRouteBlocked />;
}
