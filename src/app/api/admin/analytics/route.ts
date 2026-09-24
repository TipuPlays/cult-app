import { NextResponse } from "next/server";
import { getAdminAnalytics } from "@/lib/analytics";
import { requirePermission } from "@/lib/authz";
import { Permission } from "@/lib/rbac";

export async function GET() {
  const { error } = await requirePermission(Permission.ANALYTICS_READ);
  if (error) return error;
  const data = await getAdminAnalytics();
  return NextResponse.json(data);
}
