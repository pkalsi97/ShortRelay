import { AttributeValue } from '@aws-sdk/client-dynamodb';

export interface AssetProgress {
    M: Record<string, AttributeValue>;
}
export interface StageProgressUpdate {
    status: string;
    startTime: string;
    error: string;
}

export interface AssetRecord extends Record<string, AttributeValue> {
    userId: { S: string };
    assetId: { S: string};
    createdAt: { S: string};
    progress: AssetProgress;
}

export const createInitialRecord = (userId: string, assetId: string): AssetRecord => ({
    userId: { S: userId },
    assetId: { S: assetId },
    createdAt: { S: new Date().toISOString() },
    updatedAt: { S: new Date().toISOString() },
    stage: { S: 'N.A' },
    totalFiles: { N: '0' },
    hasCriticalFailure: { BOOL: false },
    metadata: {
        M: {
            validation: {
                M: {
                    basic: { M: {} },
                    stream: { M: {} },
                },
            },
            technical: { M: {} },
            quality: { M: {} },
        },
    },
    progress: {
        M: {
            upload: {
                M: { },
            },
            validation: {
                M: { },
            },
            metadata: {
                M: { },
            },
            accepted: {
                M: { },
            },
            download: {
                M: { },
            },
            writeToStorage: {
                M: { },
            },
            initializeProcessor: {
                M: { },
            },
            generateThumbnail: {
                M: { },
            },
            generateMP4Files: {
                M: { },
            },
            generateHLSPlaylists: {
                M: { },
            },
            generateIframePlaylists: {
                M: { },
            },
            uploadTranscodedFootage: {
                M: { },
            },
            postProcessingValidation: {
                M: { },
            },
            completion: {
                M: { },
            },
            distribution: {
                M: { },
            },
        },
    },
});
