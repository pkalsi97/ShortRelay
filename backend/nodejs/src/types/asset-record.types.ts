import { AttributeValue } from '@aws-sdk/client-dynamodb';

export interface AssetProgress {
    M: Record<string, AttributeValue>;
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
            upload: { BOOL: false },
            validation: { BOOL: false },
            metadata: { BOOL: false },
            accepted: { BOOL: false },
            rejected: { BOOL: false },
            download: { BOOL: false },
            writeToTemp: { BOOL: false },
            initializeProcessor: { BOOL: false },
            generateThumbnail: { BOOL: false },
            generateMP4Files: { BOOL: false },
            generateHLSPlaylists: { BOOL: false },
            generateIframePlaylists: { BOOL: false },
            uploadTranscodedFootage: { BOOL: false },
            totalFiles: { N: '0' },
            postProcessingValidation: { BOOL: false },
            completion: { BOOL: false },
            distribution: { BOOL: false },
            updatedAt: { S: new Date().toISOString() },
            hasCriticalFailure: { BOOL: false },
        },
    },
});
