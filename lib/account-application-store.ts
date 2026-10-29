import "server-only";
import type { Sql } from "postgres";
import {
  AccountApplicationRateError,
  AccountApplicationSchemaError,
  isAccountApplicationStatus,
  type AccountApplication,
  type NewAccountApplication,
} from "@/lib/account-application";
import {
  createFileAccountApplicationStore,
  defaultAccountApplicationFilePath,
  type AccountApplicationPatch,
  type AccountApplicationStore,
} from "@/lib/account-application-file";
import { getSql } from "@/lib/order-store";
import { orderStoreMode } from "@/lib/order-store-types";

type ApplicationRow = {
  id: string;
  created_at: Date | string;
  status: string;
  registered_company_name: string;
  acn: string;
  trading_name: string;
  abn: string;
  billing_address: string;
  delivery_address: string;
  main_phone: string;
  website: string;
  ap_name: string;
  ap_email: string;
  ap_phone: string;
  purchasing_name: string;
  purchasing_email: string;
  purchasing_phone: string;
  po_required: boolean;
  authorisation_statement: string;
  authorised_name: string;
  position: string;
  authorised_at: Date | string;
  authorised_ip: string;
  authorised_user_agent: string;
  linked_order_id: string | null;
  linked_order_number: number | null;
  decided_at: Date | string | null;
  decided_by: string;
};

function iso(value: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function rowToApplication(row: ApplicationRow): AccountApplication {
  if (!isAccountApplicationStatus(row.status)) {
    throw new Error(`Unexpected account application status: ${row.status}`);
  }
  return {
    id: row.id,
    createdAt: iso(row.created_at) ?? new Date(0).toISOString(),
    status: row.status,
    registeredCompanyName: row.registered_company_name,
    acn: row.acn,
    tradingName: row.trading_name,
    abn: row.abn,
    billingAddress: row.billing_address,
    deliveryAddress: row.delivery_address,
    mainPhone: row.main_phone,
    website: row.website,
    apName: row.ap_name,
    apEmail: row.ap_email,
    apPhone: row.ap_phone,
    purchasingName: row.purchasing_name,
    purchasingEmail: row.purchasing_email,
    purchasingPhone: row.purchasing_phone,
    poRequired: row.po_required,
    authorisationStatement: row.authorisation_statement,
    authorisedName: row.authorised_name,
    position: row.position,
    authorisedAt: iso(row.authorised_at) ?? new Date(0).toISOString(),
    authorisedIp: row.authorised_ip,
    authorisedUserAgent: row.authorised_user_agent,
    linkedOrderId: row.linked_order_id,
    linkedOrderNumber: row.linked_order_number,
    decidedAt: iso(row.decided_at),
    decidedBy: row.decided_by,
  };
}

function isMissingRelation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "42P01"
  );
}

function rethrowSchema(error: unknown): never {
  if (isMissingRelation(error)) throw new AccountApplicationSchemaError();
  throw error;
}

export function createPostgresAccountApplicationStore(sql: Sql): AccountApplicationStore {
  return {
    async insert(application: NewAccountApplication) {
      const id = crypto.randomUUID();
      try {
        const recent = await sql<{ n: number }[]>`
          SELECT count(*)::int AS n
          FROM trafflabels_account_applications
          WHERE authorised_ip = ${application.authorisedIp}
            AND created_at > now() - interval '1 hour'
        `;
        if ((recent[0]?.n ?? 0) >= 5) throw new AccountApplicationRateError();
        const rows = await sql<ApplicationRow[]>`
          INSERT INTO trafflabels_account_applications (
            id,
            status,
            registered_company_name,
            acn,
            trading_name,
            abn,
            billing_address,
            delivery_address,
            main_phone,
            website,
            ap_name,
            ap_email,
            ap_phone,
            purchasing_name,
            purchasing_email,
            purchasing_phone,
            po_required,
            authorisation_statement,
            authorised_name,
            position,
            authorised_at,
            authorised_ip,
            authorised_user_agent
          ) VALUES (
            ${id},
            'new',
            ${application.registeredCompanyName},
            ${application.acn},
            ${application.tradingName},
            ${application.abn},
            ${application.billingAddress},
            ${application.deliveryAddress},
            ${application.mainPhone},
            ${application.website},
            ${application.apName},
            ${application.apEmail},
            ${application.apPhone},
            ${application.purchasingName},
            ${application.purchasingEmail},
            ${application.purchasingPhone},
            ${application.poRequired},
            ${application.authorisationStatement},
            ${application.authorisedName},
            ${application.position},
            ${application.authorisedAt},
            ${application.authorisedIp},
            ${application.authorisedUserAgent}
          )
          RETURNING *
        `;
        return rowToApplication(rows[0]);
      } catch (error) {
        if (error instanceof AccountApplicationRateError) throw error;
        rethrowSchema(error);
      }
    },
    async list() {
      try {
        const rows = await sql<ApplicationRow[]>`
          SELECT * FROM trafflabels_account_applications
          ORDER BY created_at DESC
          LIMIT 200
        `;
        return rows.map(rowToApplication);
      } catch (error) {
        rethrowSchema(error);
      }
    },
    async update(id, patch: AccountApplicationPatch) {
      try {
        const existing = await sql<ApplicationRow[]>`
          SELECT * FROM trafflabels_account_applications WHERE id = ${id}
        `;
        const current = existing[0] ? rowToApplication(existing[0]) : null;
        if (!current) return null;
        const status = patch.status ?? current.status;
        let decidedAt = current.decidedAt;
        let decidedBy = current.decidedBy;
        if (patch.status === "new") {
          decidedAt = null;
          decidedBy = patch.decidedBy ?? current.decidedBy;
        } else if (patch.status === "approved" || patch.status === "declined") {
          decidedAt = new Date().toISOString();
          decidedBy = patch.decidedBy ?? current.decidedBy;
        }
        const linkedOrderId =
          "linkedOrderId" in patch ? (patch.linkedOrderId ?? null) : current.linkedOrderId;
        const linkedOrderNumber =
          "linkedOrderNumber" in patch
            ? (patch.linkedOrderNumber ?? null)
            : current.linkedOrderNumber;
        const rows = await sql<ApplicationRow[]>`
          UPDATE trafflabels_account_applications
          SET status = ${status},
              decided_at = ${decidedAt},
              decided_by = ${decidedBy},
              linked_order_id = ${linkedOrderId},
              linked_order_number = ${linkedOrderNumber}
          WHERE id = ${id}
          RETURNING *
        `;
        return rows[0] ? rowToApplication(rows[0]) : null;
      } catch (error) {
        rethrowSchema(error);
      }
    },
  };
}

let singleton: AccountApplicationStore | null | undefined;

/** Null when this deployment cannot store applications (production without DATABASE_URL). */
export function getAccountApplicationStore(): AccountApplicationStore | null {
  if (singleton !== undefined) return singleton;
  const mode = orderStoreMode();
  if (mode === "unconfigured") {
    singleton = null;
    return singleton;
  }
  if (mode === "file") {
    singleton = createFileAccountApplicationStore(defaultAccountApplicationFilePath());
    return singleton;
  }
  const sql = getSql();
  singleton = sql ? createPostgresAccountApplicationStore(sql) : null;
  return singleton;
}
