import { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost, PresignedPost} from '@aws-sdk/s3-presigned-post';

export interface UploadConfig {
    region: string;
    bucket: string;
    uploadSizeLimit: number;
    uploadTimeLimit: number;
};

let uploadConfig: UploadConfig;
let s3Client: S3Client;

const initialize = (config:UploadConfig): void => {
    uploadConfig = config;
    s3Client = new S3Client({region:uploadConfig.region});
};

const generatePreSignedPost = async (userId:string,key:string): Promise<PresignedPost> => {
    const presignedPost = await createPresignedPost(s3Client,{
        Bucket: uploadConfig.bucket,
        Key: key,
        Conditions: [
            ['content-length-range',1,uploadConfig.uploadSizeLimit],
        ],
        Expires: uploadConfig.uploadTimeLimit,
    });

    return presignedPost;
};

export const UploadService = {
    initialize,
    generatePreSignedPost,
};
