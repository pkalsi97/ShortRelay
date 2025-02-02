import React from 'react';
import ReactPlayer from 'react-player';

interface VideoPlayerProps {
  src: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ src }) => {
  return (
    <div className="player-wrapper">
      <ReactPlayer
        url={src}
        controls
        width="100%"
        height="100%"
        className="react-player"
      />
    </div>
  );
};

export default VideoPlayer;