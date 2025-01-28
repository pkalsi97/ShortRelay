package validation

import (
    "encoding/json"
    "fmt"
    "os"
    "os/exec"
    "strconv"
    "strings"
    "time"

    "github.com/pkalsi97/ShortRelay/backend/workers/processor/internal/models"
)

type MetadataExtractor struct{}

func NewMetadataExtractor() *MetadataExtractor {
    return &MetadataExtractor{}
}

func (e *MetadataExtractor) ExtractMetadata(filePath string) (*models.TechnicalMetadata, *models.QualityMetrics, *models.ContentMetadata, error) {
    probeData, err := e.runFFprobe(filePath)
    if err != nil {
        return nil, nil, nil, fmt.Errorf("ffprobe failed: %v", err)
    }

    technical := e.extractTechnicalMetadata(probeData)
    quality := e.extractQualityMetrics(probeData, filePath)
    content := e.extractContentMetadata(probeData, filePath)

    return technical, quality, content, nil
}

func (e *MetadataExtractor) runFFprobe(filePath string) (*ffprobeData, error) {
    cmd := exec.Command("ffprobe",
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        filePath)

    output, err := cmd.Output()
    if err != nil {
        return nil, err
    }

    var data ffprobeData
    if err := json.Unmarshal(output, &data); err != nil {
        return nil, err
    }

    return &data, nil
}

func (e *MetadataExtractor) extractTechnicalMetadata(data *ffprobeData) *models.TechnicalMetadata {
    var videoStream, audioStream *ffprobeStream
    for _, stream := range data.Streams {
        if stream.CodecType == "video" && videoStream == nil {
            videoStream = &stream
        } else if stream.CodecType == "audio" && audioStream == nil {
            audioStream = &stream
        }
    }

    duration, _ := strconv.ParseFloat(data.Format.Duration, 64)
    bitrate, _ := strconv.ParseInt(data.Format.BitRate, 10, 64)
    frameRate := 0.0
    if videoStream != nil {
        if parts := strings.Split(videoStream.RFrameRate, "/"); len(parts) == 2 {
            num, _ := strconv.ParseFloat(parts[0], 64)
            den, _ := strconv.ParseFloat(parts[1], 64)
            if den > 0 {
                frameRate = num / den
            }
        }
    }

    resolution := "0x0"
    if videoStream != nil {
        resolution = fmt.Sprintf("%dx%d", videoStream.Width, videoStream.Height)
    }

    return &models.TechnicalMetadata{
        ContainerFormat: strings.Split(data.Format.FormatName, ",")[0],
        VideoCodec:      getCodecName(videoStream),
        AudioCodec:      getCodecName(audioStream),
        Duration:        int64(duration),
        Bitrate:        bitrate,
        FrameRate:      frameRate,
        Resolution:     resolution,
        AspectRatio:    getAspectRatio(videoStream),
        ColorSpace:     getColorSpace(videoStream),
    }
}

func (e *MetadataExtractor) extractQualityMetrics(data *ffprobeData, filePath string) *models.QualityMetrics {
    var videoStream, audioStream *ffprobeStream
    for _, stream := range data.Streams {
        if stream.CodecType == "video" && videoStream == nil {
            videoStream = &stream
        } else if stream.CodecType == "audio" && audioStream == nil {
            audioStream = &stream
        }
    }

    isPlayable, _ := e.checkPlayability(filePath)

    return &models.QualityMetrics{
        VideoQualityScore: calculateVideoQuality(videoStream),
        AudioQualityScore: calculateAudioQuality(audioStream),
        IsCorrupted:      !isPlayable,
        MissingFrames:    hasMissingFrames(videoStream),
        AudioSync:        true,
    }
}

func (e *MetadataExtractor) extractContentMetadata(data *ffprobeData, filePath string) *models.ContentMetadata {
    fileInfo, err := os.Stat(filePath)
    lastModified := "N/A"
    if err == nil {
        lastModified = fileInfo.ModTime().Format(time.RFC3339)
    }

    creationDate := "N/A"
    if data.Format.Tags != nil {
        if ct, ok := data.Format.Tags["creation_time"]; ok {
            creationDate = ct
        }
    }

    return &models.ContentMetadata{
        CreationDate: creationDate,
        LastModified: lastModified,
    }
}

func (e *MetadataExtractor) checkPlayability(filePath string) (bool, error) {
    cmd := exec.Command("ffmpeg",
        "-v", "error",
        "-i", filePath,
        "-f", "null",
        "-",
    )

    if err := cmd.Run(); err != nil {
        return false, err
    }
    return true, nil
}

// Helper functions
func getCodecName(stream *ffprobeStream) string {
    if stream == nil {
        return "N/A"
    }
    return stream.CodecName
}

func getAspectRatio(stream *ffprobeStream) string {
    if stream == nil || stream.DisplayAspectRatio == "" {
        return "N/A"
    }
    return stream.DisplayAspectRatio
}

func getColorSpace(stream *ffprobeStream) string {
    if stream == nil || stream.ColorSpace == "" {
        return "N/A"
    }
    return stream.ColorSpace
}

func calculateVideoQuality(stream *ffprobeStream) int64 {
    if stream == nil {
        return 0
    }
    
    width := float64(stream.Width)
    height := float64(stream.Height)
    
    resolutionScore := (width * height) / (1920 * 1080) * 100
    if resolutionScore > 100 {
        resolutionScore = 100
    }
    
    return int64(resolutionScore)
}

func calculateAudioQuality(stream *ffprobeStream) int64 {
    if stream == nil {
        return 0
    }

    bitrate, _ := strconv.ParseInt(stream.BitRate, 10, 64)

    qualityScore := (float64(bitrate) / 320000) * 100
    if qualityScore > 100 {
        qualityScore = 100
    }
    
    return int64(qualityScore)
}

func hasMissingFrames(stream *ffprobeStream) bool {
    if stream == nil {
        return false
    }
    return stream.NbFrames == ""
}