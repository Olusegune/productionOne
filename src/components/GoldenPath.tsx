import { ArrowRight, BadgeCheck, Check, Clapperboard, FileText, PackageCheck, Palette, ScanSearch, Sparkles, type LucideIcon } from "lucide-react";
import { goldenPath, type GoldenPathInput, type GoldenStep } from "../domain/goldenPath";

const stepIcons: Record<string, LucideIcon> = { create: FileText, analyze: ScanSearch, design: Palette, generate: Sparkles, review: BadgeCheck, direct: Clapperboard, deliver: PackageCheck };

export function GoldenPath({
  input,
  onGo,
  onNext,
}: {
  input: GoldenPathInput;
  onGo: (workspace: string) => void;
  onNext?: (step: GoldenStep) => void;
}) {
  const { steps, next, progress, extras } = goldenPath(input);
  return (
    <section className="golden-path" aria-label="Golden Path">
      <div className="golden-head">
        <div>
          <span className="eyebrow">GOLDEN PATH</span>
          <h3>
            {next ? `Next: ${next.action}` : "Every step is complete"}
          </h3>
          <p>
            {next
              ? next.detail
              : "Your production is ready to export. Open Deliver to package it."}
          </p>
        </div>
        {next && (
          <button className="primary" onClick={() => (onNext ? onNext(next) : onGo(next.workspace))}>
            {next.action} <ArrowRight size={15} />
          </button>
        )}
      </div>
      <ol className="golden-steps" style={{ "--progress": `${progress}%` } as React.CSSProperties}>
        {steps.map((step) => (
          <li key={step.id} className={step.state} aria-current={step.state === "active" ? "step" : undefined}>
            <button onClick={() => onGo(step.workspace)} aria-label={`${step.label}: ${step.detail}`}>
              <span className="golden-dot">
                {step.state === "done" ? <Check size={15} aria-hidden="true" /> : (() => { const Icon = stepIcons[step.id] ?? Sparkles; return <Icon size={15} aria-hidden="true" />; })()}
              </span>
              <b>{step.label}</b>
              <small>{step.detail}</small>
            </button>
          </li>
        ))}
      </ol>
      {extras.length > 0 && (
        <ul className="golden-extras" aria-label="Optional steps">
          {extras.map((x) => (
            <li key={x.id} className={x.state}><button className="linklike" onClick={() => onGo(x.workspace)}>{x.state === "done" ? <Check size={12} aria-hidden="true" /> : null} {x.label}: {x.detail}</button></li>
          ))}
        </ul>
      )}
      {!input.storyboards && (
        <p className="golden-note">
          Direct (storyboards and animatics) is optional. Turn it on in the
          Direct workspace only if you need it.
        </p>
      )}
    </section>
  );
}
