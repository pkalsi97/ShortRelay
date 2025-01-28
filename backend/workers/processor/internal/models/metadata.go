package models

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