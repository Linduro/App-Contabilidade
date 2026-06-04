"use client"

import { Component, type ReactNode } from "react"
import { Button } from "@/components/ui/button"

interface Props {
  children: ReactNode
  fallbackTitle?: string
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {this.props.fallbackTitle ?? "Algo deu errado"}
          </h2>
          <p className="text-sm text-slate-500">Recarregue a página ou tente novamente.</p>
          <Button onClick={() => this.setState({ hasError: false })}>Tentar de novo</Button>
        </div>
      )
    }
    return this.props.children
  }
}
