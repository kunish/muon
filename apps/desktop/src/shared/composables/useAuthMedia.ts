// Delegates to @muon/ui/media which uses a resolver-based dependency-injection
// pattern. The resolver is configured in src/app/main.ts via setAuthMediaResolver.
export { setAuthMediaResolver, useAuthMedia } from '@muon/ui/media'
export type { AuthMediaResolver } from '@muon/ui/media'
