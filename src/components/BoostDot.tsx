import type { BoostMeta } from "@/lib/boosts";

interface Props {
  meta: BoostMeta;
  title?: string;
}

export const BoostDot = ({ meta, title }: Props) => {
  const Icon = meta.icon;
  return (
    <span
      className={`w-5 h-5 rounded-full inline-flex items-center justify-center ${meta.dotClass}`}
      aria-label={title ?? `${meta.label} boost active`}
      title={title}
    >
      <Icon className="w-2.5 h-2.5" aria-hidden="true" />
    </span>
  );
};
