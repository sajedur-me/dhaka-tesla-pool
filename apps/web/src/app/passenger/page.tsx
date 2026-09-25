import type { Metadata } from "next";

import { PassengerDashboard } from "../../components/passenger-dashboard";

export const metadata: Metadata = {
  title: "Passenger",
  description:
    "Request and manage pooled rides with Dhaka Tesla Pool.",
};

export default function PassengerPage() {
  return <PassengerDashboard />;
}
