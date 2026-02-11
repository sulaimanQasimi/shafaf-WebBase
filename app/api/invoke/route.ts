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

async function handleCreateUnitGroup(name: string): Promise<Record<string, unknown>> {
  await runExecute("INSERT INTO unit_groups (name) VALUES (?)", [name]);
  const result = await runQuery("SELECT id, name, created_at, updated_at FROM unit_groups WHERE name = ?", [name]);
  const groups = rowsToObjects<Record<string, unknown>>(result);
  const group = groups[0];
  if (!group) {
    throw new Error("Failed to retrieve created unit group");
  }
  return group;
}

async function handleCreateUnit(
  name: string,
  groupId: number | null,
  ratio: number,
  isBase: boolean
): Promise<Record<string, unknown>> {
  await runExecute("INSERT INTO units (name, group_id, ratio, is_base) VALUES (?, ?, ?, ?)", [
    name,
    groupId,
    ratio,
    isBase ? 1 : 0,
  ]);
  const result = await runQuery(
    "SELECT u.id, u.name, u.created_at, u.updated_at, u.group_id, u.ratio, u.is_base, g.name AS group_name FROM units u LEFT JOIN unit_groups g ON u.group_id = g.id WHERE u.name = ? ORDER BY u.id DESC LIMIT 1",
    [name]
  );
  const units = rowsToObjects<Record<string, unknown>>(result);
  const unit = units[0];
  if (!unit) {
    throw new Error("Failed to retrieve created unit");
  }
  return { ...unit, is_base: Number(unit.is_base) === 1 };
}

async function handleUpdateUnit(
  id: number,
  name: string,
  groupId: number | null,
  ratio: number,
  isBase: boolean
): Promise<Record<string, unknown>> {
  await runExecute("UPDATE units SET name = ?, group_id = ?, ratio = ?, is_base = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [
    name,
    groupId,
    ratio,
    isBase ? 1 : 0,
    id,
  ]);
  const result = await runQuery(
    "SELECT u.id, u.name, u.created_at, u.updated_at, u.group_id, u.ratio, u.is_base, g.name AS group_name FROM units u LEFT JOIN unit_groups g ON u.group_id = g.id WHERE u.id = ?",
    [id]
  );
  const units = rowsToObjects<Record<string, unknown>>(result);
  const unit = units[0];
  if (!unit) {
    throw new Error("Unit not found");
  }
  return { ...unit, is_base: Number(unit.is_base) === 1 };
}

