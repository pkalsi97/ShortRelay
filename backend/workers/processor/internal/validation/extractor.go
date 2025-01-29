package validation

import (
    "encoding/json"
    "fmt"
    "os/exec"
    "strconv"
    "strings"

    "github.com/pkalsi97/ShortRelay/backend/workers/processor/internal/models"
)

type MetadataExtractor struct{}

func NewMetadataExtractor() *MetadataExtractor {
    return &MetadataExtractor{}
}

func (e *MetadataExtractor) GetContentMetadata(filepath string) (*models.ContentMetadataResult, error) {
    cmd := exec.Command("ffprobe",
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        filepath)

    output, err := cmd.Output()
    if err != nil {
        return nil, fmt.Errorf("ffprobe execution failed: %v", err)
    }

    var ffdata ffprobeData
    if err := json.Unmarshal(output, &ffdata); err != nil {
        return nil, fmt.Errorf("failed to parse ffprobe output: %v", err)
    }

    result := &models.ContentMetadataResult{
        Technical: &models.TechnicalMetadata{},
        Quality:   &models.QualityMetrics{},
    }

    e.extractMetadata(ffdata, result)
    return result, nil
}

func (e *MetadataExtractor) extractMetadata(ffdata ffprobeData, result *models.ContentMetadataResult) {
    result.Technical.ContainerFormat = strings.Split(ffdata.Format.FormatName, ",")[0]
    
    if duration, err := strconv.ParseFloat(ffdata.Format.Duration, 64); err == nil {
        result.Technical.Duration = int64(duration)
    }
    
    if bitrate, err := strconv.ParseInt(ffdata.Format.BitRate, 10, 64); err == nil {
        result.Technical.Bitrate = bitrate
    }

    result.Quality.VideoQualityScore = -1
    result.Quality.AudioQualityScore = -1
    result.Quality.IsCorrupted = false
    result.Quality.MissingFrames = false
    result.Quality.AudioSync = true

    hasVideo := false
    hasAudio := false
    
    for _, stream := range ffdata.Streams {
        switch stream.CodecType {
        case "video":
            hasVideo = true
            e.processVideoStream(stream, result)
        case "audio":
            hasAudio = true
            e.processAudioStream(stream, result)
        }
    }

    result.Quality.AudioSync = hasVideo && hasAudio
}

func (e *MetadataExtractor) processVideoStream(stream ffprobeStream, result *models.ContentMetadataResult) {
    result.Technical.VideoCodec = stream.CodecName

    if frameRate := stream.RFrameRate; frameRate != "" {
        if nums := strings.Split(frameRate, "/"); len(nums) == 2 {
            num1, err1 := strconv.ParseFloat(nums[0], 64)
            num2, err2 := strconv.ParseFloat(nums[1], 64)
            if err1 == nil && err2 == nil && num2 != 0 {
                result.Technical.FrameRate = num1 / num2
            }
        }
    }

    if stream.Width > 0 && stream.Height > 0 {
        result.Technical.Resolution = fmt.Sprintf("%dx%d", stream.Width, stream.Height)
    }

    result.Technical.AspectRatio = stream.DisplayAspectRatio
    result.Technical.ColorSpace = stream.ColorSpace

    var score int64 = 50

    if stream.Width >= 1920 && stream.Height >= 1080 {
        score += 20
    } else if stream.Width >= 1280 && stream.Height >= 720 {
        score += 10
    }

    if bitrate, err := strconv.ParseInt(stream.BitRate, 10, 64); err == nil {
        if bitrate > 5000000 {
            score += 20
        } else if bitrate > 2000000 {
            score += 10
        }
    }

    if fps := result.Technical.FrameRate; fps >= 30 {
        score += 10
    }

    if score > 100 {
        score = 100
    }
    result.Quality.VideoQualityScore = score
}

func (e *MetadataExtractor) processAudioStream(stream ffprobeStream, result *models.ContentMetadataResult) {
    result.Technical.AudioCodec = stream.CodecName

    var score int64 = 50
    if bitrate, err := strconv.ParseInt(stream.BitRate, 10, 64); err == nil {
        if bitrate > 320000 {
            score += 25
        } else if bitrate > 192000 {
            score += 15
        } else if bitrate > 128000 {
            score += 10
        }
    }
    
    if score > 100 {
        score = 100
    }
    result.Quality.AudioQualityScore = score
}