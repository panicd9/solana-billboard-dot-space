import { Link } from "react-router-dom";

const TAKEDOWN_URL =
  (import.meta.env.VITE_TAKEDOWN_URL as string | undefined)?.trim() || "";

const SiteFooter = () => (
  <footer className="border-t border-border py-4 px-4 sm:px-6 text-[11px] text-muted-foreground flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
    <Link to="/policy" className="hover:text-foreground transition-colors">
      Content policy
    </Link>
    {TAKEDOWN_URL && (
      <a
        href={TAKEDOWN_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-foreground transition-colors"
      >
        Report a region
      </a>
    )}
    <Link to="/activity" className="hover:text-foreground transition-colors">
      Activity
    </Link>
  </footer>
);

export default SiteFooter;
