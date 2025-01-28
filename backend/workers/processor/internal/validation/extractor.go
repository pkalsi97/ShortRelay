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
    ffdata, err := e.runFFprobe(filepath)
    if err != nil {
        return nil, fmt.Errorf("failed to run ffprobe: %v", err)
    }

    result := &models.ContentMetadataResult{
        Technical: &models.TechnicalMetadata{},
        Quality:   &models.QualityMetrics{},
    }

    e.extractTechnicalMetadata(ffdata, result.Technical)
    e.extractQualityMetrics(filepath, ffdata, result.Quality)

    return result, nil
}

func (e *MetadataExtractor) runFFprobe(filepath string) (ffprobeData, error) {
    var data ffprobeData

    cmd := exec.Command("ffprobe",
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        filepath)

    output, err := cmd.Output()
    if err != nil {
        return data, fmt.Errorf("ffprobe execution failed: %v", err)
    }

    err = json.Unmarshal(output, &data)
    if err != nil {
        return data, fmt.Errorf("failed to parse ffprobe output: %v", err)
    }

    return data, nil
}

func (e *MetadataExtractor) extractTechnicalMetadata(ffdata ffprobeData, technical *models.TechnicalMetadata) {
    technical.ContainerFormat = strings.Split(ffdata.Format.FormatName, ",")[0]

    if duration, err := strconv.ParseFloat(ffdata.Format.Duration, 64); err == nil {
        technical.Duration = int64(duration)
    }

    if bitrate, err := strconv.ParseInt(ffdata.Format.BitRate, 10, 64); err == nil {
        technical.Bitrate = bitrate
    }

    for _, stream := range ffdata.Streams {
        switch stream.CodecType {
        case "video":
            e.extractVideoMetadata(stream, technical)
        case "audio":
            e.extractAudioMetadata(stream, technical)
        }
    }
}

func (e *MetadataExtractor) extractVideoMetadata(stream ffprobeStream, technical *models.TechnicalMetadata) {
    technical.VideoCodec = stream.CodecName

    if frameRate := stream.RFrameRate; frameRate != "" {
        if nums := strings.Split(frameRate, "/"); len(nums) == 2 {
            num1, err1 := strconv.ParseFloat(nums[0], 64)
            num2, err2 := strconv.ParseFloat(nums[1], 64)
            if err1 == nil && err2 == nil && num2 != 0 {
                technical.FrameRate = num1 / num2
            }
        }
    }

    if stream.Width > 0 && stream.Height > 0 {
        technical.Resolution = fmt.Sprintf("%dx%d", stream.Width, stream.Height)
    }

    technical.AspectRatio = stream.DisplayAspectRatio
    technical.ColorSpace = stream.ColorSpace
}

func (e *MetadataExtractor) extractAudioMetadata(stream ffprobeStream, technical *models.TechnicalMetadata) {
    technical.AudioCodec = stream.CodecName
}

func (e *MetadataExtractor) extractQualityMetrics(filepath string, ffdata ffprobeData, quality *models.QualityMetrics) {

    quality.VideoQualityScore = -1
    quality.AudioQualityScore = -1
    quality.IsCorrupted = false
    quality.MissingFrames = false
    quality.AudioSync = true

    if err := e.checkVideoIntegrity(filepath); err != nil {
        quality.IsCorrupted = true
    }

    for _, stream := range ffdata.Streams {
        if stream.CodecType == "video" {
            quality.VideoQualityScore = e.calculateVideoQualityScore(stream)
        } else if stream.CodecType == "audio" {
            quality.AudioQualityScore = e.calculateAudioQualityScore(stream)
        }
    }

    quality.AudioSync = e.checkAudioSync(filepath)
}

func (e *MetadataExtractor) checkVideoIntegrity(filepath string) error {
    cmd := exec.Command("ffmpeg",
        "-v", "error",
        "-i", filepath,
        "-f", "null",
        "-")

    output, err := cmd.CombinedOutput()
    if err != nil || len(output) > 0 {
        return fmt.Errorf("video integrity check failed: %v", string(output))
    }
    return nil
}

func (e *MetadataExtractor) calculateVideoQualityScore(stream ffprobeStream) int64 {
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


    if nums := strings.Split(stream.RFrameRate, "/"); len(nums) == 2 {
        num1, err1 := strconv.ParseFloat(nums[0], 64)
        num2, err2 := strconv.ParseFloat(nums[1], 64)
        if err1 == nil && err2 == nil && num2 != 0 {
            fps := num1 / num2
            if fps >= 30 {
                score += 10
            }
        }
    }

    if score > 100 {
        score = 100
    }
    return score
}

func (e *MetadataExtractor) calculateAudioQualityScore(stream ffprobeStream) int64 {
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
    return score
}

func (e *MetadataExtractor) checkAudioSync(filepath string) bool {
    cmd := exec.Command("ffmpeg",
        "-v", "error",
        "-i", filepath,
        "-af", "silencedetect=noise=-50dB:d=0.1",
        "-f", "null",
        "-")

    output, err := cmd.CombinedOutput()
    if err != nil || len(output) > 0 {
        return false
    }
    return true
}