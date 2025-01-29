'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CloudArrowUpIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { userApi } from '@/utils/api-client';
import { API_ROUTES } from '@/config/api.config';
import { authService } from '@/utils/auth.service';

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

export default function Upload() {
  const router = useRouter();
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
            resolve(true);
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
          router.push('/dashboard/library');
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
    <div className="max-w-4xl mx-auto">
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
              
              {/* Show file name immediately after selection */}
              {selectedFile && (
                <div className="mt-4 animate-fade-in">
                  <p className="text-sm text-gray-400 break-all">
                    Selected: {selectedFile.name}
                  </p>
                </div>
              )}

              {/* Show upload status only when uploading */}
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

          {/* Show upload button when file is selected and not uploading */}
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

          {/* Show loading button when uploading */}
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
      </div>
    </div>
  );
}