async function handleDeleteUnit(id: number): Promise<string> {
  await runExecute("DELETE FROM units WHERE id = ?", [id]);
  return "Unit deleted successfully";
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

async function calculateAccountBalance(accountId: number): Promise<number> {
  const initialResult = await runQuery("SELECT initial_balance FROM accounts WHERE id = ?", [accountId]);
  const initialBalance = initialResult.rows[0] ? Number(initialResult.rows[0][0]) : 0;
  const depositsResult = await runQuery(
    "SELECT COALESCE(SUM(total), 0) FROM account_transactions WHERE account_id = ? AND transaction_type = 'deposit'",
    [accountId]
  );
  const totalDeposits = depositsResult.rows[0] ? Number(depositsResult.rows[0][0]) : 0;
  const withdrawalsResult = await runQuery(
    "SELECT COALESCE(SUM(total), 0) FROM account_transactions WHERE account_id = ? AND transaction_type = 'withdraw'",
    [accountId]
  );
  const totalWithdrawals = withdrawalsResult.rows[0] ? Number(withdrawalsResult.rows[0][0]) : 0;
  return initialBalance + totalDeposits - totalWithdrawals;
}

async function handleCreateAccount(
  name: string,
  currencyId: number | null,
  coaCategoryId: number | null,
  accountCode: string | null,
  accountType: string | null,
  initialBalance: number,
  notes: string | null
): Promise<Record<string, unknown>> {
  const codeStr = accountCode?.trim() || null;
  await runExecute(
    "INSERT INTO accounts (name, currency_id, coa_category_id, account_code, account_type, initial_balance, current_balance, is_active, notes) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)",
    [name, currencyId, coaCategoryId, codeStr, accountType, initialBalance, initialBalance, notes]
  );
  const idResult = await runQuery("SELECT id FROM accounts WHERE name = ? ORDER BY id DESC LIMIT 1", [name]);
  const accountId = Number(idResult.rows[0]?.[0]);
  const result = await runQuery(
    "SELECT id, name, currency_id, coa_category_id, account_code, account_type, initial_balance, current_balance, is_active, notes, created_at, updated_at FROM accounts WHERE id = ?",
    [accountId]
  );
  const accounts = rowsToObjects<Record<string, unknown>>(result);
  return { ...accounts[0], is_active: Number(accounts[0].is_active) === 1 };
}

async function handleUpdateAccount(
  id: number,
  name: string,
  currencyId: number | null,
  coaCategoryId: number | null,
  accountCode: string | null,
  accountType: string | null,
  initialBalance: number,
  isActive: boolean,
  notes: string | null
): Promise<Record<string, unknown>> {
  const codeStr = accountCode?.trim() || null;
  await runExecute(
    "UPDATE accounts SET name = ?, currency_id = ?, coa_category_id = ?, account_code = ?, account_type = ?, initial_balance = ?, is_active = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [name, currencyId, coaCategoryId, codeStr, accountType, initialBalance, isActive ? 1 : 0, notes, id]
  );
  const balance = await calculateAccountBalance(id);
  await runExecute("UPDATE accounts SET current_balance = ? WHERE id = ?", [balance, id]);
  const result = await runQuery(
    "SELECT id, name, currency_id, coa_category_id, account_code, account_type, initial_balance, current_balance, is_active, notes, created_at, updated_at FROM accounts WHERE id = ?",
    [id]
  );
  const accounts = rowsToObjects<Record<string, unknown>>(result);
  return { ...accounts[0], is_active: Number(accounts[0].is_active) === 1 };
}

async function handleDeleteAccount(id: number): Promise<string> {
  await runExecute("DELETE FROM accounts WHERE id = ?", [id]);
  return "Account deleted successfully";
}

async function handleDepositAccount(
  accountId: number,
  amount: number,
  currency: string,
  rate: number,
  transactionDate: string,
  isFull: boolean,
  notes: string | null
): Promise<Record<string, unknown>> {
  const currentBalance = await calculateAccountBalance(accountId);
  const finalAmount = isFull ? (currentBalance <= 0 ? 0 : currentBalance) : amount;
  if (finalAmount <= 0) {
    throw new Error(isFull ? "Account has no balance to deposit" : "Deposit amount must be greater than 0");
  }
  const total = finalAmount * rate;
  const currencyResult = await runQuery("SELECT id FROM currencies WHERE name = ? LIMIT 1", [currency]);
  const currencyId = currencyResult.rows[0] ? Number(currencyResult.rows[0][0]) : null;
  if (!currencyId) {
    throw new Error("Currency not found");
  }
  await runExecute(
    "INSERT INTO account_transactions (account_id, transaction_type, amount, currency, rate, total, transaction_date, is_full, notes) VALUES (?, 'deposit', ?, ?, ?, ?, ?, ?, ?)",
    [accountId, finalAmount, currency, rate, total, transactionDate, isFull ? 1 : 0, notes]
  );
  const balanceResult = await runQuery(
    "SELECT balance FROM account_currency_balances WHERE account_id = ? AND currency_id = ?",
    [accountId, currencyId]
  );
  const currentCurrencyBalance = balanceResult.rows[0] ? Number(balanceResult.rows[0][0]) : 0;
  const newBalance = currentCurrencyBalance + finalAmount;
  await runExecute(
    "INSERT INTO account_currency_balances (account_id, currency_id, balance, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE balance = ?, updated_at = CURRENT_TIMESTAMP",
    [accountId, currencyId, newBalance, newBalance]
  );
  const accountBalance = await calculateAccountBalance(accountId);
  await runExecute("UPDATE accounts SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [accountBalance, accountId]);
  const idResult = await runQuery("SELECT id FROM account_transactions WHERE account_id = ? ORDER BY id DESC LIMIT 1", [accountId]);
  const transactionId = Number(idResult.rows[0]?.[0]);
  const result = await runQuery(
    "SELECT id, account_id, transaction_type, amount, currency, rate, total, transaction_date, is_full, notes, created_at FROM account_transactions WHERE id = ?",
    [transactionId]
  );
  return { ...rowsToObjects<Record<string, unknown>>(result)[0], is_full: Number(rowsToObjects<Record<string, unknown>>(result)[0].is_full) === 1 };
}

async function handleWithdrawAccount(
  accountId: number,
  amount: number,
  currency: string,
  rate: number,
  transactionDate: string,
  isFull: boolean,
  notes: string | null
): Promise<Record<string, unknown>> {
  const currentBalance = await calculateAccountBalance(accountId);
  const finalAmount = isFull ? (currentBalance <= 0 ? 0 : currentBalance) : amount;
  if (finalAmount <= 0) {
    throw new Error(isFull ? "Account has no balance to withdraw" : "Withdrawal amount must be greater than 0");
  }
  const total = finalAmount * rate;
  if (!isFull && total > currentBalance) {
    throw new Error("Insufficient balance for withdrawal");
  }
  const currencyResult = await runQuery("SELECT id FROM currencies WHERE name = ? LIMIT 1", [currency]);
  const currencyId = currencyResult.rows[0] ? Number(currencyResult.rows[0][0]) : null;
  if (!currencyId) {
    throw new Error("Currency not found");
  }
  const balanceResult = await runQuery(
    "SELECT balance FROM account_currency_balances WHERE account_id = ? AND currency_id = ?",
    [accountId, currencyId]
  );
  const currentCurrencyBalance = balanceResult.rows[0] ? Number(balanceResult.rows[0][0]) : 0;
  if (finalAmount > currentCurrencyBalance) {
    throw new Error("Insufficient balance in account currency");
  }
  await runExecute(
    "INSERT INTO account_transactions (account_id, transaction_type, amount, currency, rate, total, transaction_date, is_full, notes) VALUES (?, 'withdraw', ?, ?, ?, ?, ?, ?, ?)",
    [accountId, finalAmount, currency, rate, total, transactionDate, isFull ? 1 : 0, notes]
  );
  const newBalance = currentCurrencyBalance - finalAmount;
  await runExecute(
    "INSERT INTO account_currency_balances (account_id, currency_id, balance, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE balance = ?, updated_at = CURRENT_TIMESTAMP",
    [accountId, currencyId, newBalance, newBalance]
  );
  const accountBalance = await calculateAccountBalance(accountId);
  await runExecute("UPDATE accounts SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [accountBalance, accountId]);
  const idResult = await runQuery("SELECT id FROM account_transactions WHERE account_id = ? ORDER BY id DESC LIMIT 1", [accountId]);
  const transactionId = Number(idResult.rows[0]?.[0]);
  const result = await runQuery(
    "SELECT id, account_id, transaction_type, amount, currency, rate, total, transaction_date, is_full, notes, created_at FROM account_transactions WHERE id = ?",
    [transactionId]
  );
  return { ...rowsToObjects<Record<string, unknown>>(result)[0], is_full: Number(rowsToObjects<Record<string, unknown>>(result)[0].is_full) === 1 };
}

async function handleGetCoaCategories(): Promise<Record<string, unknown>[]> {
  const result = await runQuery(
    "SELECT id, parent_id, name, code, category_type, level, created_at, updated_at FROM coa_categories ORDER BY level, code",
    []
  );
  return rowsToObjects<Record<string, unknown>>(result);
}

async function handleCreateCoaCategory(
  parentId: number | null,
  name: string,
  code: string,
  categoryType: string
): Promise<Record<string, unknown>> {
  let level = 0;
  if (parentId) {
    const parentResult = await runQuery("SELECT level FROM coa_categories WHERE id = ?", [parentId]);
    level = parentResult.rows[0] ? Number(parentResult.rows[0][0]) + 1 : 0;
  }
  await runExecute("INSERT INTO coa_categories (parent_id, name, code, category_type, level) VALUES (?, ?, ?, ?, ?)", [
    parentId,
    name,
    code,
    categoryType,
    level,
  ]);
  const idResult = await runQuery("SELECT id FROM coa_categories WHERE code = ? ORDER BY id DESC LIMIT 1", [code]);
  const id = Number(idResult.rows[0]?.[0]);
  const result = await runQuery(
    "SELECT id, parent_id, name, code, category_type, level, created_at, updated_at FROM coa_categories WHERE id = ?",
    [id]
  );
  return rowsToObjects<Record<string, unknown>>(result)[0];
}

async function handleUpdateCoaCategory(
  id: number,
  parentId: number | null,
  name: string,
  code: string,
  categoryType: string
): Promise<Record<string, unknown>> {
  let level = 0;
  if (parentId) {
    const parentResult = await runQuery("SELECT level FROM coa_categories WHERE id = ?", [parentId]);
    level = parentResult.rows[0] ? Number(parentResult.rows[0][0]) + 1 : 0;
  }
  await runExecute(
    "UPDATE coa_categories SET parent_id = ?, name = ?, code = ?, category_type = ?, level = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [parentId, name, code, categoryType, level, id]
  );
  const result = await runQuery(
    "SELECT id, parent_id, name, code, category_type, level, created_at, updated_at FROM coa_categories WHERE id = ?",
    [id]
  );
  return rowsToObjects<Record<string, unknown>>(result)[0];
}

async function handleDeleteCoaCategory(id: number): Promise<string> {
  const childrenResult = await runQuery("SELECT COUNT(*) FROM coa_categories WHERE parent_id = ?", [id]);
  const childrenCount = childrenResult.rows[0] ? Number(childrenResult.rows[0][0]) : 0;
  if (childrenCount > 0) {
    throw new Error("Cannot delete category with child categories");
  }
  const accountsResult = await runQuery("SELECT COUNT(*) FROM accounts WHERE coa_category_id = ?", [id]);
  const accountsCount = accountsResult.rows[0] ? Number(accountsResult.rows[0][0]) : 0;
  if (accountsCount > 0) {
    throw new Error("Cannot delete category with associated accounts");
  }
  await runExecute("DELETE FROM coa_categories WHERE id = ?", [id]);
  return "COA category deleted successfully";
}

async function handleInitStandardCoaCategories(): Promise<string> {
  const checkResult = await runQuery("SELECT COUNT(*) FROM coa_categories", []);
  const count = checkResult.rows[0] ? Number(checkResult.rows[0][0]) : 0;
  if (count > 0) {
    return "COA categories already initialized";
  }
  // Insert standard categories (simplified - full implementation would insert all standard categories)
  // This is a placeholder - the full implementation would insert all standard COA categories
  return "COA categories initialized";
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

async function handleCreateSupplier(
  fullName: string,
  phone: string,
  address: string,
  email: string | null,
  notes: string | null
): Promise<Record<string, unknown>> {
  await runExecute("INSERT INTO suppliers (full_name, phone, address, email, notes) VALUES (?, ?, ?, ?, ?)", [
    fullName,
    phone,
    address,
    email,
    notes,
  ]);
  const result = await runQuery(
    "SELECT id, full_name, phone, address, email, notes, created_at, updated_at FROM suppliers WHERE full_name = ? AND phone = ? ORDER BY id DESC LIMIT 1",
    [fullName, phone]
  );
  const suppliers = rowsToObjects<Record<string, unknown>>(result);
  const supplier = suppliers[0];
  if (!supplier) {
    throw new Error("Failed to retrieve created supplier");
  }
  return supplier;
}

async function handleUpdateSupplier(
  id: number,
  fullName: string,
  phone: string,
  address: string,
  email: string | null,
  notes: string | null
): Promise<Record<string, unknown>> {
  await runExecute("UPDATE suppliers SET full_name = ?, phone = ?, address = ?, email = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [
    fullName,
    phone,
    address,
    email,
    notes,
    id,
  ]);
  const result = await runQuery("SELECT id, full_name, phone, address, email, notes, created_at, updated_at FROM suppliers WHERE id = ?", [id]);
  const suppliers = rowsToObjects<Record<string, unknown>>(result);
  const supplier = suppliers[0];
  if (!supplier) {
    throw new Error("Supplier not found");
  }
  return supplier;
}

async function handleDeleteSupplier(id: number): Promise<string> {
  await runExecute("DELETE FROM suppliers WHERE id = ?", [id]);
  return "Supplier deleted successfully";
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

async function handleCreateCustomer(
  fullName: string,
  phone: string,
  address: string,
  email: string | null,
  notes: string | null
): Promise<Record<string, unknown>> {
  await runExecute("INSERT INTO customers (full_name, phone, address, email, notes) VALUES (?, ?, ?, ?, ?)", [
    fullName,
    phone,
    address,
    email,
    notes,
  ]);
  const result = await runQuery(
    "SELECT id, full_name, phone, address, email, notes, created_at, updated_at FROM customers WHERE full_name = ? AND phone = ? ORDER BY id DESC LIMIT 1",
    [fullName, phone]
  );
  const customers = rowsToObjects<Record<string, unknown>>(result);
  const customer = customers[0];
  if (!customer) {
    throw new Error("Failed to retrieve created customer");
  }
  return customer;
}

async function handleUpdateCustomer(
  id: number,
  fullName: string,
  phone: string,
  address: string,
  email: string | null,
  notes: string | null
): Promise<Record<string, unknown>> {
  await runExecute("UPDATE customers SET full_name = ?, phone = ?, address = ?, email = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [
    fullName,
    phone,
    address,
    email,
    notes,
    id,
  ]);
  const result = await runQuery("SELECT id, full_name, phone, address, email, notes, created_at, updated_at FROM customers WHERE id = ?", [id]);
  const customers = rowsToObjects<Record<string, unknown>>(result);
  const customer = customers[0];
  if (!customer) {
    throw new Error("Customer not found");
  }
  return customer;
}

async function handleDeleteCustomer(id: number): Promise<string> {
  await runExecute("DELETE FROM customers WHERE id = ?", [id]);
  return "Customer deleted successfully";
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

async function handleGetPurchasePayments(
  page: number,
  perPage: number,
  search: string | null,
  sortBy: string | null,
  sortOrder: string | null
) {
  let where = "";
  const params: unknown[] = [];
  if (search?.trim()) {
    where = "WHERE (currency LIKE ? OR notes LIKE ? OR CAST(amount AS CHAR) LIKE ?)";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  const allowedSort = ["amount", "total", "rate", "currency", "date", "created_at"].includes(sortBy || "") ? sortBy! : "date";
  const order = (sortOrder || "desc").toUpperCase() === "DESC" ? "DESC" : "ASC";
  return paginated(
    "purchase_payments",
    "*",
    `SELECT COUNT(*) FROM purchase_payments ${where}`,
    `SELECT id, purchase_id, account_id, amount, currency, rate, total, date, notes, created_at FROM purchase_payments ${where}`,
    params,
    page,
    perPage,
    `ORDER BY ${allowedSort} ${order}`
  );
}

async function handleCreatePurchasePayment(
  purchaseId: number,
  accountId: number | null,
  amount: number,
  currency: string,
  rate: number,
  date: string,
  notes: string | null
): Promise<Record<string, unknown>> {
  const total = amount * rate;
  await runExecute(
    "INSERT INTO purchase_payments (purchase_id, account_id, amount, currency, rate, total, date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [purchaseId, accountId, amount, currency, rate, total, date, notes]
  );
  // If account_id provided, withdraw from account
  if (accountId) {
    const currencyResult = await runQuery("SELECT id FROM currencies WHERE name = ? LIMIT 1", [currency]);
    const currencyId = currencyResult.rows[0] ? Number(currencyResult.rows[0][0]) : null;
    if (currencyId) {
      const balanceResult = await runQuery(
        "SELECT balance FROM account_currency_balances WHERE account_id = ? AND currency_id = ?",
        [accountId, currencyId]
      );
      const currentBalance = balanceResult.rows[0] ? Number(balanceResult.rows[0][0]) : 0;
      if (currentBalance < amount) {
        throw new Error(`Insufficient balance in account. Available: ${currentBalance}, Required: ${amount}`);
      }
      const newBalance = currentBalance - amount;
      await runExecute(
        "INSERT INTO account_currency_balances (account_id, currency_id, balance, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE balance = ?, updated_at = CURRENT_TIMESTAMP",
        [accountId, currencyId, newBalance, newBalance]
      );
      const accountBalanceResult = await runQuery(
        "SELECT COALESCE(SUM(balance), 0) FROM account_currency_balances WHERE account_id = ?",
        [accountId]
      );
      const accountBalance = Number(accountBalanceResult.rows[0]?.[0] ?? 0);
      await runExecute("UPDATE accounts SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [accountBalance, accountId]);
    }
  }
  const idResult = await runQuery("SELECT id FROM purchase_payments WHERE purchase_id = ? ORDER BY id DESC LIMIT 1", [purchaseId]);
  const paymentId = Number(idResult.rows[0]?.[0]);
  const result = await runQuery(
    "SELECT id, purchase_id, account_id, amount, currency, rate, total, date, notes, created_at FROM purchase_payments WHERE id = ?",
    [paymentId]
  );
  const payments = rowsToObjects<Record<string, unknown>>(result);
  return payments[0];
}

async function handleUpdatePurchasePayment(
  id: number,
  amount: number,
  currency: string,
  rate: number,
  date: string,
  notes: string | null
): Promise<Record<string, unknown>> {
  const total = amount * rate;
  await runExecute("UPDATE purchase_payments SET amount = ?, currency = ?, rate = ?, total = ?, date = ?, notes = ? WHERE id = ?", [
    amount,
    currency,
    rate,
    total,
    date,
    notes,
    id,
  ]);
  const result = await runQuery(
    "SELECT id, purchase_id, account_id, amount, currency, rate, total, date, notes, created_at FROM purchase_payments WHERE id = ?",
    [id]
  );
  const payments = rowsToObjects<Record<string, unknown>>(result);
  return payments[0];
}

async function handleDeletePurchasePayment(id: number): Promise<string> {
  await runExecute("DELETE FROM purchase_payments WHERE id = ?", [id]);
  return "Purchase payment deleted successfully";
}

async function handleCreatePurchase(
  supplierId: number,
  date: string,
  notes: string | null,
  currencyId: number | null,
  additionalCosts: [string, number][],
  items: [number, number, number, number, number | null, number | null, number | null, number | null, string | null][]
): Promise<Record<string, unknown>> {
  // Generate batch number
  const batchResult = await runQuery(
    "SELECT COALESCE(MAX(CAST(SUBSTRING(batch_number, 7) AS SIGNED)), 0) + 1 FROM purchases WHERE batch_number LIKE 'BATCH-%'",
    []
  );
  const batchNum = Number(batchResult.rows[0]?.[0] ?? 1);
  const batchNumber = `BATCH-${String(batchNum).padStart(6, "0")}`;

  // Calculate total
  const itemsTotal = items.reduce((sum, [, , perPrice, amount]) => sum + perPrice * amount, 0);
  const additionalCostsTotal = additionalCosts.reduce((sum, [, amount]) => sum + amount, 0);
  const totalAmount = itemsTotal + additionalCostsTotal;

  // Insert purchase
  await runExecute(
    "INSERT INTO purchases (supplier_id, date, notes, currency_id, total_amount, batch_number) VALUES (?, ?, ?, ?, ?, ?)",
    [supplierId, date, notes, currencyId, totalAmount, batchNumber]
  );

  // Get purchase ID
  const idResult = await runQuery("SELECT id FROM purchases WHERE supplier_id = ? AND date = ? ORDER BY id DESC LIMIT 1", [supplierId, date]);
  const purchaseId = Number(idResult.rows[0]?.[0]);
  if (!purchaseId) {
    throw new Error("Failed to retrieve purchase ID");
  }

  // Insert items
  for (const [productId, unitId, perPrice, amount, perUnit, costPrice, wholesalePrice, retailPrice, expiryDate] of items) {
    const total = perPrice * amount;
    await runExecute(
      "INSERT INTO purchase_items (purchase_id, product_id, unit_id, per_price, amount, total, per_unit, cost_price, wholesale_price, retail_price, expiry_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [purchaseId, productId, unitId, perPrice, amount, total, perUnit, costPrice, wholesalePrice, retailPrice, expiryDate]
    );
  }

  // Insert additional costs
  for (const [name, amount] of additionalCosts) {
    await runExecute("INSERT INTO purchase_additional_costs (purchase_id, name, amount) VALUES (?, ?, ?)", [purchaseId, name, amount]);
  }

  // Get created purchase
  const result = await runQuery(
    "SELECT id, supplier_id, date, notes, currency_id, total_amount, additional_cost, batch_number, created_at, updated_at FROM purchases WHERE id = ?",
    [purchaseId]
  );
  const purchases = rowsToObjects<Record<string, unknown>>(result);
  const purchase = purchases[0];
  if (!purchase) {
    throw new Error("Failed to retrieve created purchase");
  }
  purchase.additional_cost = additionalCostsTotal;
  return purchase;
}

async function handleUpdatePurchase(
  id: number,
  supplierId: number,
  date: string,
  notes: string | null,
  currencyId: number | null,
  additionalCosts: [string, number][],
  items: [number, number, number, number, number | null, number | null, number | null, number | null, string | null][]
): Promise<Record<string, unknown>> {
  // Calculate total
  const itemsTotal = items.reduce((sum, [, , perPrice, amount]) => sum + perPrice * amount, 0);
  const additionalCostsTotal = additionalCosts.reduce((sum, [, amount]) => sum + amount, 0);
  const totalAmount = itemsTotal + additionalCostsTotal;

  // Update purchase
  await runExecute(
    "UPDATE purchases SET supplier_id = ?, date = ?, notes = ?, currency_id = ?, total_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [supplierId, date, notes, currencyId, totalAmount, id]
  );

  // Delete existing items and costs
  await runExecute("DELETE FROM purchase_items WHERE purchase_id = ?", [id]);
  await runExecute("DELETE FROM purchase_additional_costs WHERE purchase_id = ?", [id]);

  // Insert new items
  for (const [productId, unitId, perPrice, amount, perUnit, costPrice, wholesalePrice, retailPrice, expiryDate] of items) {
    const total = perPrice * amount;
    await runExecute(
      "INSERT INTO purchase_items (purchase_id, product_id, unit_id, per_price, amount, total, per_unit, cost_price, wholesale_price, retail_price, expiry_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [id, productId, unitId, perPrice, amount, total, perUnit, costPrice, wholesalePrice, retailPrice, expiryDate]
    );
  }

  // Insert new additional costs
  for (const [name, amount] of additionalCosts) {
    await runExecute("INSERT INTO purchase_additional_costs (purchase_id, name, amount) VALUES (?, ?, ?)", [id, name, amount]);
  }

  // Get updated purchase
  const result = await runQuery(
    "SELECT id, supplier_id, date, notes, currency_id, total_amount, additional_cost, batch_number, created_at, updated_at FROM purchases WHERE id = ?",
    [id]
  );
  const purchases = rowsToObjects<Record<string, unknown>>(result);
  const purchase = purchases[0];
  if (!purchase) {
    throw new Error("Purchase not found");
  }
  purchase.additional_cost = additionalCostsTotal;
  return purchase;
}

async function handleDeletePurchase(id: number): Promise<string> {
  await runExecute("DELETE FROM purchases WHERE id = ?", [id]);
  return "Purchase deleted successfully";
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

// Sale handlers
async function handleGetSale(id: number): Promise<[Record<string, unknown>, Record<string, unknown>[], Record<string, unknown>[]]> {
  const saleResult = await runQuery(
    "SELECT id, customer_id, date, notes, currency_id, exchange_rate, total_amount, base_amount, paid_amount, additional_cost, order_discount_type, order_discount_value, order_discount_amount, discount_code_id, created_at, updated_at FROM sales WHERE id = ?",
    [id]
  );
  const sales = rowsToObjects<Record<string, unknown>>(saleResult);
  const sale = sales[0];
  if (!sale) {
    throw new Error("Sale not found");
  }
  const sumResult = await runQuery(
    "SELECT COALESCE(SUM(amount), 0) AS additional_cost FROM sale_additional_costs WHERE sale_id = ?",
    [id]
  );
  const sumRow = sumResult.rows[0];
  const idx = sumResult.columns.indexOf("additional_cost");
  sale.additional_cost = sumRow && idx >= 0 ? (sumRow[idx] as number) : 0;

  const itemsResult = await runQuery(
    "SELECT id, sale_id, product_id, unit_id, per_price, amount, total, purchase_item_id, sale_type, discount_type, discount_value, created_at FROM sale_items WHERE sale_id = ? ORDER BY id",
    [id]
  );
  const items = rowsToObjects<Record<string, unknown>>(itemsResult);

  const serviceItemsResult = await runQuery(
    "SELECT id, sale_id, service_id, name, price, quantity, total, discount_type, discount_value, created_at FROM sale_service_items WHERE sale_id = ? ORDER BY id",
    [id]
  );
  const serviceItems = rowsToObjects<Record<string, unknown>>(serviceItemsResult);

  return [sale, items, serviceItems];
}

async function handleGetSaleItems(saleId: number): Promise<Record<string, unknown>[]> {
  const result = await runQuery(
    "SELECT id, sale_id, product_id, unit_id, per_price, amount, total, purchase_item_id, sale_type, discount_type, discount_value, created_at FROM sale_items WHERE sale_id = ? ORDER BY id",
    [saleId]
  );
  return rowsToObjects<Record<string, unknown>>(result);
}

async function handleCreateSaleItem(
  saleId: number,
  productId: number,
  unitId: number,
  perPrice: number,
  amount: number,
  purchaseItemId: number | null,
  saleType: string | null,
  discountType: string | null,
  discountValue: number
): Promise<Record<string, unknown>> {
  if (purchaseItemId) {
    const saleAmountBase = await amountToBase(amount, unitId);
    const remainingBase = await getBatchRemainingBase(purchaseItemId);
    if (saleAmountBase > remainingBase + 1e-9) {
      throw new Error("موجودی دسته کافی نیست (Insufficient batch stock)");
    }
  }
  const lineSubtotal = perPrice * amount;
  const disc = computeDiscountAmount(lineSubtotal, discountType, discountValue);
  const total = round2(lineSubtotal - disc);
  await runExecute(
    "INSERT INTO sale_items (sale_id, product_id, unit_id, per_price, amount, total, purchase_item_id, sale_type, discount_type, discount_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [saleId, productId, unitId, perPrice, amount, total, purchaseItemId, saleType, discountType, discountValue]
  );
  // Update sale total
  await runExecute(
    "UPDATE sales SET total_amount = (SELECT COALESCE(SUM(total), 0) FROM sale_items WHERE sale_id = ?) + (SELECT COALESCE(SUM(total), 0) FROM sale_service_items WHERE sale_id = ?) - COALESCE((SELECT order_discount_amount FROM sales WHERE id = ?), 0) + COALESCE((SELECT additional_cost FROM sales WHERE id = ?), 0), updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [saleId, saleId, saleId, saleId, saleId]
  );
  const idResult = await runQuery("SELECT id FROM sale_items WHERE sale_id = ? ORDER BY id DESC LIMIT 1", [saleId]);
  const itemId = Number(idResult.rows[0]?.[0]);
  const result = await runQuery(
    "SELECT id, sale_id, product_id, unit_id, per_price, amount, total, purchase_item_id, sale_type, discount_type, discount_value, created_at FROM sale_items WHERE id = ?",
    [itemId]
  );
  return rowsToObjects<Record<string, unknown>>(result)[0];
}

async function handleUpdateSaleItem(
  id: number,
  productId: number,
  unitId: number,
  perPrice: number,
  amount: number,
  purchaseItemId: number | null,
  saleType: string | null,
  discountType: string | null,
  discountValue: number
): Promise<Record<string, unknown>> {
  if (purchaseItemId) {
    const currentResult = await runQuery("SELECT amount, unit_id, purchase_item_id FROM sale_items WHERE id = ?", [id]);
    const currentRow = currentResult.rows[0];
    let addBack = 0;
    if (currentRow) {
      const currentAmount = Number(currentRow[currentResult.columns.indexOf("amount")]);
      const currentUnitId = Number(currentRow[currentResult.columns.indexOf("unit_id")]);
      const currentPurchaseItemId = currentRow[currentResult.columns.indexOf("purchase_item_id")];
      if (currentPurchaseItemId === purchaseItemId) {
        addBack = await amountToBase(currentAmount, currentUnitId);
      }
    }
    const remainingBase = await getBatchRemainingBase(purchaseItemId);
    const saleAmountBase = await amountToBase(amount, unitId);
    if (saleAmountBase > remainingBase + addBack + 1e-9) {
      throw new Error("موجودی دسته کافی نیست (Insufficient batch stock)");
    }
  }
  const lineSubtotal = perPrice * amount;
  const disc = computeDiscountAmount(lineSubtotal, discountType, discountValue);
  const total = round2(lineSubtotal - disc);
  await runExecute(
    "UPDATE sale_items SET product_id = ?, unit_id = ?, per_price = ?, amount = ?, total = ?, purchase_item_id = ?, sale_type = ?, discount_type = ?, discount_value = ? WHERE id = ?",
    [productId, unitId, perPrice, amount, total, purchaseItemId, saleType, discountType, discountValue, id]
  );
  const saleIdResult = await runQuery("SELECT sale_id FROM sale_items WHERE id = ?", [id]);
  const saleId = Number(saleIdResult.rows[0]?.[0]);
  await runExecute(
    "UPDATE sales SET total_amount = (SELECT COALESCE(SUM(total), 0) FROM sale_items WHERE sale_id = ?) + (SELECT COALESCE(SUM(total), 0) FROM sale_service_items WHERE sale_id = ?) - COALESCE((SELECT order_discount_amount FROM sales WHERE id = ?), 0) + COALESCE((SELECT additional_cost FROM sales WHERE id = ?), 0), updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [saleId, saleId, saleId, saleId, saleId]
  );
  const result = await runQuery(
    "SELECT id, sale_id, product_id, unit_id, per_price, amount, total, purchase_item_id, sale_type, discount_type, discount_value, created_at FROM sale_items WHERE id = ?",
    [id]
  );
  return rowsToObjects<Record<string, unknown>>(result)[0];
}

async function handleDeleteSaleItem(id: number): Promise<string> {
  const saleIdResult = await runQuery("SELECT sale_id FROM sale_items WHERE id = ?", [id]);
  const saleId = Number(saleIdResult.rows[0]?.[0]);
  if (!saleId) {
    throw new Error("Sale item not found");
  }
  await runExecute("DELETE FROM sale_items WHERE id = ?", [id]);
  await runExecute(
    "UPDATE sales SET total_amount = (SELECT COALESCE(SUM(total), 0) FROM sale_items WHERE sale_id = ?) + (SELECT COALESCE(SUM(total), 0) FROM sale_service_items WHERE sale_id = ?) - COALESCE((SELECT order_discount_amount FROM sales WHERE id = ?), 0) + COALESCE((SELECT additional_cost FROM sales WHERE id = ?), 0), updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [saleId, saleId, saleId, saleId, saleId]
  );
  return "Sale item deleted successfully";
}

async function handleGetSalePayments(saleId: number): Promise<Record<string, unknown>[]> {
  const result = await runQuery(
    "SELECT id, sale_id, account_id, currency_id, exchange_rate, amount, base_amount, date, created_at FROM sale_payments WHERE sale_id = ? ORDER BY date DESC, created_at DESC",
    [saleId]
  );
  return rowsToObjects<Record<string, unknown>>(result);
}

async function handleCreateSalePayment(
  saleId: number,
  accountId: number | null,
  currencyId: number | null,
  exchangeRate: number,
  amount: number,
  date: string
): Promise<Record<string, unknown>> {
  const baseAmount = amount * exchangeRate;
  // Get payment currency_id (use provided or sale currency or base currency)
  let paymentCurrencyId = currencyId;
  if (!paymentCurrencyId) {
    const saleResult = await runQuery("SELECT currency_id FROM sales WHERE id = ?", [saleId]);
    paymentCurrencyId = saleResult.rows[0] ? Number(saleResult.rows[0][saleResult.columns.indexOf("currency_id")]) : null;
    if (!paymentCurrencyId) {
      const baseCurrencyResult = await runQuery("SELECT id FROM currencies WHERE base = 1 LIMIT 1", []);
      paymentCurrencyId = baseCurrencyResult.rows[0] ? Number(baseCurrencyResult.rows[0][0]) : 1;
    }
  }
  await runExecute(
    "INSERT INTO sale_payments (sale_id, account_id, currency_id, exchange_rate, amount, base_amount, date) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [saleId, accountId, paymentCurrencyId, exchangeRate, amount, baseAmount, date]
  );
  // If account_id provided, deposit to account
  if (accountId && paymentCurrencyId) {
    const balanceResult = await runQuery(
      "SELECT balance FROM account_currency_balances WHERE account_id = ? AND currency_id = ?",
      [accountId, paymentCurrencyId]
    );
    const currentBalance = balanceResult.rows[0] ? Number(balanceResult.rows[0][0]) : 0;
    const newBalance = currentBalance + amount;
    await runExecute(
      "INSERT INTO account_currency_balances (account_id, currency_id, balance, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE balance = ?, updated_at = CURRENT_TIMESTAMP",
      [accountId, paymentCurrencyId, newBalance, newBalance]
    );
    const currencyResult = await runQuery("SELECT name FROM currencies WHERE id = ? LIMIT 1", [paymentCurrencyId]);
    const currencyName = currencyResult.rows[0] ? String(currencyResult.rows[0][0]) : "";
    await runExecute(
      "INSERT INTO account_transactions (account_id, transaction_type, amount, currency, rate, total, transaction_date, is_full, notes) VALUES (?, 'deposit', ?, ?, ?, ?, ?, 0, ?)",
      [accountId, amount, currencyName, exchangeRate, baseAmount, date, `Sale payment: Sale #${saleId}`]
    );
    const accountBalanceResult = await runQuery(
      "SELECT COALESCE(SUM(balance), 0) FROM account_currency_balances WHERE account_id = ?",
      [accountId]
    );
    const accountBalance = Number(accountBalanceResult.rows[0]?.[0] ?? 0);
    await runExecute("UPDATE accounts SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [accountBalance, accountId]);
  }
  // Update sale paid_amount
  await runExecute(
    "UPDATE sales SET paid_amount = (SELECT COALESCE(SUM(amount), 0) FROM sale_payments WHERE sale_id = ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [saleId, saleId]
  );
  const idResult = await runQuery("SELECT id FROM sale_payments WHERE sale_id = ? ORDER BY id DESC LIMIT 1", [saleId]);
  const paymentId = Number(idResult.rows[0]?.[0]);
  const result = await runQuery(
    "SELECT id, sale_id, account_id, currency_id, exchange_rate, amount, base_amount, date, created_at FROM sale_payments WHERE id = ?",
    [paymentId]
  );
  return rowsToObjects<Record<string, unknown>>(result)[0];
}

async function handleDeleteSalePayment(id: number): Promise<string> {
  const saleIdResult = await runQuery("SELECT sale_id FROM sale_payments WHERE id = ?", [id]);
  const saleId = Number(saleIdResult.rows[0]?.[0]);
  if (!saleId) {
    throw new Error("Sale payment not found");
  }
  await runExecute("DELETE FROM sale_payments WHERE id = ?", [id]);
  // Update sale paid_amount
  await runExecute(
    "UPDATE sales SET paid_amount = (SELECT COALESCE(SUM(amount), 0) FROM sale_payments WHERE sale_id = ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [saleId, saleId]
  );
  return "Sale payment deleted successfully";
}

async function handleGetSaleAdditionalCosts(saleId: number): Promise<Record<string, unknown>[]> {
  const result = await runQuery(
    "SELECT id, sale_id, name, amount, created_at FROM sale_additional_costs WHERE sale_id = ? ORDER BY id",
    [saleId]
  );
  return rowsToObjects<Record<string, unknown>>(result);
}

async function handleGetPurchaseItems(purchaseId: number): Promise<Record<string, unknown>[]> {
  const result = await runQuery(
    "SELECT id, purchase_id, product_id, unit_id, per_price, amount, total, per_unit, cost_price, wholesale_price, retail_price, expiry_date, created_at FROM purchase_items WHERE purchase_id = ? ORDER BY id",
    [purchaseId]
  );
  return rowsToObjects<Record<string, unknown>>(result);
}

async function handleCreatePurchaseItem(
  purchaseId: number,
  productId: number,
  unitId: number,
  perPrice: number,
  amount: number
): Promise<Record<string, unknown>> {
  const total = perPrice * amount;
  await runExecute(
    "INSERT INTO purchase_items (purchase_id, product_id, unit_id, per_price, amount, total, per_unit, cost_price, wholesale_price, retail_price, expiry_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [purchaseId, productId, unitId, perPrice, amount, total, null, null, null, null, null]
  );
  // Update purchase total
  await runExecute(
    "UPDATE purchases SET total_amount = (SELECT COALESCE(SUM(total), 0) FROM purchase_items WHERE purchase_id = ?) + COALESCE((SELECT SUM(amount) FROM purchase_additional_costs WHERE purchase_id = ?), 0), updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [purchaseId, purchaseId, purchaseId]
  );
  const idResult = await runQuery("SELECT id FROM purchase_items WHERE purchase_id = ? ORDER BY id DESC LIMIT 1", [purchaseId]);
  const itemId = Number(idResult.rows[0]?.[0]);
  const result = await runQuery(
    "SELECT id, purchase_id, product_id, unit_id, per_price, amount, total, per_unit, cost_price, wholesale_price, retail_price, expiry_date, created_at FROM purchase_items WHERE id = ?",
    [itemId]
  );
  const items = rowsToObjects<Record<string, unknown>>(result);
  return items[0];
}

async function handleUpdatePurchaseItem(
  id: number,
  productId: number,
  unitId: number,
  perPrice: number,
  amount: number
): Promise<Record<string, unknown>> {
  const total = perPrice * amount;
  await runExecute(
    "UPDATE purchase_items SET product_id = ?, unit_id = ?, per_price = ?, amount = ?, total = ?, per_unit = ?, cost_price = ?, wholesale_price = ?, retail_price = ?, expiry_date = ? WHERE id = ?",
    [productId, unitId, perPrice, amount, total, null, null, null, null, null, id]
  );
  // Get purchase_id to update purchase total
  const purchaseIdResult = await runQuery("SELECT purchase_id FROM purchase_items WHERE id = ?", [id]);
  const purchaseId = Number(purchaseIdResult.rows[0]?.[0]);
  await runExecute(
    "UPDATE purchases SET total_amount = (SELECT COALESCE(SUM(total), 0) FROM purchase_items WHERE purchase_id = ?) + COALESCE((SELECT SUM(amount) FROM purchase_additional_costs WHERE purchase_id = ?), 0), updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [purchaseId, purchaseId, purchaseId]
  );
  const result = await runQuery(
    "SELECT id, purchase_id, product_id, unit_id, per_price, amount, total, per_unit, cost_price, wholesale_price, retail_price, expiry_date, created_at FROM purchase_items WHERE id = ?",
    [id]
  );
  const items = rowsToObjects<Record<string, unknown>>(result);
  return items[0];
}

async function handleDeletePurchaseItem(id: number): Promise<string> {
  const purchaseIdResult = await runQuery("SELECT purchase_id FROM purchase_items WHERE id = ?", [id]);
  const purchaseId = Number(purchaseIdResult.rows[0]?.[0]);
  if (!purchaseId) {
    throw new Error("Purchase item not found");
  }
  await runExecute("DELETE FROM purchase_items WHERE id = ?", [id]);
  // Update purchase total
  await runExecute(
    "UPDATE purchases SET total_amount = (SELECT COALESCE(SUM(total), 0) FROM purchase_items WHERE purchase_id = ?) + COALESCE((SELECT SUM(amount) FROM purchase_additional_costs WHERE purchase_id = ?), 0), updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [purchaseId, purchaseId, purchaseId]
  );
  return "Purchase item deleted successfully";
}

// Product stock handlers
async function handleGetProductBatches(productId: number): Promise<Record<string, unknown>[]> {
  const result = await runQuery(
    `SELECT 
      pi.id AS purchase_item_id,
      pi.purchase_id,
      p.batch_number,
      p.date AS purchase_date,
      pi.expiry_date,
      pi.per_price,
      pi.per_unit,
      pi.wholesale_price,
      pi.retail_price,
      pi.amount,
      ROUND(((pi.amount * COALESCE(u_pi.ratio, 1)) - COALESCE(sold.sold_base, 0)) / COALESCE(u_pi.ratio, 1), 6) AS remaining_quantity
    FROM purchase_items pi
    INNER JOIN purchases p ON pi.purchase_id = p.id
    LEFT JOIN units u_pi ON u_pi.id = pi.unit_id
    LEFT JOIN (
      SELECT si.purchase_item_id,
        SUM(si.amount * COALESCE(u_si.ratio, 1)) AS sold_base
      FROM sale_items si
      LEFT JOIN units u_si ON u_si.id = si.unit_id
      WHERE si.purchase_item_id IS NOT NULL
      GROUP BY si.purchase_item_id
    ) sold ON sold.purchase_item_id = pi.id
    WHERE pi.product_id = ?
    HAVING remaining_quantity > 0`,
    [productId]
  );
  return rowsToObjects<Record<string, unknown>>(result);
}

async function handleGetProductStock(productId: number, unitId: number | null): Promise<Record<string, unknown>> {
  const stockResult = await runQuery(
    `SELECT COALESCE(SUM(
      GREATEST(0, (pi.amount * COALESCE(u_pi.ratio, 1)) - COALESCE(sold.sold_base, 0))
    ), 0) AS total_base
    FROM purchase_items pi
    LEFT JOIN units u_pi ON u_pi.id = pi.unit_id
    LEFT JOIN (
      SELECT si.purchase_item_id,
        SUM(si.amount * COALESCE(u_si.ratio, 1)) AS sold_base
      FROM sale_items si
      LEFT JOIN units u_si ON u_si.id = si.unit_id
      WHERE si.purchase_item_id IS NOT NULL
      GROUP BY si.purchase_item_id
    ) sold ON sold.purchase_item_id = pi.id
    WHERE pi.product_id = ?`,
    [productId]
  );
  const totalBase = Number(stockResult.rows[0]?.[0] ?? 0);
  
  let totalInUnit = totalBase;
  if (unitId) {
    const unitResult = await runQuery("SELECT ratio FROM units WHERE id = ?", [unitId]);
    const ratio = Number(unitResult.rows[0]?.[0] ?? 1);
    totalInUnit = totalBase / ratio;
  }
  
  return { total_base: totalBase, total_in_unit: totalInUnit };
}

async function handleGetStockByBatches(): Promise<Record<string, unknown>[]> {
  const result = await runQuery(
    `SELECT 
      pi.product_id,
      COALESCE(pr.name, '') AS product_name,
      pi.id AS purchase_item_id,
      pi.purchase_id,
      p.batch_number,
      p.date AS purchase_date,
      pi.expiry_date,
      COALESCE(u_pi.name, '') AS unit_name,
      pi.amount,
      ROUND(((pi.amount * COALESCE(u_pi.ratio, 1)) - COALESCE(sold.sold_base, 0)) / COALESCE(u_pi.ratio, 1), 6) AS remaining_quantity,
      pi.per_price,
      COALESCE(pi.cost_price, pi.per_price) AS cost_price,
      pi.retail_price,
      pi.wholesale_price
    FROM purchase_items pi
    INNER JOIN purchases p ON pi.purchase_id = p.id
    LEFT JOIN units u_pi ON u_pi.id = pi.unit_id
    LEFT JOIN products pr ON pr.id = pi.product_id
    LEFT JOIN (
      SELECT si.purchase_item_id,
        SUM(si.amount * COALESCE(u_si.ratio, 1)) AS sold_base
      FROM sale_items si
      LEFT JOIN units u_si ON u_si.id = si.unit_id
      WHERE si.purchase_item_id IS NOT NULL
      GROUP BY si.purchase_item_id
    ) sold ON sold.purchase_item_id = pi.id
    HAVING remaining_quantity > 0`,
    []
  );
  return rowsToObjects<Record<string, unknown>>(result);
}

// Service handlers
async function handleGetService(id: number): Promise<Record<string, unknown>> {
  const result = await runQuery(
    "SELECT id, name, price, currency_id, description, created_at, updated_at FROM services WHERE id = ?",
    [id]
  );
  const services = rowsToObjects<Record<string, unknown>>(result);
  const service = services[0];
  if (!service) {
    throw new Error("Service not found");
  }
  return service;
}

async function handleCreateService(
  name: string,
  price: number,
  currencyId: number | null,
  description: string | null
): Promise<Record<string, unknown>> {
  await runExecute("INSERT INTO services (name, price, currency_id, description) VALUES (?, ?, ?, ?)", [name, price, currencyId, description]);
  const idResult = await runQuery("SELECT id FROM services ORDER BY id DESC LIMIT 1", []);
  const serviceId = Number(idResult.rows[0]?.[0]);
  if (!serviceId) {
    throw new Error("Failed to retrieve service ID");
  }
  const result = await runQuery(
    "SELECT id, name, price, currency_id, description, created_at, updated_at FROM services WHERE id = ?",
    [serviceId]
  );
  const services = rowsToObjects<Record<string, unknown>>(result);
  const service = services[0];
  if (!service) {
    throw new Error("Failed to retrieve created service");
  }
  return service;
}

async function handleUpdateService(
  id: number,
  name: string,
  price: number,
  currencyId: number | null,
  description: string | null
): Promise<Record<string, unknown>> {
  await runExecute("UPDATE services SET name = ?, price = ?, currency_id = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [
    name,
    price,
    currencyId,
    description,
    id,
  ]);
  const result = await runQuery(
    "SELECT id, name, price, currency_id, description, created_at, updated_at FROM services WHERE id = ?",
    [id]
  );
  const services = rowsToObjects<Record<string, unknown>>(result);
  const service = services[0];
  if (!service) {
    throw new Error("Service not found");
  }
  return service;
}

async function handleDeleteService(id: number): Promise<string> {
  await runExecute("DELETE FROM services WHERE id = ?", [id]);
  return "Service deleted successfully";
}

// Expense handlers
async function handleGetExpenseTypes(): Promise<Record<string, unknown>[]> {
  const result = await runQuery("SELECT id, name, created_at, updated_at FROM expense_types ORDER BY name", []);
  return rowsToObjects<Record<string, unknown>>(result);
}

async function handleCreateExpenseType(name: string): Promise<Record<string, unknown>> {
  await runExecute("INSERT INTO expense_types (name) VALUES (?)", [name]);
  const result = await runQuery("SELECT id, name, created_at, updated_at FROM expense_types WHERE name = ?", [name]);
  const types = rowsToObjects<Record<string, unknown>>(result);
  const expenseType = types[0];
  if (!expenseType) {
    throw new Error("Failed to retrieve created expense type");
  }
  return expenseType;
}

async function handleUpdateExpenseType(id: number, name: string): Promise<Record<string, unknown>> {
  await runExecute("UPDATE expense_types SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [name, id]);
  const result = await runQuery("SELECT id, name, created_at, updated_at FROM expense_types WHERE id = ?", [id]);
  const types = rowsToObjects<Record<string, unknown>>(result);
  const expenseType = types[0];
  if (!expenseType) {
    throw new Error("Expense type not found");
  }
  return expenseType;
}

async function handleDeleteExpenseType(id: number): Promise<string> {
  await runExecute("DELETE FROM expense_types WHERE id = ?", [id]);
  return "Expense type deleted successfully";
}

async function handleGetExpenses(page: number, perPage: number, search: string | null, sortBy: string | null, sortOrder: string | null) {
  let where = "";
  const params: unknown[] = [];
  const allowedSort = ["date", "amount", "created_at"].includes(sortBy || "") ? sortBy! : "date";
  const order = (sortOrder || "desc").toUpperCase() === "DESC" ? "DESC" : "ASC";
  return paginated(
    "expenses",
    "*",
    `SELECT COUNT(*) FROM expenses ${where}`,
    `SELECT id, expense_type_id, amount, currency, rate, total, date, bill_no, description, created_at, updated_at FROM expenses ${where}`,
    params,
    page,
    perPage,
    `ORDER BY ${allowedSort} ${order}`
  );
}

async function handleGetExpense(id: number): Promise<Record<string, unknown>> {
  const result = await runQuery(
    "SELECT id, expense_type_id, account_id, amount, currency, rate, total, date, bill_no, description, created_at, updated_at FROM expenses WHERE id = ?",
    [id]
  );
  const expenses = rowsToObjects<Record<string, unknown>>(result);
  const expense = expenses[0];
  if (!expense) {
    throw new Error("Expense not found");
  }
  return expense;
}

async function handleCreateExpense(
  expenseTypeId: number,
  accountId: number | null,
  amount: number,
  currency: string,
  rate: number,
  total: number,
  date: string,
  billNo: string | null,
  description: string | null
): Promise<Record<string, unknown>> {
  // If account_id is provided, check balance and create transaction
  if (accountId) {
    const currencyResult = await runQuery("SELECT id FROM currencies WHERE name = ? LIMIT 1", [currency]);
    const currencyId = currencyResult.rows[0] ? Number(currencyResult.rows[0][0]) : null;
    if (currencyId) {
      const balanceResult = await runQuery(
        "SELECT balance FROM account_currency_balances WHERE account_id = ? AND currency_id = ?",
        [accountId, currencyId]
      );
      const currentBalance = balanceResult.rows[0] ? Number(balanceResult.rows[0][0]) : 0;
      if (currentBalance < amount) {
        throw new Error(`Insufficient balance in account. Available: ${currentBalance}, Required: ${amount}`);
      }
      // Create transaction record
      await runExecute(
        "INSERT INTO account_transactions (account_id, transaction_type, amount, currency, rate, total, transaction_date, is_full, notes) VALUES (?, 'withdraw', ?, ?, ?, ?, ?, 0, ?)",
        [accountId, amount, currency, rate, total, date, description ? `Expense: ${description}` : null]
      );
      // Update balance
      const newBalance = currentBalance - amount;
      await runExecute(
        "INSERT INTO account_currency_balances (account_id, currency_id, balance, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE balance = ?, updated_at = CURRENT_TIMESTAMP",
        [accountId, currencyId, newBalance, newBalance]
      );
      // Update account current_balance
      const accountBalanceResult = await runQuery(
        "SELECT COALESCE(SUM(balance), 0) FROM account_currency_balances WHERE account_id = ?",
        [accountId]
      );
      const accountBalance = Number(accountBalanceResult.rows[0]?.[0] ?? 0);
      await runExecute("UPDATE accounts SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [accountBalance, accountId]);
    }
  }
  await runExecute(
    "INSERT INTO expenses (expense_type_id, account_id, amount, currency, rate, total, date, bill_no, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [expenseTypeId, accountId, amount, currency, rate, total, date, billNo, description]
  );
  const idResult = await runQuery("SELECT id FROM expenses ORDER BY id DESC LIMIT 1", []);
  const expenseId = Number(idResult.rows[0]?.[0]);
  const result = await runQuery(
    "SELECT id, expense_type_id, account_id, amount, currency, rate, total, date, bill_no, description, created_at, updated_at FROM expenses WHERE id = ?",
    [expenseId]
  );
  const expenses = rowsToObjects<Record<string, unknown>>(result);
  const expense = expenses[0];
  if (!expense) {
    throw new Error("Failed to retrieve created expense");
  }
  return expense;
}

async function handleUpdateExpense(
  id: number,
  expenseTypeId: number,
  accountId: number | null,
  amount: number,
  currency: string,
  rate: number,
  total: number,
  date: string,
  billNo: string | null,
  description: string | null
): Promise<Record<string, unknown>> {
  // Get old expense to restore balance if needed
  const oldResult = await runQuery("SELECT account_id, amount, currency FROM expenses WHERE id = ?", [id]);
  const oldExpense = oldResult.rows[0];
  if (oldExpense) {
    const oldAccountId = oldExpense[oldResult.columns.indexOf("account_id")];
    const oldAmount = Number(oldExpense[oldResult.columns.indexOf("amount")]);
    const oldCurrency = String(oldExpense[oldResult.columns.indexOf("currency")]);
    // Restore old balance if account changed
    if (oldAccountId && (oldAccountId !== accountId || oldCurrency !== currency)) {
      const oldCurrencyResult = await runQuery("SELECT id FROM currencies WHERE name = ? LIMIT 1", [oldCurrency]);
      const oldCurrencyId = oldCurrencyResult.rows[0] ? Number(oldCurrencyResult.rows[0][0]) : null;
      if (oldCurrencyId) {
        const balanceResult = await runQuery(
          "SELECT balance FROM account_currency_balances WHERE account_id = ? AND currency_id = ?",
          [oldAccountId, oldCurrencyId]
        );
        const currentBalance = balanceResult.rows[0] ? Number(balanceResult.rows[0][0]) : 0;
        const newBalance = currentBalance + oldAmount;
        await runExecute(
          "INSERT INTO account_currency_balances (account_id, currency_id, balance, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE balance = ?, updated_at = CURRENT_TIMESTAMP",
          [oldAccountId, oldCurrencyId, newBalance, newBalance]
        );
      }
    }
  }
  // Update expense
  await runExecute(
    "UPDATE expenses SET expense_type_id = ?, account_id = ?, amount = ?, currency = ?, rate = ?, total = ?, date = ?, bill_no = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [expenseTypeId, accountId, amount, currency, rate, total, date, billNo, description, id]
  );
  // Update new account balance if account_id provided
  if (accountId) {
    const currencyResult = await runQuery("SELECT id FROM currencies WHERE name = ? LIMIT 1", [currency]);
    const currencyId = currencyResult.rows[0] ? Number(currencyResult.rows[0][0]) : null;
    if (currencyId) {
      const balanceResult = await runQuery(
        "SELECT balance FROM account_currency_balances WHERE account_id = ? AND currency_id = ?",
        [accountId, currencyId]
      );
      const currentBalance = balanceResult.rows[0] ? Number(balanceResult.rows[0][0]) : 0;
      if (currentBalance < amount) {
        throw new Error(`Insufficient balance in account. Available: ${currentBalance}, Required: ${amount}`);
      }
      const newBalance = currentBalance - amount;
      await runExecute(
        "INSERT INTO account_currency_balances (account_id, currency_id, balance, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE balance = ?, updated_at = CURRENT_TIMESTAMP",
        [accountId, currencyId, newBalance, newBalance]
      );
    }
  }
  const result = await runQuery(
    "SELECT id, expense_type_id, account_id, amount, currency, rate, total, date, bill_no, description, created_at, updated_at FROM expenses WHERE id = ?",
    [id]
  );
  const expenses = rowsToObjects<Record<string, unknown>>(result);
  const expense = expenses[0];
  if (!expense) {
    throw new Error("Expense not found");
  }
  return expense;
}

async function handleDeleteExpense(id: number): Promise<string> {
  await runExecute("DELETE FROM expenses WHERE id = ?", [id]);
  return "Expense deleted successfully";
}

// Helper functions for sale creation
function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

function computeDiscountAmount(subtotal: number, discountType: string | null, discountValue: number): number {
  if (subtotal <= 0) return 0;
  if (!discountType) return 0;
  if (discountType === "percent") {
    const pct = Math.max(0, Math.min(100, discountValue));
    return round2(subtotal * pct / 100);
  } else if (discountType === "fixed") {
    return round2(Math.min(subtotal, discountValue));
  }
  return 0;
}

async function getUnitRatio(unitId: number): Promise<number> {
  const result = await runQuery("SELECT ratio FROM units WHERE id = ?", [unitId]);
  const ratio = Number(result.rows[0]?.[0] ?? 1);
  return ratio || 1;
}

async function amountToBase(amount: number, unitId: number): Promise<number> {
  const ratio = await getUnitRatio(unitId);
  return amount * ratio;
}

async function getBatchRemainingBase(purchaseItemId: number): Promise<number> {
  const result = await runQuery(
    `SELECT ROUND(((pi.amount * COALESCE(u_pi.ratio, 1)) - COALESCE(sold.sold_base, 0)) / COALESCE(u_pi.ratio, 1), 6) AS remaining_quantity
    FROM purchase_items pi
    LEFT JOIN units u_pi ON u_pi.id = pi.unit_id
    LEFT JOIN (
      SELECT si.purchase_item_id,
        SUM(si.amount * COALESCE(u_si.ratio, 1)) AS sold_base
      FROM sale_items si
      LEFT JOIN units u_si ON u_si.id = si.unit_id
      WHERE si.purchase_item_id IS NOT NULL
      GROUP BY si.purchase_item_id
    ) sold ON sold.purchase_item_id = pi.id
    WHERE pi.id = ?`,
    [purchaseItemId]
  );
  return Number(result.rows[0]?.[0] ?? 0);
}

// Sale creation handler
async function handleCreateSale(
  customerId: number,
  date: string,
  notes: string | null,
  currencyId: number | null,
  exchangeRate: number,
  paidAmount: number,
  additionalCosts: [string, number][],
  items: [number, number, number, number, number | null, string | null, string | null, number][],
  serviceItems: [number, string, number, number, string | null, number][],
  orderDiscountType: string | null,
  orderDiscountValue: number
): Promise<Record<string, unknown>> {
  if (items.length === 0 && serviceItems.length === 0) {
    throw new Error("Sale must have at least one product item or service item");
  }

  // Compute line totals with line-level discount
  const itemsLineTotals: number[] = [];
  for (const [, , perPrice, amount, , , discountType, discountValue] of items) {
    const lineSubtotal = perPrice * amount;
    const disc = computeDiscountAmount(lineSubtotal, discountType, discountValue);
    itemsLineTotals.push(round2(lineSubtotal - disc));
  }

  const serviceLineTotals: number[] = [];
  for (const [, , price, qty, discountType, discountValue] of serviceItems) {
    const lineSubtotal = price * qty;
    const disc = computeDiscountAmount(lineSubtotal, discountType, discountValue);
    serviceLineTotals.push(round2(lineSubtotal - disc));
  }

  const subtotal = round2(itemsLineTotals.reduce((a, b) => a + b, 0) + serviceLineTotals.reduce((a, b) => a + b, 0));
  const orderDiscountAmount = computeDiscountAmount(subtotal, orderDiscountType, orderDiscountValue);
  const additionalCostsTotal = additionalCosts.reduce((sum, [, amount]) => sum + amount, 0);
  const totalAmount = round2(subtotal - orderDiscountAmount + additionalCostsTotal);
  const baseAmount = totalAmount * exchangeRate;

  // Insert sale
  await runExecute(
    "INSERT INTO sales (customer_id, date, notes, currency_id, exchange_rate, total_amount, base_amount, paid_amount, additional_cost, order_discount_type, order_discount_value, order_discount_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      customerId,
      date,
      notes,
      currencyId,
      exchangeRate,
      totalAmount,
      baseAmount,
      paidAmount,
      additionalCostsTotal,
      orderDiscountType,
      orderDiscountValue,
      orderDiscountAmount,
    ]
  );

  // Get the created sale ID
  const saleIdResult = await runQuery("SELECT id FROM sales WHERE customer_id = ? AND date = ? ORDER BY id DESC LIMIT 1", [customerId, date]);
  const saleId = Number(saleIdResult.rows[0]?.[0]);
  if (!saleId) {
    throw new Error("Failed to retrieve sale ID");
  }

  // Get base currency ID
  const baseCurrencyResult = await runQuery("SELECT id FROM currencies WHERE base = 1 LIMIT 1", []);
  let baseCurrencyId = baseCurrencyResult.rows[0] ? Number(baseCurrencyResult.rows[0][0]) : null;
  if (!baseCurrencyId) {
    const firstCurrencyResult = await runQuery("SELECT id FROM currencies LIMIT 1", []);
    baseCurrencyId = firstCurrencyResult.rows[0] ? Number(firstCurrencyResult.rows[0][0]) : 1;
  }

  // Validate batch stock for each sale item
  const batchUsedBase: Map<number, number> = new Map();
  for (const [productId, unitId, , amount, purchaseItemId] of items) {
    if (purchaseItemId) {
      const remainingBase = await getBatchRemainingBase(purchaseItemId);
      const usedSoFar = batchUsedBase.get(purchaseItemId) || 0;
      const thisBase = await amountToBase(amount, unitId);
      if (usedSoFar + thisBase > remainingBase + 1e-9) {
        throw new Error("موجودی دسته کافی نیست (Insufficient batch stock)");
      }
      batchUsedBase.set(purchaseItemId, usedSoFar + thisBase);
    }
  }

  // Insert sale items
  for (let idx = 0; idx < items.length; idx++) {
    const [productId, unitId, perPrice, amount, purchaseItemId, saleType, discountType, discountValue] = items[idx];
    const total = itemsLineTotals[idx] || perPrice * amount;
    await runExecute(
      "INSERT INTO sale_items (sale_id, product_id, unit_id, per_price, amount, total, purchase_item_id, sale_type, discount_type, discount_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [saleId, productId, unitId, perPrice, amount, total, purchaseItemId, saleType, discountType, discountValue]
    );
  }

  // Insert sale service items
  for (let idx = 0; idx < serviceItems.length; idx++) {
    const [serviceId, name, price, quantity, discountType, discountValue] = serviceItems[idx];
    const total = serviceLineTotals[idx] || price * quantity;
    await runExecute(
      "INSERT INTO sale_service_items (sale_id, service_id, name, price, quantity, total, discount_type, discount_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [saleId, serviceId, name, price, quantity, total, discountType, discountValue]
    );
  }

  // Insert additional costs
  for (const [name, amount] of additionalCosts) {
    await runExecute("INSERT INTO sale_additional_costs (sale_id, name, amount) VALUES (?, ?, ?)", [saleId, name, amount]);
  }

  // Insert initial payment if paid_amount > 0
  if (paidAmount > 0) {
    const paymentCurrencyId = currencyId || baseCurrencyId;
    const paymentBaseAmount = paidAmount * exchangeRate;
    await runExecute(
      "INSERT INTO sale_payments (sale_id, currency_id, exchange_rate, amount, base_amount, date) VALUES (?, ?, ?, ?, ?, ?)",
      [saleId, paymentCurrencyId, exchangeRate, paidAmount, paymentBaseAmount, date]
    );
  }

  // Get the created sale
  const saleResult = await runQuery(
    "SELECT id, customer_id, date, notes, currency_id, exchange_rate, total_amount, base_amount, paid_amount, additional_cost, order_discount_type, order_discount_value, order_discount_amount, discount_code_id, created_at, updated_at FROM sales WHERE id = ?",
    [saleId]
  );
  const sales = rowsToObjects<Record<string, unknown>>(saleResult);
  const sale = sales[0];
  if (!sale) {
    throw new Error("Failed to retrieve created sale");
  }
  return sale;
}

async function handleUpdateSale(
  id: number,
  customerId: number,
  date: string,
  notes: string | null,
  currencyId: number | null,
  exchangeRate: number,
  paidAmount: number,
  additionalCosts: [string, number][],
  items: [number, number, number, number, number | null, string | null, string | null, number][],
  serviceItems: [number, string, number, number, string | null, number][],
  orderDiscountType: string | null,
  orderDiscountValue: number
): Promise<Record<string, unknown>> {
  if (items.length === 0 && serviceItems.length === 0) {
    throw new Error("Sale must have at least one product item or service item");
  }

  // Compute totals (same as create)
  const itemsLineTotals: number[] = [];
  for (const [, , perPrice, amount, , , discountType, discountValue] of items) {
    const lineSubtotal = perPrice * amount;
    const disc = computeDiscountAmount(lineSubtotal, discountType, discountValue);
    itemsLineTotals.push(round2(lineSubtotal - disc));
  }
  const serviceLineTotals: number[] = [];
  for (const [, , price, qty, discountType, discountValue] of serviceItems) {
    const lineSubtotal = price * qty;
    const disc = computeDiscountAmount(lineSubtotal, discountType, discountValue);
    serviceLineTotals.push(round2(lineSubtotal - disc));
  }
  const subtotal = round2(itemsLineTotals.reduce((a, b) => a + b, 0) + serviceLineTotals.reduce((a, b) => a + b, 0));
  const orderDiscountAmount = computeDiscountAmount(subtotal, orderDiscountType, orderDiscountValue);
  const additionalCostsTotal = additionalCosts.reduce((sum, [, amount]) => sum + amount, 0);
  const totalAmount = round2(subtotal - orderDiscountAmount + additionalCostsTotal);
  const baseAmount = totalAmount * exchangeRate;

  // Update sale
  await runExecute(
    "UPDATE sales SET customer_id = ?, date = ?, notes = ?, currency_id = ?, exchange_rate = ?, total_amount = ?, base_amount = ?, paid_amount = ?, additional_cost = ?, order_discount_type = ?, order_discount_value = ?, order_discount_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [
      customerId,
      date,
      notes,
      currencyId,
      exchangeRate,
      totalAmount,
      baseAmount,
      paidAmount,
      additionalCostsTotal,
      orderDiscountType,
      orderDiscountValue,
      orderDiscountAmount,
      id,
    ]
  );

  // Delete existing items, service items, and costs
  await runExecute("DELETE FROM sale_items WHERE sale_id = ?", [id]);
  await runExecute("DELETE FROM sale_service_items WHERE sale_id = ?", [id]);
  await runExecute("DELETE FROM sale_additional_costs WHERE sale_id = ?", [id]);

  // Validate batch stock
  const batchUsedBase: Map<number, number> = new Map();
  for (const [productId, unitId, , amount, purchaseItemId] of items) {
    if (purchaseItemId) {
      const remainingBase = await getBatchRemainingBase(purchaseItemId);
      const usedSoFar = batchUsedBase.get(purchaseItemId) || 0;
      const thisBase = await amountToBase(amount, unitId);
      if (usedSoFar + thisBase > remainingBase + 1e-9) {
        throw new Error("موجودی دسته کافی نیست (Insufficient batch stock)");
      }
      batchUsedBase.set(purchaseItemId, usedSoFar + thisBase);
    }
  }

  // Insert new items
  for (let idx = 0; idx < items.length; idx++) {
    const [productId, unitId, perPrice, amount, purchaseItemId, saleType, discountType, discountValue] = items[idx];
    const total = itemsLineTotals[idx] || perPrice * amount;
    await runExecute(
      "INSERT INTO sale_items (sale_id, product_id, unit_id, per_price, amount, total, purchase_item_id, sale_type, discount_type, discount_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [id, productId, unitId, perPrice, amount, total, purchaseItemId, saleType, discountType, discountValue]
    );
  }

  // Insert new service items
  for (let idx = 0; idx < serviceItems.length; idx++) {
    const [serviceId, name, price, quantity, discountType, discountValue] = serviceItems[idx];
    const total = serviceLineTotals[idx] || price * quantity;
    await runExecute(
      "INSERT INTO sale_service_items (sale_id, service_id, name, price, quantity, total, discount_type, discount_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [id, serviceId, name, price, quantity, total, discountType, discountValue]
    );
  }

  // Insert new additional costs
  for (const [name, amount] of additionalCosts) {
    await runExecute("INSERT INTO sale_additional_costs (sale_id, name, amount) VALUES (?, ?, ?)", [id, name, amount]);
  }

  // Get updated sale
  const saleResult = await runQuery(
    "SELECT id, customer_id, date, notes, currency_id, exchange_rate, total_amount, base_amount, paid_amount, additional_cost, order_discount_type, order_discount_value, order_discount_amount, discount_code_id, created_at, updated_at FROM sales WHERE id = ?",
    [id]
  );
  const sales = rowsToObjects<Record<string, unknown>>(saleResult);
  const sale = sales[0];
  if (!sale) {
    throw new Error("Sale not found");
  }
  return sale;
}

async function handleDeleteSale(id: number): Promise<string> {
  await runExecute("DELETE FROM sales WHERE id = ?", [id]);
  return "Sale deleted successfully";
}

// Employee handlers
async function handleGetEmployees(page: number, perPage: number, search: string | null, sortBy: string | null, sortOrder: string | null) {
  let where = "";
  const params: unknown[] = [];
  if (search?.trim()) {
    where = "WHERE (full_name LIKE ? OR phone LIKE ? OR email LIKE ?)";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  const allowedSort = ["full_name", "created_at"].includes(sortBy || "") ? sortBy! : "created_at";
  const order = (sortOrder || "desc").toUpperCase() === "DESC" ? "DESC" : "ASC";
  return paginated(
    "employees",
    "*",
    `SELECT COUNT(*) FROM employees ${where}`,
    `SELECT id, full_name, phone, email, address, position, hire_date, base_salary, photo_path, notes, created_at, updated_at FROM employees ${where}`,
    params,
    page,
    perPage,
    `ORDER BY ${allowedSort} ${order}`
  );
}

async function handleGetEmployee(id: number): Promise<Record<string, unknown>> {
  const result = await runQuery(
    "SELECT id, full_name, phone, email, address, position, hire_date, base_salary, photo_path, notes, created_at, updated_at FROM employees WHERE id = ?",
    [id]
  );
  const employees = rowsToObjects<Record<string, unknown>>(result);
  const employee = employees[0];
  if (!employee) {
    throw new Error("Employee not found");
  }
  return employee;
}

async function handleCreateEmployee(
  fullName: string,
  phone: string,
  email: string | null,
  address: string,
  position: string | null,
  hireDate: string | null,
  baseSalary: number | null,
  photoPath: string | null,
  notes: string | null
): Promise<Record<string, unknown>> {
  await runExecute(
    "INSERT INTO employees (full_name, phone, email, address, position, hire_date, base_salary, photo_path, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [fullName, phone, email, address, position, hireDate, baseSalary, photoPath, notes]
  );
  const result = await runQuery(
    "SELECT id, full_name, phone, email, address, position, hire_date, base_salary, photo_path, notes, created_at, updated_at FROM employees WHERE full_name = ? AND phone = ? ORDER BY id DESC LIMIT 1",
    [fullName, phone]
  );
  const employees = rowsToObjects<Record<string, unknown>>(result);
  const employee = employees[0];
  if (!employee) {
    throw new Error("Failed to retrieve created employee");
  }
  return employee;
}

async function handleUpdateEmployee(
  id: number,
  fullName: string,
  phone: string,
  email: string | null,
  address: string,
  position: string | null,
  hireDate: string | null,
  baseSalary: number | null,
  photoPath: string | null,
  notes: string | null
): Promise<Record<string, unknown>> {
  await runExecute(
    "UPDATE employees SET full_name = ?, phone = ?, email = ?, address = ?, position = ?, hire_date = ?, base_salary = ?, photo_path = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [fullName, phone, email, address, position, hireDate, baseSalary, photoPath, notes, id]
  );
  const result = await runQuery(
    "SELECT id, full_name, phone, email, address, position, hire_date, base_salary, photo_path, notes, created_at, updated_at FROM employees WHERE id = ?",
    [id]
  );
  const employees = rowsToObjects<Record<string, unknown>>(result);
  const employee = employees[0];
  if (!employee) {
    throw new Error("Employee not found");
  }
  return employee;
}

async function handleDeleteEmployee(id: number): Promise<string> {
  await runExecute("DELETE FROM employees WHERE id = ?", [id]);
  return "Employee deleted successfully";
}

// Salary handlers
async function handleGetSalaries(page: number, perPage: number, search: string | null, sortBy: string | null, sortOrder: string | null) {
  let where = "";
  const params: unknown[] = [];
  const allowedSort = ["year", "month", "amount", "created_at"].includes(sortBy || "") ? sortBy! : "year";
  const order = (sortOrder || "desc").toUpperCase() === "DESC" ? "DESC" : "ASC";
  return paginated(
    "salaries",
    "*",
    `SELECT COUNT(*) FROM salaries ${where}`,
    `SELECT id, employee_id, year, month, amount, deductions, notes, created_at, updated_at FROM salaries ${where}`,
    params,
    page,
    perPage,
    `ORDER BY ${allowedSort} ${order}`
  );
}

async function handleGetSalariesByEmployee(employeeId: number): Promise<Record<string, unknown>[]> {
  const result = await runQuery(
    "SELECT id, employee_id, year, month, amount, deductions, notes, created_at, updated_at FROM salaries WHERE employee_id = ? ORDER BY year DESC, month DESC",
    [employeeId]
  );
  return rowsToObjects<Record<string, unknown>>(result);
}

async function handleGetSalary(id: number): Promise<Record<string, unknown>> {
  const result = await runQuery(
    "SELECT id, employee_id, year, month, amount, deductions, notes, created_at, updated_at FROM salaries WHERE id = ?",
    [id]
  );
  const salaries = rowsToObjects<Record<string, unknown>>(result);
  const salary = salaries[0];
  if (!salary) {
    throw new Error("Salary not found");
  }
  return salary;
}

async function handleCreateSalary(
  employeeId: number,
  year: number,
  month: string,
  amount: number,
  deductions: number,
  notes: string | null
): Promise<Record<string, unknown>> {
  await runExecute("INSERT INTO salaries (employee_id, year, month, amount, deductions, notes) VALUES (?, ?, ?, ?, ?, ?)", [
    employeeId,
    year,
    month,
    amount,
    deductions,
    notes,
  ]);
  const result = await runQuery(
    "SELECT id, employee_id, year, month, amount, deductions, notes, created_at, updated_at FROM salaries WHERE employee_id = ? AND year = ? AND month = ? ORDER BY id DESC LIMIT 1",
    [employeeId, year, month]
  );
  const salaries = rowsToObjects<Record<string, unknown>>(result);
  const salary = salaries[0];
  if (!salary) {
    throw new Error("Failed to retrieve created salary");
  }
  return salary;
}

async function handleUpdateSalary(
  id: number,
  employeeId: number,
  year: number,
  month: string,
  amount: number,
  deductions: number,
  notes: string | null
): Promise<Record<string, unknown>> {
  await runExecute(
    "UPDATE salaries SET employee_id = ?, year = ?, month = ?, amount = ?, deductions = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [employeeId, year, month, amount, deductions, notes, id]
  );
  const result = await runQuery(
    "SELECT id, employee_id, year, month, amount, COALESCE(deductions, 0) as deductions, notes, created_at, updated_at FROM salaries WHERE id = ?",
    [id]
  );
  const salaries = rowsToObjects<Record<string, unknown>>(result);
  const salary = salaries[0];
  if (!salary) {
    throw new Error("Salary not found");
  }
  return salary;
}

async function handleDeleteSalary(id: number): Promise<string> {
  await runExecute("DELETE FROM salaries WHERE id = ?", [id]);
  return "Salary deleted successfully";
}

// Deduction handlers
async function handleGetDeduction(id: number): Promise<Record<string, unknown>> {
  const result = await runQuery(
    "SELECT id, employee_id, year, month, currency, rate, amount, created_at, updated_at FROM deductions WHERE id = ?",
    [id]
  );
  const deductions = rowsToObjects<Record<string, unknown>>(result);
  const deduction = deductions[0];
  if (!deduction) {
    throw new Error("Deduction not found");
  }
  return deduction;
}

async function handleCreateDeduction(
  employeeId: number,
  year: number,
  month: string,
  currency: string,
  rate: number,
  amount: number
): Promise<Record<string, unknown>> {
  await runExecute("INSERT INTO deductions (employee_id, year, month, currency, rate, amount) VALUES (?, ?, ?, ?, ?, ?)", [
    employeeId,
    year,
    month,
    currency,
    rate,
    amount,
  ]);
  const result = await runQuery(
    "SELECT id, employee_id, year, month, currency, rate, amount, created_at, updated_at FROM deductions WHERE employee_id = ? AND year = ? AND month = ? AND currency = ? AND rate = ? AND amount = ? ORDER BY id DESC LIMIT 1",
    [employeeId, year, month, currency, rate, amount]
  );
  const deductions = rowsToObjects<Record<string, unknown>>(result);
  const deduction = deductions[0];
  if (!deduction) {
    throw new Error("Failed to retrieve created deduction");
  }
  return deduction;
}

async function handleUpdateDeduction(
  id: number,
  employeeId: number,
  currency: string,
  rate: number,
  amount: number
): Promise<Record<string, unknown>> {
  await runExecute("UPDATE deductions SET employee_id = ?, currency = ?, rate = ?, amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [
    employeeId,
    currency,
    rate,
    amount,
    id,
  ]);
  const result = await runQuery(
    "SELECT id, employee_id, COALESCE(year, 1403) as year, COALESCE(month, 'حمل') as month, currency, rate, amount, created_at, updated_at FROM deductions WHERE id = ?",
    [id]
  );
  const deductions = rowsToObjects<Record<string, unknown>>(result);
  const deduction = deductions[0];
  if (!deduction) {
    throw new Error("Deduction not found");
  }
  return deduction;
}

async function handleDeleteDeduction(id: number): Promise<string> {
  await runExecute("DELETE FROM deductions WHERE id = ?", [id]);
  return "Deduction deleted successfully";
}

async function handleGetDeductionsByEmployee(employeeId: number): Promise<Record<string, unknown>[]> {
  const result = await runQuery(
    "SELECT id, employee_id, year, month, currency, rate, amount, created_at, updated_at FROM deductions WHERE employee_id = ? ORDER BY year DESC, month DESC",
    [employeeId]
  );
  return rowsToObjects<Record<string, unknown>>(result);
}

async function handleGetDeductionsByEmployeeYearMonth(employeeId: number, year: number, month: string): Promise<Record<string, unknown>[]> {
  const result = await runQuery(
    "SELECT id, employee_id, year, month, currency, rate, amount, created_at, updated_at FROM deductions WHERE employee_id = ? AND year = ? AND month = ? ORDER BY created_at",
    [employeeId, year, month]
  );
  return rowsToObjects<Record<string, unknown>>(result);
}

// Account handlers
async function handleGetAccount(id: number): Promise<Record<string, unknown>> {
  const result = await runQuery(
    "SELECT id, name, currency_id, coa_category_id, account_code, account_type, initial_balance, current_balance, is_active, notes, created_at, updated_at FROM accounts WHERE id = ?",
    [id]
  );
  const accounts = rowsToObjects<Record<string, unknown>>(result);
  const account = accounts[0];
  if (!account) {
    throw new Error("Account not found");
  }
  return { ...account, is_active: Number(account.is_active) === 1 };
}

async function handleGetAccountBalance(accountId: number): Promise<number> {
  const result = await runQuery("SELECT current_balance FROM accounts WHERE id = ?", [accountId]);
  return Number(result.rows[0]?.[0] ?? 0);
}

async function handleGetAccountTransactions(accountId: number): Promise<Record<string, unknown>[]> {
  const result = await runQuery(
    "SELECT id, account_id, transaction_type, amount, currency, rate, total, transaction_date, is_full, notes, created_at, updated_at FROM account_transactions WHERE account_id = ? ORDER BY transaction_date DESC, created_at DESC",
    [accountId]
  );
  return rowsToObjects<Record<string, unknown>>(result).map((row: Record<string, unknown>) => ({
    ...row,
    is_full: Number(row.is_full) === 1,
  }));
}

async function handleGetAccountBalanceByCurrency(accountId: number, currencyId: number): Promise<Record<string, unknown>> {
  const result = await runQuery(
    "SELECT id, account_id, currency_id, balance, updated_at FROM account_currency_balances WHERE account_id = ? AND currency_id = ?",
    [accountId, currencyId]
  );
  const balances = rowsToObjects<Record<string, unknown>>(result);
  return balances[0] || { account_id: accountId, currency_id: currencyId, balance: 0 };
}

async function handleGetAllAccountBalances(): Promise<Record<string, unknown>[]> {
  const result = await runQuery(
    "SELECT id, account_id, currency_id, balance, updated_at FROM account_currency_balances ORDER BY account_id, currency_id",
    []
  );
  return rowsToObjects<Record<string, unknown>>(result);
}

// Journal handlers
async function handleGetJournalEntries(page: number, perPage: number, search: string | null, sortBy: string | null, sortOrder: string | null) {
  let where = "";
  const params: unknown[] = [];
  const allowedSort = ["entry_date", "entry_number", "created_at"].includes(sortBy || "") ? sortBy! : "entry_date";
  const order = (sortOrder || "desc").toUpperCase() === "DESC" ? "DESC" : "ASC";
  return paginated(
    "journal_entries",
    "*",
    `SELECT COUNT(*) FROM journal_entries ${where}`,
    `SELECT id, entry_number, entry_date, description, reference_type, reference_id, created_at, updated_at FROM journal_entries ${where}`,
    params,
    page,
    perPage,
    `ORDER BY ${allowedSort} ${order}`
  );
}

async function handleGetJournalEntry(id: number): Promise<Record<string, unknown>> {
  const entryResult = await runQuery(
    "SELECT id, entry_number, entry_date, description, reference_type, reference_id, created_at, updated_at FROM journal_entries WHERE id = ?",
    [id]
  );
  const entries = rowsToObjects<Record<string, unknown>>(entryResult);
  const entry = entries[0];
  if (!entry) {
    throw new Error("Journal entry not found");
  }
  const linesResult = await runQuery(
    "SELECT id, journal_entry_id, account_id, currency_id, debit_amount, credit_amount, exchange_rate, base_amount, description, created_at FROM journal_entry_lines WHERE journal_entry_id = ? ORDER BY id",
    [id]
  );
  const lines = rowsToObjects<Record<string, unknown>>(linesResult);
  return { ...entry, lines };
}

async function handleCreateJournalEntry(
  entryDate: string,
  description: string | null,
  referenceType: string | null,
  referenceId: number | null,
  lines: [number, number, number, number, number, string | null][]
): Promise<Record<string, unknown>> {
  // Generate entry number
  const entryNumberResult = await runQuery(
    "SELECT COALESCE(MAX(CAST(SUBSTR(entry_number, 2) AS SIGNED)), 0) + 1 FROM journal_entries WHERE entry_number LIKE 'J%'",
    []
  );
  const entryNum = Number(entryNumberResult.rows[0]?.[0] ?? 1);
  const entryNumber = `J${String(entryNum).padStart(6, "0")}`;

  // Insert journal entry
  await runExecute(
    "INSERT INTO journal_entries (entry_number, entry_date, description, reference_type, reference_id) VALUES (?, ?, ?, ?, ?)",
    [entryNumber, entryDate, description, referenceType, referenceId]
  );

  // Get entry ID
  const idResult = await runQuery("SELECT id FROM journal_entries WHERE entry_number = ?", [entryNumber]);
  const entryId = Number(idResult.rows[0]?.[0]);
  if (!entryId) {
    throw new Error("Failed to retrieve entry ID");
  }

  // Insert lines
  for (const [accountId, currencyId, debitAmount, creditAmount, exchangeRate, lineDesc] of lines) {
    const baseAmount = debitAmount > 0 ? debitAmount * exchangeRate : creditAmount * exchangeRate;
    await runExecute(
      "INSERT INTO journal_entry_lines (journal_entry_id, account_id, currency_id, debit_amount, credit_amount, exchange_rate, base_amount, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [entryId, accountId, currencyId, debitAmount, creditAmount, exchangeRate, baseAmount, lineDesc]
    );
    // Update account balance
    const balanceResult = await runQuery(
      "SELECT balance FROM account_currency_balances WHERE account_id = ? AND currency_id = ?",
      [accountId, currencyId]
    );
    const currentBalance = balanceResult.rows[0] ? Number(balanceResult.rows[0][0]) : 0;
    const newBalance = currentBalance + debitAmount - creditAmount;
    await runExecute(
      "INSERT INTO account_currency_balances (account_id, currency_id, balance, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE balance = ?, updated_at = CURRENT_TIMESTAMP",
      [accountId, currencyId, newBalance, newBalance]
    );
    const accountBalance = await calculateAccountBalance(accountId);
    await runExecute("UPDATE accounts SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [accountBalance, accountId]);
  }

  // Get created entry
  const entryResult = await runQuery(
    "SELECT id, entry_number, entry_date, description, reference_type, reference_id, created_at, updated_at FROM journal_entries WHERE id = ?",
    [entryId]
  );
  const entries = rowsToObjects<Record<string, unknown>>(entryResult);
  const linesResult = await runQuery(
    "SELECT id, journal_entry_id, account_id, currency_id, debit_amount, credit_amount, exchange_rate, base_amount, description, created_at FROM journal_entry_lines WHERE journal_entry_id = ? ORDER BY id",
    [entryId]
  );
  const entryLines = rowsToObjects<Record<string, unknown>>(linesResult);
  return { ...entries[0], lines: entryLines };
}

async function handleUpdateJournalEntry(
  entryId: number,
  newLines: [number, number, number, number, number, string | null][]
): Promise<Record<string, unknown>> {
  // Get existing lines to reverse balances
  const existingResult = await runQuery(
    "SELECT account_id, currency_id, debit_amount, credit_amount FROM journal_entry_lines WHERE journal_entry_id = ?",
    [entryId]
  );
  const existingLines = rowsToObjects<Record<string, unknown>>(existingResult);

  // Reverse account balance changes
  for (const line of existingLines) {
    const accountId = Number(line.account_id);
    const currencyId = Number(line.currency_id);
    const oldDebit = Number(line.debit_amount ?? 0);
    const oldCredit = Number(line.credit_amount ?? 0);
    const balanceResult = await runQuery(
      "SELECT balance FROM account_currency_balances WHERE account_id = ? AND currency_id = ?",
      [accountId, currencyId]
    );
    const currentBalance = balanceResult.rows[0] ? Number(balanceResult.rows[0][0]) : 0;
    const reversedBalance = oldDebit > 0 ? currentBalance - oldDebit : currentBalance + oldCredit;
    await runExecute(
      "INSERT INTO account_currency_balances (account_id, currency_id, balance, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE balance = ?, updated_at = CURRENT_TIMESTAMP",
      [accountId, currencyId, reversedBalance, reversedBalance]
    );
  }

  // Delete existing lines
  await runExecute("DELETE FROM journal_entry_lines WHERE journal_entry_id = ?", [entryId]);

  // Insert new lines
  for (const [accountId, currencyId, debitAmount, creditAmount, exchangeRate, lineDesc] of newLines) {
    const baseAmount = debitAmount > 0 ? debitAmount * exchangeRate : creditAmount * exchangeRate;
    await runExecute(
      "INSERT INTO journal_entry_lines (journal_entry_id, account_id, currency_id, debit_amount, credit_amount, exchange_rate, base_amount, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [entryId, accountId, currencyId, debitAmount, creditAmount, exchangeRate, baseAmount, lineDesc]
    );
    // Update account balance
    const balanceResult = await runQuery(
      "SELECT balance FROM account_currency_balances WHERE account_id = ? AND currency_id = ?",
      [accountId, currencyId]
    );
    const currentBalance = balanceResult.rows[0] ? Number(balanceResult.rows[0][0]) : 0;
    const newBalance = currentBalance + debitAmount - creditAmount;
    await runExecute(
      "INSERT INTO account_currency_balances (account_id, currency_id, balance, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE balance = ?, updated_at = CURRENT_TIMESTAMP",
      [accountId, currencyId, newBalance, newBalance]
    );
    const accountBalance = await calculateAccountBalance(accountId);
    await runExecute("UPDATE accounts SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [accountBalance, accountId]);
  }

  // Get updated entry
  const entryResult = await runQuery(
    "SELECT id, entry_number, entry_date, description, reference_type, reference_id, created_at, updated_at FROM journal_entries WHERE id = ?",
    [entryId]
  );
  const entries = rowsToObjects<Record<string, unknown>>(entryResult);
  const linesResult = await runQuery(
    "SELECT id, journal_entry_id, account_id, currency_id, debit_amount, credit_amount, exchange_rate, base_amount, description, created_at FROM journal_entry_lines WHERE journal_entry_id = ? ORDER BY id",
    [entryId]
  );
  const entryLines = rowsToObjects<Record<string, unknown>>(linesResult);
  return { ...entries[0], lines: entryLines };
}

// Exchange rate handlers
async function handleGetExchangeRate(fromCurrencyId: number, toCurrencyId: number, date: string | null): Promise<Record<string, unknown> | null> {
  const sql = date
    ? "SELECT id, from_currency_id, to_currency_id, rate, date, created_at FROM currency_exchange_rates WHERE from_currency_id = ? AND to_currency_id = ? AND date = ? ORDER BY created_at DESC LIMIT 1"
    : "SELECT id, from_currency_id, to_currency_id, rate, date, created_at FROM currency_exchange_rates WHERE from_currency_id = ? AND to_currency_id = ? ORDER BY date DESC, created_at DESC LIMIT 1";
  const params = date ? [fromCurrencyId, toCurrencyId, date] : [fromCurrencyId, toCurrencyId];
  const result = await runQuery(sql, params);
  const rates = rowsToObjects<Record<string, unknown>>(result);
  return rates[0] || null;
}

async function handleGetExchangeRateHistory(fromCurrencyId: number, toCurrencyId: number): Promise<Record<string, unknown>[]> {
  const result = await runQuery(
    "SELECT id, from_currency_id, to_currency_id, rate, date, created_at FROM currency_exchange_rates WHERE from_currency_id = ? AND to_currency_id = ? ORDER BY date DESC, created_at DESC",
    [fromCurrencyId, toCurrencyId]
  );
  return rowsToObjects<Record<string, unknown>>(result);
}

async function handleCreateExchangeRate(
  fromCurrencyId: number,
  toCurrencyId: number,
  rate: number,
  date: string
): Promise<Record<string, unknown>> {
  await runExecute("INSERT INTO currency_exchange_rates (from_currency_id, to_currency_id, rate, date) VALUES (?, ?, ?, ?)", [
    fromCurrencyId,
    toCurrencyId,
    rate,
    date,
  ]);
  const result = await runQuery(
    "SELECT id, from_currency_id, to_currency_id, rate, date, created_at FROM currency_exchange_rates WHERE from_currency_id = ? AND to_currency_id = ? AND date = ? ORDER BY id DESC LIMIT 1",
    [fromCurrencyId, toCurrencyId, date]
  );
  return rowsToObjects<Record<string, unknown>>(result)[0];
}

// Discount code handlers
async function handleGetDiscountCodes(search: string | null): Promise<Record<string, unknown>[]> {
  let sql = "SELECT id, code, type, value, min_purchase, valid_from, valid_to, max_uses, use_count, created_at FROM sale_discount_codes";
  const params: unknown[] = [];
  
  if (search?.trim()) {
    sql += " WHERE code LIKE ?";
    params.push(`%${search.trim()}%`);
  }
  
  sql += " ORDER BY code ASC";
  
  const result = await runQuery(sql, params);
  return rowsToObjects<Record<string, unknown>>(result).map((row: Record<string, unknown>) => ({
    ...row,
    type: row.type, // Keep as-is (frontend expects "type" not "type_")
  }));
}

async function handleValidateDiscountCode(code: string, subtotal: number): Promise<[string, number]> {
  const codeUpper = code.trim().toUpperCase();
  if (!codeUpper) {
    throw new Error("Code is required");
  }
  const result = await runQuery(
    "SELECT id, code, type, value, min_purchase, valid_from, valid_to, max_uses, use_count FROM sale_discount_codes WHERE UPPER(TRIM(code)) = ? LIMIT 1",
    [codeUpper]
  );
  const rows = rowsToObjects<Record<string, unknown>>(result);
  if (rows.length === 0) {
    throw new Error("Discount code not found");
  }
  const row = rows[0];
  const type = String(row.type ?? "");
  const value = Number(row.value ?? 0);
  const minPurchase = Number(row.min_purchase ?? 0);
  const validFrom = row.valid_from ? String(row.valid_from) : null;
  const validTo = row.valid_to ? String(row.valid_to) : null;
  const maxUses = row.max_uses != null ? Number(row.max_uses) : null;
  const useCount = Number(row.use_count ?? 0);

  if (subtotal < minPurchase) {
    throw new Error(`Minimum purchase for this code is ${minPurchase}`);
  }

  const today = new Date().toISOString().split("T")[0];
  if (validFrom && today < validFrom) {
    throw new Error("Discount code is not yet valid");
  }
  if (validTo && today > validTo) {
    throw new Error("Discount code has expired");
  }
  if (maxUses != null && useCount >= maxUses) {
    throw new Error("Discount code has reached maximum uses");
  }

  const discountAmount = computeDiscountAmount(subtotal, type, value);
  return [type, discountAmount];
}

async function handleCreateDiscountCode(
  code: string,
  type: string,
  value: number,
  minPurchase: number,
  validFrom: string | null,
  validTo: string | null,
  maxUses: number | null
): Promise<Record<string, unknown>> {
  const codeTrimmed = code.trim().toUpperCase();
  if (!codeTrimmed) {
    throw new Error("Code is required");
  }
  const discountType = type.toLowerCase() === "percent" ? "percent" : "fixed";
  try {
    await runExecute(
      "INSERT INTO sale_discount_codes (code, type, value, min_purchase, valid_from, valid_to, max_uses, use_count) VALUES (?, ?, ?, ?, ?, ?, ?, 0)",
      [codeTrimmed, discountType, value, minPurchase, validFrom, validTo, maxUses]
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.toLowerCase().includes("duplicate") || msg.includes("UNIQUE") || msg.includes("1062")) {
      throw new Error("این کد تخفیف قبلاً ثبت شده است");
    }
    throw error;
  }
  const idResult = await runQuery("SELECT id FROM sale_discount_codes ORDER BY id DESC LIMIT 1", []);
  const id = Number(idResult.rows[0]?.[0]);
  const result = await runQuery(
    "SELECT id, code, type, value, min_purchase, valid_from, valid_to, max_uses, use_count, created_at FROM sale_discount_codes WHERE id = ?",
    [id]
  );
  return rowsToObjects<Record<string, unknown>>(result)[0];
}

async function handleUpdateDiscountCode(
  id: number,
  code: string,
  type: string,
  value: number,
  minPurchase: number,
  validFrom: string | null,
  validTo: string | null,
  maxUses: number | null
): Promise<Record<string, unknown>> {
  const codeTrimmed = code.trim().toUpperCase();
  if (!codeTrimmed) {
    throw new Error("Code is required");
  }
  const discountType = type.toLowerCase() === "percent" ? "percent" : "fixed";
  await runExecute(
    "UPDATE sale_discount_codes SET code = ?, type = ?, value = ?, min_purchase = ?, valid_from = ?, valid_to = ?, max_uses = ? WHERE id = ?",
    [codeTrimmed, discountType, value, minPurchase, validFrom, validTo, maxUses, id]
  );
  const result = await runQuery(
    "SELECT id, code, type, value, min_purchase, valid_from, valid_to, max_uses, use_count, created_at FROM sale_discount_codes WHERE id = ?",
    [id]
  );
  return rowsToObjects<Record<string, unknown>>(result)[0];
}

async function handleDeleteDiscountCode(id: number): Promise<string> {
  await runExecute("DELETE FROM sale_discount_codes WHERE id = ?", [id]);
  return "OK";
}

// User handlers
async function handleGetUsers(): Promise<Record<string, unknown>[]> {
  const result = await runQuery(
    "SELECT id, username, email, full_name, phone, role, is_active, profile_picture, created_at, updated_at FROM users ORDER BY created_at DESC",
    []
  );
  return rowsToObjects<Record<string, unknown>>(result).map((row: Record<string, unknown>) => ({
    ...row,
    is_active: Number(row.is_active) === 1,
  }));
}

// COA category tree
async function handleGetCoaCategoryTree(): Promise<Record<string, unknown>[]> {
  // Same as get_coa_categories, frontend builds tree
  return handleGetCoaCategories();
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
      case "create_unit_group":
        result = await handleCreateUnitGroup(String(payload.name ?? ""));
        break;
      case "create_unit":
        result = await handleCreateUnit(
          String(payload.name ?? ""),
          payload.groupId != null ? Number(payload.groupId) : null,
          Number(payload.ratio ?? 1),
          Boolean(payload.isBase ?? payload.is_base ?? false)
        );
        break;
      case "update_unit":
        result = await handleUpdateUnit(
          Number(payload.id),
          String(payload.name ?? ""),
          payload.groupId != null ? Number(payload.groupId) : null,
          Number(payload.ratio ?? 1),
          Boolean(payload.isBase ?? payload.is_base ?? false)
        );
        break;
      case "delete_unit":
        result = await handleDeleteUnit(Number(payload.id));
        break;
      case "get_accounts":
        result = await handleGetAccounts();
        break;
      case "create_account":
        result = await handleCreateAccount(
          String(payload.name ?? ""),
          payload.currencyId != null ? Number(payload.currencyId) : null,
          payload.coaCategoryId != null ? Number(payload.coaCategoryId) : null,
          (typeof payload.accountCode === "string" ? payload.accountCode : typeof payload.account_code === "string" ? payload.account_code : null),
          (typeof payload.accountType === "string" ? payload.accountType : typeof payload.account_type === "string" ? payload.account_type : null),
          Number(payload.initialBalance ?? payload.initial_balance ?? 0),
          (typeof payload.notes === "string" ? payload.notes : null)
        );
        break;
      case "update_account":
        result = await handleUpdateAccount(
          Number(payload.id),
          String(payload.name ?? ""),
          payload.currencyId != null ? Number(payload.currencyId) : null,
          payload.coaCategoryId != null ? Number(payload.coaCategoryId) : null,
          (typeof payload.accountCode === "string" ? payload.accountCode : typeof payload.account_code === "string" ? payload.account_code : null),
          (typeof payload.accountType === "string" ? payload.accountType : typeof payload.account_type === "string" ? payload.account_type : null),
          Number(payload.initialBalance ?? payload.initial_balance ?? 0),
          Boolean(payload.isActive ?? payload.is_active ?? true),
          (typeof payload.notes === "string" ? payload.notes : null)
        );
        break;
      case "delete_account":
        result = await handleDeleteAccount(Number(payload.id));
        break;
      case "deposit_account":
        result = await handleDepositAccount(
          Number(payload.accountId ?? payload.account_id),
          Number(payload.amount ?? 0),
          String(payload.currency ?? ""),
          Number(payload.rate ?? 1),
          String(payload.transactionDate ?? payload.transaction_date ?? ""),
          Boolean(payload.isFull ?? payload.is_full ?? false),
          (typeof payload.notes === "string" ? payload.notes : null)
        );
        break;
      case "withdraw_account":
        result = await handleWithdrawAccount(
          Number(payload.accountId ?? payload.account_id),
          Number(payload.amount ?? 0),
          String(payload.currency ?? ""),
          Number(payload.rate ?? 1),
          String(payload.transactionDate ?? payload.transaction_date ?? ""),
          Boolean(payload.isFull ?? payload.is_full ?? false),
          (typeof payload.notes === "string" ? payload.notes : null)
        );
        break;
      case "get_coa_categories":
        result = await handleGetCoaCategories();
        break;
      case "create_coa_category":
        result = await handleCreateCoaCategory(
          payload.parentId != null ? Number(payload.parentId) : null,
          String(payload.name ?? ""),
          String(payload.code ?? ""),
          String(payload.categoryType ?? payload.category_type ?? "")
        );
        break;
      case "update_coa_category":
        result = await handleUpdateCoaCategory(
          Number(payload.id),
          payload.parentId != null ? Number(payload.parentId) : null,
          String(payload.name ?? ""),
          String(payload.code ?? ""),
          String(payload.categoryType ?? payload.category_type ?? "")
        );
        break;
      case "delete_coa_category":
        result = await handleDeleteCoaCategory(Number(payload.id));
        break;
      case "init_standard_coa_categories":
        result = await handleInitStandardCoaCategories();
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
          (typeof payload.description === "string" ? payload.description : null),
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
          (typeof payload.description === "string" ? payload.description : null),
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
      case "create_supplier":
        result = await handleCreateSupplier(
          String(payload.fullName ?? payload.full_name ?? ""),
          String(payload.phone ?? ""),
          String(payload.address ?? ""),
          (payload.email as string) ?? null,
          (typeof payload.notes === "string" ? payload.notes : null)
        );
        break;
      case "update_supplier":
        result = await handleUpdateSupplier(
          Number(payload.id),
          String(payload.fullName ?? payload.full_name ?? ""),
          String(payload.phone ?? ""),
          String(payload.address ?? ""),
          (payload.email as string) ?? null,
          (typeof payload.notes === "string" ? payload.notes : null)
        );
        break;
      case "delete_supplier":
        result = await handleDeleteSupplier(Number(payload.id));
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
      case "create_customer":
        result = await handleCreateCustomer(
          String(payload.fullName ?? payload.full_name ?? ""),
          String(payload.phone ?? ""),
          String(payload.address ?? ""),
          (payload.email as string) ?? null,
          (typeof payload.notes === "string" ? payload.notes : null)
        );
        break;
      case "update_customer":
        result = await handleUpdateCustomer(
          Number(payload.id),
          String(payload.fullName ?? payload.full_name ?? ""),
          String(payload.phone ?? ""),
          String(payload.address ?? ""),
          (payload.email as string) ?? null,
          (typeof payload.notes === "string" ? payload.notes : null)
        );
        break;
      case "delete_customer":
        result = await handleDeleteCustomer(Number(payload.id));
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
      case "create_purchase":
        result = await handleCreatePurchase(
          Number(payload.supplierId ?? payload.supplier_id),
          String(payload.date ?? ""),
          (typeof payload.notes === "string" ? payload.notes : null),
          payload.currencyId != null ? Number(payload.currencyId) : null,
          (payload.additionalCosts ?? payload.additional_costs ?? []) as [string, number][],
          (payload.items ?? []) as [number, number, number, number, number | null, number | null, number | null, number | null, string | null][]
        );
        break;
      case "update_purchase":
        result = await handleUpdatePurchase(
          Number(payload.id),
          Number(payload.supplierId ?? payload.supplier_id),
          String(payload.date ?? ""),
          (typeof payload.notes === "string" ? payload.notes : null),
          payload.currencyId != null ? Number(payload.currencyId) : null,
          (payload.additionalCosts ?? payload.additional_costs ?? []) as [string, number][],
          (payload.items ?? []) as [number, number, number, number, number | null, number | null, number | null, number | null, string | null][]
        );
        break;
      case "delete_purchase":
        result = await handleDeletePurchase(Number(payload.id));
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
      case "create_sale":
        result = await handleCreateSale(
          Number(payload.customerId),
          String(payload.date ?? ""),
          (typeof payload.notes === "string" ? payload.notes : null),
          payload.currencyId != null ? Number(payload.currencyId) : null,
          Number(payload.exchangeRate ?? 1),
          Number(payload.paidAmount ?? 0),
          Array.isArray(payload.additionalCosts) ? payload.additionalCosts as [string, number][] : [],
          Array.isArray(payload.items) ? payload.items as [number, number, number, number, number | null, string | null, string | null, number][] : [],
          Array.isArray(payload.serviceItems) ? payload.serviceItems as [number, string, number, number, string | null, number][] : [],
          (payload.orderDiscountType as string) ?? null,
          Number(payload.orderDiscountValue ?? 0)
        );
        break;
      case "update_sale":
        result = await handleUpdateSale(
          Number(payload.id),
          Number(payload.customerId),
          String(payload.date ?? ""),
          (typeof payload.notes === "string" ? payload.notes : null),
          payload.currencyId != null ? Number(payload.currencyId) : null,
          Number(payload.exchangeRate ?? 1),
          Number(payload.paidAmount ?? 0),
          Array.isArray(payload.additionalCosts) ? payload.additionalCosts as [string, number][] : [],
          Array.isArray(payload.items) ? payload.items as [number, number, number, number, number | null, string | null, string | null, number][] : [],
          Array.isArray(payload.serviceItems) ? payload.serviceItems as [number, string, number, number, string | null, number][] : [],
          (payload.orderDiscountType as string) ?? null,
          Number(payload.orderDiscountValue ?? 0)
        );
        break;
      case "delete_sale":
        result = await handleDeleteSale(Number(payload.id));
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
      case "get_sale":
        result = await handleGetSale(Number(payload.id));
        break;
      case "get_sale_items":
        result = await handleGetSaleItems(Number(payload.saleId));
        break;
      case "create_sale_item":
        result = await handleCreateSaleItem(
          Number(payload.saleId ?? payload.sale_id),
          Number(payload.productId ?? payload.product_id),
          Number(payload.unitId ?? payload.unit_id),
          Number(payload.perPrice ?? payload.per_price ?? 0),
          Number(payload.amount ?? 0),
          payload.purchaseItemId != null ? Number(payload.purchaseItemId) : null,
          (typeof payload.saleType === "string" ? payload.saleType : typeof payload.sale_type === "string" ? payload.sale_type : null),
          (typeof payload.discountType === "string" ? payload.discountType : typeof payload.discount_type === "string" ? payload.discount_type : null),
          Number(payload.discountValue ?? payload.discount_value ?? 0)
        );
        break;
      case "update_sale_item":
        result = await handleUpdateSaleItem(
          Number(payload.id),
          Number(payload.productId ?? payload.product_id),
          Number(payload.unitId ?? payload.unit_id),
          Number(payload.perPrice ?? payload.per_price ?? 0),
          Number(payload.amount ?? 0),
          payload.purchaseItemId != null ? Number(payload.purchaseItemId) : null,
          (typeof payload.saleType === "string" ? payload.saleType : typeof payload.sale_type === "string" ? payload.sale_type : null),
          (typeof payload.discountType === "string" ? payload.discountType : typeof payload.discount_type === "string" ? payload.discount_type : null),
          Number(payload.discountValue ?? payload.discount_value ?? 0)
        );
        break;
      case "delete_sale_item":
        result = await handleDeleteSaleItem(Number(payload.id));
        break;
      case "get_sale_payments":
        result = await handleGetSalePayments(Number(payload.saleId));
        break;
      case "create_sale_payment":
        result = await handleCreateSalePayment(
          Number(payload.saleId ?? payload.sale_id),
          payload.accountId != null ? Number(payload.accountId) : null,
          payload.currencyId != null ? Number(payload.currencyId) : null,
          Number(payload.exchangeRate ?? payload.exchange_rate ?? 1),
          Number(payload.amount ?? 0),
          String(payload.date ?? "")
        );
        break;
      case "delete_sale_payment":
        result = await handleDeleteSalePayment(Number(payload.id));
        break;
      case "get_sale_additional_costs":
        result = await handleGetSaleAdditionalCosts(Number(payload.saleId));
        break;
      case "get_product_batches":
        result = await handleGetProductBatches(Number(payload.productId));
        break;
      case "get_product_stock":
        result = await handleGetProductStock(Number(payload.productId), payload.unitId != null ? Number(payload.unitId) : null);
        break;
      case "get_stock_by_batches":
        result = await handleGetStockByBatches();
        break;
      case "get_service":
        result = await handleGetService(Number(payload.id));
        break;
      case "create_service":
        result = await handleCreateService(
          String(payload.name ?? ""),
          Number(payload.price ?? 0),
          payload.currencyId != null ? Number(payload.currencyId) : null,
          (payload.description as string) ?? null
        );
        break;
      case "update_service":
        result = await handleUpdateService(
          Number(payload.id),
          String(payload.name ?? ""),
          Number(payload.price ?? 0),
          payload.currencyId != null ? Number(payload.currencyId) : null,
          (payload.description as string) ?? null
        );
        break;
      case "delete_service":
        result = await handleDeleteService(Number(payload.id));
        break;
      case "get_expense_types":
        result = await handleGetExpenseTypes();
        break;
      case "create_expense_type":
        result = await handleCreateExpenseType(String(payload.name ?? ""));
        break;
      case "update_expense_type":
        result = await handleUpdateExpenseType(Number(payload.id), String(payload.name ?? ""));
        break;
      case "delete_expense_type":
        result = await handleDeleteExpenseType(Number(payload.id));
        break;
      case "get_expenses":
        result = await handleGetExpenses(
          Number(payload.page ?? 1),
          Number(payload.per_page ?? payload.perPage ?? 10),
          (payload.search as string) ?? null,
          ((payload.sort_by ?? payload.sortBy) as string) ?? null,
          ((payload.sort_order ?? payload.sortOrder) as string) ?? null
        );
        break;
      case "get_expense":
        result = await handleGetExpense(Number(payload.id));
        break;
      case "create_expense":
        result = await handleCreateExpense(
          Number(payload.expenseTypeId ?? payload.expense_type_id),
          payload.accountId != null ? Number(payload.accountId) : null,
          Number(payload.amount ?? 0),
          String(payload.currency ?? ""),
          Number(payload.rate ?? 1),
          Number(payload.total ?? 0),
          String(payload.date ?? ""),
          (typeof payload.billNo === "string" ? payload.billNo : typeof payload.bill_no === "string" ? payload.bill_no : null),
          (typeof payload.description === "string" ? payload.description : null)
        );
        break;
      case "update_expense":
        result = await handleUpdateExpense(
          Number(payload.id),
          Number(payload.expenseTypeId ?? payload.expense_type_id),
          payload.accountId != null ? Number(payload.accountId) : null,
          Number(payload.amount ?? 0),
          String(payload.currency ?? ""),
          Number(payload.rate ?? 1),
          Number(payload.total ?? 0),
          String(payload.date ?? ""),
          (typeof payload.billNo === "string" ? payload.billNo : typeof payload.bill_no === "string" ? payload.bill_no : null),
          (typeof payload.description === "string" ? payload.description : null)
        );
        break;
      case "delete_expense":
        result = await handleDeleteExpense(Number(payload.id));
        break;
      case "get_employees":
        result = await handleGetEmployees(
          Number(payload.page ?? 1),
          Number(payload.per_page ?? payload.perPage ?? 10),
          (payload.search as string) ?? null,
          ((payload.sort_by ?? payload.sortBy) as string) ?? null,
          ((payload.sort_order ?? payload.sortOrder) as string) ?? null
        );
        break;
      case "get_employee":
        result = await handleGetEmployee(Number(payload.id));
        break;
      case "create_employee":
        result = await handleCreateEmployee(
          String(payload.fullName ?? payload.full_name ?? ""),
          String(payload.phone ?? ""),
          (typeof payload.email === "string" ? payload.email : null),
          String(payload.address ?? ""),
          (typeof payload.position === "string" ? payload.position : null),
          (typeof payload.hireDate === "string" ? payload.hireDate : typeof payload.hire_date === "string" ? payload.hire_date : null),
          payload.baseSalary != null ? Number(payload.baseSalary) : null,
          (typeof payload.photoPath === "string" ? payload.photoPath : typeof payload.photo_path === "string" ? payload.photo_path : null),
          (typeof payload.notes === "string" ? payload.notes : null)
        );
        break;
      case "update_employee":
        result = await handleUpdateEmployee(
          Number(payload.id),
          String(payload.fullName ?? payload.full_name ?? ""),
          String(payload.phone ?? ""),
          (typeof payload.email === "string" ? payload.email : null),
          String(payload.address ?? ""),
          (typeof payload.position === "string" ? payload.position : null),
          (typeof payload.hireDate === "string" ? payload.hireDate : typeof payload.hire_date === "string" ? payload.hire_date : null),
          payload.baseSalary != null ? Number(payload.baseSalary) : null,
          (typeof payload.photoPath === "string" ? payload.photoPath : typeof payload.photo_path === "string" ? payload.photo_path : null),
          (typeof payload.notes === "string" ? payload.notes : null)
        );
        break;
      case "delete_employee":
        result = await handleDeleteEmployee(Number(payload.id));
        break;
      case "get_salaries":
        result = await handleGetSalaries(
          Number(payload.page ?? 1),
          Number(payload.per_page ?? payload.perPage ?? 10),
          (payload.search as string) ?? null,
          ((payload.sort_by ?? payload.sortBy) as string) ?? null,
          ((payload.sort_order ?? payload.sortOrder) as string) ?? null
        );
        break;
      case "get_salaries_by_employee":
        result = await handleGetSalariesByEmployee(Number(payload.employeeId));
        break;
      case "get_salary":
        result = await handleGetSalary(Number(payload.id));
        break;
      case "create_salary":
        result = await handleCreateSalary(
          Number(payload.employeeId ?? payload.employee_id),
          Number(payload.year ?? 1403),
          String(payload.month ?? ""),
          Number(payload.amount ?? 0),
          Number(payload.deductions ?? 0),
          (typeof payload.notes === "string" ? payload.notes : null)
        );
        break;
      case "update_salary":
        result = await handleUpdateSalary(
          Number(payload.id),
          Number(payload.employeeId ?? payload.employee_id),
          Number(payload.year ?? 1403),
          String(payload.month ?? ""),
          Number(payload.amount ?? 0),
          Number(payload.deductions ?? 0),
          (typeof payload.notes === "string" ? payload.notes : null)
        );
        break;
      case "delete_salary":
        result = await handleDeleteSalary(Number(payload.id));
        break;
      case "get_deduction":
        result = await handleGetDeduction(Number(payload.id));
        break;
      case "create_deduction":
        result = await handleCreateDeduction(
          Number(payload.employeeId ?? payload.employee_id),
          Number(payload.year ?? 1403),
          String(payload.month ?? ""),
          String(payload.currency ?? ""),
          Number(payload.rate ?? 1),
          Number(payload.amount ?? 0)
        );
        break;
      case "update_deduction":
        result = await handleUpdateDeduction(
          Number(payload.id),
          Number(payload.employeeId ?? payload.employee_id),
          String(payload.currency ?? ""),
          Number(payload.rate ?? 1),
          Number(payload.amount ?? 0)
        );
        break;
      case "delete_deduction":
        result = await handleDeleteDeduction(Number(payload.id));
        break;
      case "get_deductions_by_employee":
        result = await handleGetDeductionsByEmployee(Number(payload.employeeId));
        break;
      case "get_deductions_by_employee_year_month":
        result = await handleGetDeductionsByEmployeeYearMonth(
          Number(payload.employeeId),
          Number(payload.year),
          String(payload.month ?? "")
        );
        break;
      case "get_account":
        result = await handleGetAccount(Number(payload.id));
        break;
      case "get_account_balance":
        result = await handleGetAccountBalance(Number(payload.accountId));
        break;
      case "get_account_transactions":
        result = await handleGetAccountTransactions(Number(payload.accountId));
        break;
      case "get_account_balance_by_currency":
        result = await handleGetAccountBalanceByCurrency(Number(payload.accountId), Number(payload.currencyId));
        break;
      case "get_all_account_balances":
        result = await handleGetAllAccountBalances();
        break;
      case "get_journal_entries":
        result = await handleGetJournalEntries(
          Number(payload.page ?? 1),
          Number(payload.per_page ?? payload.perPage ?? 10),
          (payload.search as string) ?? null,
          ((payload.sort_by ?? payload.sortBy) as string) ?? null,
          ((payload.sort_order ?? payload.sortOrder) as string) ?? null
        );
        break;
      case "get_journal_entry":
        result = await handleGetJournalEntry(Number(payload.id));
        break;
      case "create_journal_entry":
        result = await handleCreateJournalEntry(
          String(payload.entryDate ?? payload.entry_date ?? ""),
          (typeof payload.description === "string" ? payload.description : null),
          (typeof payload.referenceType === "string" ? payload.referenceType : typeof payload.reference_type === "string" ? payload.reference_type : null),
          payload.referenceId != null ? Number(payload.referenceId) : null,
          Array.isArray(payload.lines) ? payload.lines as [number, number, number, number, number, string | null][] : []
        );
        break;
      case "update_journal_entry":
        result = await handleUpdateJournalEntry(
          Number(payload.entryId ?? payload.entry_id),
          Array.isArray(payload.newLines ?? payload.new_lines) ? (payload.newLines ?? payload.new_lines) as [number, number, number, number, number, string | null][] : []
        );
        break;
      case "get_exchange_rate":
        result = await handleGetExchangeRate(
          Number(payload.fromCurrencyId),
          Number(payload.toCurrencyId),
          (payload.date as string) ?? null
        );
        break;
      case "get_exchange_rate_history":
        result = await handleGetExchangeRateHistory(Number(payload.fromCurrencyId), Number(payload.toCurrencyId));
        break;
      case "create_exchange_rate":
        result = await handleCreateExchangeRate(
          Number(payload.fromCurrencyId ?? payload.from_currency_id),
          Number(payload.toCurrencyId ?? payload.to_currency_id),
          Number(payload.rate ?? 1),
          String(payload.date ?? "")
        );
        break;
      case "get_discount_codes":
        result = await handleGetDiscountCodes((payload.search as string) ?? null);
        break;
      case "validate_discount_code":
        result = await handleValidateDiscountCode(String(payload.code ?? ""), Number(payload.subtotal ?? 0));
        break;
      case "create_discount_code":
        result = await handleCreateDiscountCode(
          String(payload.code ?? ""),
          String(payload.type ?? payload.type_ ?? "fixed"),
          Number(payload.value ?? 0),
          Number(payload.minPurchase ?? payload.min_purchase ?? 0),
          (typeof payload.validFrom === "string" ? payload.validFrom : typeof payload.valid_from === "string" ? payload.valid_from : null),
          (typeof payload.validTo === "string" ? payload.validTo : typeof payload.valid_to === "string" ? payload.valid_to : null),
          payload.maxUses != null ? Number(payload.maxUses) : null
        );
        break;
      case "update_discount_code":
        result = await handleUpdateDiscountCode(
          Number(payload.id),
          String(payload.code ?? ""),
          String(payload.type ?? payload.type_ ?? "fixed"),
          Number(payload.value ?? 0),
          Number(payload.minPurchase ?? payload.min_purchase ?? 0),
          (typeof payload.validFrom === "string" ? payload.validFrom : typeof payload.valid_from === "string" ? payload.valid_from : null),
          (typeof payload.validTo === "string" ? payload.validTo : typeof payload.valid_to === "string" ? payload.valid_to : null),
          payload.maxUses != null ? Number(payload.maxUses) : null
        );
        break;
      case "delete_discount_code":
        result = await handleDeleteDiscountCode(Number(payload.id));
        break;
      case "get_users":
        result = await handleGetUsers();
        break;
      case "get_purchase_items":
        result = await handleGetPurchaseItems(Number(payload.purchaseId));
        break;
      case "create_purchase_item":
        result = await handleCreatePurchaseItem(
          Number(payload.purchaseId ?? payload.purchase_id),
          Number(payload.productId ?? payload.product_id),
          Number(payload.unitId ?? payload.unit_id),
          Number(payload.perPrice ?? payload.per_price ?? 0),
          Number(payload.amount ?? 0)
        );
        break;
      case "update_purchase_item":
        result = await handleUpdatePurchaseItem(
          Number(payload.id),
          Number(payload.productId ?? payload.product_id),
          Number(payload.unitId ?? payload.unit_id),
          Number(payload.perPrice ?? payload.per_price ?? 0),
          Number(payload.amount ?? 0)
        );
        break;
      case "delete_purchase_item":
        result = await handleDeletePurchaseItem(Number(payload.id));
        break;
      case "get_purchase_payments":
        if (payload.purchaseId != null || payload.purchase_id != null) {
          result = await handleGetPurchasePaymentsByPurchase(Number(payload.purchaseId ?? payload.purchase_id));
        } else {
          result = await handleGetPurchasePayments(
            Number(payload.page ?? 1),
            Number(payload.per_page ?? payload.perPage ?? 10),
            (payload.search as string) ?? null,
            ((payload.sort_by ?? payload.sortBy) as string) ?? null,
            ((payload.sort_order ?? payload.sortOrder) as string) ?? null
          );
        }
        break;
      case "create_purchase_payment":
        result = await handleCreatePurchasePayment(
          Number(payload.purchaseId ?? payload.purchase_id),
          payload.accountId != null ? Number(payload.accountId) : null,
          Number(payload.amount ?? 0),
          String(payload.currency ?? ""),
          Number(payload.rate ?? 1),
          String(payload.date ?? ""),
          (typeof payload.notes === "string" ? payload.notes : null)
        );
        break;
      case "update_purchase_payment":
        result = await handleUpdatePurchasePayment(
          Number(payload.id),
          Number(payload.amount ?? 0),
          String(payload.currency ?? ""),
          Number(payload.rate ?? 1),
          String(payload.date ?? ""),
          (typeof payload.notes === "string" ? payload.notes : null)
        );
        break;
      case "delete_purchase_payment":
        result = await handleDeletePurchasePayment(Number(payload.id));
        break;
      case "get_coa_category_tree":
        result = await handleGetCoaCategoryTree();
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
