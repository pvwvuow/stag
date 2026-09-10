"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

/**
 * فاز ۵.۳ — global React error boundary. An exception in any view used to
 * white-screen the whole renderer; now the view is replaced by a friendly
 * Persian recovery card (and the crash reaches the main-process log through
 * the console-message capture).
 */

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Also lands in stag.log via the renderer console-message bridge.
    console.error("[stag] view crashed:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex h-full items-center justify-center p-8" dir="rtl">
        <div className="w-full max-w-md rounded-3xl border border-rose-500/25 bg-rose-500/5 p-8 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/15">
            <AlertTriangle className="h-7 w-7 text-rose-500" />
          </span>
          <h1 className="mb-2 text-base font-black">این بخش موقتاً خراب شد</h1>
          <p className="mb-1 text-xs leading-6 text-muted-foreground">
            یک خطای غیرمنتظره در همین صفحه رخ داد؛ بقیه برنامه سالم است.
          </p>
          <p className="mb-5 break-all text-[10px] text-muted-foreground/70">
            {this.state.error.message}
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => this.setState({ error: null })}
              className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground transition-opacity hover:bg-primary/90"
            >
              <RotateCw className="h-4 w-4" />
              تلاش مجدد
            </button>
            <button
              onClick={() => window.location.reload()}
              className="rounded-full bg-muted/70 px-5 py-2.5 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground"
            >
              راه‌اندازی دوباره برنامه
            </button>
          </div>
        </div>
      </div>
    );
  }
}
