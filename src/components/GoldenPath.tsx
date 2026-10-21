import { ArrowRight, Check } from "lucide-react";
import { goldenPath, type GoldenPathInput } from "../domain/goldenPath";

export function GoldenPath({
  input,
  onGo,
}: {
  input: GoldenPathInput;
  onGo: (workspace: string) => void;
}) {
  const { steps, next, progress } = goldenPath(input);
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
          <button className="primary" onClick={() => onGo(next.workspace)}>
            {next.action} <ArrowRight size={15} />
          </button>
        )}
      </div>
      <ol className="golden-steps" style={{ "--progress": `${progress}%` } as React.CSSProperties}>
        {steps.map((step, index) => (
          <li key={step.id} className={step.state} aria-current={step.state === "active" ? "step" : undefined}>
            <button onClick={() => onGo(step.workspace)} aria-label={`${step.label}: ${step.detail}`}>
              <span className="golden-dot">
                {step.state === "done" ? <Check size={14} /> : index + 1}
              </span>
              <b>{step.label}</b>
              <small>{step.detail}</small>
            </button>
          </li>
        ))}
      </ol>
      {!input.storyboards && (
        <p className="golden-note">
          Direct (storyboards and animatics) is optional. Turn it on in the
          Direct workspace only if you need it.
        </p>
      )}
    </section>
  );
}
