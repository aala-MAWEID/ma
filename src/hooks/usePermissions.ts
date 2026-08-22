import { useAuth } from '../contexts/AuthContext'
import type { Permissions } from '../data/domain'

/**
 * Read-only view of what this account may do.
 *
 * Used ONLY to decide what to render. Never as a security boundary — every
 * one of these is re-checked by maweid.require() inside the RPC. If someone
 * flips a boolean in the devtools they will see a delete button, press it,
 * and receive 42501.
 */
export function usePermissions(): Permissions & { isOwner: boolean } {
  const { perms, isOwner } = useAuth()
  return { ...perms, isOwner }
}

/** Convenience for a single capability. */
export function useCan(capability: keyof Permissions): boolean {
  const { perms } = useAuth()
  return perms[capability] === true
}
