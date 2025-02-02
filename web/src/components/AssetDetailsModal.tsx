'use client';

import { useEffect, useState } from 'react';
import { userApi } from '@/utils/api-client';
import { authService } from '@/utils/auth.service';
import { toast } from 'react-hot-toast';
import { DetailedAsset, DetailedApiResponse } from '@/types/asset.types';
import { format } from 'date-fns';
import VideoPlayer from './VideoPlayer';
import CopyButton from './CopyButton'; 

interface AssetDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  assetId: string | null;
}

const PROGRESS_STEPS_ORDER = [
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
  'completion'
] as const;

const calculateDuration = (startTime: string, endTime: string): string => {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const durationMs = end - start;
  
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }
  
  if (durationMs < 60000) {
    return `${(durationMs / 1000).toFixed(2)}s`;
  }
  
  const minutes = Math.floor(durationMs / 60000);
  const seconds = ((durationMs % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
};

const formatStepName = (step: string): string => {
  return step
    .replace(/([A-Z])/g, ' $1')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-sm font-medium text-gray-400 mb-3 pb-2 border-b border-gray-800">
    {children}
  </h3>
);

export const AssetDetailsModal = ({ isOpen, onClose, assetId }: AssetDetailsModalProps) => {
  const [asset, setAsset] = useState<DetailedAsset | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAssetDetails = async () => {
      if (!assetId) return;

      try {
        setIsLoading(true);
        setError(null);
        
        const accessToken = authService.getAccessToken();
        const idToken = authService.getIdToken();

        if (!accessToken || !idToken) {
          throw new Error('Authentication failed');
        }

        const response = await userApi.get<DetailedApiResponse>(
          `/v1/user/assets/${assetId}`,
          {
            headers: {
              'authorization': `Bearer ${idToken}`,
              'x-access-token': `Bearer ${accessToken}`
            }
          }
        );

        if (response.success) {
          setAsset(response.data);
        } else {
          throw new Error(response.message);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load asset details';
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen && assetId) {
      fetchAssetDetails();
    }
  }, [isOpen, assetId]);

  if (!isOpen) return null;

  const totalProcessingTime = asset && asset.stage === 'Finished' 
    ? calculateDuration(asset.createdAt, asset.updatedAt)
    : null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 overflow-y-auto">
      <div className="min-h-screen px-4 py-8 flex items-center justify-center">
        <div className="bg-gray-900 rounded-lg w-full max-w-4xl p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white"
          >
            <span className="sr-only">Close</span>
            ✕
          </button>

          {isLoading ? (
            <div className="h-96 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-900/50 text-red-400 rounded-lg">
              {error}
            </div>
          ) : asset ? (
                <div className="space-y-8">
                {/* Overview Section */}
                <div>
                    <SectionTitle>Overview</SectionTitle>
                    <div className="bg-gray-800/50 rounded-lg p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {asset.assetId && (
                        <div>
                            <p className="text-xs text-gray-500">Asset ID</p>
                            <p className="text-sm text-white break-words">{asset.assetId}</p>
                        </div>
                        )}
                        {asset.stage && (
                        <div>
                            <p className="text-xs text-gray-500">Status</p>
                            <p className="text-sm text-white">{asset.stage}</p>
                        </div>
                        )}
                        {asset.createdAt && (
                        <div>
                            <p className="text-xs text-gray-500">Created</p>
                            <p className="text-sm text-white">
                            {format(new Date(asset.createdAt), 'MMM dd, yyyy hh:mm a')}
                            </p>
                        </div>
                        )}
                        {totalProcessingTime && (
                        <div>
                            <p className="text-xs text-gray-500">Total Processing Time</p>
                            <p className="text-sm text-white">{totalProcessingTime}</p>
                        </div>
                        )}
                    </div>
                    </div>
                </div>
              {/* Video Player */}
              {asset.metadata?.distribution?.streaming?.hls && (
                <VideoPlayer src={asset.metadata.distribution.streaming.hls} />
              )}

              {/* Links Section */}
              {asset.metadata?.distribution && (
                <div>
                  <SectionTitle>Distribution Links</SectionTitle>
                  <div className="space-y-4">
                    {/* Downloads */}
                    {asset.metadata.distribution.downloads && (
                      <div className="bg-gray-800/50 rounded-lg p-4">
                        <p className="text-lg text-gray-500 mb-2">Download Options</p>
                        <div className="space-y-2">
                          {Object.entries(asset.metadata.distribution.downloads).map(([quality, url]) => (
                            <div key={quality} className="flex items-center justify-between">
                              <span className="text-sm text-gray-400 capitalize">
                                {quality === 'high' ? 'HD (1080p)' :
                                 quality === 'medium' ? 'HD (720p)' :
                                 quality === 'low' ? 'SD (480p)' :
                                 quality === 'mobile' ? 'Mobile (360p)' :
                                 quality === 'audio' ? 'Audio Only' : quality}
                              </span>
                              <a
                                href={url}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-purple-500 hover:text-purple-400 text-sm flex items-center gap-2"
                              >
                                Download
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Streaming */}
                    {asset.metadata.distribution.streaming && (
                      <div className="bg-gray-800/50 rounded-lg p-4">
                      <p className="text-lg text-gray-500 mb-2">Streaming URLs</p>
                      <div className="space-y-2">
                        {Object.entries(asset.metadata.distribution.streaming).map(([type, url]) => (
                          <div key={type} className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                            <span className="text-sm text-gray-400 capitalize sm:w-1/4">
                              {type === 'hls' ? 'HLS Stream' :
                               type === 'iframe' ? 'IFrame Embed' :
                               type === 'audio' ? 'Audio Stream' : type}
                            </span>
                            <div className="flex items-center gap-2 w-full sm:w-3/4">
                              <input
                                type="text"
                                value={url}
                                readOnly
                                className="bg-gray-700 text-xs text-gray-300 px-2 py-1 rounded w-full focus:outline-none focus:ring-1 focus:ring-purple-500"
                              />
                              <CopyButton url={url} />
                            </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  {/* Thumbnail */}
                  {asset.metadata.distribution.thumbnail && (
                    <div className="bg-gray-800/50 rounded-lg p-4">
                    <p className="text-lg text-gray-500 mb-2">Thumbnail</p>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 w-full sm:w-3/4">
                              <input
                                type="text"
                                value={asset.metadata.distribution.thumbnail}
                                readOnly
                                className="bg-gray-700 text-xs text-gray-300 px-2 py-1 rounded w-full focus:outline-none focus:ring-1 focus:ring-purple-500"
                              />
                              <CopyButton url={asset.metadata.distribution.thumbnail} />
                            </div>
                    </div>
                    </div>
                    )}
                  </div>
                </div>
              )}
                {/* Metadata Section */}
                {asset?.metadata && (
                <div>
                    <SectionTitle>Metadata</SectionTitle>
                    <div className="bg-gray-800/50 rounded-lg p-4 space-y-6">
                    
                    {/* Technical Details */}
                    {asset.metadata.technical && Object.keys(asset.metadata.technical).length > 0 && (
                        <div>
                        <p className="text-lg text-gray-500 mb-2">Technical Details</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {[
                            { label: 'Duration', value: asset.metadata.technical.duration ? `${Math.round(asset.metadata.technical.duration)}s` : null },
                            { label: 'Resolution', value: asset.metadata.technical.resolution ? `${asset.metadata.technical.resolution.width} x ${asset.metadata.technical.resolution.height}` : null },
                            { label: 'Frame Rate', value: asset.metadata.technical.frameRate },
                            { label: 'Bitrate', value: asset.metadata.technical.bitrate ? `${Math.round(asset.metadata.technical.bitrate / 1000)} Kbps` : null },
                            { label: 'Aspect Ratio', value: asset.metadata.technical.aspectRatio },
                            { label: 'Container Format', value: asset.metadata.technical.containerFormat },
                            { label: 'Color Space', value: asset.metadata.technical.colorSpace },
                            { label: 'Video Codec', value: asset.metadata.technical.videoCodec },
                            { label: 'Audio Codec', value: asset.metadata.technical.audioCodec },
                            ].filter(item => item.value).map((item, index) => (
                            <div key={index}>
                                <p className="text-xs text-gray-500">{item.label}</p>
                                <p className="text-sm text-white">{item.value}</p>
                            </div>
                            ))}
                        </div>
                        </div>
                    )}

                    {/* Quality Analysis */}
                    {asset.metadata.quality && Object.keys(asset.metadata.quality).length > 0 && (
                        <div>
                        <p className="text-xl text-gray-500 mb-2">Quality Analysis</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {[
                            { label: 'Video Quality Score', value: asset.metadata.quality.videoQualityScore ? `${asset.metadata.quality.videoQualityScore}/100` : null },
                            { label: 'Audio Quality Score', value: asset.metadata.quality.audioQualityScore ? `${asset.metadata.quality.audioQualityScore}/100` : null },
                            { label: 'Missing Frames', value: asset.metadata.quality.missingFrames },
                            { label: 'Audio Sync', value: asset.metadata.quality.audioSync ? `${asset.metadata.quality.audioSync.inSync ? 'In Sync' : 'Out of Sync'}${asset.metadata.quality.audioSync.offsetMs !== null ? ` (${asset.metadata.quality.audioSync.offsetMs}ms offset)` : ''}` : null },
                            { label: 'Corruption Status', value: asset.metadata.quality.corruptionStatus ? (asset.metadata.quality.corruptionStatus.isCorrupted ? 'Corrupted' : 'Not Corrupted') : null, className: asset.metadata.quality.corruptionStatus?.isCorrupted ? 'text-red-400' : 'text-green-400' }
                            ].filter(item => item.value).map((item, index) => (
                            <div key={index} className={item.className ? `col-span-2 md:col-span-3 ${item.className}` : ''}>
                                <p className="text-xs text-gray-500">{item.label}</p>
                                <p className="text-sm text-white">{item.value}</p>
                            </div>
                            ))}
                        </div>
                        </div>
                    )}

                    {/* Validation Details */}
                    {asset.metadata.validation && 
                        (Object.values(asset.metadata.validation.basic).some(value => value !== null && value !== undefined) ||
                        Object.values(asset.metadata.validation.stream).some(value => value !== null && value !== undefined)) && (
                        <div>
                        <p className="text-xl text-gray-500 mb-2">Validation Details</p>
                        <div className="space-y-4">
                            {/* Basic Validation */}
                            {asset.metadata.validation.basic && Object.keys(asset.metadata.validation.basic).length > 0 && (
                            <div>
                                <p className="text-xs text-gray-500 mb-2">Basic Validation</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {[
                                    { label: 'File Size', value: asset.metadata.validation.basic.sizeInBytes ? `${(asset.metadata.validation.basic.sizeInBytes / (1024 * 1024)).toFixed(2)} MB` : null },
                                    { label: 'Status', value: asset.metadata.validation.basic.isValid ? 'Valid' : 'Invalid', className: asset.metadata.validation.basic.isValid ? 'text-green-400' : 'text-red-400' },
                                    { label: 'File Exists', value: asset.metadata.validation.basic.exists ? 'Yes' : 'No', className: asset.metadata.validation.basic.exists ? 'text-green-400' : 'text-red-400' },
                                    { label: 'Container Format', value: asset.metadata.validation.basic.containerFormat },
                                ].filter(item => item.value).map((item, index) => (
                                    <div key={index} className={item.className ? item.className : ''}>
                                    <p className="text-xs text-gray-500">{item.label}</p>
                                    <p className="text-sm text-white">{item.value}</p>
                                    </div>
                                ))}
                                </div>
                            </div>
                            )}

                            {/* Stream Validation */}
                            {asset.metadata.validation.stream && Object.keys(asset.metadata.validation.stream).length > 0 && (
                            <div>
                                <p className="text-xl text-gray-500 mb-2">Stream Validation</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {[
                                    { label: 'Playable', value: asset.metadata.validation.stream.isPlayable ? 'Yes' : 'No', className: asset.metadata.validation.stream.isPlayable ? 'text-green-400' : 'text-red-400' },
                                    { label: 'Video Stream', value: asset.metadata.validation.stream.hasVideoStream ? 'Present' : 'Missing', className: asset.metadata.validation.stream.hasVideoStream ? 'text-green-400' : 'text-red-400' },
                                    { label: 'Audio Stream', value: asset.metadata.validation.stream.hasAudioStream ? 'Present' : 'Missing', className: asset.metadata.validation.stream.hasAudioStream ? 'text-green-400' : 'text-red-400' },
                                    { label: 'Corrupt Frames', value: asset.metadata.validation.stream.hasCorruptFrames ? 'Yes' : 'No', className: asset.metadata.validation.stream.hasCorruptFrames ? 'text-red-400' : 'text-green-400' },
                                ].filter(item => item.value).map((item, index) => (
                                    <div key={index} className={item.className ? item.className : ''}>
                                    <p className="text-xs text-gray-500">{item.label}</p>
                                    <p className="text-sm text-white">{item.value}</p>
                                    </div>
                                ))}
                                {asset.metadata.validation.stream.error && (
                                    <div className="col-span-2 md:col-span-3">
                                    <p className="text-xs text-gray-500">Stream Error</p>
                                    <p className="text-sm text-red-400">{asset.metadata.validation.stream.error}</p>
                                    </div>
                                )}
                                </div>
                            </div>
                            )}
                        </div>
                        </div>
                    )}
                    </div>
                </div>
                )}
             {/* Progress Timeline */}
              {asset.progress && (
                <div>
                  <SectionTitle>Processing Timeline</SectionTitle>
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <div className="space-y-2">
                      {PROGRESS_STEPS_ORDER.map((step) => {
                        const details = asset.progress[step];
                        if (!details) return null;

                        const duration = details.startTime && details.endTime
                          ? calculateDuration(details.startTime, details.endTime)
                          : null;

                        return (
                          <div key={step} className="flex flex-row items-center justify-between text-sm space-x-2">
                            <span className="flex-1 text-gray-400 min-w-[100px]">
                              {formatStepName(step)}
                            </span>
                            <span className={`flex-shrink-0 px-2 py-1 rounded-full text-xs text-center ${
                              details.status === 'COMPLETED' 
                                ? 'bg-green-900/50 text-green-400'
                                : details.status === 'FAILED'
                                ? 'bg-red-900/50 text-red-400'
                                : 'bg-yellow-900/50 text-yellow-400'
                            } min-w-[80px]`}>
                              {details.status}
                            </span>
                            {duration && (
                              <span className="flex-shrink-0 text-xs text-gray-500 text-center min-w-[60px]">
                                {duration}
                              </span>
                            )}
                            {details.error && details.error !== 'N.A' && (
                              <span className="flex-1 text-xs text-red-400 min-w-[100px]">
                                {details.error}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};