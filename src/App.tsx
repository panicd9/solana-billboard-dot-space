import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import SolanaProvider from "@/components/SolanaProvider";
import { RegionProvider } from "@/context/RegionContext";
import ComingSoon from "./pages/ComingSoon";
import Index from "./pages/Index";
import Preview from "./pages/Preview";
import PreviewCard from "./pages/PreviewCard";
import Profile from "./pages/Profile";
import Embed from "./pages/Embed";
import Activity from "./pages/Activity";
import Policy from "./pages/Policy";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <SolanaProvider>
      <TooltipProvider>
        <Analytics />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <RegionProvider>
            <Routes>
              <Route path="/" element={<ComingSoon />} />
              <Route path="/app" element={<Index />} />
              <Route path="/preview" element={<Preview />} />
              <Route path="/preview-card" element={<PreviewCard />} />
              <Route path="/u/:wallet" element={<Profile />} />
              <Route path="/embed/r/:assetId" element={<Embed />} />
              <Route path="/activity" element={<Activity />} />
              <Route path="/policy" element={<Policy />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </RegionProvider>
        </BrowserRouter>
      </TooltipProvider>
    </SolanaProvider>
  </QueryClientProvider>
);

export default App;
