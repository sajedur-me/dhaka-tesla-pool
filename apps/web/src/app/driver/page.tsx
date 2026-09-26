import type { Metadata } from "next";

import { DriverDashboard } from "../../components/driver-dashboard";

export const metadata: Metadata = {
  title: "Driver",
  description:
    "Manage Bullet, pooled ride requests, and active trips with Dhaka Tesla Pool.",
};

export default function DriverPage() {
  return <DriverDashboard />;
}
