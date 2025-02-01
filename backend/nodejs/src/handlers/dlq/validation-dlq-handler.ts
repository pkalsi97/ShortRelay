import { SQSEvent, SQSBatchResponse, SQSBatchItemFailure } from 'aws-lambda';

import { Progress, ProcessingStage, MetadataService } from '../../services/data/metadata-service';
import { DbConfig } from '../../types/db.types';
import { Task } from '../../types/task.type';
import { exceptionHandlerFunction } from '../../utils/error-handling';
import { KeyOwner, KeyService } from '../../utils/key-service';

// Initialize
const dbConfig: DbConfig = {
    table: process.env.METADATASTORAGE_TABLE_NAME!,
    region: process.env.AWS_DEFAULT_REGION!,
};

MetadataService.initialize(dbConfig);

export const validationDLQHandler = async(messages:SQSEvent):Promise<SQSBatchResponse> => {
    const batchItemFailures: SQSBatchItemFailure[] = [];
    await Promise.all(
        messages.Records.map(async (sqsRecord) => {
            try {
                const task = JSON.parse(sqsRecord.body) as Task;
                const key:string = task.inputKey;

                const owner: KeyOwner = KeyService.getOwner(key);

                await MetadataService.updateProgress(
                    owner,
                    ProcessingStage.Accepted,
                    ProcessingStage.Download,
                    {
                        status: Progress.FAILED,
                        startTime: new Date().toISOString(),
                        error: 'Validation Failed, Because of Unknown Reasons Try Again',
                    },
                );
                await MetadataService.markCriticalFailure(owner, true);
            } catch (error){
                exceptionHandlerFunction(error);
            }
        }),
    );

    return { batchItemFailures };
};

