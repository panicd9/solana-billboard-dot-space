import { MockRegionProvider } from "@/context/MockRegionProvider";
import Index from "@/pages/Index";

const Preview = () => (
  <MockRegionProvider empty>
    <div className="relative">
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full border border-border/50 bg-background/80 px-4 py-2 text-xs text-muted-foreground backdrop-blur-sm">
        Preview — empty canvas. Writes disabled.
      </div>
      <Index />
    </div>
  </MockRegionProvider>
);

export default Preview;
