import mysql from "mysql2/promise";
import path from "path";
import fs from "fs";

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
}

export interface ExecuteResult {
  rows_affected: number;
}

let pool: mysql.Pool | null = null;

function getConfig() {
  return {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: parseInt(process.env.MYSQL_PORT || "3306", 10),
    user: process.env.MYSQL_USER || "",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "shafaf",
  };
}

export function getPool(): mysql.Pool {
  if (!pool) {
    const config = getConfig();
    pool = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return pool;
}

export function isPoolOpen(): boolean {
  return pool != null;
}

/** Convert JS value to MySQL placeholder-safe value */
function toMysqlParam(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" || typeof v === "boolean" || typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "toISOString" in v && typeof (v as Date).toISOString === "function") return (v as Date).toISOString();
  return String(v);
}

export async function runQuery(sql: string, params: unknown[] = []): Promise<QueryResult> {
  const p = getPool();
  const safeParams = params.map(toMysqlParam);
  const [rows, fields] = await p.execute<mysql.RowDataPacket[]>(sql, safeParams);
  const columns = Array.isArray(fields) ? (fields as mysql.FieldPacket[]).map((f) => f.name) : [];
  const rowArrays = Array.isArray(rows)
    ? (rows as mysql.RowDataPacket[]).map((r) => columns.map((c) => (r as Record<string, unknown>)[c] ?? null))
    : [];
  return { columns, rows: rowArrays };
}

/** Convert QueryResult to array of objects */
export function rowsToObjects<T = Record<string, unknown>>(result: QueryResult): T[] {
  return result.rows.map((row) => {
    const obj: Record<string, unknown> = {};
    result.columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj as T;
  });
}

export async function runExecute(sql: string, params: unknown[] = []): Promise<ExecuteResult> {
  const p = getPool();
  const safeParams = params.map(toMysqlParam);
  const [result] = await p.execute(sql, safeParams);
  const rr = result as mysql.ResultSetHeader;
  return { rows_affected: rr.affectedRows ?? 0 };
}

/** Run full schema from db/db.sql */
export async function runSchema(): Promise<void> {
  const p = getPool();
  const schemaPath = path.join(process.cwd(), "db", "db.sql");
  const sql = fs.readFileSync(schemaPath, "utf-8");
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));
  for (const stmt of statements) {
    try {
      await p.execute(stmt);
    } catch (e) {
      if (String(e).includes("Duplicate column") || String(e).includes("already exists")) continue;
      throw e;
    }
  }
}

/** Create database if not exists, then run schema */
export async function createDatabaseAndSchema(dbName: string): Promise<string> {
  const config = getConfig();
  const createPool = mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    waitForConnections: true,
    connectionLimit: 2,
  });
  await createPool.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName.replace(/`/g, "")}\``);
  await createPool.end();
  process.env.MYSQL_DATABASE = dbName;
  if (pool) {
    await pool.end();
    pool = null;
  }
  getPool();
  await runSchema();
  return `Database ${dbName} created and schema applied`;
}

/** Ensure connection works and schema exists */
export async function openDatabase(_dbName?: string): Promise<string> {
  const config = getConfig();
  if (!config.database) return Promise.reject(new Error("MYSQL_DATABASE is not set"));
  getPool();
  await runQuery("SELECT 1");
  await runSchema();
  return `Database opened: ${config.host}/${config.database}`;
}
