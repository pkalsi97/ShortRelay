import { promisify } from 'util';

import ffmpeg, { FfprobeData, FfprobeStream } from 'fluent-ffmpeg';

import { TechnicalMetadata, QualityMetrics, ContentMetadataResult } from '../../types/metadata.types';

interface StreamInfo {
    videoStream?: FfprobeStream;
    audioStream?: FfprobeStream;
}

interface PlayabilityResult {
    isPlayable: boolean;
    error?: string;
}

const ffprobeAsync = promisify<string, FfprobeData>(ffmpeg.ffprobe);

const getDefaultTechnicalMetadata = (): TechnicalMetadata => ({
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
});

const getDefaultQualityMetrics = (): QualityMetrics => ({
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
});

const getStreams = (metadata: FfprobeData): StreamInfo => ({
    videoStream: metadata.streams.find(s => s.codec_type === 'video'),
    audioStream: metadata.streams.find(s => s.codec_type === 'audio'),
});

const checkPlayability = async (filePath: string): Promise<PlayabilityResult> => {
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

const calculateExpectedFrames = (duration: number, frameRate: string): number => {
    const [num, den] = frameRate.split('/').map(Number);
    return Math.round(duration * (num / den));
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

// Main extraction functions
const extractTechnicalMetadata = (
    metadata: FfprobeData,
    { videoStream, audioStream }: StreamInfo,
): TechnicalMetadata => ({
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
});

const extractQualityMetrics = (
    { videoStream, audioStream }: StreamInfo,
    playabilityCheck: PlayabilityResult,
): QualityMetrics => ({
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
});

const getContentMetadata = async (filePath: string): Promise<ContentMetadataResult> => {
    try {
        const [metadata, playabilityCheck] = await Promise.all([
            ffprobeAsync(filePath),
            checkPlayability(filePath),
        ]);

        const streams = getStreams(metadata);

        return {
            technical: extractTechnicalMetadata(metadata, streams),
            quality: extractQualityMetrics(streams, playabilityCheck),
        };
    } catch (error) {
        console.error(error);
        return {
            technical: getDefaultTechnicalMetadata(),
            quality: getDefaultQualityMetrics(),
        };
    }
};

export const MetadataExtractor = {
    getContentMetadata,
};
