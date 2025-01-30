
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { SQSEvent, SQSBatchResponse, SQSBatchItemFailure } from 'aws-lambda';

import { MetadataExtractor } from '../services/content/content-metadata-service';
import { ContentValidator } from '../services/content/content-validation-service';
import { MetadataPath, ProcessingStage, MetadataService } from '../services/data/metadata-service';
import { ObjectServiceConfig, ObjectService } from '../services/data/object-service';
import { DbConfig } from '../types/db.types';
import { TaskType, WorkerType, Task } from '../types/task.type';
import { CustomError, Fault, ErrorName, exceptionHandlerFunction } from '../utils/error-handling';
import { FileManager } from '../utils/file-manager';
import { KeyOwner, KeyService } from '../utils/key-service';
import { TaskService } from '../utils/task-creator';

// Initialize

const dbConfig: DbConfig = {
    table: process.env.METADATASTORAGE_TABLE_NAME!,
    region: process.env.AWS_DEFAULT_REGION!,
};

const objectConfig: ObjectServiceConfig = {
    region: process.env.AWS_DEFAULT_REGION!,
    bucket: process.env.TRANSPORTSTORAGE_BUCKET_NAME!,
};

ObjectService.initialize(objectConfig);
MetadataService.initialize(dbConfig);
const sqs = new SQSClient({
    region: process.env.AWS_DEFAULT_REGION!,
});

export const validationHandler = async(messages:SQSEvent):Promise<SQSBatchResponse> => {
    const batchItemFailures: SQSBatchItemFailure[] = [];
    await Promise.all(
        messages.Records.map(async (sqsRecord) => {
            try {
                const task = JSON.parse(sqsRecord.body) as Task;
                const key:string = task.inputKey;

                const owner: KeyOwner = KeyService.getOwner(key);
                const userId: string = owner.userId;
                const assetId: string = owner.assetId;

                const footage = await ObjectService.getObject(key);
                const filePath = await FileManager.writeFile('/tmp', footage);

                const contentValidationResult = await ContentValidator.validateContent(filePath);
                await MetadataService.updateMetadata(
                    userId,
                    assetId,
                    MetadataPath.BASIC,
                    contentValidationResult.basic,
                );
                await MetadataService.updateMetadata(
                    userId,
                    assetId,
                    MetadataPath.STREAM,
                    contentValidationResult.stream,
                );

                await MetadataService.updateProgress(userId, assetId, ProcessingStage.VALIDATION, true);

                if ( contentValidationResult.success ){

                    const contentMetadataResult = await MetadataExtractor.getContentMetadata(filePath);

                    await MetadataService.updateMetadata(
                        userId,
                        assetId,
                        MetadataPath.TECHNICAL,
                        contentMetadataResult.technical,
                    );

                    await MetadataService.updateMetadata(
                        userId,
                        assetId,
                        MetadataPath.QUALITY,
                        contentMetadataResult.quality,
                    );

                    await MetadataService.updateProgress(userId, assetId, ProcessingStage.METADATA, true);
                    await MetadataService.updateProgress(userId, assetId, ProcessingStage.ACCEPTED, true);

                    const task:Task = TaskService.createTask(
                        userId,
                        assetId,
                        TaskType.TRANSCODE,
                        key,
                        key,
                        WorkerType.PROCESSOR,
                    );

                    const command = new SendMessageCommand({
                        QueueUrl: process.env.TASKQUEUE_QUEUE_URL!,
                        MessageBody: JSON.stringify(task),
                    });

                    const response = await sqs.send(command);
                    if (response.$metadata.httpStatusCode!==200){
                        await MetadataService.markCriticalFailure(userId, assetId, true);
                        throw new CustomError(
                            ErrorName.InternalError,
                            'Unable to send message to Task Queue',
                            503,
                            Fault.SERVER,
                            true,
                        );
                    }

                } else {
                    await MetadataService.updateProgress(userId, assetId, ProcessingStage.REJECTED, true);
                }
            } catch (error){
                exceptionHandlerFunction(error);
                batchItemFailures.push({
                    itemIdentifier: sqsRecord.messageId,
                });
            } finally {
                await FileManager.cleanUpTmp();
            }
        }),
    );

    return { batchItemFailures };
};

