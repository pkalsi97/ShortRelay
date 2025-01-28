package transcoder

import (
    "fmt"
    "os"
    "path/filepath"
    "strconv"
    "strings"
)

func createDirectories(paths *OutputPaths) error {
    dirs := []string{
        paths.MP4Dir,
        paths.HLSDir,
        paths.AssetsDir,
        paths.LogsDir,
    }

    for _, dir := range dirs {
        if err := os.MkdirAll(dir, 0755); err != nil {
            return fmt.Errorf("failed to create directory %s: %v", dir, err)
        }
    }
    return nil
}

func getBitrate(bitrate string) int {
    numStr := strings.TrimSuffix(bitrate, "k")
    num, _ := strconv.Atoi(numStr)
    return num
}

func getBufsize(bitrate string) int {
    return getBitrate(bitrate) * 2
}

func getBandwidth(bitrate string) int {
    return getBitrate(bitrate) * 1000
}

func createHLSDirectories(paths *OutputPaths, resolutions []Resolution) error {
    for _, res := range resolutions {
        dir := filepath.Join(paths.HLSDir, "video", res.Name, "segments")
        if err := os.MkdirAll(dir, 0755); err != nil {
            return err
        }
    }

    if err := os.MkdirAll(filepath.Join(paths.HLSDir, "audio", "segments"), 0755); err != nil {
        return err
    }

    if err := os.MkdirAll(filepath.Join(paths.HLSDir, "iframe"), 0755); err != nil {
        return err
    }

    return nil
}