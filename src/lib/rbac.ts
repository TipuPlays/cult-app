/** Staff RBAC — server-enforced. Members are not staff. */

export const StaffRole = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  MANAGER: "manager",
  STAFF: "staff",
  ANALYST: "analyst",
} as const;

export type StaffRoleValue = (typeof StaffRole)[keyof typeof StaffRole];
export type AppRole = "member" | StaffRoleValue;

export const STAFF_ROLES: StaffRoleValue[] = [
  StaffRole.SUPER_ADMIN,
  StaffRole.ADMIN,
  StaffRole.MANAGER,
  StaffRole.STAFF,
  StaffRole.ANALYST,
];

export const Permission = {
  ADMIN_AREA: "admin_area",
  MEMBERS_READ: "members_read",
  LEVELS_READ: "levels_read",
  AUDIT_READ: "audit_read",
  RECEIPTS_REVIEW: "receipts_review",
  GRANTS_WRITE: "grants_write",
  ROLES_WRITE: "roles_write",
  EVENTS_WRITE: "events_write",
  REFERRALS_READ: "referrals_read",
  FRAUD_REVIEW: "fraud_review",
  ANALYTICS_READ: "analytics_read",
} as const;

export type PermissionValue = (typeof Permission)[keyof typeof Permission];

const ALL = new Set(Object.values(Permission));

const ROLE_PERMS: Record<StaffRoleValue, ReadonlySet<PermissionValue>> = {
  super_admin: ALL,
  admin: new Set([
    Permission.ADMIN_AREA,
    Permission.MEMBERS_READ,
    Permission.LEVELS_READ,
    Permission.AUDIT_READ,
    Permission.RECEIPTS_REVIEW,
    Permission.GRANTS_WRITE,
    Permission.EVENTS_WRITE,
    Permission.REFERRALS_READ,
    Permission.FRAUD_REVIEW,
    Permission.ANALYTICS_READ,
  ]),
  manager: new Set([
    Permission.ADMIN_AREA,
    Permission.MEMBERS_READ,
    Permission.LEVELS_READ,
    Permission.AUDIT_READ,
    Permission.RECEIPTS_REVIEW,
    Permission.GRANTS_WRITE,
    Permission.EVENTS_WRITE,
    Permission.REFERRALS_READ,
    Permission.FRAUD_REVIEW,
    Permission.ANALYTICS_READ,
  ]),
  staff: new Set([
    Permission.ADMIN_AREA,
    Permission.MEMBERS_READ,
    Permission.RECEIPTS_REVIEW,
    Permission.LEVELS_READ,
    Permission.FRAUD_REVIEW,
  ]),
  analyst: new Set([
    Permission.ADMIN_AREA,
    Permission.MEMBERS_READ,
    Permission.LEVELS_READ,
    Permission.AUDIT_READ,
    Permission.REFERRALS_READ,
    Permission.ANALYTICS_READ,
  ]),
};

export function isStaffRole(role: string | undefined | null): role is StaffRoleValue {
  return STAFF_ROLES.includes(role as StaffRoleValue);
}

export function hasPermission(
  role: string | undefined | null,
  permission: PermissionValue,
): boolean {
  if (!isStaffRole(role)) return false;
  return ROLE_PERMS[role].has(permission);
}

export function normalizeRole(role: string): AppRole {
  if (role === "member" || isStaffRole(role)) return role;
  return "member";
}

export function assignableRoles(): StaffRoleValue[] {
  return [...STAFF_ROLES];
}
