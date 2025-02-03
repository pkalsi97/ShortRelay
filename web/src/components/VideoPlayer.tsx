/*eslint-disable*/
import React, { useEffect, useRef } from 'react';
import Plyr from "plyr-react";
import Hls from 'hls.js';
import "plyr-react/plyr.css";

interface StreamingProps {
  hls: string;
  iframe?: string;
}

const VideoPlayer = ({ streaming }: { streaming: StreamingProps }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const video = document.querySelector('video');
    if (!video) return;

    if (Hls.isSupported()) {
      const hls = new Hls();
      (video as any).__hls = hls;
      
      hls.loadSource(streaming.hls);
      hls.attachMedia(video);

      const previewVideo = document.createElement('video');
      previewVideo.style.display = 'none';
      previewVideo.preload = 'auto';
      document.body.appendChild(previewVideo);

      const previewHls = new Hls({
        capLevelToPlayerSize: true,
        startLevel: 2,
        maxBufferLength: 5
      });
      previewHls.loadSource(streaming.hls);
      previewHls.attachMedia(previewVideo);

      const progressBar = document.querySelector('.plyr__progress');
      if (progressBar) {
        const preview = document.createElement('div');
        preview.className = 'plyr-preview';
        preview.style.cssText = `
          position: absolute;
          bottom: 20px;
          background: black;
          border: 2px solid white;
          border-radius: 4px;
          display: none;
          width: 160px;
          height: 90px;
          z-index: 1000;
          pointer-events: none;
          box-shadow: 0 2px 8px rgba(0,0,0,0.5);
        `;
        
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 90;
        canvas.style.width = '160px';
        canvas.style.height = '90px';
        preview.appendChild(canvas);
        progressBar.appendChild(preview);

        const ctx = canvas.getContext('2d', { 
          alpha: false,
          desynchronized: true
        });
        
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'medium';
        }

        let throttleTimeout: NodeJS.Timeout | null = null;
        const throttleDelay = 150;

        const handleMouseMove = (e: Event) => {
          const mouseEvent = e as MouseEvent;
          const rect = (progressBar as HTMLElement).getBoundingClientRect();
          const pos = (mouseEvent.clientX - rect.left) / rect.width;
          const time = pos * video.duration;

          preview.style.display = 'block';
          const previewLeft = mouseEvent.clientX - rect.left - 80;
          const maxLeft = rect.width - 160;
          preview.style.left = `${Math.min(Math.max(0, previewLeft), maxLeft)}px`;

          if (throttleTimeout) {
            clearTimeout(throttleTimeout);
          }

          throttleTimeout = setTimeout(() => {
            if (ctx && !previewVideo.seeking && previewVideo.readyState >= 2) {
              previewVideo.currentTime = time;
              const updateCanvas = () => {
                try {
                  ctx.drawImage(previewVideo, 0, 0, canvas.width, canvas.height);
                } catch (error) {
                  console.error('Failed to draw preview:', error);
                }
              };
              previewVideo.addEventListener('seeked', updateCanvas, { once: true });
            }
          }, throttleDelay);
        };

        const handleMouseLeave = () => {
          preview.style.display = 'none';
          if (throttleTimeout) {
            clearTimeout(throttleTimeout);
          }
        };

        progressBar.addEventListener('mousemove', handleMouseMove as EventListener);
        progressBar.addEventListener('mouseleave', handleMouseLeave);

        return () => {
          progressBar.removeEventListener('mousemove', handleMouseMove as EventListener);
          progressBar.removeEventListener('mouseleave', handleMouseLeave);
          if (throttleTimeout) {
            clearTimeout(throttleTimeout);
          }
          previewHls.destroy();
          document.body.removeChild(previewVideo);
          hls.destroy();
          (video as any).__hls = null;
        };
      }

      return () => {
        hls.destroy();
        (video as any).__hls = null;
      };
    }
  }, [streaming]);

  const options = {
    controls: ['play', 'progress', 'current-time', 'mute', 'volume', 'settings', 'fullscreen'],
    settings: ['quality', 'speed'],
    quality: { 
      default: 1080, 
      options: [1080, 720, 480, 360],
      forced: true,
      onChange: (quality: number) => {
        const video = document.querySelector('video');
        if (!video) return;
        
        const hls = (video as any).__hls;
        if (hls) {
          const levelIndex = hls.levels.findIndex(
            (level: any) => level.height === quality
          );
          if (levelIndex !== -1) {
            hls.currentLevel = levelIndex;
            console.log(`Switching to quality: ${quality}p (level ${levelIndex})`);
          }
        }
      }
    }
  };

  return (
    <div className="video-player-container">
      <Plyr
        source={{
          type: 'video',
          sources: [{
            src: streaming.hls,
            type: 'application/vnd.apple.mpegurl'
          }]
        }}
        options={options}
      />
    </div>
  );
};

export default VideoPlayer;