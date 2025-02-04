import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

import ffmpeg, { FfprobeData, FfprobeStream } from 'fluent-ffmpeg';

import {
    BasicValidationResult,
    StreamValidationResult,
    ContentValidationResult,
} from '../../types/metadata.types';

if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
    ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH || '/opt/ffmpeg/ffmpeg');
    ffmpeg.setFfprobePath(process.env.FFPROBE_PATH || '/opt/ffprobe/ffprobe');
}

const SUPPORTED_FORMATS = ['mp4', 'mov', 'avi', 'mkv'];
const SUPPORTED_VIDEO_CODECS = ['h264', 'hevc', 'vp8', 'vp9'];
const SUPPORTED_AUDIO_CODECS = ['aac', 'mp3', 'opus'];

const ffprobeAsync = promisify<string, FfprobeData>(ffmpeg.ffprobe);

const getDefaultResult = (exists:boolean, stats?:fs.Stats):BasicValidationResult => {
    return {
        exists,
        sizeInBytes: stats?.size || 0,
        containerFormat: 'unknown',
        detectedFormats: 'unknown',
        videoCodec: 'none',
        audioCodec: 'none',
        isValid: false,
    };
};

const isValidVideo = (format: string, videoCodec: string, audioCodec: string): boolean => {
    return  SUPPORTED_FORMATS.some(f => format.includes(f)) &&
            SUPPORTED_VIDEO_CODECS.includes(videoCodec) &&
            SUPPORTED_AUDIO_CODECS.includes(audioCodec);
};

const validateStreams = async(filePath: string): Promise<StreamValidationResult> => {
    let metadata: FfprobeData;

    try {
        metadata = await ffprobeAsync(filePath);
    } catch {
        return {
            hasVideoStream: false,
            hasAudioStream: false,
            isPlayable: false,
            hasCorruptFrames: true,
            error: 'Unable to read file metadata',
        };
    }

    const videoStream = metadata.streams.find(
        (s: FfprobeStream) => s.codec_type === 'video',
    );
    const audioStream = metadata.streams.find(
        (s: FfprobeStream) => s.codec_type === 'audio',
    );

    const playabilityCheck = await checkPlayability(filePath);

    return {
        hasVideoStream: !!videoStream,
        hasAudioStream: !!audioStream,
        isPlayable: playabilityCheck.isPlayable,
        hasCorruptFrames: !playabilityCheck.isPlayable,
        error: playabilityCheck.error,
    };
};

const checkPlayability = async(filePath: string): Promise<{ isPlayable: boolean; error?: string }> => {
    const outputPath = process.platform === 'win32' ? 'NUL' : '/dev/null';
    return new Promise((resolve) => {
        ffmpeg()
            .input(filePath)
            .outputOptions(['-f', 'null', '-c', 'copy'])
            .output(outputPath)
            .on('end', () => {
                resolve({ isPlayable: true });
            })
            .on('error', (error: Error) => {
                resolve({
                    isPlayable: false,
                    error: error.message,
                });
            })
            .run();
    });
};

const validateBasics = async (filePath: string): Promise<BasicValidationResult> => {
    const stats = await fs.promises.stat(filePath).catch(() => null);
    if (!stats){
        return getDefaultResult(false);
    }
    const metadata = await new Promise<FfprobeData>((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, data) => err ? reject(err) : resolve(data));
    }).catch(() => null);

    if (!metadata) {
        return getDefaultResult(true, stats);
    }

    const format = path.extname(filePath).toLowerCase().replace('.', '') ||
                  metadata.format?.format_name?.split(',')[0] || 'unknown';

    const videoCodec = metadata.streams.find((s: FfprobeStream) =>
        s.codec_type === 'video')?.codec_name?.toLowerCase() || 'none';

    const audioCodec = metadata.streams.find((s: FfprobeStream) =>
        s.codec_type === 'audio')?.codec_name?.toLowerCase() || 'none';

    return {
        exists: true,
        sizeInBytes: stats.size,
        containerFormat: format,
        detectedFormats: metadata.format?.format_name || 'unknown',
        videoCodec,
        audioCodec,
        isValid: isValidVideo(format, videoCodec, audioCodec),
    };
};

const validateContent = async (filePath:string): Promise <ContentValidationResult> => {

    const basic = await validateBasics(filePath);
    const stream: StreamValidationResult = await validateStreams(filePath);

    const success = basic.isValid &&
                    stream.isPlayable &&
                    !stream.hasCorruptFrames &&
                    stream.hasVideoStream &&
                    stream.hasAudioStream;

    let error: string | undefined;
    if (!success) {
        if (!stream.hasVideoStream) {
            error = 'No video stream found';
        } else if (!stream.hasAudioStream) {
            error = 'No audio stream found';
        } else if (stream.hasCorruptFrames) {
            error = 'Corrupt frames detected';
        } else if (!stream.isPlayable) {
            error = stream.error || 'Content not playable';
        } else {
            error = 'Validation failed';
        }
    }

    return {
        success,
        error,
        basic,
        stream,
    };
};

export const ContentValidator = {
    validateContent,
};
