import * as fs from 'fs';
import { promisify } from 'util';

import ffmpeg, { FfprobeData, FfprobeStream } from 'fluent-ffmpeg';

import {
    TechnicalMetadata,
    QualityMetrics,
    ContentMetadata,
    ContentMetadataResult,
} from '../../types/metadata.types';

const ffprobeAsync = promisify<string, FfprobeData>(ffmpeg.ffprobe);

const getContentMetadata = async (filePath: string): Promise<ContentMetadataResult> => {
    const [technicalMetadata,qualityMetrics,contentMetadata] = await Promise.all([
        extractTechnicalMetadata(filePath),
        extractQualityMetrics(filePath),
        extractContentMetadata(filePath),
    ]);

    return{
        technical:technicalMetadata,
        quality:qualityMetrics,
        content:contentMetadata,
    };
};

const extractTechnicalMetadata = async (filePath: string): Promise<TechnicalMetadata> => {
    const metadata = await ffprobeAsync(filePath).catch(() => null);
    if (!metadata) {
        return getDefaultTechnicalMetadata();
    }

    const videoStream = metadata.streams.find(
        (s: FfprobeStream) => s.codec_type === 'video',
    );
    const audioStream = metadata.streams.find(
        (s: FfprobeStream) => s.codec_type === 'audio',
    );

    return {
        containerFormat: metadata.format?.format_name?.split(',')[0] || 'N/A',
        videoCodec: videoStream?.codec_name || 'N/A',
        audioCodec: audioStream?.codec_name || 'N/A',
        duration: metadata.format?.duration ? metadata.format.duration : 0,
        bitrate: metadata.format?.bit_rate ? metadata.format.bit_rate : 0,
        frameRate: videoStream?.r_frame_rate || 'N/A',
        resolution: {
            width: videoStream?.width || 0,
            height: videoStream?.height || 0,
        },
        aspectRatio: videoStream?.display_aspect_ratio || 'N/A',
        colorSpace: videoStream?.color_space || 'N/A',
    };
};

const extractContentMetadata = async (filePath: string): Promise<ContentMetadata> => {
    const metadata = await ffprobeAsync(filePath).catch(() => null);
    if (!metadata) {
        return getDefaultContentMetadata();
    }

    const tags = metadata.format?.tags as { creation_time?: string } || {};

    return {
        creationDate: tags.creation_time || 'N/A',
        lastModified: await fs.promises.stat(filePath)
            .then(stats => stats.mtime.toISOString())
            .catch(() => 'N/A'),
    };
};

const extractQualityMetrics = async (filePath: string): Promise<QualityMetrics> => {
    const metadata = await ffprobeAsync(filePath).catch(() => null);
    if (!metadata) {
        return getDefaultQualityMetrics();
    }

    const playabilityCheck = await checkPlayability(filePath);

    const videoStream = metadata.streams.find(s => s.codec_type === 'video');
    const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

    return {
        videoQualityScore: calculateVideoQuality(videoStream),
        audioQualityScore: calculateAudioQuality(audioStream),
        corruptionStatus: {
            isCorrupted: !playabilityCheck.isPlayable,
            details: playabilityCheck.error || 'No corruption detected',
        },
        missingFrames: calculateMissingFrames(videoStream),
        audioSync: {
            inSync: true,
            offsetMs: 'N/A',
        },
    };
};

const getDefaultTechnicalMetadata = (): TechnicalMetadata => {
    return {
        containerFormat: 'N/A',
        videoCodec: 'N/A',
        audioCodec: 'N/A',
        duration: 'N/A',
        bitrate: 'N/A',
        frameRate: 'N/A',
        resolution: {
            width: 'N/A',
            height: 'N/A',
        },
        aspectRatio: 'N/A',
        colorSpace: 'N/A',
    };
};

const getDefaultContentMetadata = (): ContentMetadata => {
    return {
        creationDate: 'N/A',
        lastModified: 'N/A',
    };
};

const getDefaultQualityMetrics = ():QualityMetrics => {
    return {
        videoQualityScore: 'N/A',
        audioQualityScore: 'N/A',
        corruptionStatus: {
            isCorrupted: false,
            details: 'Unable to determine',
        },
        missingFrames: 'N/A',
        audioSync: {
            inSync: false,
            offsetMs: 'N/A',
        },
    };
};

const checkPlayability = async (filePath: string): Promise<{ isPlayable: boolean; error?: string }> => {
    return new Promise((resolve) => {
        const outputPath = process.platform === 'win32' ? 'NUL' : '/dev/null';
        ffmpeg()
            .input(filePath)
            .outputOptions(['-f', 'null', '-c', 'copy'])
            .output(outputPath)
            .on('end', () => resolve({ isPlayable: true }))
            .on('error', (error: Error) => resolve({
                isPlayable: false,
                error: error.message,
            }))
            .run();
    });
};

const calculateVideoQuality = (videoStream?: FfprobeStream): number | 'N/A' => {
    if (!videoStream){
        return 'N/A';
    }

    const width = videoStream.width || 0;
    const height = videoStream.height || 0;
    const bitrate = parseInt(videoStream.bit_rate || '0');

    if (!width || !height || !bitrate) {
        return 'N/A';
    }

    const resolutionScore = (width * height) / (1920 * 1080);
    const bitrateScore = bitrate / 5000000;

    return Math.min(100, Math.round((resolutionScore + bitrateScore) * 50));
};

const calculateAudioQuality = (audioStream?: FfprobeStream): number | 'N/A' => {
    if (!audioStream) {
        return 'N/A';

    }
    const bitrate = parseInt(audioStream.bit_rate || '0');
    if (!bitrate) {
        return 'N/A';
    }

    return Math.min(100, Math.round((bitrate / 320000) * 100));
};

const calculateMissingFrames = (videoStream?: FfprobeStream): number | 'N/A' => {
    if (!videoStream) {
        return 'N/A';
    }

    const expectedFrames = videoStream.duration && videoStream.r_frame_rate
        ? calculateExpectedFrames(
            parseFloat(videoStream.duration),
            videoStream.r_frame_rate,
        )
        : 0;

    const actualFrames = videoStream.nb_frames
        ? parseInt(videoStream.nb_frames)
        : 0;

    return expectedFrames && actualFrames
        ? Math.max(0, expectedFrames - actualFrames)
        : 'N/A';
};

const calculateExpectedFrames = (duration: number, frameRate: string): number => {
    const [num, den] = frameRate.split('/').map(Number);
    return Math.round(duration * (num / den));
};

export const MetadataExtractor = {
    getContentMetadata,
};
