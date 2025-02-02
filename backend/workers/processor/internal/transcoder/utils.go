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
    dirs := []string{
        paths.HLSDir,
        filepath.Join(paths.HLSDir, "audio"),
        filepath.Join(paths.HLSDir, "iframe"),
    }

    for _, res := range resolutions {
        dirs = append(dirs, 
            filepath.Join(paths.HLSDir, "video", res.Name),
            filepath.Join(paths.HLSDir, "iframe", res.Name),
        )
    }

    for _, dir := range dirs {
        if err := os.MkdirAll(dir, 0755); err != nil {
            return fmt.Errorf("failed to create directory %s: %v", dir, err)
        }
    }

    return nil
}