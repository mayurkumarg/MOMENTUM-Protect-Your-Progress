import { useState, useEffect } from 'react'

export function useExtension() {
  const [status, setStatus] = useState(() => {
    return document.documentElement.getAttribute('data-momentum-extension-status') || 'not_installed'
  })

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.source !== window || !event.data) return

      if (event.data.type === 'MOMENTUM_EXTENSION_STATUS') {
        setStatus(event.data.status)
      }
    }

    // Also observe the attribute directly in case the initial load message was missed
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === 'data-momentum-extension-status') {
          const newStatus = document.documentElement.getAttribute('data-momentum-extension-status')
          if (newStatus) {
            setStatus(newStatus)
          }
        }
      }
    })

    observer.observe(document.documentElement, { attributes: true })
    window.addEventListener('message', handleMessage)

    // Read whatever the content script may have already set before we mounted…
    const current = document.documentElement.getAttribute('data-momentum-extension-status')
    if (current) setStatus(current)

    // …and actively ping the extension, so if its one-shot announce fired
    // before this component mounted, it re-answers. A few short retries cover
    // the extension's content script loading slightly after the page.
    let attempts = 0
    const ping = () => window.postMessage({ type: 'MOMENTUM_PING' }, '*')
    ping()
    const interval = setInterval(() => {
      attempts += 1
      const detected = document.documentElement.getAttribute('data-momentum-extension-status')
      if (detected || attempts >= 5) {
        clearInterval(interval)
        return
      }
      ping()
    }, 400)

    return () => {
      observer.disconnect()
      window.removeEventListener('message', handleMessage)
      clearInterval(interval)
    }
  }, [])

  return {
    isInstalled: status === 'installed' || status === 'connected',
    isConnected: status === 'connected',
    status, // 'not_installed' | 'installed' | 'connected'
  }
}
