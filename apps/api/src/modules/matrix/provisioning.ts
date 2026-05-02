export interface MatrixProvisioningInput {
  displayName: string
  organizationSlug: string
  username: string
}

export interface MatrixProvisioningResult {
  accessToken: string
  deviceId: string
  matrixUserId: string
}

export interface MatrixProvisioningAdapter {
  ensureUser: (input: MatrixProvisioningInput) => Promise<MatrixProvisioningResult>
}
