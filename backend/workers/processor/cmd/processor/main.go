package main

import (
    "fmt"
    "log"
    "os"
    "os/exec"
    "path/filepath"
    "strings"
)

type FFmpegComponents struct {
    FFmpeg     bool
    FFprobe    bool
    Codecs     map[string]bool
    Formats    map[string]bool
    Libraries  map[string]bool
}

func checkFFmpegInstallation() (*FFmpegComponents, error) {
    components := &FFmpegComponents{
        Codecs: map[string]bool{
            "libx264": false,
            "aac":     false,
        },
        Formats: map[string]bool{
            "hls": false,
            "dash": false,
        },
        Libraries: map[string]bool{
            "libpng": false,
        },
    }

    if _, err := exec.LookPath("ffmpeg"); err == nil {
        components.FFmpeg = true
    }

    if _, err := exec.LookPath("ffprobe"); err == nil {
        components.FFprobe = true
    }

    cmd := exec.Command("ffmpeg", "-version")
    output, err := cmd.Output()
    if err != nil {
        return nil, fmt.Errorf("failed to get FFmpeg version: %v", err)
    }

    outputStr := string(output)

    for codec := range components.Codecs {
        if strings.Contains(outputStr, codec) {
            components.Codecs[codec] = true
        }
    }

    for format := range components.Formats {
        if strings.Contains(outputStr, format) {
            components.Formats[format] = true
        }
    }

    for lib := range components.Libraries {
        if strings.Contains(outputStr, lib) {
            components.Libraries[lib] = true
        }
    }

    return components, nil
}

func logFFmpegStatus(components *FFmpegComponents) {
    log.Println("FFmpeg Components Status:")
    log.Printf("FFmpeg installed: %v", components.FFmpeg)
    log.Printf("FFprobe installed: %v", components.FFprobe)
    
    log.Println("\nCodecs:")
    for codec, installed := range components.Codecs {
        log.Printf("- %s: %v", codec, installed)
    }
    
    log.Println("\nFormats:")
    for format, installed := range components.Formats {
        log.Printf("- %s: %v", format, installed)
    }
    
    log.Println("\nLibraries:")
    for lib, installed := range components.Libraries {
        log.Printf("- %s: %v", lib, installed)
    }
}

func main() {
    components, err := checkFFmpegInstallation()
    if err != nil {
        log.Fatalf("Failed to check FFmpeg installation: %v", err)
    }

    logFFmpegStatus(components)

    if !components.FFmpeg || !components.FFprobe {
        log.Fatal("Required FFmpeg components are missing")
    }

    taskId := os.Getenv("TASK_ID")
    userId := os.Getenv("USER_ID")
    assetId := os.Getenv("ASSET_ID")
    footageDir := os.Getenv("FOOTAGE_DIR")

    workDir := filepath.Join(footageDir, taskId)
    if err := os.MkdirAll(workDir, 0755); err != nil {
        log.Fatalf("Failed to create working directory: %v", err)
    }

    defer os.RemoveAll(workDir)

    log.Printf("Processor started")
    log.Printf("Task ID: %s", taskId)
    log.Printf("User ID: %s", userId)
    log.Printf("Asset ID: %s", assetId)
    log.Printf("Working Directory: %s", workDir)

    testFile := filepath.Join(workDir, "test.txt")
    if err := os.WriteFile(testFile, []byte("test"), 0644); err != nil {
        log.Printf("Failed to write test file: %v", err)
    }
}