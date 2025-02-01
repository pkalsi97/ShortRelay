import { SQSEvent, SQSBatchResponse, SQSBatchItemFailure } from 'aws-lambda';

import { Progress, ProcessingStage, MetadataService } from '../services/data/metadata-service';
import { EcsConfig, WorkerService } from '../services/workers-service';
import { DbConfig } from '../types/db.types';
import { Task } from '../types/task.type';
import { exceptionHandlerFunction } from '../utils/error-handling';
import { KeyOwner } from '../utils/key-service';

// init
const dbConfig: DbConfig = {
    table: process.env.METADATASTORAGE_TABLE_NAME!,
    region: process.env.AWS_DEFAULT_REGION!,
};

const ecsConfig:  EcsConfig = {
    region: process.env.AWS_DEFAULT_REGION!,
    cluster: process.env.ECS_CLUSTER!,
    taskDefinition: process.env.PROCESSOR_TASK_DEFINITION!,
    subnets: process.env.SUBNET_IDS!.split(','),
    securityGroups: [process.env.SECURITY_GROUP_ID!],
    taskLimit: parseInt(process.env.FARGATE_TASK_LIMIT!, 10 ),
};

MetadataService.initialize(dbConfig);
WorkerService.initialize(ecsConfig);

export const taskHandler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
    const batchItemFailures: SQSBatchItemFailure[] = [];
    for (const record of event.Records) {
        const task: Task = JSON.parse(record.body);
        const owner: KeyOwner = { userId: task.userId, assetId: task.assetId };
        try {
            const canJobBeAssignedResult = await WorkerService.canJobBeAssigned();

            if (canJobBeAssignedResult){
                const assignJobResult = await WorkerService.assignJob(task);
                if (assignJobResult){
                    await MetadataService.updateProgressField(owner, ProcessingStage.Accepted, 'status', Progress.COMPLETED);
                    await MetadataService.updateProgressField(owner, ProcessingStage.Accepted, 'endTime', new Date().toISOString());
                } else {
                    await MetadataService.updateProgressField(owner, ProcessingStage.Accepted, 'status', Progress.HOLD);
                }
            } else {
                await MetadataService.updateProgressField(owner, ProcessingStage.Accepted, 'status', Progress.HOLD);
            }

        } catch (error) {
            const errorResponse = exceptionHandlerFunction(error);
            batchItemFailures.push({
                itemIdentifier: record.messageId,
            });
            await MetadataService.updateProgressField(owner, ProcessingStage.Accepted, 'status', Progress.HOLD);
            await MetadataService.updateProgressField(owner, ProcessingStage.Accepted, 'error', errorResponse.message);
        }
    }
    return { batchItemFailures };
};

// use updatedAt
// need to ensure if task is not assigned its dealt well.
