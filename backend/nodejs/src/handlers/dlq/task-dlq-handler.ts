import { SQSEvent, SQSBatchResponse, SQSBatchItemFailure } from 'aws-lambda';

import { Progress, ProcessingStage, MetadataService } from '../../services/data/metadata-service';
import { DbConfig } from '../../types/db.types';
import { Task } from '../../types/task.type';
import { exceptionHandlerFunction } from '../../utils/error-handling';
import { KeyOwner } from '../../utils/key-service';

// init
const dbConfig: DbConfig = {
    table: process.env.METADATASTORAGE_TABLE_NAME!,
    region: process.env.AWS_DEFAULT_REGION!,
};

MetadataService.initialize(dbConfig);

export const taskDLQHandler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
    const batchItemFailures: SQSBatchItemFailure[] = [];
    for (const record of event.Records) {
        const task: Task = JSON.parse(record.body);
        const owner: KeyOwner = { userId: task.userId, assetId: task.assetId };
        try {
            await MetadataService.updateProgressField(owner, ProcessingStage.Accepted, 'status', Progress.FAILED);
            await MetadataService.updateProgressField(owner, ProcessingStage.Accepted, 'error', 'Unable to Assign Processing Job, Please Try Again!');
            await MetadataService.markCriticalFailure(owner, true);

        } catch (error) {
            exceptionHandlerFunction(error);
        }
    }
    return { batchItemFailures };
};

