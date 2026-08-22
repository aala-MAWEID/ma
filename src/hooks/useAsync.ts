import { useCallback, useEffect, useRef, useState } from 'react'
import { errorCodeOf, type ErrorCode } from '@/data/errors'

export interface AsyncState<T> {
  value: T | null
  loading: boolean
  error: ErrorCode | null
}

/**
 * One loading pattern for the whole app. Handles the two bugs every hand-rolled
 * fetch effect has: setting state after unmount, and a slow response from an
 * old query overwriting a fast response from the new one.
 */
export function useAsync<T>(
  run: () => Promise<T>,
  deps: unknown[],
  enabled = true,
): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({
    value: null,
    loading: enabled,
    error: null,
  })
  const [nonce, setNonce] = useState(0)
  const seq = useRef(0)

  useEffect(() => {
    if (!enabled) {
      setState({ value: null, loading: false, error: null })
      return
    }
    const ticket = ++seq.current
    setState((s) => ({ ...s, loading: true, error: null }))

    run()
      .then((value) => {
        if (ticket !== seq.current) return // a newer request already won
        setState({ value, loading: false, error: null })
      })
      .catch((e) => {
        if (ticket !== seq.current) return
        setState({ value: null, loading: false, error: errorCodeOf(e) })
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, nonce])

  return { ...state, reload: useCallback(() => setNonce((n) => n + 1), []) }
}
