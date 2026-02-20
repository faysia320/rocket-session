import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  /** 리셋 시 호출되는 콜백 (예: key 변경으로 리마운트) */
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-sm">
          <span className="text-sm">{"⚠"}</span>
          <span className="font-mono text-xs text-destructive">
            메시지를 표시할 수 없습니다
          </span>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * 앱 최상단용 전역 에러 폴백 UI.
 * 복구 불가능한 렌더 에러 발생 시 새로고침을 안내합니다.
 */
export function AppErrorFallback({ onReset }: { onReset?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground gap-4 p-8">
      <div className="text-4xl">{"⚠"}</div>
      <h1 className="text-xl font-semibold">문제가 발생했습니다</h1>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        예기치 않은 오류가 발생했습니다. 페이지를 새로고침하거나 아래 버튼을 눌러주세요.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          페이지 새로고침
        </button>
        {onReset ? (
          <button
            type="button"
            onClick={onReset}
            className="px-4 py-2 text-sm font-medium rounded-md border border-border text-foreground hover:bg-muted transition-colors"
          >
            다시 시도
          </button>
        ) : null}
      </div>
    </div>
  );
}
