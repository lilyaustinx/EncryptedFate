import { useEffect, useMemo, useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { Contract } from 'ethers';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { CONTRACT_ABI, CONTRACT_ADDRESS, PATH_LENGTH } from '../config/contracts';
import { StepCard } from './StepCard';
import '../styles/GameApp.css';

type ReadResult = ReturnType<typeof useReadContract>;

const EMPTY_CHOICES = Array(PATH_LENGTH).fill(null) as (number | null)[];

export function EncryptedFateApp() {
  const { address, isConnected } = useAccount();
  const signerPromise = useEthersSigner();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();

  const [isStarting, setIsStarting] = useState(false);
  const [pendingStep, setPendingStep] = useState<number | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptedScore, setDecryptedScore] = useState<number | null>(null);
  const [decryptedOutcome, setDecryptedOutcome] = useState<number | null>(null);
  const [decryptedChoices, setDecryptedChoices] = useState<(number | null)[]>(EMPTY_CHOICES);
  const [feedback, setFeedback] = useState<string>('');

  const progress = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getProgress',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  }) as ReadResult;

  const encryptedScore = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getEncryptedScore',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  }) as ReadResult;

  const encryptedOutcome = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getEncryptedOutcome',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  }) as ReadResult;

  const choiceReads = [
    useReadContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'getEncryptedChoice',
      args: address ? [address, 0] : undefined,
      query: { enabled: Boolean(address) },
    }) as ReadResult,
    useReadContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'getEncryptedChoice',
      args: address ? [address, 1] : undefined,
      query: { enabled: Boolean(address) },
    }) as ReadResult,
    useReadContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'getEncryptedChoice',
      args: address ? [address, 2] : undefined,
      query: { enabled: Boolean(address) },
    }) as ReadResult,
    useReadContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'getEncryptedChoice',
      args: address ? [address, 3] : undefined,
      query: { enabled: Boolean(address) },
    }) as ReadResult,
  ];

  const submittedSteps = useMemo(
    () => Number((progress.data as readonly [bigint, boolean] | undefined)?.[0] ?? 0n),
    [progress.data],
  );
  const finished = useMemo(
    () => Boolean((progress.data as readonly [bigint, boolean] | undefined)?.[1] ?? false),
    [progress.data],
  );

  useEffect(() => {
    setFeedback('');
    setDecryptedScore(null);
    setDecryptedOutcome(null);
    setDecryptedChoices(EMPTY_CHOICES);
  }, [address]);

  const encryptedChoices = choiceReads.map((entry) => entry.data as string | undefined);

  const refreshReads = async () => {
    await Promise.all([
      encryptedScore.refetch(),
      encryptedOutcome.refetch(),
      progress.refetch(),
      ...choiceReads.map((entry) => entry.refetch()),
    ]);
  };

  const handleStartGame = async () => {
    if (!isConnected || !address) {
      setFeedback('Connect your wallet to initialize the encrypted score.');
      return;
    }
    if (!signerPromise) {
      setFeedback('Waiting for signer to be ready.');
      return;
    }

    setIsStarting(true);
    setFeedback('');
    setDecryptedScore(null);
    setDecryptedOutcome(null);
    setDecryptedChoices(EMPTY_CHOICES);

    try {
      const signer = await signerPromise;
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.startGame();
      await tx.wait();
      await refreshReads();
      setFeedback('Encrypted score initialized to 1000. Time to choose your first path.');
    } catch (error) {
      console.error('Failed to start game', error);
      setFeedback('Could not start the game. Please confirm the transaction in your wallet.');
    } finally {
      setIsStarting(false);
    }
  };

  const handleSubmitChoice = async (stepIndex: number, value: number) => {
    if (!instance) {
      setFeedback('Encryption service is still loading.');
      return;
    }
    if (!address || !isConnected) {
      setFeedback('Connect your wallet to submit a choice.');
      return;
    }
    if (!signerPromise) {
      setFeedback('Waiting for signer to be ready.');
      return;
    }

    setPendingStep(stepIndex);
    setFeedback('');

    try {
      const encryptedInput = await instance.createEncryptedInput(CONTRACT_ADDRESS, address).add32(value).encrypt();
      const signer = await signerPromise;
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.submitPathChoice(stepIndex, encryptedInput.handles[0], encryptedInput.inputProof);
      await tx.wait();
      await refreshReads();
      setDecryptedChoices(EMPTY_CHOICES);
    } catch (error) {
      console.error('Failed to submit path choice', error);
      setFeedback('Path submission failed. Ensure you follow the step order and retry.');
    } finally {
      setPendingStep(null);
    }
  };

  const decryptGameData = async () => {
    if (!instance) {
      setFeedback('Encryption service is still loading.');
      return;
    }
    if (!address || !isConnected) {
      setFeedback('Connect your wallet to decrypt your data.');
      return;
    }
    if (!signerPromise) {
      setFeedback('Waiting for signer to be ready.');
      return;
    }

    const handles: { handle: string; contractAddress: string }[] = [];
    if (typeof encryptedScore.data === 'string') {
      handles.push({ handle: encryptedScore.data, contractAddress: CONTRACT_ADDRESS });
    }
    if (typeof encryptedOutcome.data === 'string') {
      handles.push({ handle: encryptedOutcome.data, contractAddress: CONTRACT_ADDRESS });
    }
    encryptedChoices.forEach((choice) => {
      if (typeof choice === 'string') {
        handles.push({ handle: choice, contractAddress: CONTRACT_ADDRESS });
      }
    });

    if (handles.length === 0) {
      setFeedback('No encrypted values available yet.');
      return;
    }

    setIsDecrypting(true);
    setFeedback('');

    try {
      const signer = await signerPromise;
      const keypair = instance.generateKeypair();
      const startTimestamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '10';
      const contractAddresses = [CONTRACT_ADDRESS];

      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimestamp, durationDays);
      const signature = await signer.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message
      );

      const result = await instance.userDecrypt(
        handles,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimestamp,
        durationDays
      );

      if (typeof encryptedScore.data === 'string') {
        const scoreValue = result[encryptedScore.data];
        setDecryptedScore(scoreValue !== undefined ? Number(scoreValue) : null);
      }
      if (typeof encryptedOutcome.data === 'string') {
        const outcomeValue = result[encryptedOutcome.data];
        setDecryptedOutcome(outcomeValue !== undefined ? Number(outcomeValue) : null);
      }

      const decodedChoices = encryptedChoices.map((handle) => {
        if (typeof handle !== 'string') return null;
        const value = result[handle];
        return value !== undefined ? Number(value) : null;
      });

      setDecryptedChoices(decodedChoices);
      setFeedback('Decryption finished locally. Values remain private to you.');
    } catch (error) {
      console.error('Failed to decrypt data', error);
      setFeedback('Decryption failed. Please retry once your last transaction is confirmed.');
    } finally {
      setIsDecrypting(false);
    }
  };

  const scoreLabel = decryptedScore !== null ? decryptedScore : 'Encrypted';
  const outcomeLabel =
    decryptedOutcome === null ? 'Encrypted' : decryptedOutcome === 1 ? 'Perfect path' : 'Wrong turn detected';

  const activeStep = finished ? PATH_LENGTH : submittedSteps;

  return (
    <div className="game-app">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Encrypted path challenge</p>
          <h1 className="hero-title">Walk the secret route and double your encrypted score.</h1>
          <p className="hero-copy">
            Every choice and reward is homomorphically encrypted with Zama. Begin with 1000 concealed points, follow
            the four-step pattern, and unlock a +1000 bonus only when you match 1 → 1 → 1 → 2.
          </p>
          <div className="hero-actions">
            <button className="primary-button" onClick={handleStartGame} disabled={isStarting || zamaLoading}>
              {isStarting ? 'Preparing encrypted score...' : 'Start new run'}
            </button>
            <button className="ghost-button" onClick={decryptGameData} disabled={isDecrypting || zamaLoading}>
              {isDecrypting ? 'Decrypting...' : 'Decrypt my data'}
            </button>
          </div>
          {feedback && <p className="feedback">{feedback}</p>}
          {zamaError && <p className="feedback warning">Zama SDK error: {zamaError}</p>}
        </div>
        <div className="hero-panel">
          <div className="stat">
            <p className="stat-label">Encrypted score</p>
            <p className="stat-value">{scoreLabel}</p>
            {typeof encryptedScore.data === 'string' ? (
              <p className="stat-mono">
                {encryptedScore.data.slice(0, 14)}...{encryptedScore.data.slice(-6)}
              </p>
            ) : (
              <p className="stat-mono">Awaiting start</p>
            )}
          </div>
          <div className="stat">
            <p className="stat-label">Progress</p>
            <p className="stat-value">
              {activeStep}/{PATH_LENGTH}
            </p>
            <p className="stat-mono">{finished ? 'Path locked' : 'Submit your next step'}</p>
          </div>
          <div className="stat">
            <p className="stat-label">Outcome</p>
            <p className="stat-value">{outcomeLabel}</p>
            {typeof encryptedOutcome.data === 'string' ? (
              <p className="stat-mono">
                {encryptedOutcome.data.slice(0, 14)}...{encryptedOutcome.data.slice(-6)}
              </p>
            ) : (
              <p className="stat-mono">Encrypted until completion</p>
            )}
          </div>
        </div>
      </section>

      <section className="grid">
        {Array.from({ length: PATH_LENGTH }).map((_, index) => (
          <StepCard
            key={index}
            stepIndex={index}
            submittedSteps={submittedSteps}
            finished={finished}
            encryptedChoice={encryptedChoices[index] ?? undefined}
            decryptedChoice={decryptedChoices[index]}
            isSubmitting={pendingStep === index}
            onSelect={(value) => handleSubmitChoice(index, value)}
          />
        ))}
      </section>

      <section className="panel">
        <div>
          <p className="eyebrow">Cipher vault</p>
          <h2 className="section-title">Encrypted handles pulled directly from the contract</h2>
          <p className="panel-copy">
            Reads use viem and remain on-chain accurate. Click &quot;Decrypt my data&quot; to re-encrypt values for your
            keys via the Zama Relayer.
          </p>
        </div>
        <div className="cipher-grid">
          <div className="cipher-card">
            <p className="cipher-label">Score handle</p>
            <p className="cipher-value">
              {typeof encryptedScore.data === 'string'
                ? `${encryptedScore.data.slice(0, 22)}...${encryptedScore.data.slice(-6)}`
                : '—'}
            </p>
          </div>
          <div className="cipher-card">
            <p className="cipher-label">Outcome handle</p>
            <p className="cipher-value">
              {typeof encryptedOutcome.data === 'string'
                ? `${encryptedOutcome.data.slice(0, 22)}...${encryptedOutcome.data.slice(-6)}`
                : '—'}
            </p>
          </div>
          {encryptedChoices.map((choice, idx) => (
            <div key={idx} className="cipher-card">
              <p className="cipher-label">Step {idx + 1} handle</p>
              <p className="cipher-value">
                {typeof choice === 'string' ? `${choice.slice(0, 22)}...${choice.slice(-6)}` : '—'}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
