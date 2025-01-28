package main

import (
    "fmt"
    "log"
    "os"
    "os/exec"
    "path/filepath"
    "strings"
    "bufio"
    "bytes"
)

type FFmpegComponents struct {
    FFmpeg     bool
    FFprobe    bool
    Codecs     map[string]bool
    Formats    map[string]bool
    Libraries  map[string]bool
    Details    map[string]string
}

func runCommand(name string, args ...string) (string, error) {
    cmd := exec.Command(name, args...)
    var out bytes.Buffer
    cmd.Stdout = &out
    cmd.Stderr = &out
    err := cmd.Run()
    return out.String(), err
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
        Details: map[string]string{},
    }

    if ffmpegPath, err := exec.LookPath("ffmpeg"); err == nil {
        components.FFmpeg = true
        components.Details["ffmpeg_path"] = ffmpegPath

        if version, err := runCommand("ffmpeg", "-version"); err == nil {
            components.Details["ffmpeg_version"] = version
        }

        if encoders, err := runCommand("ffmpeg", "-hide_banner", "-encoders"); err == nil {
            components.Details["encoders"] = encoders
            scanner := bufio.NewScanner(strings.NewReader(encoders))
            for scanner.Scan() {
                line := scanner.Text()
                if strings.Contains(line, "libx264") {
                    components.Codecs["libx264"] = true
                }
                if strings.Contains(line, " aac ") {
                    components.Codecs["aac"] = true
                }
                if strings.Contains(line, "png") {
                    components.Libraries["libpng"] = true
                }
            }
        }

        if formats, err := runCommand("ffmpeg", "-hide_banner", "-formats"); err == nil {
            components.Details["formats"] = formats
            scanner := bufio.NewScanner(strings.NewReader(formats))
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
    }

    if ffprobePath, err := exec.LookPath("ffprobe"); err == nil {
        components.FFprobe = true
        components.Details["ffprobe_path"] = ffprobePath
        
        if version, err := runCommand("ffprobe", "-version"); err == nil {
            components.Details["ffprobe_version"] = version
        }
    }

    return components, nil
}

func generateStatusReport(components *FFmpegComponents) string {
    var report strings.Builder

    report.WriteString("\n=== FFmpeg Installation Report ===\n")
    report.WriteString(fmt.Sprintf("FFmpeg: %v (Path: %s)\n", components.FFmpeg, components.Details["ffmpeg_path"]))
    report.WriteString(fmt.Sprintf("FFprobe: %v (Path: %s)\n", components.FFprobe, components.Details["ffprobe_path"]))

    report.WriteString("\nCodecs:\n")
    for codec, installed := range components.Codecs {
        report.WriteString(fmt.Sprintf("- %s: %v\n", codec, installed))
    }

    report.WriteString("\nFormats:\n")
    for format, installed := range components.Formats {
        report.WriteString(fmt.Sprintf("- %s: %v\n", format, installed))
    }

    report.WriteString("\nLibraries:\n")
    for lib, installed := range components.Libraries {
        report.WriteString(fmt.Sprintf("- %s: %v\n", lib, installed))
    }

    report.WriteString("\nDetailed Capabilities:\n")
    report.WriteString("FFmpeg Version Info:\n")
    report.WriteString(components.Details["ffmpeg_version"])

    return report.String()
}

func validateEnvironment() error {
    required := []string{"TASK_ID", "USER_ID", "ASSET_ID", "FOOTAGE_DIR"}
    missing := []string{}
    for _, env := range required {
        if value := os.Getenv(env); value == "" {
            missing = append(missing, env)
        }
    }
    if len(missing) > 0 {
        return fmt.Errorf("missing required environment variables: %v", missing)
    }
    return nil
}

func main() {
    components, err := checkFFmpegInstallation()
    if err != nil {
        log.Fatalf("Failed to check FFmpeg installation: %v", err)
    }

    report := generateStatusReport(components)
    log.Println(report)

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

    log.Printf("\n=== Process Configuration ===\nTask ID: %s\nUser ID: %s\nAsset ID: %s\nWorking Directory: %s\n",
        taskId, userId, assetId, workDir)

    defer func() {
        if err := os.RemoveAll(workDir); err != nil {
            log.Printf("Failed to cleanup working directory: %v", err)
        }
    }()
}