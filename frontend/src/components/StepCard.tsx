import '../styles/GameApp.css';

type StepCardProps = {
  stepIndex: number;
  submittedSteps: number;
  finished: boolean;
  encryptedChoice?: string;
  decryptedChoice?: number | null;
  isSubmitting: boolean;
  onSelect: (value: number) => Promise<void>;
};

export function StepCard({
  stepIndex,
  submittedSteps,
  finished,
  encryptedChoice,
  decryptedChoice,
  isSubmitting,
  onSelect,
}: StepCardProps) {
  const isCurrent = stepIndex === submittedSteps && !finished;
  const lockedIn = stepIndex < submittedSteps || finished;
  const disabled = !isCurrent || isSubmitting;

  const statusLabel = lockedIn ? "Locked in" : isCurrent ? "Your next move" : "Awaiting unlock";
  const statusTone = lockedIn ? "status-locked" : isCurrent ? "status-active" : "status-idle";

  const shortChoice = encryptedChoice ? `${encryptedChoice.slice(0, 10)}...${encryptedChoice.slice(-6)}` : "—";

  return (
    <div className="step-card">
      <div className="step-header">
        <div>
          <p className="step-kicker">Step {stepIndex + 1}</p>
          <h3 className="step-title">Pick one of three encrypted exits</h3>
        </div>
        <span className={`status-pill ${statusTone}`}>{statusLabel}</span>
      </div>

      <p className="step-copy">
        Choices are encrypted in-browser before they ever reach the contract. Only the correct sequence unlocks the
        bonus.
      </p>

      <div className="option-row">
        {[1, 2, 3].map((option) => (
          <button
            key={option}
            className={`option-button ${isCurrent ? "option-live" : "option-muted"}`}
            disabled={disabled}
            onClick={() => onSelect(option)}
          >
            {isSubmitting ? "Encrypting..." : `Path ${option}`}
          </button>
        ))}
      </div>

      <div className="cipherline">
        <div>
          <p className="cipher-label">Encrypted choice</p>
          <p className="cipher-value">{shortChoice}</p>
        </div>
        <div className="decoded-chip">
          <span className="decoded-label">Decoded</span>
          <span className="decoded-value">
            {decryptedChoice !== null && decryptedChoice !== undefined ? decryptedChoice : "Hidden"}
          </span>
        </div>
      </div>
    </div>
  );
}
