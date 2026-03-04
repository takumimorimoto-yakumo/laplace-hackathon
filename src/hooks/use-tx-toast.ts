import type { Connection, Transaction, VersionedTransaction } from "@solana/web3.js";
import { toast } from "sonner";

interface SendWithToastOptions {
  sendTransaction: (
    tx: Transaction | VersionedTransaction,
    connection: Connection
  ) => Promise<string>;
  transaction: Transaction | VersionedTransaction;
  connection: Connection;
  labels: {
    loading: string;
    success: string;
    error: string;
  };
}

/**
 * Wraps sendTransaction with sonner toast notifications.
 * Shows loading → success/error toast.
 * Returns the signature on success, null on failure.
 */
export async function sendWithToast({
  sendTransaction,
  transaction,
  connection,
  labels,
}: SendWithToastOptions): Promise<string | null> {
  const toastId = toast.loading(labels.loading);

  try {
    const signature = await sendTransaction(transaction, connection);
    toast.success(labels.success, { id: toastId });
    return signature;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : String(err);
    toast.error(labels.error, {
      id: toastId,
      description: message,
    });
    return null;
  }
}
