package main

import (
    "fmt"
    "log"
    "os"
    "os/exec"
    "path/filepath"
    "strings"
    "bufio"
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
            "hls":  false,
            "dash": false,
        },
        Libraries: map[string]bool{
            "libpng": false,
        },
    }

    // Check basic installation
    ffmpegPath, err := exec.LookPath("ffmpeg")
    if err == nil {
        components.FFmpeg = true
        log.Printf("FFmpeg found at: %s", ffmpegPath)
    }

    ffprobePath, err := exec.LookPath("ffprobe")
    if err == nil {
        components.FFprobe = true
        log.Printf("FFprobe found at: %s", ffprobePath)
    }

    // Check encoders
    cmd := exec.Command("ffmpeg", "-encoders")
    output, err := cmd.Output()
    if err == nil {
        outputStr := string(output)
        scanner := bufio.NewScanner(strings.NewReader(outputStr))
        for scanner.Scan() {
            line := scanner.Text()
            if strings.Contains(line, "libx264") {
                components.Codecs["libx264"] = true
            }
            if strings.Contains(line, " aac ") {
                components.Codecs["aac"] = true
            }
        }
    }

    // Check formats
    cmd = exec.Command("ffmpeg", "-formats")
    output, err = cmd.Output()
    if err == nil {
        outputStr := string(output)
        scanner := bufio.NewScanner(strings.NewReader(outputStr))
        for scanner.Scan() {
            line := scanner.Text()
            if strings.Contains(line, " hls ") {
                components.Formats["hls"] = true
            }
            if strings.Contains(line, " dash ") {
                components.Formats["dash"] = true
            }
        }
    }

    // Check configuration and libraries
    cmd = exec.Command("ffmpeg", "-version")
    output, err = cmd.Output()
    if err == nil {
        outputStr := string(output)
        if strings.Contains(outputStr, "enable-libpng") || 
           strings.Contains(outputStr, "--enable-libpng") ||
           strings.Contains(outputStr, "png") {
            components.Libraries["libpng"] = true
        }
    }

    // Additional verification
    if components.FFmpeg {
        // Verify H.264 encoding capability
        cmd = exec.Command("ffmpeg", "-hide_banner", "-h", "encoder=libx264")
        if err := cmd.Run(); err == nil {
            components.Codecs["libx264"] = true
        }

        // Verify AAC encoding capability
        cmd = exec.Command("ffmpeg", "-hide_banner", "-h", "encoder=aac")
        if err := cmd.Run(); err == nil {
            components.Codecs["aac"] = true
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

func validateEnvironment() error {
    required := []string{"TASK_ID", "USER_ID", "ASSET_ID", "FOOTAGE_DIR"}
    for _, env := range required {
        if value := os.Getenv(env); value == "" {
            return fmt.Errorf("required environment variable %s is not set", env)
        }
    }
    return nil
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

    if err := validateEnvironment(); err != nil {
        log.Fatalf("Environment validation failed: %v", err)
    }

    taskId := os.Getenv("TASK_ID")
    userId := os.Getenv("USER_ID")
    assetId := os.Getenv("ASSET_ID")
    footageDir := os.Getenv("FOOTAGE_DIR")

    workDir := filepath.Join(footageDir, taskId)
    if err := os.MkdirAll(workDir, 0755); err != nil {
        log.Fatalf("Failed to create working directory: %v", err)
    }

    defer func() {
        if err := os.RemoveAll(workDir); err != nil {
            log.Printf("Failed to cleanup working directory: %v", err)
        }
    }()

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