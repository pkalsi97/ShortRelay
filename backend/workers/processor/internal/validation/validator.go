package validation

import (
    "encoding/json"
    "os"
    "os/exec"
    "path/filepath"
    "strings"

    "github.com/pkalsi97/ShortRelay/backend/workers/processor/internal/models"
)

type Validator struct {
    supportedFormats     []string
    supportedVideoCodecs []string
    supportedAudioCodecs []string
}

func NewValidator() *Validator {
    return &Validator{
        supportedFormats:     []string{"mp4", "mov", "avi", "mkv"},
        supportedVideoCodecs: []string{"h264", "hevc", "vp8", "vp9"},
        supportedAudioCodecs: []string{"aac", "mp3", "opus"},
    }
}

func (v *Validator) ValidateBasic(filePath string) (*models.BasicValidationResult, error) {
    info, err := os.Stat(filePath)
    if err != nil {
        return &models.BasicValidationResult{
            Exists:      false,
            SizeInBytes: 0,
        }, nil
    }

    probeData, err := v.runFFprobe(filePath)
    if err != nil {
        return &models.BasicValidationResult{
            Exists:          true,
            SizeInBytes:     info.Size(),
            ContainerFormat: "unknown",
            DetectedFormats: "unknown",
            VideoCodec:      "none",
            AudioCodec:      "none",
            IsValid:         false,
        }, nil
    }

    format := filepath.Ext(filePath)
    format = strings.TrimPrefix(format, ".")
    if format == "" {
        format = strings.Split(probeData.Format.FormatName, ",")[0]
    }

    var videoCodec, audioCodec string
    for _, stream := range probeData.Streams {
        switch stream.CodecType {
        case "video":
            videoCodec = strings.ToLower(stream.CodecName)
        case "audio":
            audioCodec = strings.ToLower(stream.CodecName)
        }
    }

    result := &models.BasicValidationResult{
        Exists:          true,
        SizeInBytes:     info.Size(),
        ContainerFormat: format,
        DetectedFormats: probeData.Format.FormatName,
        VideoCodec:      videoCodec,
        AudioCodec:      audioCodec,
    }

    result.IsValid = v.isValidVideo(format, videoCodec, audioCodec)
    return result, nil
}

func (v *Validator) ValidateStream(filePath string) (*models.StreamValidationResult, error) {
    probeData, err := v.runFFprobe(filePath)
    if err != nil {
        return &models.StreamValidationResult{
            HasVideoStream:   false,
            HasAudioStream:   false,
            IsPlayable:       false,
            HasCorruptFrames: true,
            Error:           "Unable to read file metadata",
        }, nil
    }

    var hasVideo, hasAudio bool
    for _, stream := range probeData.Streams {
        switch stream.CodecType {
        case "video":
            hasVideo = true
        case "audio":
            hasAudio = true
        }
    }

    isPlayable, playabilityError := v.checkPlayability(filePath)

    return &models.StreamValidationResult{
        HasVideoStream:   hasVideo,
        HasAudioStream:   hasAudio,
        IsPlayable:      isPlayable,
        HasCorruptFrames: !isPlayable,
        Error:           playabilityError,
    }, nil
}

func (v *Validator) runFFprobe(filePath string) (*ffprobeData, error) {
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

    var probeData ffprobeData
    if err := json.Unmarshal(output, &probeData); err != nil {
        return nil, err
    }

    return &probeData, nil
}

func (v *Validator) isValidVideo(format, videoCodec, audioCodec string) bool {
    formatValid := false
    for _, f := range v.supportedFormats {
        if strings.Contains(format, f) {
            formatValid = true
            break
        }
    }

    videoValid := false
    for _, codec := range v.supportedVideoCodecs {
        if videoCodec == codec {
            videoValid = true
            break
        }
    }

    audioValid := false
    for _, codec := range v.supportedAudioCodecs {
        if audioCodec == codec {
            audioValid = true
            break
        }
    }

    return formatValid && videoValid && audioValid
}

func (v *Validator) checkPlayability(filePath string) (bool, string) {
    cmd := exec.Command("ffmpeg",
        "-v", "error",
        "-i", filePath,
        "-f", "null",
        "-c", "copy",
        os.DevNull)

    if err := cmd.Run(); err != nil {
        if exitErr, ok := err.(*exec.ExitError); ok {
            return false, string(exitErr.Stderr)
        }
        return false, err.Error()
    }

    return true, ""
}