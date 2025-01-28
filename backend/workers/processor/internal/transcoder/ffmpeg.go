package transcoder

import (
    "encoding/json"
    "fmt"
    "os"
    "os/exec"
    "strconv"
    "strings"
)

func runFFmpeg(args []string) error {
    cmd := exec.Command("ffmpeg", args...)
    cmd.Stdout = os.Stdout
    cmd.Stderr = os.Stderr
    return cmd.Run()
}

func runFFprobe(args []string) ([]byte, error) {
    cmd := exec.Command("ffprobe", args...)
    return cmd.Output()
}

func getVideoInfo(inputPath string) (*VideoInfo, error) {
    probeCmd := exec.Command("ffprobe",
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height,display_aspect_ratio:format=duration",
        "-of", "json",
        inputPath)

    output, err := probeCmd.Output()
    if err != nil {
        return nil, fmt.Errorf("failed to probe video: %v", err)
    }

    type ProbeData struct {
        Streams []struct {
            Width       int    `json:"width"`
            Height      int    `json:"height"`
            AspectRatio string `json:"display_aspect_ratio"`
        } `json:"streams"`
        Format struct {
            Duration string `json:"duration"`
        } `json:"format"`
    }

    var data ProbeData
    if err := json.Unmarshal(output, &data); err != nil {
        return nil, fmt.Errorf("failed to parse probe data: %v", err)
    }

    if len(data.Streams) == 0 {
        return nil, fmt.Errorf("no video streams found")
    }

    audioProbeCmd := exec.Command("ffprobe",
        "-v", "error",
        "-select_streams", "a:0",
        "-show_entries", "stream=codec_type",
        "-of", "json",
        inputPath)

    audioOutput, _ := audioProbeCmd.Output()
    hasAudio := strings.Contains(string(audioOutput), "audio")

    duration, _ := strconv.ParseFloat(data.Format.Duration, 64)

    return &VideoInfo{
        Width:      data.Streams[0].Width,
        Height:     data.Streams[0].Height,
        Duration:   duration,
        HasAudio:   hasAudio,
        IsVertical: data.Streams[0].Height > data.Streams[0].Width,
    }, nil
}