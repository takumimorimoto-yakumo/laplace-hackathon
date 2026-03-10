import {
  Program,
  AnchorProvider,
  BN,
  Idl,
  Wallet,
} from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
  SystemProgram,
} from "@solana/web3.js";
import { getConnection } from "./connection";
import { getSignerKeypair } from "./prediction-recorder";
import oracleIdlJson from "./idl/laplace-oracle.json";

// ---------- Types ----------

interface RecordPredictionParams {
  agentId: string;
  token: string;
  direction: number;
  confidence: number;
  entryPrice: BN;
  timeHorizon: number;
}

// ---------- NodeWallet Implementation ----------

class NodeWallet implements Wallet {
  constructor(readonly payer: Keypair) {}

  get publicKey(): PublicKey {
    return this.payer.publicKey;
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(
    tx: T
  ): Promise<T> {
    if (tx instanceof Transaction) {
      tx.partialSign(this.payer);
    } else if (tx instanceof VersionedTransaction) {
      tx.sign([this.payer]);
    }
    return tx;
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(
    txs: T[]
  ): Promise<T[]> {
    return txs.map((tx) => {
      if (tx instanceof Transaction) {
        tx.partialSign(this.payer);
      } else if (tx instanceof VersionedTransaction) {
        tx.sign([this.payer]);
      }
      return tx;
    });
  }
}

// ---------- Program Helpers ----------

function getOracleProgramId(): PublicKey {
  const id = process.env.NEXT_PUBLIC_ORACLE_PROGRAM_ID;
  if (!id) {
    throw new Error("NEXT_PUBLIC_ORACLE_PROGRAM_ID not set");
  }
  return new PublicKey(id);
}

function getOracleProgram(signer: Keypair): Program {
  const connection = getConnection();
  const wallet = new NodeWallet(signer);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  const idl = oracleIdlJson as unknown as Idl;
  return new Program(idl, provider);
}

// ---------- PDA Helpers ----------

function getAgentCounterPda(agentId: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("counter"), Buffer.from(agentId)],
    getOracleProgramId()
  );
}

function getPredictionPda(
  agentId: string,
  count: BN
): [PublicKey, number] {
  const countBuffer = Buffer.alloc(8);
  countBuffer.writeBigUInt64LE(BigInt(count.toString()));

  return PublicKey.findProgramAddressSync(
    [Buffer.from("prediction"), Buffer.from(agentId), countBuffer],
    getOracleProgramId()
  );
}

// ---------- OracleClient ----------

export class OracleClient {
  private signer: Keypair;
  private program: Program;

  constructor() {
    this.signer = getSignerKeypair();
    this.program = getOracleProgram(this.signer);
  }

  /**
   * Initialize a counter for an agent (one-time setup).
   */
  async initializeCounter(agentId: string): Promise<string> {
    const [agentCounterPda] = getAgentCounterPda(agentId);

    try {
      // Check if counter already exists
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existingCounter = await (this.program.account as any).agentCounter.fetchNullable(
        agentCounterPda
      );
      if (existingCounter) {
        console.log(`Counter for agent ${agentId} already exists`);
        return "already_exists";
      }

      const tx = await this.program.methods
        .initializeCounter(agentId)
        .accounts({
          agentCounter: agentCounterPda,
          authority: this.signer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log(
        `Counter initialized for agent ${agentId}. Tx: ${tx}`
      );
      return tx;
    } catch (err) {
      console.error("Failed to initialize counter:", err);
      throw err;
    }
  }

  /**
   * Record a prediction on-chain (server-side).
   */
  async recordPrediction(
    params: RecordPredictionParams
  ): Promise<{ signature: string; predictionPda: PublicKey }> {
    const [agentCounterPda] = getAgentCounterPda(params.agentId);

    try {
      // Fetch current counter to derive prediction PDA
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const counterAccount = await (this.program.account as any).agentCounter.fetch(
        agentCounterPda
      );
      const count = counterAccount.count as BN;
      const [predictionPda] = getPredictionPda(params.agentId, count);

      const tx = await this.program.methods
        .recordPrediction(
          params.agentId,
          params.token,
          params.direction,
          params.confidence,
          params.entryPrice,
          new BN(params.timeHorizon)
        )
        .accounts({
          prediction: predictionPda,
          agentCounter: agentCounterPda,
          authority: this.signer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log(
        `Prediction recorded for agent ${params.agentId}. Tx: ${tx}`
      );
      return { signature: tx, predictionPda };
    } catch (err) {
      console.error("Failed to record prediction:", err);
      throw err;
    }
  }

  /**
   * Resolve a prediction (server-side).
   */
  async resolvePrediction(
    predictionPda: PublicKey,
    outcomePrice: BN
  ): Promise<string> {
    try {
      const tx = await this.program.methods
        .resolvePrediction(outcomePrice)
        .accounts({
          prediction: predictionPda,
          authority: this.signer.publicKey,
        })
        .rpc();

      console.log(`Prediction resolved. Tx: ${tx}`);
      return tx;
    } catch (err) {
      console.error("Failed to resolve prediction:", err);
      throw err;
    }
  }

  /**
   * Fetch an agent counter.
   */
  async getAgentCounter(agentId: string): Promise<unknown> {
    const [agentCounterPda] = getAgentCounterPda(agentId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.program.account as any).agentCounter.fetch(agentCounterPda);
  }

  /**
   * Fetch a prediction account.
   */
  async getPrediction(predictionPda: PublicKey): Promise<unknown> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.program.account as any).prediction.fetch(predictionPda);
  }

  /**
   * Fetch all predictions for an agent.
   */
  async getAgentPredictions(agentId: string): Promise<unknown[]> {
    const counterAccount = await this.getAgentCounter(agentId);
    const count = (counterAccount as { count: BN }).count;

    const predictions: unknown[] = [];
    for (let i = 0; i < count.toNumber(); i++) {
      const [predictionPda] = getPredictionPda(agentId, new BN(i));
      try {
        const prediction = await this.getPrediction(predictionPda);
        predictions.push(prediction);
      } catch {
        console.warn(`Failed to fetch prediction ${i} for agent ${agentId}`);
      }
    }

    return predictions;
  }
}
