import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/context/AppContext";
import BlobBackground from "@/components/BlobBackground";
import AdminDashboard from "@/components/admin/AdminDashboard";
import TherapistDashboard from "@/components/therapist/TherapistDashboard";
import ParentDashboard from "@/components/parent/ParentDashboard";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppProvider>
      <TooltipProvider>
        <div className="relative min-h-screen overflow-hidden bg-background">
          <BlobBackground />
          <div className="relative z-10 min-h-screen">
            <Toaster />
            <Sonner />
            <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/therapist" element={<TherapistDashboard />} />
                <Route path="/family" element={<ParentDashboard />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </div>
        </div>
      </TooltipProvider>
    </AppProvider>
  </QueryClientProvider>
);

export default App;
