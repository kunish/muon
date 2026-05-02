import process from 'node:process'

export interface EnterpriseApiConfig {
  adminBaseUrl: string
  apiBaseUrl: string
  databaseUrl: string
  matrixAdapter: 'conduit'
  matrixAdminToken: string
  matrixServerUrl: string
  sessionSecret: string
}

export function readEnterpriseApiConfig(env: Record<string, string | undefined> = process.env): EnterpriseApiConfig {
  return {
    adminBaseUrl: env.MUON_ADMIN_BASE_URL ?? 'http://127.0.0.1:4174',
    apiBaseUrl: env.MUON_API_BASE_URL ?? 'http://127.0.0.1:8787',
    databaseUrl: env.MUON_DATABASE_URL ?? 'postgres://muon:muon@127.0.0.1:5432/muon',
    matrixAdapter: 'conduit',
    matrixAdminToken: env.MUON_MATRIX_ADMIN_TOKEN ?? '',
    matrixServerUrl: env.MUON_MATRIX_SERVER_URL ?? 'http://127.0.0.1:6167',
    sessionSecret: env.MUON_SESSION_SECRET ?? 'development-session-secret',
  }
}
