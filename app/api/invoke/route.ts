import { NextRequest, NextResponse } from "next/server";
import {
  getPool,
  runQuery,
  runExecute,
  openDatabase,
  createDatabaseAndSchema,
  rowsToObjects,
} from "@/lib/db-server";
import bcrypt from "bcrypt";

const BCRYPT_ROUNDS = 10;

export interface EnvConfig {
  has_env_file: boolean;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

function getEnvConfig(): EnvConfig {
  return {
    has_env_file: true,
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: parseInt(process.env.MYSQL_PORT || "3306", 10),
    user: process.env.MYSQL_USER || "",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "shafaf",
  };
}

async function handleDbQuery(sql: string, params: unknown[] = []) {
  return runQuery(sql, params);
}

async function handleDbExecute(sql: string, params: unknown[] = []) {
  const r = await runExecute(sql, params);
  return { rows_affected: r.rows_affected };
}

async function handleDbOpen(_dbName: string) {
  return openDatabase(_dbName);
}

async function handleDbCreate(dbName: string) {
  const name = dbName || process.env.MYSQL_DATABASE || "shafaf";
  return createDatabaseAndSchema(name);
}

async function handleDbIsOpen() {
  try {
    getPool();
    await runQuery("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

async function handleInitUsersTable() {
  try {
    await runExecute("ALTER TABLE users ADD COLUMN profile_picture MEDIUMTEXT", []);
  } catch {
    // ignore
  }
  try {
    await runExecute("ALTER TABLE users MODIFY COLUMN profile_picture MEDIUMTEXT", []);
  } catch {
    // ignore
  }
  return "OK";
}

async function handleRegisterUser(username: string, email: string, password: string) {
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const existing = await runQuery("SELECT id FROM users WHERE username = ? OR email = ?", [username, email]);
  if (existing.rows.length > 0) {
    return { success: false, user: null, message: "Username or email already exists" };
  }
  await runExecute("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)", [username, email, hash]);
  const users = await runQuery(
    "SELECT id, username, email, full_name, phone, role, is_active, profile_picture, created_at, updated_at FROM users WHERE username = ?",
    [username]
  );
  if (users.rows.length === 0) return { success: false, user: null, message: "Failed to retrieve created user" };
  const r = users.rows[0];
  const cols = users.columns;
  const get = (key: string) => r[cols.indexOf(key)] ?? null;
  const user = {
    id: get("id"),
    username: get("username"),
    email: get("email"),
    full_name: get("full_name"),
    phone: get("phone"),
    role: get("role") || "user",
    is_active: get("is_active") ?? 1,
    profile_picture: get("profile_picture"),
    created_at: get("created_at"),
    updated_at: get("updated_at"),
  };
  return { success: true, user, message: "User registered successfully" };
}

async function handleLoginUser(username: string, password: string) {
  const users = await runQuery(
    "SELECT id, username, email, password_hash, full_name, phone, role, is_active, profile_picture, created_at, updated_at FROM users WHERE username = ? OR email = ?",
    [username, username]
  );
  if (users.rows.length === 0) {
    return { success: false, user: null, message: "Invalid username or password" };
  }
  const r = users.rows[0];
  const cols = users.columns;
  const get = (key: string) => r[cols.indexOf(key)] ?? null;
  const hash = get("password_hash") as string;
  const valid = await bcrypt.compare(password, hash);
  if (!valid) {
    return { success: false, user: null, message: "Invalid username or password" };
  }
  const user = {
    id: get("id"),
    username: get("username"),
    email: get("email"),
    full_name: get("full_name"),
    phone: get("phone"),
    role: get("role") || "user",
    is_active: get("is_active") ?? 1,
    profile_picture: get("profile_picture"),
    created_at: get("created_at"),
    updated_at: get("updated_at"),
  };
  return { success: true, user, message: "Login successful" };
}

// Company
async function handleGetCompanySettings() {
  const r = await runQuery("SELECT id, name, logo, phone, address, font, auto_backup_dir, created_at, updated_at FROM company_settings LIMIT 1", []);
  if (r.rows.length === 0) throw new Error("No company settings");
  const row = r.rows[0];
  const get = (k: string) => row[r.columns.indexOf(k)] ?? null;
  return { id: get("id"), name: get("name"), logo: get("logo"), phone: get("phone"), address: get("address"), font: get("font"), auto_backup_dir: get("auto_backup_dir"), created_at: get("created_at"), updated_at: get("updated_at") };
}
async function handleInitCompanySettingsTable() {
  return "OK";
}
async function handleUpdateCompanySettings(payload: { name?: string; logo?: string | null; phone?: string | null; address?: string | null; font?: string | null; auto_backup_dir?: string | null }) {
  await runExecute(
    "UPDATE company_settings SET name = ?, logo = ?, phone = ?, address = ?, font = ?, auto_backup_dir = ? WHERE id = 1",
    [payload.name ?? "", payload.logo ?? null, payload.phone ?? null, payload.address ?? null, payload.font ?? null, payload.auto_backup_dir ?? null]
  );
  return handleGetCompanySettings();
}

// Currencies
async function handleInitCurrenciesTable() {
  return "OK";
}
async function handleGetCurrencies() {
  const r = await runQuery("SELECT id, name, base, rate, created_at, updated_at FROM currencies ORDER BY base DESC, name ASC", []);
  return rowsToObjects(r).map((row: Record<string, unknown>) => ({ ...row, base: Number(row.base) === 1 }));
}

// Units
async function handleGetUnits() {
  // include group_name for UI convenience
  const r = await runQuery(
    `SELECT u.id, u.name, u.group_id, u.ratio, u.is_base, ug.name AS group_name, u.created_at, u.updated_at
     FROM units u
     LEFT JOIN unit_groups ug ON ug.id = u.group_id
     ORDER BY u.name ASC`,
    []
  );
  return rowsToObjects(r).map((row: Record<string, unknown>) => ({ ...row, is_base: Number(row.is_base) === 1 }));
}

async function handleGetUnitGroups() {
  const r = await runQuery("SELECT id, name, created_at, updated_at FROM unit_groups ORDER BY name ASC", []);
  return rowsToObjects(r);
}

// Accounts (basic list for pickers)
async function handleGetAccounts() {
  const r = await runQuery(
    `SELECT id, name, currency_id, coa_category_id, account_code, account_type, initial_balance, current_balance, is_active, notes, created_at, updated_at
     FROM accounts
     ORDER BY created_at DESC`,
    []
  );
  return rowsToObjects(r).map((row: Record<string, unknown>) => ({ ...row, is_active: Number(row.is_active) === 1 }));
}

async function handleGetCoaCategories(): Promise<Record<string, unknown>[]> {
  const result = await runQuery(
    "SELECT id, parent_id, name, code, category_type, level, created_at, updated_at FROM coa_categories ORDER BY level, code",
    []
  );
  return rowsToObjects<Record<string, unknown>>(result);
}

async function handleCreateCurrency(name: string, base: boolean, rate: number) {
  if (base) await runExecute("UPDATE currencies SET base = 0", []);
  await runExecute("INSERT INTO currencies (name, base, rate) VALUES (?, ?, ?)", [name, base ? 1 : 0, rate]);
  const r = await runQuery("SELECT id, name, base, rate, created_at, updated_at FROM currencies WHERE name = ?", [name]);
  const row = r.rows[0];
  const get = (k: string) => row[r.columns.indexOf(k)] ?? null;
  return { id: get("id"), name: get("name"), base: Number(get("base")) === 1, rate: get("rate"), created_at: get("created_at"), updated_at: get("updated_at") };
}
async function handleUpdateCurrency(id: number, name: string, base: boolean, rate: number) {
  if (base) await runExecute("UPDATE currencies SET base = 0 WHERE id != ?", [id]);
  await runExecute("UPDATE currencies SET name = ?, base = ?, rate = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [name, base ? 1 : 0, rate, id]);
  const r = await runQuery("SELECT id, name, base, rate, created_at, updated_at FROM currencies WHERE id = ?", [id]);
  const row = r.rows[0];
  const get = (k: string) => row[r.columns.indexOf(k)] ?? null;
  return { id: get("id"), name: get("name"), base: Number(get("base")) === 1, rate: get("rate"), created_at: get("created_at"), updated_at: get("updated_at") };
}
async function handleDeleteCurrency(id: number) {
  await runExecute("DELETE FROM currencies WHERE id = ?", [id]);
  return "OK";
}

// Paginated helper
async function paginated(
  table: string,
  selectCols: string,
  countSql: string,
  dataSql: string,
  params: unknown[],
  page: number,
  perPage: number,
  orderBy: string
) {
  const totalR = await runQuery(countSql, params);
  const total = Number((totalR.rows[0] ?? [0])[0]) || 0;
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safePerPage = Number.isFinite(perPage) && perPage > 0 ? Math.min(100000, Math.floor(perPage)) : 10;
  const offset = (safePage - 1) * safePerPage;

  // IMPORTANT: some MySQL/MariaDB setups error on LIMIT/OFFSET placeholders in prepared statements.
  // We inline validated integers here to avoid `Incorrect arguments to mysqld_stmt_execute`.
  const dataR = await runQuery(`${dataSql} ${orderBy} LIMIT ${safePerPage} OFFSET ${offset}`, params);
  const items = rowsToObjects(dataR);
  const totalPages = Math.ceil(total / safePerPage);
  return { items, total, page: safePage, per_page: safePerPage, total_pages: totalPages };
}

async function handleGetProducts(page: number, perPage: number, search: string | null, sortBy: string | null, sortOrder: string | null) {
  const allowedSort = ["name", "price", "stock_quantity", "created_at"].includes(sortBy || "") ? sortBy! : "created_at";
  const order = (sortOrder || "desc").toUpperCase() === "DESC" ? "DESC" : "ASC";
  let where = "";
  const params: unknown[] = [];
  if (search?.trim()) {
    where = "WHERE (name LIKE ? OR bar_code LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }
  return paginated(
    "products",
    "id,name,description,price,currency_id,supplier_id,stock_quantity,unit,image_path,bar_code,created_at,updated_at",
    `SELECT COUNT(*) FROM products ${where}`,
    `SELECT id, name, description, price, currency_id, supplier_id, stock_quantity, unit, image_path, bar_code, created_at, updated_at FROM products ${where}`,
    params,
    page,
    perPage,
    `ORDER BY ${allowedSort} ${order}`
  );
}

async function handleCreateProduct(
  name: string,
  description: string | null,
  price: number | null,
  currencyId: number | null,
  supplierId: number | null,
  stockQuantity: number | null,
  unit: string | null,
  imagePath: string | null,
  barCode: string | null
): Promise<Record<string, unknown>> {
  await runExecute(
    "INSERT INTO products (name, description, price, currency_id, supplier_id, stock_quantity, unit, image_path, bar_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [name, description, price, currencyId, supplierId, stockQuantity, unit, imagePath, barCode]
  );
  const r = await runQuery(
    "SELECT id, name, description, price, currency_id, supplier_id, stock_quantity, unit, image_path, bar_code, created_at, updated_at FROM products WHERE name = ? ORDER BY id DESC LIMIT 1",
    [name]
  );
  const rows = rowsToObjects<Record<string, unknown>>(r);
  const product = rows[0];
  if (!product) throw new Error("Failed to retrieve created product");
  return product;
}

async function handleUpdateProduct(
  id: number,
  name: string,
  description: string | null,
  price: number | null,
  currencyId: number | null,
  supplierId: number | null,
  stockQuantity: number | null,
  unit: string | null,
  imagePath: string | null,
  barCode: string | null
): Promise<Record<string, unknown>> {
  await runExecute(
    "UPDATE products SET name = ?, description = ?, price = ?, currency_id = ?, supplier_id = ?, stock_quantity = ?, unit = ?, image_path = ?, bar_code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [name, description, price, currencyId, supplierId, stockQuantity, unit, imagePath, barCode, id]
  );
  const r = await runQuery(
    "SELECT id, name, description, price, currency_id, supplier_id, stock_quantity, unit, image_path, bar_code, created_at, updated_at FROM products WHERE id = ?",
    [id]
  );
  const rows = rowsToObjects<Record<string, unknown>>(r);
  const product = rows[0];
  if (!product) throw new Error("Product not found");
  return product;
}

async function handleDeleteProduct(id: number): Promise<string> {
  const purchaseCheck = await runQuery("SELECT COUNT(*) AS c FROM purchase_items WHERE product_id = ?", [id]);
  const purchaseCount = Number(purchaseCheck.rows[0]?.[0] ?? 0);
  const saleCheck = await runQuery("SELECT COUNT(*) AS c FROM sale_items WHERE product_id = ?", [id]);
  const saleCount = Number(saleCheck.rows[0]?.[0] ?? 0);
  if (purchaseCount > 0 || saleCount > 0) {
    const reasons: string[] = [];
    if (purchaseCount > 0) reasons.push(`used in ${purchaseCount} purchase(s)`);
    if (saleCount > 0) reasons.push(`used in ${saleCount} sale(s)`);
    throw new Error(`Cannot delete product: it is ${reasons.join(" and ")}`);
  }
  await runExecute("DELETE FROM products WHERE id = ?", [id]);
  return "Product deleted successfully";
}

async function handleGetSuppliers(page: number, perPage: number, search: string | null, sortBy: string | null, sortOrder: string | null) {
  let where = "";
  const params: unknown[] = [];
  if (search?.trim()) {
    where = "WHERE (full_name LIKE ? OR phone LIKE ? OR email LIKE ?)";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  const allowedSort = ["full_name", "created_at"].includes(sortBy || "") ? sortBy! : "created_at";
  const order = (sortOrder || "desc").toUpperCase() === "DESC" ? "DESC" : "ASC";
  return paginated(
    "suppliers",
    "*",
    `SELECT COUNT(*) FROM suppliers ${where}`,
    `SELECT id, full_name, phone, address, email, notes, created_at, updated_at FROM suppliers ${where}`,
    params,
    page,
    perPage,
    `ORDER BY ${allowedSort} ${order}`
  );
}

async function handleGetCustomers(page: number, perPage: number, search: string | null, sortBy: string | null, sortOrder: string | null) {
  let where = "";
  const params: unknown[] = [];
  if (search?.trim()) {
    where = "WHERE (full_name LIKE ? OR phone LIKE ? OR email LIKE ?)";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  const allowedSort = ["full_name", "created_at"].includes(sortBy || "") ? sortBy! : "created_at";
  const order = (sortOrder || "desc").toUpperCase() === "DESC" ? "DESC" : "ASC";
  return paginated(
    "customers",
    "*",
    `SELECT COUNT(*) FROM customers ${where}`,
    `SELECT id, full_name, phone, address, email, notes, created_at, updated_at FROM customers ${where}`,
    params,
    page,
    perPage,
    `ORDER BY ${allowedSort} ${order}`
  );
}

async function handleGetPurchases(page: number, perPage: number, search: string | null, sortBy: string | null, sortOrder: string | null) {
  let where = "";
  const params: unknown[] = [];
  const allowedSort = ["date", "total_amount", "created_at"].includes(sortBy || "") ? sortBy! : "date";
  const order = (sortOrder || "desc").toUpperCase() === "DESC" ? "DESC" : "ASC";
  return paginated(
    "purchases",
    "*",
    `SELECT COUNT(*) FROM purchases ${where}`,
    `SELECT * FROM purchases ${where}`,
    params,
    page,
    perPage,
    `ORDER BY ${allowedSort} ${order}`
  );
}

async function handleGetPurchase(id: number): Promise<[Record<string, unknown>, Record<string, unknown>[]]> {
  const purchaseResult = await runQuery(
    "SELECT id, supplier_id, date, notes, currency_id, total_amount, additional_cost, batch_number, created_at, updated_at FROM purchases WHERE id = ?",
    [id]
  );
  const purchases = rowsToObjects<Record<string, unknown>>(purchaseResult);
  const purchase = purchases[0];
  if (!purchase) {
    throw new Error("Purchase not found");
  }
  const sumResult = await runQuery(
    "SELECT COALESCE(SUM(amount), 0) AS additional_cost FROM purchase_additional_costs WHERE purchase_id = ?",
    [id]
  );
  const sumRow = sumResult.rows[0];
  const idx = sumResult.columns.indexOf("additional_cost");
  purchase.additional_cost = sumRow && idx >= 0 ? (sumRow[idx] as number) : 0;

  const itemsResult = await runQuery(
    "SELECT id, purchase_id, product_id, unit_id, per_price, amount, total, per_unit, cost_price, wholesale_price, retail_price, expiry_date, created_at FROM purchase_items WHERE purchase_id = ?",
    [id]
  );
  const items = rowsToObjects<Record<string, unknown>>(itemsResult);
  return [purchase, items];
}

async function handleGetPurchaseAdditionalCosts(purchaseId: number): Promise<Record<string, unknown>[]> {
  const result = await runQuery(
    "SELECT id, purchase_id, name, amount, created_at FROM purchase_additional_costs WHERE purchase_id = ? ORDER BY id",
    [purchaseId]
  );
  return rowsToObjects<Record<string, unknown>>(result);
}

async function handleGetPurchasePaymentsByPurchase(purchaseId: number): Promise<Record<string, unknown>[]> {
  const result = await runQuery(
    "SELECT id, purchase_id, account_id, amount, currency, rate, total, date, notes, created_at FROM purchase_payments WHERE purchase_id = ? ORDER BY date DESC, created_at DESC",
    [purchaseId]
  );
  return rowsToObjects<Record<string, unknown>>(result);
}

async function handleGetSales(page: number, perPage: number, search: string | null, sortBy: string | null, sortOrder: string | null) {
  let where = "";
  const params: unknown[] = [];
  const allowedSort = ["date", "total_amount", "paid_amount", "created_at"].includes(sortBy || "") ? sortBy! : "date";
  const order = (sortOrder || "desc").toUpperCase() === "DESC" ? "DESC" : "ASC";
  return paginated(
    "sales",
    "*",
    `SELECT COUNT(*) FROM sales ${where}`,
    `SELECT * FROM sales ${where}`,
    params,
    page,
    perPage,
    `ORDER BY ${allowedSort} ${order}`
  );
}
async function handleGetDeductions(page: number, perPage: number, search: string | null, sortBy: string | null, sortOrder: string | null) {
  let where = "";
  const params: unknown[] = [];
  const allowedSort = ["year", "month", "amount", "created_at"].includes(sortBy || "") ? sortBy! : "year";
  const order = (sortOrder || "desc").toUpperCase() === "DESC" ? "DESC" : "ASC";
  return paginated(
    "deductions",
    "*",
    `SELECT COUNT(*) FROM deductions ${where}`,
    `SELECT * FROM deductions ${where}`,
    params,
    page,
    perPage,
    `ORDER BY ${allowedSort} ${order}`
  );
}

async function handleGetServices(page: number, perPage: number, search: string | null, sortBy: string | null, sortOrder: string | null) {
  let where = "";
  const params: unknown[] = [];
  if (search?.trim()) {
    where = "WHERE (name LIKE ? OR description LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }
  const allowedSort = ["name", "price", "created_at"].includes(sortBy || "") ? sortBy! : "name";
  const order = (sortOrder || "asc").toUpperCase() === "DESC" ? "DESC" : "ASC";
  return paginated(
    "services",
    "*",
    `SELECT COUNT(*) FROM services ${where}`,
    `SELECT id, name, price, currency_id, description, created_at, updated_at FROM services ${where}`,
    params,
    page,
    perPage,
    `ORDER BY ${allowedSort} ${order}`
  );
}

// Init tables: return OK (schema already run in db_open)
const INIT_TABLES = [
  "init_currencies_table", "init_suppliers_table", "init_customers_table", "init_unit_groups_table", "init_units_table",
  "init_products_table", "init_purchases_table", "init_purchase_payments_table", "init_sales_table", "init_sale_discount_codes_table",
  "init_services_table", "init_expense_types_table", "init_expenses_table", "init_employees_table", "init_salaries_table",
  "init_deductions_table", "init_company_settings_table", "init_coa_categories_table", "init_accounts_table", "init_account_transactions_table",
  "init_account_currency_balances_table", "init_journal_entries_table", "init_journal_entry_lines_table", "init_currency_exchange_rates_table",
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cmd, ...payload } = body as { cmd: string; [k: string]: unknown };
    if (!cmd || typeof cmd !== "string") {
      return NextResponse.json({ error: "Missing cmd" }, { status: 400 });
    }

    let result: unknown;
    switch (cmd) {
      case "get_env_config":
        result = getEnvConfig();
        break;
      case "save_env_config":
        // On server we don't persist .env from API; env is from deployment
        result = undefined;
        break;
      case "db_query":
        result = await handleDbQuery(String(payload.sql ?? ""), Array.isArray(payload.params) ? payload.params : []);
        break;
      case "db_execute":
        result = await handleDbExecute(String(payload.sql ?? ""), Array.isArray(payload.params) ? payload.params : []);
        break;
      case "db_open":
        result = await handleDbOpen(String(payload.dbName ?? ""));
        break;
      case "db_create":
        result = await handleDbCreate(String(payload.dbName ?? ""));
        break;
      case "db_is_open":
        result = await handleDbIsOpen();
        break;
      case "get_database_path":
        result = process.env.MYSQL_DATABASE ? `${process.env.MYSQL_HOST || "localhost"}/${process.env.MYSQL_DATABASE}` : "web";
        break;
      case "db_close":
        result = "Database closed successfully";
        break;
      case "backup_database":
      case "save_backup_to_path":
      case "get_backups_dir":
      case "create_daily_backup":
      case "restore_database":
        result = "Backup/restore not available in web mode. Use MySQL tools or export from your host.";
        break;
      case "print_sale_receipt_thermal":
        result = undefined;
        break;
      case "reconcile_account_balance":
        result = { is_balanced: true };
        break;
      case "migrate_existing_data":
        result = "OK";
        break;
      case "hash_password":
        result = await bcrypt.hash(String(payload.password ?? ""), BCRYPT_ROUNDS);
        break;
      case "verify_password":
        result = await bcrypt.compare(String(payload.password ?? ""), String(payload.hash ?? ""));
        break;
      case "init_users_table":
        result = await handleInitUsersTable();
        break;
      case "register_user":
        result = await handleRegisterUser(
          String(payload.username ?? ""),
          String(payload.email ?? ""),
          String(payload.password ?? "")
        );
        break;
      case "login_user":
        result = await handleLoginUser(String(payload.username ?? ""), String(payload.password ?? ""));
        break;
      case "get_company_settings":
        result = await handleGetCompanySettings();
        break;
      case "init_company_settings_table":
        result = await handleInitCompanySettingsTable();
        break;
      case "update_company_settings":
        result = await handleUpdateCompanySettings(payload as Parameters<typeof handleUpdateCompanySettings>[0]);
        break;
      case "init_currencies_table":
        result = await handleInitCurrenciesTable();
        break;
      case "get_currencies":
        result = await handleGetCurrencies();
        break;
      case "get_units":
        result = await handleGetUnits();
        break;
      case "get_unit_groups":
        result = await handleGetUnitGroups();
        break;
      case "get_accounts":
        result = await handleGetAccounts();
        break;
      case "get_coa_categories":
        result = await handleGetCoaCategories();
        break;
      case "create_currency":
        result = await handleCreateCurrency(String(payload.name ?? ""), Boolean(payload.base), Number(payload.rate ?? 1));
        break;
      case "update_currency":
        result = await handleUpdateCurrency(Number(payload.id), String(payload.name ?? ""), Boolean(payload.base), Number(payload.rate ?? 1));
        break;
      case "delete_currency":
        result = await handleDeleteCurrency(Number(payload.id));
        break;
      case "get_products":
        result = await handleGetProducts(
          Number(payload.page ?? 1),
          Number(payload.per_page ?? payload.perPage ?? 10),
          (payload.search as string) ?? null,
          ((payload.sort_by ?? payload.sortBy) as string) ?? null,
          ((payload.sort_order ?? payload.sortOrder) as string) ?? null
        );
        break;
      case "create_product":
        result = await handleCreateProduct(
          String(payload.name ?? ""),
          (payload.description as string) ?? null,
          payload.price != null ? Number(payload.price) : null,
          payload.currencyId != null ? Number(payload.currencyId) : null,
          payload.supplierId != null ? Number(payload.supplierId) : null,
          payload.stockQuantity != null ? Number(payload.stockQuantity) : null,
          (payload.unit as string) ?? null,
          (payload.imagePath as string) ?? null,
          (payload.barCode as string) ?? null
        );
        break;
      case "update_product":
        result = await handleUpdateProduct(
          Number(payload.id),
          String(payload.name ?? ""),
          (payload.description as string) ?? null,
          payload.price != null ? Number(payload.price) : null,
          payload.currencyId != null ? Number(payload.currencyId) : null,
          payload.supplierId != null ? Number(payload.supplierId) : null,
          payload.stockQuantity != null ? Number(payload.stockQuantity) : null,
          (payload.unit as string) ?? null,
          (payload.imagePath as string) ?? null,
          (payload.barCode as string) ?? null
        );
        break;
      case "delete_product":
        result = await handleDeleteProduct(Number(payload.id));
        break;
      case "get_suppliers":
        result = await handleGetSuppliers(
          Number(payload.page ?? 1),
          Number(payload.per_page ?? payload.perPage ?? 10),
          (payload.search as string) ?? null,
          ((payload.sort_by ?? payload.sortBy) as string) ?? null,
          ((payload.sort_order ?? payload.sortOrder) as string) ?? null
        );
        break;
      case "get_customers":
        result = await handleGetCustomers(
          Number(payload.page ?? 1),
          Number(payload.per_page ?? payload.perPage ?? 10),
          (payload.search as string) ?? null,
          ((payload.sort_by ?? payload.sortBy) as string) ?? null,
          ((payload.sort_order ?? payload.sortOrder) as string) ?? null
        );
        break;
      case "get_purchases":
        result = await handleGetPurchases(
          Number(payload.page ?? 1),
          Number(payload.per_page ?? payload.perPage ?? 10),
          (payload.search as string) ?? null,
          ((payload.sort_by ?? payload.sortBy) as string) ?? null,
          ((payload.sort_order ?? payload.sortOrder) as string) ?? null
        );
        break;
      case "get_purchase":
        result = await handleGetPurchase(Number(payload.id));
        break;
      case "get_purchase_additional_costs":
        result = await handleGetPurchaseAdditionalCosts(Number(payload.purchaseId));
        break;
      case "get_purchase_payments_by_purchase":
        result = await handleGetPurchasePaymentsByPurchase(Number(payload.purchaseId));
        break;
      case "get_sales":
        result = await handleGetSales(
          Number(payload.page ?? 1),
          Number(payload.per_page ?? payload.perPage ?? 10),
          (payload.search as string) ?? null,
          ((payload.sort_by ?? payload.sortBy) as string) ?? null,
          ((payload.sort_order ?? payload.sortOrder) as string) ?? null
        );
        break;
      case "get_deductions":
        result = await handleGetDeductions(
          Number(payload.page ?? 1),
          Number(payload.per_page ?? payload.perPage ?? 10),
          (payload.search as string) ?? null,
          ((payload.sort_by ?? payload.sortBy) as string) ?? null,
          ((payload.sort_order ?? payload.sortOrder) as string) ?? null
        );
        break;
      case "get_services":
        result = await handleGetServices(
          Number(payload.page ?? 1),
          Number(payload.per_page ?? payload.perPage ?? 10),
          (payload.search as string) ?? null,
          ((payload.sort_by ?? payload.sortBy) as string) ?? null,
          ((payload.sort_order ?? payload.sortOrder) as string) ?? null
        );
        break;
      default:
        if (INIT_TABLES.includes(cmd)) {
          result = "OK";
        } else {
          return NextResponse.json({ error: `Unknown command: ${cmd}` }, { status: 400 });
        }
    }

    const resolved = result instanceof Promise ? await result : result;
    return NextResponse.json(resolved);
  } catch (err) {
    console.error("Invoke error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
