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
    const taskLimit = parseInt(process.env.FARGATE_TASK_LIMIT!, 10);
    
    const tasks = event.Records.map(record => ({
        task: JSON.parse(record.body) as Task,
        messageId: record.messageId
    }));

    for (let i = 0; i < tasks.length; i += taskLimit) {
        const taskBatch = tasks.slice(i, i + taskLimit);
        const batchTasks = taskBatch.map(t => t.task);
        
        try {
            const canJobBeAssignedResult = await WorkerService.canJobBeAssigned();

            if (canJobBeAssignedResult) {
                const assignJobResult = await WorkerService.assignJob(batchTasks);
                
                if (assignJobResult) {
                    await Promise.all(taskBatch.map(async ({ task }) => {
                        const owner: KeyOwner = { userId: task.userId, assetId: task.assetId };
                        return Promise.all([
                            MetadataService.updateProgressField(owner, ProcessingStage.Accepted, 'status', Progress.COMPLETED),
                            MetadataService.updateProgressField(owner, ProcessingStage.Accepted, 'endTime', new Date().toISOString())
                        ]);
                    }));
                } else {
                    await Promise.all(taskBatch.map(async ({ task, messageId }) => {
                        const owner: KeyOwner = { userId: task.userId, assetId: task.assetId };
                        batchItemFailures.push({ itemIdentifier: messageId });
                        return MetadataService.updateProgressField(owner, ProcessingStage.Accepted, 'status', Progress.HOLD);
                    }));
                }
            } else {
                await Promise.all(taskBatch.map(async ({ task, messageId }) => {
                    const owner: KeyOwner = { userId: task.userId, assetId: task.assetId };
                    batchItemFailures.push({ itemIdentifier: messageId });
                    return MetadataService.updateProgressField(owner, ProcessingStage.Accepted, 'status', Progress.HOLD);
                }));
            }
        } catch (error) {
            const errorResponse = exceptionHandlerFunction(error);
            await Promise.all(taskBatch.map(async ({ task, messageId }) => {
                const owner: KeyOwner = { userId: task.userId, assetId: task.assetId };
                batchItemFailures.push({ itemIdentifier: messageId });
                return Promise.all([
                    MetadataService.updateProgressField(owner, ProcessingStage.Accepted, 'status', Progress.HOLD),
                    MetadataService.updateProgressField(owner, ProcessingStage.Accepted, 'error', errorResponse.message)
                ]);
            }));
        }
    }

    return { batchItemFailures };
};