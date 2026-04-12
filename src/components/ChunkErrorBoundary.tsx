import { Component, ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

const isChunkError = (error: unknown): boolean => {
  if (!error) return false;
  const e = error as Error;
  return (
    e.name === "ChunkLoadError" ||
    /Loading (chunk|CSS chunk)/.test(e.message || "") ||
    /Failed to fetch dynamically imported module/.test(e.message || "") ||
    /Failed to load module script/.test(e.message || "") ||
    /Importing a module script failed/.test(e.message || "")
  );
};

export class ChunkErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State | null {
    if (isChunkError(error)) {
      // Reload setelah satu tick agar React selesai render
      setTimeout(() => window.location.reload(), 100);
      return { hasError: true };
    }
    return null;
  }

  componentDidCatch(error: unknown) {
    if (isChunkError(error)) {
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <p className="text-sm text-muted-foreground">Memuat ulang...</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
