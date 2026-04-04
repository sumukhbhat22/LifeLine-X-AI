import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "./pages/Dashboard.tsx";
import SimulationPage from "./pages/Simulation.tsx";
import SurgePredictorPage from "./pages/SurgePredictorPage.tsx";
import TrafficAdminPage from "./pages/TrafficAdmin.tsx";
import DisruptionReroutePage from "./pages/DisruptionReroute.tsx";
import SafetyRoutingPage from "./pages/SafetyRouting.tsx";
import PhaseSkippingPage from "./pages/PhaseSkipping.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/simulation" element={<SimulationPage />} />
          <Route path="/surge-predictor" element={<SurgePredictorPage />} />
          <Route path="/traffic-admin" element={<TrafficAdminPage />} />
          <Route path="/disruption-reroute" element={<DisruptionReroutePage />} />
          <Route path="/safety-routing" element={<SafetyRoutingPage />} />
          <Route path="/phase-skipping" element={<PhaseSkippingPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
