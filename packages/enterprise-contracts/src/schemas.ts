import { z } from 'zod'

export const userRoleSchema = z.enum(['owner', 'admin', 'member'])
export type UserRole = z.infer<typeof userRoleSchema>

export const organizationStatusSchema = z.enum(['active', 'suspended'])
export type OrganizationStatus = z.infer<typeof organizationStatusSchema>

export const userStatusSchema = z.enum(['active', 'disabled'])
export type UserStatus = z.infer<typeof userStatusSchema>

export const installRequestSchema = z.object({
  organizationName: z.string().trim().min(1),
  organizationSlug: z.string().trim().min(2).max(64).regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/),
  ownerUsername: z.string().trim().min(2).max(64).regex(/^[\w.-]+$/),
  ownerEmail: z.string().trim().email(),
  ownerDisplayName: z.string().trim().min(1),
  ownerPassword: z.string().min(12),
})
export type InstallRequest = z.infer<typeof installRequestSchema>

export const createOrganizationRequestSchema = installRequestSchema
export type CreateOrganizationRequest = InstallRequest

export const organizationSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  status: organizationStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type Organization = z.infer<typeof organizationSchema>

export const userSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  username: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().min(1),
  status: userStatusSchema,
  mustChangePassword: z.boolean(),
  roles: z.array(userRoleSchema).min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type EnterpriseUser = z.infer<typeof userSchema>

export const installResponseSchema = z.object({
  organization: organizationSchema,
  owner: userSchema,
})
export type InstallResponse = z.infer<typeof installResponseSchema>

export const createOrganizationResponseSchema = installResponseSchema
export type CreateOrganizationResponse = InstallResponse

export const adminLoginRequestSchema = z.object({
  organizationSlug: z.string().trim().min(1),
  username: z.string().trim().min(1),
  password: z.string().min(1),
})
export type AdminLoginRequest = z.infer<typeof adminLoginRequestSchema>

export const createUserRequestSchema = z.object({
  username: z.string().trim().min(2).max(64).regex(/^[\w.-]+$/),
  email: z.string().trim().email(),
  displayName: z.string().trim().min(1),
  initialPassword: z.string().min(12),
  roles: z.array(userRoleSchema).min(1),
})
export type CreateUserRequest = z.infer<typeof createUserRequestSchema>

export const updateUserRequestSchema = z.object({
  username: z.string().trim().min(2).max(64).regex(/^[\w.-]+$/).optional(),
  displayName: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional(),
  status: userStatusSchema.optional(),
  roles: z.array(userRoleSchema).min(1).optional(),
})
export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>

export const resetPasswordRequestSchema = z.object({
  newPassword: z.string().min(12),
  mustChangePassword: z.boolean().default(true),
})
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>

export const oauthLoginRequestSchema = z.object({
  organizationSlug: z.string().trim().min(1),
  username: z.string().trim().min(1),
  password: z.string().min(1),
  clientId: z.string().min(1),
  redirectUri: z.string().min(1),
  codeChallenge: z.string().min(1),
  codeChallengeMethod: z.enum(['plain', 'S256']).default('S256'),
  state: z.string().min(1),
})
export type OAuthLoginRequest = z.infer<typeof oauthLoginRequestSchema>

export const oauthLoginResponseSchema = z.object({
  redirectUri: z.string().url().or(z.string().startsWith('muon://')),
  code: z.string().min(1),
  state: z.string().min(1),
})
export type OAuthLoginResponse = z.infer<typeof oauthLoginResponseSchema>

export const oauthTokenRequestSchema = z.object({
  code: z.string().min(1),
  codeVerifier: z.string().min(1),
  redirectUri: z.string().min(1),
  clientId: z.string().min(1),
  deviceName: z.string().trim().min(1),
})
export type OAuthTokenRequest = z.infer<typeof oauthTokenRequestSchema>

export const muonSessionSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.string().datetime(),
  deviceName: z.string().trim().min(1),
})
export type MuonSession = z.infer<typeof muonSessionSchema>

export const matrixSessionSchema = z.object({
  serverUrl: z.string().url(),
  userId: z.string().regex(/^@[^:]+:.+$/),
  accessToken: z.string().min(1),
  deviceId: z.string().min(1),
})
export type MatrixSession = z.infer<typeof matrixSessionSchema>

export const oauthTokenResponseSchema = z.object({
  muonSession: muonSessionSchema,
  matrixSession: matrixSessionSchema,
})
export type OAuthTokenResponse = z.infer<typeof oauthTokenResponseSchema>

export const auditLogSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  actorUserId: z.string().nullable(),
  action: z.string().min(1),
  targetType: z.string().min(1),
  targetId: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdAt: z.string().datetime(),
})
export type AuditLog = z.infer<typeof auditLogSchema>

export const changeOwnPasswordRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12),
})
export type ChangeOwnPasswordRequest = z.infer<typeof changeOwnPasswordRequestSchema>

export const oauthRefreshRequestSchema = z.object({
  refreshToken: z.string().min(1),
  clientId: z.string().min(1),
  deviceName: z.string().trim().min(1),
})
export type OAuthRefreshRequest = z.infer<typeof oauthRefreshRequestSchema>

export const deviceSessionSchema = z.object({
  id: z.string().min(1),
  deviceName: z.string().min(1),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
})
export type DeviceSessionPublic = z.infer<typeof deviceSessionSchema>
