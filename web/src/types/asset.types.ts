export interface StageProgressUpdate {
    status: string;
    startTime: string;
    error: string;
    endTime?: string;
  }
  
  export interface Progress {
    upload?: StageProgressUpdate;
    validation?: StageProgressUpdate;
    metadata?: StageProgressUpdate;
    accepted?: StageProgressUpdate;
    download?: StageProgressUpdate;
    writeToStorage?: StageProgressUpdate;
    initializeProcessor?: StageProgressUpdate;
    generateThumbnail?: StageProgressUpdate;
    generateMP4Files?: StageProgressUpdate;
    generateHLSPlaylists?: StageProgressUpdate;
    generateIframePlaylists?: StageProgressUpdate;
    uploadTranscodedFootage?: StageProgressUpdate;
    postProcessingValidation?: StageProgressUpdate;
    completion?: StageProgressUpdate;
  }
  
  export interface Asset {
    assetId: string;
    stage: string;
    hasCriticalFailure: boolean;
    progress: Progress;
    metadata: {
      distribution: {
        thumbnail?: string;
      };
      technical?: {
        duration: number;
      };
    };
    createdAt: string;
    updatedAt: string;
  }
  
  export interface DetailedAsset extends Asset {
    totalFiles: string;
    metadata: {
      distribution: {
        downloads: {
          mobile: string;
          high: string;
          medium: string;
          audio: string;
          low: string;
        };
        streaming: {
          hls: string;
          iframe: string;
          audio: string;
        };
        thumbnail: string;
      };
      quality: {
        missingFrames: number;
        videoQualityScore: number;
        audioQualityScore: number;
        audioSync: {
          offsetMs: number | null;
          inSync: boolean;
        };
        corruptionStatus: {
          isCorrupted: boolean;
          details: string;
        };
      };
      technical: {
        duration: number;
        colorSpace: string;
        frameRate: string;
        containerFormat: string;
        bitrate: number;
        aspectRatio: string;
        audioCodec: string;
        resolution: {
          width: number;
          height: number;
        };
        videoCodec: string;
      };
      validation: {
        basic: {
          sizeInBytes: number;
          isValid: boolean;
          exists: boolean;
          containerFormat: string;
          detectedFormats: string;
          audioCodec: string;
          videoCodec: string;
        };
        stream: {
          hasCorruptFrames: boolean;
          hasVideoStream: boolean;
          isPlayable: boolean;
          error: string | null;
          hasAudioStream: boolean;
        };
      };
    };
  }
  
  export interface ApiResponse {
    success: boolean;
    message: string;
    data: Asset[];
  }
  
  export interface DetailedApiResponse {
    success: boolean;
    message: string;
    data: DetailedAsset;
  }
  
  export type Stage = 
    | 'upload'
    | 'validation'
    | 'queued'
    | 'processing'
    | 'finalizing'
    | 'finished'
    | 'failed';