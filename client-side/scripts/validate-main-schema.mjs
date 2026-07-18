import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const schemaUrl = new URL("../../docs/supabase/main_schema.sql", import.meta.url);
const schemaPath = fileURLToPath(schemaUrl);
const source = await readFile(schemaUrl, "utf8");

const requiredPatterns = new Map([
  ["transaction start", /\bbegin\s*;/i],
  ["transaction commit", /\bcommit\s*;/i],
  ["private schema", /\bcreate schema private\s*;/i],
  ["user roles", /\bcreate table private\.user_roles\b/i],
  ["authoritative roles", /\bcreate function public\.authorize_user_roles\b/i],
  [
    "store manager invitations",
    /\bcreate table private\.store_manager_invitations\b/i,
  ],
  [
    "store manager access request",
    /\bcreate function public\.request_store_manager_access\b/i,
  ],
  [
    "store manager access list",
    /\bcreate function public\.list_store_manager_access\b/i,
  ],
  [
    "store manager access removal",
    /\bcreate function public\.remove_store_manager_access\b/i,
  ],
  ["audit events", /\bcreate table public\.audit_events\b/i],
  ["product categories", /\bcreate table public\.product_categories\b/i],
  ["attribute types", /\bcreate table public\.attribute_types\b/i],
  ["attribute values", /\bcreate table public\.attribute_values\b/i],
  ["category attributes", /\bcreate table public\.category_attributes\b/i],
  [
    "effective required options",
    /\brequired_from\s+timestamptz\b/i,
  ],
  [
    "catalog option usage",
    /\bcreate function public\.get_catalog_option_usage\b/i,
  ],
  [
    "attribute value removal",
    /\bcreate function public\.remove_attribute_value\b/i,
  ],
  [
    "attribute type removal",
    /\bcreate function public\.remove_attribute_type\b/i,
  ],
  [
    "category attribute removal",
    /\bcreate function public\.remove_category_attribute\b/i,
  ],
  [
    "bulk variant attribute assignment",
    /\bcreate function public\.bulk_assign_variant_attribute\b/i,
  ],
  [
    "inline product option creation",
    /\bcreate function public\.add_product_option_to_category\b/i,
  ],
  ["products", /\bcreate table public\.products\b/i],
  ["product brand", /\bbrand\s+text\b/i],
  ["product variants", /\bcreate table public\.product_variants\b/i],
  ["variant barcode", /\bbarcode\s+text\b/i],
  [
    "multi-variant product creation",
    /\bcreate function public\.create_product_with_variants\b/i,
  ],
  ["product images", /\bcreate table public\.product_images\b/i],
  ["product image bucket", /'product-images'/i],
  ["variant attribute values", /\bcreate table public\.variant_attribute_values\b/i],
  ["orders", /\bcreate table public\.orders\b/i],
  ["order lines", /\bcreate table public\.order_lines\b/i],
  ["stock movements", /\bcreate table public\.stock_movements\b/i],
  ["idempotent stock keys", /\bidempotency_key\s+uuid\b/i],
  ["add stock contract", /\bcreate function public\.add_stock_to_count\b/i],
  [
    "stock reduction contract",
    /\bcreate function public\.record_stock_reduction\b/i,
  ],
  ["variant validation", /\bcreate function private\.variant_attribute_signature\b/i],
  ["product update contract", /\bcreate function public\.update_product\b/i],
  ["variant create contract", /\bcreate function public\.add_product_variant\b/i],
  ["variant update contract", /\bcreate function public\.update_product_variant\b/i],
  ["product archival contract", /\bcreate function public\.set_product_active\b/i],
  ["variant archival contract", /\bcreate function public\.set_variant_active\b/i],
  ["payment attempts", /\bcreate table public\.payment_attempts\b/i],
  ["webhook ledger", /\bcreate table private\.processed_webhooks\b/i],
  ["college signup hook", /\bcreate function private\.hook_restrict_college_signup\b/i],
  ["row-level security", /\benable row level security\s*;/i],
]);

const forbiddenPatterns = new Map([
  ["migration add-column patch", /\balter table\b[\s\S]*?\badd column\b/i],
  ["migration rename patch", /\balter table\b[\s\S]*?\brename (column|to)\b/i],
  ["destructive drop statement", /^\s*drop\s+/im],
  ["seed-data section", /^\s*--\s*seed data\b/im],
  ["migration filename", /\b20\d{12}_[a-z0-9_]+\.sql\b/i],
  ["catalog audience enum", /\bcreate type public\.product_audience\b/i],
  ["department restrictions", /\bcreate table public\.product_departments\b/i],
  ["audience restrictions", /\bcreate table public\.product_audiences\b/i],
]);

const errors = [];

function tableBody(tableName) {
  const match = source.match(
    new RegExp(
      `create table public\\.${tableName}\\s*\\(([\\s\\S]*?)\\n\\);`,
      "i",
    ),
  );
  return match?.[1] ?? "";
}

for (const [name, pattern] of requiredPatterns) {
  if (!pattern.test(source)) {
    errors.push(`Missing required schema element: ${name}`);
  }
}

for (const [name, pattern] of forbiddenPatterns) {
  if (pattern.test(source)) {
    errors.push(`Canonical schema contains forbidden ${name}`);
  }
}

for (const tableName of [
  "attribute_types",
  "attribute_values",
  "category_attributes",
]) {
  if (/\bis_active\s+boolean\b/i.test(tableBody(tableName))) {
    errors.push(
      `Canonical schema contains forbidden archive state on ${tableName}`,
    );
  }
}

const beginCount = source.match(/\bbegin\s*;/gi)?.length ?? 0;
const commitCount = source.match(/\bcommit\s*;/gi)?.length ?? 0;

if (beginCount !== 1 || commitCount !== 1) {
  errors.push("Canonical schema must contain exactly one BEGIN and one COMMIT.");
}

if (errors.length > 0) {
  console.error(`Schema validation failed for ${schemaPath}:`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Schema validation passed: ${schemaPath}`);
