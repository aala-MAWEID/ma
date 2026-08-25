const memory = new Map<string, string>()

function backend(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null {
  try {
    const probe = '__maweid_probe__'
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return window.localStorage
  } catch {
    return null
  }
}
const store = typeof window === 'undefined' ? null : backend()

export const safeStorage = {
  get(key: string): string | null {
    try {
      return store ? store.getItem(key) : memory.get(key) ?? null
    } catch {
      return memory.get(key) ?? null
    }
  },
  set(key: string, value: string): void {
    try {
      if (store) store.setItem(key, value)
      else memory.set(key, value)
    } catch {
      memory.set(key, value)
    }
  },
  remove(key: string): void {
    try {
      if (store) store.removeItem(key)
      else memory.delete(key)
    } catch {
      memory.delete(key)
    }
  },
}
