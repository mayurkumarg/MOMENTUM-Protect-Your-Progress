import { Component } from 'react'
import { RefreshCw } from 'lucide-react'
import { Logo } from './Logo'

// Last line of defense: if a page throws during render (a bug we didn't
// catch, a malformed API response, etc.), show a real recovery screen
// instead of a blank white page or React's raw error overlay in production.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Momentum crashed:', error, info)
  }

  handleReload = () => {
    this.setState({ hasError: false })
    window.location.href = '/overview'
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="grid min-h-screen place-items-center bg-canvas px-4 text-ink">
        <div className="w-full max-w-sm space-y-5 text-center">
          <Logo size={44} className="mx-auto" />
          <div>
            <h1 className="font-display text-xl font-bold">Something went wrong</h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              Momentum hit an unexpected error. Your data is safe — try heading back to your overview.
            </p>
          </div>
          <button
            onClick={this.handleReload}
            className="focus-ring mx-auto inline-flex h-10 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-canvas transition-colors hover:bg-accent hover:text-white"
          >
            <RefreshCw size={16} />
            Back to Overview
          </button>
        </div>
      </div>
    )
  }
}
