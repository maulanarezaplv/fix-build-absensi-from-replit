import { lazy, Suspense } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import FaviconSync from "@/components/FaviconSync";
import { queryClient } from "@/lib/queryClient";

import Index from "./pages/Index";
import Login from "./pages/Login";
import PublicLayout from "./layouts/PublicLayout";
import NotFound from "./pages/NotFound";

const AdminRoutes = lazy(() =>
  Promise.resolve().then(() => import("./routes/AdminRoutes"))
);

const PanelLoader = () => {
  const { isAdmin } = useAuth();
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-muted-foreground">
          {isAdmin ? "Memuat panel admin..." : "Memuat panel guru..."}
        </p>
      </div>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <FaviconSync />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Halaman publik: tanpa lazy, tanpa Suspense — tidak ada flash */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
            </Route>

            {/* Halaman admin: lazy-loaded sebagai satu chunk terpisah */}
            <Route
              path="/admin/*"
              element={
                <Suspense fallback={<PanelLoader />}>
                  <AdminRoutes />
                </Suspense>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
