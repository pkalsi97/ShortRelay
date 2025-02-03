'use client';

import { useState, useEffect, useCallback } from 'react';
import { CloudArrowUpIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { userApi } from '@/utils/api-client';
import { API_ROUTES } from '@/config/api.config';
import { authService } from '@/utils/auth.service';
import { format } from 'date-fns';

interface UploadResponse {
  url: string;
  fields: {
    bucket: string;
    'X-Amz-Algorithm': string;
    'X-Amz-Credential': string;
    'X-Amz-Date': string;
    'X-Amz-Security-Token': string;
    key: string;
    Policy: string;
    'X-Amz-Signature': string;
  };
}

interface ProgressResponse {
  success: boolean;
  message: string;
  data: Array<{
    createdAt: string;
    updatedAt: string;
    assetId: string;
    progress: {
      [key: string]: {
        endTime?: string;
        startTime: string;
        status: string;
        error: string;
      };
    };
  }>;
}

type UploadStatus = 'idle' | 'validating' | 'requesting' | 'uploading' | 'complete' | 'error';

const ACCEPTED_FORMATS = ['video/mp4', 'video/quicktime', 'video/webm'];
const MAX_FILE_SIZE_MB = 120;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const STATUS_MESSAGES = {
  idle: '',
  validating: 'Validating file...',
  requesting: 'Requesting upload URL...',
  uploading: 'Uploading video...',
  complete: 'Upload complete!',
  error: 'Upload failed'
};

const STAGES_ORDER = [
  'upload',
  'validation',
  'metadata',
  'accepted',
  'download',
  'writeToStorage',
  'initializeProcessor',
  'generateThumbnail',
  'generateMP4Files',
  'generateHLSPlaylists',
  'generateIframePlaylists',
  'uploadTranscodedFootage',
  'postProcessingValidation',
  'completion',
  'Finished'
];

const STAGE_DISPLAY_NAMES = {
  'upload': '📤 Uploading your video',
  'validation': '🔍 Validating format',
  'metadata': '📋 Processing metadata',
  'accepted': '✅ Video accepted',
  'download': '⬇️ Preparing video',
  'writeToStorage': '💾 Saving to storage',
  'initializeProcessor': '🎬 Initializing processor',
  'generateThumbnail': '🖼️ Creating thumbnail',
  'generateMP4Files': '🎥 Converting format',
  'generateHLSPlaylists': '📱 Optimizing for streaming',
  'generateIframePlaylists': '⚡ Creating previews',
  'uploadTranscodedFootage': '🚀 Finalizing video',
  'postProcessingValidation': '🔎 Final checks',
  'completion': '🎉 Ready',
  'Failed': '❌ Processing failed',
};

interface ProgressResponse {
  success: boolean;
  message: string;
  data: Array<{
    assetId: string;
    createdAt: string;
    updatedAt: string;
    progress: {
      [key: string]: {
        endTime?: string;
        startTime: string;
        status: string;
        error: string;
      };
    };
  }>;
}

const ProgressSection = () => {
  const [progressData, setProgressData] = useState<ProgressResponse['data']>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchProgress = useCallback(async () => {
    try {
      setIsLoading(true);
      const accessToken = authService.getAccessToken();
      const idToken = authService.getIdToken();

      if (!accessToken || !idToken) {
        throw new Error('Authentication failed');
      }

      const response = await userApi.get<ProgressResponse>(
        '/v1/user/assets/progress',
        {
          headers: {
            'authorization': `Bearer ${idToken}`,
            'x-access-token': `Bearer ${accessToken}`
          }
        }
      );

      if (response.success) {
        setProgressData(response.data);
      }
    } catch (error) {
      toast.error('Failed to fetch progress');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProgress();
    const interval = setInterval(fetchProgress, 10000);
    return () => clearInterval(interval);
  }, [fetchProgress]);

  const getCurrentStageAndProgress = (progress: ProgressResponse['data'][0]['progress']) => {
    let currentStage = '';
    let progressPercentage = 0;
    
    const stageWeights = {
      'upload': 7,
      'validation': 14,
      'metadata': 21,
      'accepted': 28,
      'download': 35,
      'writeToStorage': 42,
      'initializeProcessor': 49,
      'generateThumbnail': 56,
      'generateMP4Files': 63,
      'generateHLSPlaylists': 70,
      'generateIframePlaylists': 77,
      'uploadTranscodedFootage': 84,
      'postProcessingValidation': 91,
      'completion': 100,
    };

    for (const stage of STAGES_ORDER) {
      if (progress[stage]?.status === 'IN_PROGRESS') {
        currentStage = stage;
        progressPercentage = stageWeights[stage];
        break;
      }
    }

    if (!currentStage) {
      for (let i = STAGES_ORDER.length - 1; i >= 0; i--) {
        const stage = STAGES_ORDER[i];
        if (progress[stage]?.status === 'COMPLETED') {
          currentStage = stage;
          progressPercentage = stageWeights[stage];
          break;
        }
      }
    }

    const hasFailedStage = Object.values(progress).some(
      stage => stage?.status === 'FAILED'
    );

    if (hasFailedStage) {
      currentStage = 'Failed';
      progressPercentage = 0;
    }

    return { currentStage, progressPercentage };
  };

  if (isLoading && progressData.length === 0) {
    return (
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-200 mb-4">Processing Status</h2>
        <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg p-6 animate-pulse">
          <div className="h-4 bg-gray-800 rounded w-1/4 mb-4"></div>
          <div className="h-2 bg-gray-800 rounded w-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold text-gray-200 mb-4">Processing Status</h2>
      {progressData.length > 0 ? (
        <div className="space-y-4">
          {[...progressData]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .map((item, index) => {
              const { currentStage, progressPercentage } = getCurrentStageAndProgress(item.progress);
              const isFinished = currentStage === 'Finished';
              const isFailed = currentStage === 'Failed';

              return (
                <div key={index} className="bg-gray-900/50 backdrop-blur-sm rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs text-gray-400">
                        Asset ID: {item.assetId}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        Started {format(new Date(item.createdAt), 'MMM dd, HH:mm:ss')}
                      </p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            isFinished ? 'bg-gradient-to-r from-purple-500/20 to-cyan-500/20 text-cyan-400' : 
                            isFailed ? 'bg-red-500/20 text-red-400' :
                            'bg-gradient-to-r from-purple-500/20 to-cyan-500/20 text-purple-400'
                            }`}>
                            {STAGE_DISPLAY_NAMES[currentStage] || currentStage}
                      </span>
                  </div>
                  <div className="relative h-1.5 bg-gray-800/50 rounded-full overflow-hidden">
                    <div
                      className={`absolute left-0 top-0 h-full transition-all duration-500 ease-out ${
                        isFailed ? 'bg-red-500' : 'bg-gradient-to-r from-purple-500 to-cyan-500'
                      }`}
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                  <div className="mt-1 text-right">
                    <span className="text-xs text-gray-400">
                      {progressPercentage}%
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
      ) : (
        <div className="text-center py-6 bg-gray-900/50 backdrop-blur-sm rounded-lg">
          <p className="text-gray-400">No active processing</p>
        </div>
      )}
    </div>
  );
};

export default function Upload() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadStatus('idle');
      setUploadProgress(0);
    }
  };

  const validateFile = (file: File): { isValid: boolean; message: string } => {
    if (!file.type.startsWith('video/')) {
      return {
        isValid: false,
        message: 'Please upload a video file'
      };
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return {
        isValid: false,
        message: `File size must be less than ${MAX_FILE_SIZE_MB}MB`
      };
    }

    if (!ACCEPTED_FORMATS.includes(file.type)) {
      return {
        isValid: false,
        message: `Supported formats: ${ACCEPTED_FORMATS.map(format => format.split('/')[1]).join(', ')}`
      };
    }

    return {
      isValid: true,
      message: 'File validation successful!'
    };
  };

  const uploadToS3 = async (file: File, uploadData: UploadResponse): Promise<boolean> => {
    return new Promise((resolve) => {
      const formData = new FormData();
      
      Object.entries(uploadData.fields).forEach(([key, value]) => {
        formData.append(key, value);
      });

      formData.append('file', file);

      const xhr = new XMLHttpRequest();
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded * 100) / event.total);
          setUploadProgress(progress);
        }
      };
      
      xhr.open('POST', uploadData.url, true);
      
      xhr.onload = () => {
        resolve(xhr.status === 204);
      };

      xhr.onerror = () => {
        resolve(false);
      };
      
      xhr.send(formData);
    });
  };

  const handleRequestUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a video file first');
      return;
    }

    setUploadStatus('validating');
    const validation = validateFile(selectedFile);
    if (!validation.isValid) {
      toast.error(validation.message);
      setUploadStatus('error');
      return;
    }

    setIsLoading(true);
    setUploadStatus('requesting');
    
    try {
      const accessToken = authService.getAccessToken();
      const idToken = authService.getIdToken();

      if (!accessToken || !idToken) {
        toast.error('Authentication failed');
        setUploadStatus('error');
        return;
      }

      const response = await userApi.post<{ success: boolean; data: UploadResponse; message: string }>(
        API_ROUTES.user.uploadVideo(),
        undefined,
        {
          headers: {
            'authorization': `Bearer ${idToken}`,
            'x-access-token': `Bearer ${accessToken}`
          }
        }
      );

      if (!response.success) {
        toast.error(response.message);
        setUploadStatus('error');
        return;
      }

      setUploadStatus('uploading');
      const uploadSuccess = await uploadToS3(selectedFile, response.data);
      
      if (uploadSuccess) {
        setUploadStatus('complete');
        toast.success('Video uploaded successfully!');
        setTimeout(() => {
          setSelectedFile(null);
          setUploadStatus('idle');
          setUploadProgress(0);
        }, 1000);
      } else {
        setUploadStatus('error');
        toast.error('Failed to upload video');
      }
      
    } catch (error) {
      console.error(error);
      setUploadStatus('error');
      toast.error('Failed to upload video. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="max-w-4xl mx-auto pb-20">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-100">
        Upload Video
      </h1>
      <div className="mt-8">
        <div className="max-w-xl">
          <div className="mt-4 flex justify-center px-4 md:px-6 pt-5 pb-6 border-2 border-gray-800 border-dashed rounded-lg hover:border-purple-500 transition-colors">
            <div className="space-y-1 text-center w-full">
              <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
              <div className="flex flex-col md:flex-row items-center justify-center text-sm text-gray-400">
                <label className="relative cursor-pointer rounded-md font-medium text-purple-500 hover:text-purple-400 focus-within:outline-none">
                  <span>Upload a file</span>
                  <input 
                    type="file" 
                    className="sr-only" 
                    accept={ACCEPTED_FORMATS.join(',')}
                    onChange={handleFileSelect}
                    disabled={isLoading}
                  />
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Supported formats: {ACCEPTED_FORMATS.map(format => format.split('/')[1]).join(', ')}, 
                up to {MAX_FILE_SIZE_MB}MB
              </p>
              
              {selectedFile && (
                <div className="mt-4 animate-fade-in">
                  <p className="text-sm text-gray-400 break-all">
                    Selected: {selectedFile.name}
                  </p>
                </div>
              )}

              {uploadStatus !== 'idle' && uploadStatus !== 'validating' && (
                <div className="mt-4 animate-fade-in">
                  <p className="text-sm text-gray-400">
                    {STATUS_MESSAGES[uploadStatus]}
                    {uploadStatus === 'uploading' && uploadProgress > 0 && (
                      <span className="ml-2">{uploadProgress}%</span>
                    )}
                  </p>
                  <div className="mt-2 w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-cyan-500 h-1.5 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${uploadStatus === 'complete' ? 100 : uploadProgress}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {selectedFile && !isLoading && (
            <div className="mt-6 animate-fade-in">
              <button
                onClick={handleRequestUpload}
                className="w-full btn bg-gradient-to-r from-purple-500 to-cyan-500 border-0 text-white hover:opacity-90 disabled:opacity-50 transition-all duration-300"
              >
                Request Upload
              </button>
            </div>
          )}

          {isLoading && (
            <div className="mt-6 animate-fade-in">
              <button
                disabled
                className="w-full btn bg-gradient-to-r from-purple-500 to-cyan-500 border-0 text-white opacity-75"
              >
                <span className="loading loading-spinner loading-sm mr-2"></span>
                Uploading...
              </button>
            </div>
          )}
        </div>

        {/* Add the Progress Section */}
        <ProgressSection />
      </div>
    </div>
  );
}