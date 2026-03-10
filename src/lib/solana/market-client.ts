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
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { getConnection } from "./connection";
import { getSignerKeypair } from "./prediction-recorder";
import marketIdlJson from "./idl/laplace-market.json";

// ---------- Types ----------

interface ContestParams {
  contestId: string;
  periodType: number;
  startsAt: number;
  endsAt: number;
  paymentMint: PublicKey;
}

interface PositionParams {
  contestId: string;
  positionType: number;
  agentSelections: [PublicKey, PublicKey, PublicKey];
  amount: BN;
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

function getMarketProgramId(): PublicKey {
  const id = process.env.NEXT_PUBLIC_MARKET_PROGRAM_ID;
  if (!id) {
    throw new Error("NEXT_PUBLIC_MARKET_PROGRAM_ID not set");
  }
  return new PublicKey(id);
}

function getMarketProgram(signer: Keypair): Program {
  const connection = getConnection();
  const wallet = new NodeWallet(signer);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  const idl = marketIdlJson as unknown as Idl;
  return new Program(idl, provider);
}

// ---------- PDA Helpers ----------

function getContestPda(contestId: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("contest"), Buffer.from(contestId)],
    getMarketProgramId()
  );
}

function getPositionPda(
  predictor: PublicKey,
  contestId: string
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("position"), predictor.toBuffer(), Buffer.from(contestId)],
    getMarketProgramId()
  );
}

// ---------- MarketClient ----------

export class MarketClient {
  private signer: Keypair;
  private program: Program;

  constructor() {
    this.signer = getSignerKeypair();
    this.program = getMarketProgram(this.signer);
  }

  /**
   * Create a new contest (server-side, uses SOLANA_SIGNER_PRIVATE_KEY).
   */
  async createContest(params: ContestParams): Promise<string> {
    const [contestPda] = getContestPda(params.contestId);

    try {
      const tx = await this.program.methods
        .createContest(
          params.contestId,
          params.periodType,
          new BN(params.startsAt),
          new BN(params.endsAt)
        )
        .accounts({
          contest: contestPda,
          paymentMint: params.paymentMint,
          authority: this.signer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log(
        `Contest ${params.contestId} created on-chain. Tx: ${tx}`
      );
      return tx;
    } catch (err) {
      console.error("Failed to create contest:", err);
      throw err;
    }
  }

  /**
   * Place a position (client-side: returns unsigned transaction for user to sign).
   */
  async placePositionTx(
    params: PositionParams,
    userWallet: PublicKey,
    userTokenAccount: PublicKey,
    vault: PublicKey
  ): Promise<Transaction> {
    const [contestPda] = getContestPda(params.contestId);
    const [positionPda] = getPositionPda(userWallet, params.contestId);

    const tx = await this.program.methods
      .placePosition(
        params.contestId,
        params.positionType,
        params.agentSelections,
        params.amount
      )
      .accounts({
        contest: contestPda,
        position: positionPda,
        predictorTokenAccount: userTokenAccount,
        vault,
        predictor: userWallet,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .transaction();

    return tx;
  }

  /**
   * Resolve a contest (server-side).
   */
  async resolveContest(
    contestId: string,
    winners: [PublicKey, PublicKey, PublicKey]
  ): Promise<string> {
    const [contestPda] = getContestPda(contestId);

    try {
      const tx = await this.program.methods
        .resolveContest(winners)
        .accounts({
          contest: contestPda,
          authority: this.signer.publicKey,
        })
        .rpc();

      console.log(`Contest ${contestId} resolved on-chain. Tx: ${tx}`);
      return tx;
    } catch (err) {
      console.error("Failed to resolve contest:", err);
      throw err;
    }
  }

  /**
   * Claim winnings (client-side: returns unsigned transaction).
   */
  async claimWinningsTx(
    contestId: string,
    userWallet: PublicKey
  ): Promise<Transaction> {
    const [contestPda] = getContestPda(contestId);
    const [positionPda] = getPositionPda(userWallet, contestId);

    const tx = await this.program.methods
      .claimWinnings()
      .accounts({
        position: positionPda,
        contest: contestPda,
        predictor: userWallet,
      })
      .transaction();

    return tx;
  }

  /**
   * Fetch a contest account.
   */
  async getContest(contestId: string): Promise<unknown> {
    const [contestPda] = getContestPda(contestId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.program.account as any).contest.fetch(contestPda);
  }

  /**
   * Fetch a position account.
   */
  async getPosition(
    predictor: PublicKey,
    contestId: string
  ): Promise<unknown> {
    const [positionPda] = getPositionPda(predictor, contestId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.program.account as any).position.fetch(positionPda);
  }
}
