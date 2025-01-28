package main

import (
    "fmt"
    "log"
    "os"
    "time" 
    "path/filepath"

    "github.com/pkalsi97/ShortRelay/backend/workers/processor/internal/storage/s3"
    "github.com/pkalsi97/ShortRelay/backend/workers/processor/internal/validation"
    "github.com/pkalsi97/ShortRelay/backend/workers/processor/internal/transcoder"
)

type Config struct {
    TaskID          string
    UserID          string
    AssetID         string
    FootageDir      string
    AWSRegion       string
    TransportBucket string
    ContentBucket   string
    MetadataTable   string
    InputKey        string
    OutputKey       string
}

func loadConfig() (*Config, error) {
    config := &Config{}
    envVars := map[string]*string{
        "TASK_ID":          &config.TaskID,
        "USER_ID":          &config.UserID,
        "ASSET_ID":         &config.AssetID,
        "FOOTAGE_DIR":      &config.FootageDir,
        "AWS_REGION":       &config.AWSRegion,
        "TRANSPORT_BUCKET": &config.TransportBucket,
        "CONTENT_BUCKET":   &config.ContentBucket,
        "METADATA_TABLE":   &config.MetadataTable,
        "INPUT_KEY":        &config.InputKey,
        "OUTPUT_KEY":       &config.OutputKey,
    }

    missingVars := []string{}
    for env, ptr := range envVars {
        if *ptr = os.Getenv(env); *ptr == "" {
            missingVars = append(missingVars, env)
        }
    }

    if len(missingVars) > 0 {
        return nil, fmt.Errorf("missing required environment variables: %v", missingVars)
    }

    return config, nil
}

func main() {
    start := time.Now()
    defer func() {
        log.Fatalf("Total execution time: %v", time.Since(start))
    }()

    config, err := loadConfig()
    if err != nil {
        log.Fatalf("Failed to load config: %v", err)
    }
    log.Printf("Config loaded: %+v", config)

    workDir := filepath.Join(config.FootageDir, config.TaskID)
    if err := os.MkdirAll(workDir, 0755); err != nil {
        log.Fatalf("Failed to create working directory: %v", err)
    }

    s3TransportClient, err := s3.NewS3Client(config.AWSRegion, config.TransportBucket)
    if err != nil {
        log.Fatalf("Failed to create transport S3 client: %v", err)
    }

    downloadedData, err := s3TransportClient.DownloadFile(config.InputKey)
    if err != nil {
        log.Fatalf("Failed to download file: %v", err)
    }

    tempFile := filepath.Join(workDir, "input.mp4")
    if err := os.WriteFile(tempFile, downloadedData, 0644); err != nil {
        log.Fatalf("Failed to write temporary file: %v", err)
    }

    validator := validation.NewValidator()

    basicResult, err := validator.ValidateBasic(tempFile)
    if err != nil {
        log.Fatalf("Basic validation failed: %v", err)
    }
    log.Printf("Basic Validation Result: %+v", basicResult)

    streamResult, err := validator.ValidateStream(tempFile)
    if err != nil {
        log.Fatalf("Stream validation failed: %v", err)
    }
    log.Printf("Stream Validation Result: %+v", streamResult)

    extractor := validation.NewMetadataExtractor()
    metadata, err := extractor.GetContentMetadata(tempFile)
    if err != nil {
        log.Printf("Warning: metadata extraction had errors: %v", err)
    }
    log.Printf(`
        === Media File Analysis ===

        Technical Metadata:
        - Container Format: %s
        - Video Codec: %s
        - Audio Codec: %s
        - Duration: %d seconds
        - Bitrate: %d bps
        - Frame Rate: %.2f fps
        - Resolution: %s
        - Aspect Ratio: %s
        - Color Space: %s

        Quality Metrics:
        - Video Quality Score: %d
        - Audio Quality Score: %d
        - Is Corrupted: %t
        - Missing Frames: %t
        - Audio Sync: %t
        `,
            metadata.Technical.ContainerFormat,
            metadata.Technical.VideoCodec,
            metadata.Technical.AudioCodec,
            metadata.Technical.Duration,
            metadata.Technical.Bitrate,
            metadata.Technical.FrameRate,
            metadata.Technical.Resolution,
            metadata.Technical.AspectRatio,
            metadata.Technical.ColorSpace,
            metadata.Quality.VideoQualityScore,
            metadata.Quality.AudioQualityScore,
            metadata.Quality.IsCorrupted,
            metadata.Quality.MissingFrames,
            metadata.Quality.AudioSync,
        )
        resolutions := []transcoder.Resolution{
            {
                Name:    "1080p",
                Width:   1920,
                Height:  1080,
                Bitrate: "3000k",
            },
            {
                Name:    "720p",
                Width:   1280,
                Height:  720,
                Bitrate: "2000k",
            },
            {
                Name:    "480p",
                Width:   854,
                Height:  480,
                Bitrate: "800k",
            },
            {
                Name:    "360p",
                Width:   640,
                Height:  360,
                Bitrate: "400k",
            },
        }

        if err := transcoder.Process(tempFile, resolutions); err != nil {
            log.Fatalf("Transcoding failed: %v", err)
        }

    defer func() {
        if err := os.RemoveAll(workDir); err != nil {
            log.Printf("Failed to cleanup working directory: %v", err)
        }
    }()
}