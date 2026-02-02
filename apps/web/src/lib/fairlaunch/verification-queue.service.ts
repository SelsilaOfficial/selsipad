/**
 * Verification Queue Service
 * 
 * Simple in-memory queue for contract verification jobs
 * For production, replace with BullMQ + Redis for persistence and scalability
 */

import { createClient } from '@supabase/supabase-js';
import { BSCScanVerifierService, VerificationStatus } from './bscscan-verifier.service';
import type { FairlaunchConstructorArgs } from './params-builder';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface VerificationJob {
  id: string;
  contractAddress: string;
  launchRoundId: string;
  chainId: number;
  constructorArgs: FairlaunchConstructorArgs;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  maxAttempts: number;
  error?: string;
  guid?: string;
  createdAt: Date;
  updatedAt: Date;
}

class VerificationQueueService {
  private queue: Map<string, VerificationJob> = new Map();
  private processing: boolean = false;
  private readonly MAX_ATTEMPTS = 3;
  private readonly RETRY_DELAY_MS = 60000; // 1 minute

  /**
   * Add verification job to queue
   */
  async addJob(
    contractAddress: string,
    launchRoundId: string,
    chainId: number,
    constructorArgs: FairlaunchConstructorArgs
  ): Promise<string> {
    const jobId = `${contractAddress}-${Date.now()}`;

    const job: VerificationJob = {
      id: jobId,
      contractAddress,
      launchRoundId,
      chainId,
      constructorArgs,
      status: 'pending',
      attempts: 0,
      maxAttempts: this.MAX_ATTEMPTS,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.queue.set(jobId, job);

    console.log(`[VerificationQueue] Job added: ${jobId}`);
    console.log(`[VerificationQueue] Queue size: ${this.queue.size}`);

    // Start processing if not already running
    if (!this.processing) {
      this.processQueue();
    }

    return jobId;
  }

  /**
   * Process verification queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;

    this.processing = true;
    console.log('[VerificationQueue] Starting queue processor...');

    while (this.queue.size > 0) {
      // Get next pending job
      const job = this.getNextPendingJob();
      if (!job) {
        console.log('[VerificationQueue] No pending jobs');
        break;
      }

      console.log(`[VerificationQueue] Processing job: ${job.id}`);
      await this.processJob(job);

      // Small delay between jobs to avoid API rate limits
      await this.delay(2000);
    }

    this.processing = false;
    console.log('[VerificationQueue] Queue processor stopped');
  }

  /**
   * Process single verification job
   */
  private async processJob(job: VerificationJob): Promise<void> {
    try {
      job.status = 'processing';
      job.attempts++;
      job.updatedAt = new Date();

      console.log(`[VerificationQueue] Attempt ${job.attempts}/${job.maxAttempts}`);

      // Create verifier service
      const verifier = new BSCScanVerifierService(job.chainId);

      // Check if already verified
      const isVerified = await verifier.isVerified(job.contractAddress);
      if (isVerified) {
        console.log('[VerificationQueue] Contract already verified!');
        await this.markJobCompleted(job, 'Already verified');
        return;
      }

      // Submit verification
      const result = await verifier.verifyContract(job.contractAddress, job.constructorArgs);

      if (result.status === VerificationStatus.SUCCESS || 
          result.status === VerificationStatus.ALREADY_VERIFIED) {
        // Success!
        await this.markJobCompleted(job, result.message);
      } else if (job.attempts >= job.maxAttempts) {
        // Failed after max attempts
        await this.markJobFailed(job, result.error || 'Max attempts reached');
      } else {
        // Retry later
        console.log(`[VerificationQueue] Job will retry in ${this.RETRY_DELAY_MS}ms`);
        job.status = 'pending';
        job.error = result.error;
        job.guid = result.guid;
      }
    } catch (error: any) {
      console.error('[VerificationQueue] Job processing error:', error);

      if (job.attempts >= job.maxAttempts) {
        await this.markJobFailed(job, error.message);
      } else {
        job.status = 'pending';
        job.error = error.message;
      }
    }
  }

  private async markJobCompleted(job: VerificationJob, message?: string): Promise<void> {
    try {
      job.status = 'completed';
      job.updatedAt = new Date();

      console.log(`[VerificationQueue] ✅ Job completed: ${job.id}`);

      // Update database - get current params and update
      const { data: round, error: fetchError } = await supabase
        .from('launch_rounds')
        .select('params')
        .eq('id', job.launchRoundId)
        .single();

      if (fetchError) {
        console.error('[VerificationQueue] Database fetch error:', fetchError);
        this.queue.delete(job.id);
        return;
      }

      const updatedParams = {
        ...(round.params || {}),
        verified: true,
        verified_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('launch_rounds')
        .update({ params: updatedParams })
        .eq('id', job.launchRoundId);

      if (error) {
        console.error('[VerificationQueue] Database update error:', error);
      } else {
        console.log(`[VerificationQueue] Database updated for launch round: ${job.launchRoundId}`);
      }

      // Remove from queue
      this.queue.delete(job.id);
    } catch (error) {
      console.error('[VerificationQueue] Error marking job completed:', error);
    }
  }

  /**
   * Mark job as failed
   */
  private async markJobFailed(job: VerificationJob, error: string): Promise<void> {
    job.status = 'failed';
    job.error = error;
    job.updatedAt = new Date();

    console.log(`[VerificationQueue] ❌ Job failed: ${job.id}`);
    console.log(`[VerificationQueue] Error: ${error}`);

    // Log failure but don't block launch
    // Contract still works, just not verified

    // Remove from queue
    this.queue.delete(job.id);
  }

  /**
   * Get next pending job
   */
  private getNextPendingJob(): VerificationJob | undefined {
    for (const job of this.queue.values()) {
      if (job.status === 'pending') {
        return job;
      }
    }
    return undefined;
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): VerificationJob | undefined {
    return this.queue.get(jobId);
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.queue.size;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const verificationQueue = new VerificationQueueService();
