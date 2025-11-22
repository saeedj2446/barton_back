import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { AccountUserActivityService } from './account-user-activity.service';

export interface ActivityBatchJob {
    activities: any[];
    batchId: string;
    timestamp: Date;
}

export interface PatternAnalysisJob {
    accountUserId: string;
    timeframe: string;
}

@Injectable()
@Processor('activity-queue')
export class AccountUserActivityProcessor {
    private readonly logger = new Logger(AccountUserActivityProcessor.name);

    constructor(
        private readonly activityService: AccountUserActivityService,
    ) {}

    @Process('process-activity-batch')
    async processActivityBatch(job: Job<ActivityBatchJob>) {
        const { activities, batchId } = job.data;

        this.logger.log(`Processing activity batch ${batchId} with ${activities.length} activities`);

        try {
            // ✅ استفاده از trackBatchActivities به جای processBatchActivities
            const results = await this.activityService.trackBatchActivities({
                activities: activities
            });

            this.logger.log(`Successfully processed batch ${batchId}`);
            return {
                success: true,
                batchId,
                processedCount: results.activities?.length || 0,
                timestamp: new Date()
            };

        } catch (error) {
            this.logger.error(`Failed to process batch ${batchId}:`, error);
            throw error;
        }
    }

    @Process('analyze-user-patterns')
    async analyzeUserPatterns(job: Job<PatternAnalysisJob>) {
        const { accountUserId, timeframe } = job.data;

        this.logger.log(`Analyzing patterns for user ${accountUserId} over ${timeframe}`);

        try {
            const patterns = await this.activityService.getUserActivityPatterns(accountUserId);

            this.logger.log(`Successfully analyzed patterns for user ${accountUserId}`);
            return {
                success: true,
                accountUserId,
                patterns,
                analyzedAt: new Date()
            };

        } catch (error) {
            this.logger.error(`Failed to analyze patterns for user ${accountUserId}:`, error);
            throw error;
        }
    }

    @Process('cleanup-old-activities')
    async cleanupOldActivities(job: Job<{ olderThanDays: number }>) {
        const { olderThanDays } = job.data;

        this.logger.log(`Cleaning up activities older than ${olderThanDays} days`);

        try {
            const result = await this.activityService.cleanupOldActivities(olderThanDays);

            this.logger.log(`Cleanup completed: ${result.deletedCount} activities deleted`);
            return {
                success: true,
                deletedCount: result.deletedCount,
                cleanedAt: new Date()
            };

        } catch (error) {
            this.logger.error('Failed to cleanup old activities:', error);
            throw error;
        }
    }
}