import { SQSEvent, SQSBatchResponse, SQSBatchItemFailure, S3Event } from 'aws-lambda';

import { Progress, ProcessingStage, MetadataService } from '../../services/data/metadata-service';
import { DbConfig } from '../../types/db.types';
import { exceptionHandlerFunction } from '../../utils/error-handling';
import { KeyOwner, KeyService } from '../../utils/key-service';

// Initialize
const dbConfig: DbConfig = {
    table: process.env.METADATASTORAGE_TABLE_NAME!,
    region: process.env.AWS_DEFAULT_REGION!,
};

MetadataService.initialize(dbConfig);

export const completionHandler = async(messages:SQSEvent):Promise<SQSBatchResponse> => {
    const batchItemFailures: SQSBatchItemFailure[] = [];
    await Promise.all(
        messages.Records.map(async (sqsRecord) => {
            try {
                const s3Events = JSON.parse(sqsRecord.body) as S3Event;
                await Promise.all(
                    s3Events.Records.map(async (s3Event) => {
                        const key:string = s3Event.s3.object.key;
                        const owner: KeyOwner = KeyService.getOwner(key);

                        await MetadataService.updateProgressField(owner, ProcessingStage.Completion, 'status', Progress.FAILED);
                        await MetadataService.updateProgressField(owner, ProcessingStage.Completion, 'error', 'Completion Failed, We are sorry!');
                        await MetadataService.markCriticalFailure(owner, true);
                    }),
                );
            } catch (error){
                exceptionHandlerFunction(error);
            }
        }),
    );

    return { batchItemFailures };
};

// Pending -> Where to send Failed s3 events, how can they be managed ?
