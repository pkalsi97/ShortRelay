import { SQSEvent, SQSBatchResponse, SQSBatchItemFailure, S3Event } from 'aws-lambda';

import { MetadataPath, Progress, ProcessingStage, MetadataService } from '../services/data/metadata-service';
import { ObjectServiceConfig, ObjectService } from '../services/data/object-service';
import { DbConfig } from '../types/db.types';
import { exceptionHandlerFunction } from '../utils/error-handling';
import { KeyOwner, KeyService } from '../utils/key-service';

// Initialize
const dbConfig: DbConfig = {
    table: process.env.METADATASTORAGE_TABLE_NAME!,
    region: process.env.AWS_DEFAULT_REGION!,
};

const objectConfig: ObjectServiceConfig = {
    region: process.env.AWS_DEFAULT_REGION!,
    bucket: process.env.CONTENTSTORAGE_BUCKET_NAME!,
};

ObjectService.initialize(objectConfig);
MetadataService.initialize(dbConfig);
interface AssetUrls {
    streaming: {
        hls: string;
        iframe: string;
        audio: string;
    };
    downloads: {
        high: string;
        medium: string;
        low: string;
        mobile: string;
        audio: string;
    };
    thumbnail: string;
}

function generateAssetUrls(userId: string, assetId: string): AssetUrls {
    const CLOUDFRONT_DOMAIN = process.env.CDN_DOMAIN;
    const basePath = `${userId}/${assetId}`;

    return {
        streaming: {
            hls: `https://${CLOUDFRONT_DOMAIN}/${basePath}/hls/master.m3u8`,
            iframe: `https://${CLOUDFRONT_DOMAIN}/${basePath}/hls/master_iframe.m3u8`,
            audio: `https://${CLOUDFRONT_DOMAIN}/${basePath}/hls/audio/stream.m3u8`,
        },
        downloads: {
            high: `https://${CLOUDFRONT_DOMAIN}/${basePath}/mp4/1080p.mp4`,
            medium: `https://${CLOUDFRONT_DOMAIN}/${basePath}/mp4/720p.mp4`,
            low: `https://${CLOUDFRONT_DOMAIN}/${basePath}/mp4/480p.mp4`,
            mobile: `https://${CLOUDFRONT_DOMAIN}/${basePath}/mp4/360p.mp4`,
            audio: `https://${CLOUDFRONT_DOMAIN}/${basePath}/mp4/audio.m4a`,
        },
        thumbnail: `https://${CLOUDFRONT_DOMAIN}/${basePath}/assets/thumbnail.png`,
    };
}

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
                        const userId = owner.userId;

                        const assetId: string = owner.assetId;
                        const postProcessingValidationStart = new Date().toISOString();
                        try {
                            const dbCount:number = parseInt( await MetadataService.getFileCount(owner), 10 );
                            const s3Count:number = await ObjectService.getFileCount(`${userId}/${assetId}`)-1;

                            if (dbCount == s3Count ){
                                await MetadataService.updateProgress(
                                    owner,
                                    ProcessingStage.PostProcessingValidation,
                                    ProcessingStage.Completion,
                                    {
                                        status: Progress.COMPLETED,
                                        startTime: postProcessingValidationStart,
                                        error: 'N.A',
                                    },
                                );

                                const completionStart = new Date().toISOString();
                                const assetUrls = generateAssetUrls(userId, assetId);
                                const result = await MetadataService.updateMetadata(
                                    owner,
                                    MetadataPath.DISTRIBUTION,
                                    assetUrls,
                                );
                                if (result) {
                                    await MetadataService.updateProgress(
                                        owner,
                                        ProcessingStage.Completion,
                                        ProcessingStage.Finished,
                                        {
                                            status: Progress.COMPLETED,
                                            startTime: completionStart,
                                            error: 'N.A',
                                        },
                                    );
                                } else {
                                    await MetadataService.updateProgress(
                                        owner,
                                        ProcessingStage.Completion,
                                        ProcessingStage.Finished,
                                        {
                                            status: Progress.HOLD,
                                            startTime: completionStart,
                                            error: 'N.A',
                                        },
                                    );
                                }
                            } else {
                                await MetadataService.updateProgress(
                                    owner,
                                    ProcessingStage.PostProcessingValidation,
                                    ProcessingStage.Completion,
                                    {
                                        status: Progress.HOLD,
                                        startTime: postProcessingValidationStart,
                                        error: 'Count Match Issue',
                                    },
                                );
                                await MetadataService.markCriticalFailure(owner, true);
                            }
                        } catch (error){
                            const errorResponse =exceptionHandlerFunction(error);
                            await MetadataService.updateProgress(
                                owner,
                                ProcessingStage.PostProcessingValidation,
                                ProcessingStage.Completion,
                                {
                                    status: Progress.FAILED,
                                    startTime: postProcessingValidationStart,
                                    error: errorResponse.message,
                                },
                            );
                            await MetadataService.markCriticalFailure(owner, true);
                        }
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
