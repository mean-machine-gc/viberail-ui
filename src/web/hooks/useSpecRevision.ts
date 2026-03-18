import { useState, useEffect } from 'react'

/**
 * Returns a revision counter that increments whenever specs are
 * updated on the server. Use it as a useEffect dependency to re-fetch.
 */
export function useSpecRevision(): number {
    const [revision, setRevision] = useState(0)

    useEffect(() => {
        if (import.meta.hot) {
            import.meta.hot.on('viberail:specs-updated', () => {
                setRevision(r => r + 1)
            })
        }
    }, [])

    return revision
}
