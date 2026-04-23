import type { BoostMeta } from "@/lib/boosts";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  meta: BoostMeta;
  title?: string;
}

export const BoostDot = ({ meta, title }: Props) => {
  const Icon = meta.icon;
  const label = title ?? `${meta.label} boost active`;
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <button
          type="button"
          tabIndex={0}
          className={`w-5 h-5 rounded-full inline-flex items-center justify-center cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${meta.dotClass}`}
          aria-label={label}
        >
          <Icon className="w-2.5 h-2.5" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
};
