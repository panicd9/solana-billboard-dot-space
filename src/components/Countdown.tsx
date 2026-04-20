import { useEffect, useState } from "react";

interface Props {
  target: Date;
}

interface Parts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
}

const computeParts = (target: Date): Parts => {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
  const s = Math.floor(diff / 1000);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    done: false,
  };
};

const Unit = ({ value, label }: { value: number; label: string }) => (
  <div className="flex flex-col items-center">
    <div className="font-mono tabular-nums text-4xl sm:text-5xl md:text-6xl font-semibold text-foreground leading-none px-3 py-4 sm:px-5 sm:py-5 min-w-[4rem] sm:min-w-[5.5rem] text-center rounded-lg border border-border bg-card/60 backdrop-blur-sm">
      {value.toString().padStart(2, "0")}
    </div>
    <div className="mt-2 text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground font-mono">
      {label}
    </div>
  </div>
);

const Countdown = ({ target }: Props) => {
  const [parts, setParts] = useState<Parts>(() => computeParts(target));

  useEffect(() => {
    const tick = () => setParts(computeParts(target));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [target]);

  if (parts.done) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-5 py-2.5">
        <span className="relative flex w-2 h-2">
          <span className="absolute inset-0 rounded-full bg-primary opacity-75 animate-ping" />
          <span className="relative inline-block w-2 h-2 rounded-full bg-primary" />
        </span>
        <span className="font-mono text-sm uppercase tracking-widest text-primary text-glow">
          Launching now
        </span>
      </div>
    );
  }

  return (
    <div
      role="timer"
      aria-live="polite"
      aria-label={`${parts.days} days, ${parts.hours} hours, ${parts.minutes} minutes, ${parts.seconds} seconds until launch`}
      className="flex items-start gap-2 sm:gap-3"
    >
      <Unit value={parts.days} label="Days" />
      <Unit value={parts.hours} label="Hours" />
      <Unit value={parts.minutes} label="Min" />
      <Unit value={parts.seconds} label="Sec" />
    </div>
  );
};

export default Countdown;
