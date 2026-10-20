import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/context/AppContext";
import { ApiAppProvider } from "@/context/ApiAppProvider";
import BlobBackground from "@/components/BlobBackground";

const Index = lazy(() => import("./pages/Index.tsx"));
const RoleSelector = lazy(() => import("@/components/RoleSelector"));
const TermsPage = lazy(() => import("./pages/Terms.tsx"));
const AdminDashboard = lazy(() => import("@/components/admin/AdminDashboard"));
const TherapistDashboard = lazy(() => import("@/components/therapist/TherapistDashboard"));
const ParentDashboard = lazy(() => import("@/components/parent/ParentDashboard"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

const queryClient = new QueryClient();

const DataProvider = import.meta.env.VITE_DATA_MODE === "api" ? ApiAppProvider : AppProvider;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <DataProvider>
      <TooltipProvider>
        <div className="relative min-h-screen overflow-hidden bg-background">
          <BlobBackground />
          <div className="relative z-10 min-h-screen">
            <Toaster />
            <Sonner />
            <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Suspense
                fallback={
                  <div className="flex min-h-screen items-center justify-center" aria-busy="true" aria-label="Loading" />
                }
              >
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/enter" element={<RoleSelector />} />
                  <Route path="/terms" element={<TermsPage />} />
                  <Route path="/therapist" element={<TherapistDashboard />} />
                  <Route path="/family" element={<ParentDashboard />} />
                  <Route path="/admin" element={<AdminDashboard />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </div>
        </div>
      </TooltipProvider>
    </DataProvider>
  </QueryClientProvider>
);

export default App;
