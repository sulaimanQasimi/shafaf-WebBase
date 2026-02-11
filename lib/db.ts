import { invoke } from "@/lib/api";

export interface EnvConfig {
  has_env_file: boolean;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

/**
 * Get current database env configuration (for setup/configuration page).
 * Values are read from the backend .env / environment.
 */
export async function getEnvConfig(): Promise<EnvConfig> {
  return await invoke<EnvConfig>("get_env_config");
}

/**
 * Save database configuration to .env and reload in the app.
 * After calling this, retry opening the database (e.g. ensureDatabase).
 */
export async function saveEnvConfig(config: {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}): Promise<void> {
  await invoke("save_env_config", {
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
  });
}

export interface QueryResult {
  columns: string[];
  rows: Array<Array<any>>;
}

export interface ExecuteResult {
  rows_affected: number;
}

/**
 * Create a new MySQL database (if it doesn't exist) and connect
 * Connection uses MYSQL_* environment variables
 * @param dbName Name of the database (optional; uses MYSQL_DATABASE if empty)
 * @returns Promise with the connection/status message
 */
export async function createDatabase(dbName: string): Promise<string> {
  return await invoke<string>("db_create", { dbName });
}

/**
 * Open database (connect to MySQL)
 * Connection parameters are read from environment: MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE
 * @param dbName Name of the database (optional; uses MYSQL_DATABASE if empty)
 * @returns Promise with the connection/status message
 */
export async function openDatabase(dbName: string): Promise<string> {
  return await invoke<string>("db_open", { dbName });
}

/**
 * Get the current database path
 * @returns Promise with the database path string
 */
export async function getDatabasePath(): Promise<string> {
  return await invoke<string>("get_database_path");
}

/**
 * Close the current database connection
 * @returns Promise with success message
 */
export async function closeDatabase(): Promise<string> {
  return await invoke<string>("db_close");
}

/**
 * Check if a database is currently open
 * @returns Promise with boolean indicating if database is open
 */
export async function isDatabaseOpen(): Promise<boolean> {
  return await invoke<boolean>("db_is_open");
}

/**
 * Execute a SQL query (INSERT, UPDATE, DELETE, CREATE TABLE, etc.)
 * @param sql SQL query string
 * @param params Optional array of parameters for prepared statements
 * @returns Promise with ExecuteResult containing rows_affected
 */
export async function executeQuery(
  sql: string,
  params: any[] = []
): Promise<ExecuteResult> {
  return await invoke<ExecuteResult>("db_execute", { sql, params });
}

/**
 * Execute a SELECT query and return results
 * @param sql SQL SELECT query string
 * @param params Optional array of parameters for prepared statements
 * @returns Promise with QueryResult containing columns and rows
 */
export async function queryDatabase(
  sql: string,
  params: any[] = []
): Promise<QueryResult> {
  return await invoke<QueryResult>("db_query", { sql, params });
}

/**
 * Helper function to convert query results to objects
 * @param result QueryResult from queryDatabase
 * @returns Array of objects with column names as keys
 */
export function resultToObjects(result: QueryResult): Record<string, any>[] {
  return result.rows.map((row) => {
    const obj: Record<string, any> = {};
    result.columns.forEach((col, index) => {
      obj[col] = row[index];
    });
    return obj;
  });
}
