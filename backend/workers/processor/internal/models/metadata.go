package models

import (
   "fmt" 
)


type BasicValidationResult struct {
    Exists          bool   `json:"exists"`          
    SizeInBytes     int64  `json:"sizeInBytes"`
    ContainerFormat string `json:"containerFormat"`
    DetectedFormats string `json:"detectedFormats"`
    VideoCodec      string `json:"videoCodec"`
    AudioCodec      string `json:"audioCodec"`
    IsValid         bool   `json:"isValid"`         
}

type StreamValidationResult struct {
    HasVideoStream   bool   `json:"hasVideoStream"`
    HasAudioStream   bool   `json:"hasAudioStream"`
    IsPlayable       bool   `json:"isPlayable"`
    HasCorruptFrames bool   `json:"hasCorruptFrames"`
    Error            string `json:"error"`
}

type TechnicalMetadata struct {
    ContainerFormat string  `json:"containerFormat"`
    VideoCodec      string  `json:"videoCodec"`
    AudioCodec      string  `json:"audioCodec"`
    Duration        int64   `json:"duration"`
    Bitrate         int64   `json:"bitrate"`
    FrameRate       float64 `json:"frameRate"`
    Resolution      string  `json:"resolution"`
    AspectRatio     string  `json:"aspectRatio"`
    ColorSpace      string  `json:"colorSpace"`
}

type QualityMetrics struct {
    VideoQualityScore int64 `json:"videoQualityScore"`
    AudioQualityScore int64 `json:"audioQualityScore"`
    IsCorrupted       bool  `json:"isCorrupted"`
    MissingFrames     bool  `json:"missingFrames"`
    AudioSync         bool  `json:"audioSync"`
}

type ContentMetadataResult struct {
    Technical *TechnicalMetadata `json:"technical"`
    Quality   *QualityMetrics    `json:"quality"`
}

func (r *ContentMetadataResult) String() string {
    formatValue := func(format string, value interface{}) string {
        if value == nil {
            return "N/A"
        }
        return fmt.Sprintf(format, value)
    }

    frameRate := "N/A"
    if r.Technical.FrameRate > 0 {
        frameRate = fmt.Sprintf("%.2f", r.Technical.FrameRate)
    }

    bitrate := "N/A"
    if r.Technical.Bitrate > 0 {
        bitrate = fmt.Sprintf("%.2f", float64(r.Technical.Bitrate)/1000000)
    }
    resolution := "N/A"
    if r.Technical.Resolution != "" {
        resolution = r.Technical.Resolution
    }

    return fmt.Sprintf(`
=== Content Metadata ===
Technical Information:
- Container Format: %s
- Video Codec: %s
- Audio Codec: %s
- Duration: %d seconds
- Bitrate: %s Mbps
- Frame Rate: %s fps
- Resolution: %s
- Aspect Ratio: %s
- Color Space: %s

Quality Metrics:
- Video Quality Score: %d/100
- Audio Quality Score: %d/100
- Has Audio Sync: %v
- Is Corrupted: %v
- Has Missing Frames: %v`,
        formatValue("%s", r.Technical.ContainerFormat),
        formatValue("%s", r.Technical.VideoCodec),
        formatValue("%s", r.Technical.AudioCodec),
        r.Technical.Duration,
        bitrate,
        frameRate,
        resolution,
        formatValue("%s", r.Technical.AspectRatio),
        formatValue("%s", r.Technical.ColorSpace),
        r.Quality.VideoQualityScore,
        r.Quality.AudioQualityScore,
        r.Quality.AudioSync,
        r.Quality.IsCorrupted,
        r.Quality.MissingFrames)
}