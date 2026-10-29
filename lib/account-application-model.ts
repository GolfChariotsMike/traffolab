/** Client-safe account application types. No Node built-ins. */

export const ACCOUNT_APPLICATION_STATUSES = ["new", "approved", "declined"] as const;
export type AccountApplicationStatus = (typeof ACCOUNT_APPLICATION_STATUSES)[number];

export type AccountApplication = {
  id: string;
  createdAt: string;
  status: AccountApplicationStatus;
  registeredCompanyName: string;
  acn: string;
  tradingName: string;
  abn: string;
  billingAddress: string;
  deliveryAddress: string;
  mainPhone: string;
  website: string;
  apName: string;
  apEmail: string;
  apPhone: string;
  purchasingName: string;
  purchasingEmail: string;
  purchasingPhone: string;
  poRequired: boolean;
  authorisationStatement: string;
  authorisedName: string;
  position: string;
  authorisedAt: string;
  authorisedIp: string;
  authorisedUserAgent: string;
  linkedOrderId: string | null;
  linkedOrderNumber: number | null;
  decidedAt: string | null;
  decidedBy: string;
};

export function isAccountApplicationStatus(value: unknown): value is AccountApplicationStatus {
  return (
    typeof value === "string" &&
    (ACCOUNT_APPLICATION_STATUSES as readonly string[]).includes(value)
  );
}

export function formatAbn(digits: string) {
  if (!/^\d{11}$/.test(digits)) return digits;
  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
}
