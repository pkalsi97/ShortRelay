'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import Image from 'next/image';
import { userApi } from '@/utils/api-client';
import { authService } from '@/utils/auth.service';
import { toast } from 'react-hot-toast';
import { Asset, ApiResponse, Stage } from '@/types/asset.types';
import { AssetDetailsModal } from '@/components/AssetDetailsModal';
interface StageProgressUpdate {
  status: string;
  startTime: string;
  error: string;
  endTime?: string;
}

interface Progress {
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


const determineStage = (asset: Asset): Stage => {
  if (asset.hasCriticalFailure) {
      return 'failed';
  }

  const hasFailedStage = Object.entries(asset.progress).some(
      ([, stage]) => stage?.status === 'FAILED'
  );
  if (hasFailedStage) {
      return 'failed';
  }

  if (asset.stage === 'Finished') {
      return 'finished';
  }

  if (asset.stage === 'postProcessingValidation' || asset.stage === 'completion') {
      return 'finalizing';
  }

  if (asset.stage=== "accepted") {
      return 'queued';
  }

  if (asset.stage === "validation" || asset.stage === "metadata") {
      return 'validation';
  }
  
  const processingStages: Array<keyof Progress> = [
      'download',
      'writeToStorage',
      'initializeProcessor',
      'generateThumbnail',
      'generateMP4Files',
      'generateHLSPlaylists',
      'generateIframePlaylists',
      'uploadTranscodedFootage'
  ];
  
  if (processingStages.some(stage => stage === asset.stage)) {
      return 'processing';
  }
  
  return 'upload';
};

const stageConfig: Record<Stage, { label: string; color: string }> = {
  'upload': {
      label: '📤 Uploading',
      color: 'bg-blue-900/50 text-blue-400',
  },
  'validation': {
      label: '🔍 Validating',
      color: 'bg-yellow-900/50 text-yellow-400',
  },
  'queued': {
      label: '⏳ Queued',
      color: 'bg-orange-900/50 text-orange-400',
  },
  'processing': {
      label: '⚙️ Processing',
      color: 'bg-purple-900/50 text-purple-400',
  },
  'finalizing': {
      label: '✨ Finalizing',
      color: 'bg-indigo-900/50 text-indigo-400',
  },
  'finished': {
      label: '✅ Ready',
      color: 'bg-green-900/50 text-green-400',
  },
  'failed': {
      label: '❌ Failed',
      color: 'bg-red-900/50 text-red-400',
  }
};

const LoadingSkeleton = () => (
  <div className="bg-gray-900 rounded-lg overflow-hidden animate-pulse">
    <div className="aspect-video bg-gray-800"></div>
    <div className="p-4">
      <div className="h-4 bg-gray-800 rounded w-3/4"></div>
      <div className="mt-2 h-3 bg-gray-800 rounded w-1/2"></div>
      <div className="mt-4 flex justify-between items-center">
        <div className="h-3 bg-gray-800 rounded w-1/4"></div>
        <div className="h-3 bg-gray-800 rounded w-1/4"></div>
      </div>
    </div>
  </div>
);

const VideoCard = ({ asset, onViewDetails }: { 
  asset: Asset; 
  onViewDetails: (assetId: string) => void 
}) => {
  const currentStage = determineStage(asset);
  const stageDisplay = stageConfig[currentStage] || stageConfig['processing'];

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden hover:ring-2 hover:ring-purple-500 transition-all duration-200">
      <div className="aspect-video bg-gray-800 relative">
        {asset.metadata?.distribution?.thumbnail ? (
          <Image
            src={asset.metadata.distribution.thumbnail}
            alt={`Thumbnail for ${asset.assetId}`}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-600">
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <p className="text-gray-100 text-xs break-all">
              Asset ID: {asset.assetId}
            </p>
          </div>
        </div>
        <div className="mt-2">
          <p className="text-xs text-gray-400">
            Created: {format(new Date(asset.createdAt), 'MMM dd, yyyy hh:mm a')}
          </p>
        </div>
        <div className="mt-4 flex justify-between items-center">
          <span className={`text-xs px-2 py-1 rounded-full ${stageDisplay.color}`}>
            {stageDisplay.label}
          </span>
          <button
            onClick={() => onViewDetails(asset.assetId)}
            className="text-purple-500 hover:text-purple-400 text-sm transition-colors"
          >
            View Details
          </button>
        </div>
      </div>
    </div>
  );
};

export default function Library() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const fetchAssets = useCallback(async () => {
    try {
      setError(null);
      const accessToken = authService.getAccessToken();
      const idToken = authService.getIdToken();

      if (!accessToken || !idToken) {
        throw new Error('Authentication failed');
      }

      const response = await userApi.get<ApiResponse>(
        '/v1/user/assets/all',
        {
          headers: {
            'authorization': `Bearer ${idToken}`,
            'x-access-token': `Bearer ${accessToken}`
          }
        }
      );

      if (response.success) {
        setAssets(response.data);
      } else {
        throw new Error(response.message);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load videos';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const { activeAssets, failedAssets } = useMemo(() => {
    const sortByDate = (a: Asset, b: Asset) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

    const failed = assets
      .filter(asset => 
        asset.hasCriticalFailure || 
        Object.values(asset.progress).some(stage => stage?.status === 'FAILED')
      )
      .sort(sortByDate);

    const active = assets
      .filter(asset => 
        !asset.hasCriticalFailure && 
        !Object.values(asset.progress).some(stage => stage?.status === 'FAILED')
      )
      .sort(sortByDate);

    return { activeAssets: active, failedAssets: failed };
  }, [assets]);

  const handleViewDetails = (assetId: string) => {
    setSelectedAssetId(assetId);
  };

  return (
    <>
      <div className="max-w-4xl mx-auto pb-20">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-100">
            Your Videos
          </h1>
          {!isLoading && (
            <button
              onClick={() => {
                window.location.reload();
              }}
              className="text-sm text-purple-500 hover:text-purple-400 transition-colors"
            >
              Refresh
            </button>
          )}
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-900/50 text-red-400 rounded-lg">
            {error}
          </div>
        )}

        <div className="mt-8">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => <LoadingSkeleton key={i} />)}
            </div>
          ) : assets.length > 0 ? (
            <>
              {/* Active Assets */}
              {activeAssets.length > 0 && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activeAssets.map((asset) => (
                      <VideoCard 
                        key={asset.assetId} 
                        asset={asset}
                        onViewDetails={handleViewDetails}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Failed Assets */}
              {failedAssets.length > 0 && (
                <div className="space-y-6 mt-8">
                  <h2 className="text-xl font-semibold text-gray-300">
                    Failed Videos
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {failedAssets.map((asset) => (
                      <VideoCard 
                        key={asset.assetId} 
                        asset={asset}
                        onViewDetails={handleViewDetails}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="col-span-full text-center py-12 text-gray-400">
              No videos found. Upload your first video to get started.
            </div>
          )}
        </div>
      </div>

      <AssetDetailsModal
        isOpen={!!selectedAssetId}
        onClose={() => setSelectedAssetId(null)}
        assetId={selectedAssetId}
      />
    </>
  );
}