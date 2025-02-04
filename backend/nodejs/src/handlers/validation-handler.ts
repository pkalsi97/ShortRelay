import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { SQSEvent, SQSBatchResponse, SQSBatchItemFailure } from 'aws-lambda';
import ffmpeg from 'fluent-ffmpeg';

import { MetadataExtractor } from '../services/content/content-metadata-service';
import { ContentValidator } from '../services/content/content-validation-service';
import { Progress, MetadataPath, ProcessingStage, MetadataService } from '../services/data/metadata-service';
import { ObjectServiceConfig, ObjectService } from '../services/data/object-service';
import { DbConfig } from '../types/db.types';
import { TaskType, WorkerType, Task } from '../types/task.type';
import { CustomError, Fault, ErrorName, exceptionHandlerFunction } from '../utils/error-handling';
import { FileManager } from '../utils/file-manager';
import { KeyOwner, KeyService } from '../utils/key-service';
import { TaskService } from '../utils/task-creator';

// Initialize
if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
    ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH || '/opt/ffmpeg/ffmpeg');
    ffmpeg.setFfprobePath(process.env.FFPROBE_PATH || '/opt/ffprobe/ffprobe');
}

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

                const validationStart = new Date().toISOString();
                const footage = await ObjectService.getObject(key);
                const filePath = await FileManager.writeFile('/tmp', footage);

                const contentValidationResult = await ContentValidator.validateContent(filePath);
                await MetadataService.updateMetadata(
                    owner,
                    MetadataPath.BASIC,
                    contentValidationResult.basic,
                );
                await MetadataService.updateMetadata(
                    owner,
                    MetadataPath.STREAM,
                    contentValidationResult.stream,
                );

                await MetadataService.updateProgress(
                    owner,
                    ProcessingStage.Validation,
                    ProcessingStage.Metadata,
                    {
                        status: Progress.COMPLETED,
                        startTime: validationStart,
                        error: 'N.A',
                    },
                );

                if ( contentValidationResult.success ){
                    const metadataStart = new Date().toISOString();
                    const contentMetadataResult = await MetadataExtractor.getContentMetadata(filePath);
                    await MetadataService.updateMetadata(
                        owner,
                        MetadataPath.TECHNICAL,
                        contentMetadataResult.technical,
                    );

                    await MetadataService.updateMetadata(
                        owner,
                        MetadataPath.QUALITY,
                        contentMetadataResult.quality,
                    );

                    await MetadataService.updateProgress(
                        owner,
                        ProcessingStage.Metadata,
                        ProcessingStage.Accepted,
                        {
                            status: Progress.COMPLETED,
                            startTime: metadataStart,
                            error: 'N.A',
                        },
                    );

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
                        await MetadataService.markCriticalFailure(owner, true);
                        throw new CustomError(
                            ErrorName.InternalError,
                            'Unable to send message to Task Queue',
                            503,
                            Fault.SERVER,
                            true,
                        );
                    }
                    await MetadataService.updateProgressField(owner, ProcessingStage.Accepted, 'startTime', new Date().toISOString());
                    await MetadataService.updateProgressField(owner, ProcessingStage.Accepted, 'status', Progress.PENDING);

                } else {
                    await MetadataService.updateProgress(
                        owner,
                        ProcessingStage.Accepted,
                        ProcessingStage.Download,
                        {
                            status: Progress.FAILED,
                            startTime: new Date().toISOString(),
                            error: `Error: ${contentValidationResult.error}`,
                        },
                    );
                    await MetadataService.markCriticalFailure(owner, true);
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

