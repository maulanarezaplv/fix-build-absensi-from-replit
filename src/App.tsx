import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import FaviconSync from "@/components/FaviconSync";
import { queryClient } from "@/lib/queryClient";
import { ChunkErrorBoundary } from "@/components/ChunkErrorBoundary";

import Index from "./pages/Index";
import Login from "./pages/Login";
import PublicLayout from "./layouts/PublicLayout";
import NotFound from "./pages/NotFound";
import AdminRoutes from "./routes/AdminRoutes";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <FaviconSync />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
            </Route>

            <Route
              path="/admin/*"
              element={
                <ChunkErrorBoundary>
                  <AdminRoutes />
                </ChunkErrorBoundary>
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
