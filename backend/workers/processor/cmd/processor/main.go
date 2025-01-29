package main

import (
    "fmt"
    "log"
    "os"
    "time"
    "path/filepath"
    "runtime"
    "context"

    "github.com/pkalsi97/ShortRelay/backend/workers/processor/internal/storage/s3"
    "github.com/pkalsi97/ShortRelay/backend/workers/processor/internal/storage/dynamodb"
    "github.com/pkalsi97/ShortRelay/backend/workers/processor/internal/transcoder"
)

type StopWatch struct {
    start time.Time
    name  string
}

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


func NewStopWatch(name string) *StopWatch {
    sw := &StopWatch{
        start: time.Now(),
        name:  name,
    }
    return sw
}

const (
    bold    = "\033[1m"
    blue    = "\033[34m"
    reset   = "\033[0m"
    format  = "%s[STEP]%s %-25s %s Duration: %.3fs%s\n"
)


func (sw *StopWatch) Stop() {
    duration := time.Since(sw.start)
    fmt.Printf(format,
        bold, reset,
        sw.name,
        blue, duration.Seconds(), reset,
    )
}

func updateState(ctx context.Context, updater *db.ProgressUpdater, userId string, assetId string, state string, success bool) {
    if err := updater.UpdateProgress(ctx, userId, assetId, state, success); err != nil {
        log.Printf("Failed to update %s state: %v", state, err)
    }
}

func main() {
    var workDir string

    swm := NewStopWatch("Overall")
    defer func() {
        if r := recover(); r != nil {
            log.Printf("Recovered from fatal panic: %v", r)
        }
        if workDir != "" {
            if err := os.RemoveAll(workDir); err != nil {
                log.Printf("Failed to cleanup working directory: %v", err)
            }
        }
        swm.Stop()
    }()

    // Step 1: Initialize
    sw := NewStopWatch("Initialization")
    config, err := loadConfig()
    if err != nil {
        log.Printf("Initialization failed: %v", err)
        os.Exit(1)
    }
    sw.Stop()

    updater, err := db.NewProgressUpdater(config.AWSRegion, config.MetadataTable)
    ctx := context.Background()
    userID := config.UserID
    assetID := config.AssetID


    // Step 2: Download
    sw = NewStopWatch("Download")
    client, err := s3.NewS3Client(config.AWSRegion, config.TransportBucket)
    if err != nil {
        log.Printf("S3 client creation failed: %v", err)
        updateState(ctx, updater, userID, assetID, db.StateDownload, false)
        os.Exit(1)
    }
    downloadedData, err := client.DownloadFile(config.InputKey)
    if err != nil {
        log.Printf("Download failed: %v", err)
        updateState(ctx, updater, userID, assetID, db.StateDownload, false)
        os.Exit(1)
    }
    updateState(ctx, updater, userID, assetID, db.StateDownload, true)
    sw.Stop()

    // Step 3: Write to temp
    sw = NewStopWatch("Write Temp")
    workDir = filepath.Join(config.FootageDir, config.UserID, config.AssetID)
    if err := os.MkdirAll(workDir, 0755); err != nil {
        log.Printf("Failed to create working directory: %v", err)
        updateState(ctx, updater, userID, assetID, db.StateWriteToTemp, false)
        os.Exit(1)
    }
    tempFile := filepath.Join(workDir, "input")
    if err := os.WriteFile(tempFile, downloadedData, 0644); err != nil {
        log.Printf("Failed to write temp file: %v", err)
        updateState(ctx, updater, userID, assetID, db.StateWriteToTemp, false)
        os.Exit(1)
    }
    updateState(ctx, updater, userID, assetID, db.StateWriteToTemp, true)
    sw.Stop()

    // Define resolutions
    resolutions := []transcoder.Resolution{
        {Name: "1080p", Width: 1920, Height: 1080, Bitrate: "3000k"},
        {Name: "720p", Width: 1280, Height: 720, Bitrate: "2000k"},
        {Name: "480p", Width: 854, Height: 480, Bitrate: "800k"},
        {Name: "360p", Width: 640, Height: 360, Bitrate: "400k"},
    }

    // Step 4: Initialize Processor
    sw = NewStopWatch("Initialize Processor")
    processor, err := transcoder.NewProcessor(tempFile, resolutions)
    if err != nil {
        log.Printf("Processor initialization failed: %v", err)
        updateState(ctx, updater, userID, assetID, db.StateInitializeProcessor, false)
        os.Exit(1)
    }
    updateState(ctx, updater, userID, assetID, db.StateInitializeProcessor, true)
    sw.Stop()

    // Step 5: Create Thumbnail
    sw = NewStopWatch("GenerateThumbnail")
    err = processor.GenerateThumbnail();
    if err != nil {
        log.Printf("GenerateThumbnail failed: %v", err)
        updateState(ctx, updater, userID, assetID, db.StateGenerateThumbnail, false)
        os.Exit(1)
    }
    updateState(ctx, updater, userID, assetID, db.StateGenerateThumbnail, true)
    sw.Stop()


    // Step 6: GenerateMP4Files
    sw = NewStopWatch("GenerateMP4Files")
    err = processor.GenerateMP4Files(); 
    if err != nil {
        log.Printf("GenerateMP4Files failed: %v", err)
        updateState(ctx, updater, userID, assetID, db.StateGenerateMP4Files, false)
        os.Exit(1)
    }
    updateState(ctx, updater, userID, assetID, db.StateGenerateMP4Files, true)
    sw.Stop()


    // Step 7: GenerateHLSPlaylists
    sw = NewStopWatch("GenerateHLSPlaylists")
    err = processor.GenerateHLSPlaylists(); 
    if err != nil {
        log.Printf("GenerateHLSPlaylists failed: %v", err)
        updateState(ctx, updater, userID, assetID, db.StateGenerateHLSPlaylists, false)
        os.Exit(1)
    }
    updateState(ctx, updater, userID, assetID, db.StateGenerateHLSPlaylists, true)
    sw.Stop()

    // Step 8: IframePlaylist
    sw = NewStopWatch("GenerateIframePlaylists")
    err = processor.GenerateIframePlaylists(); 
    if err != nil {
        log.Printf("GenerateIframePlaylists failed: %v", err)
        updateState(ctx, updater, userID, assetID, db.StateGenerateIframePlaylists, false)
        os.Exit(1)
    }
    updateState(ctx, updater, userID, assetID, db.StateGenerateIframePlaylists, true)
    sw.Stop()

    // Step 9: Upload
    sw = NewStopWatch("UploadAllParallel")
    s3ContentClient, err := s3.NewS3Client(config.AWSRegion, config.ContentBucket)
    if err != nil {
        log.Printf("S3 content client creation failed: %v", err)
        updateState(ctx, updater, userID, assetID, db.StateUploadTranscodedFootage, false)
        os.Exit(1)
    }

    uploadConfig := &s3.UploadManagerConfig{
        MaxWorkers: runtime.NumCPU(),
        BufferSize: 1000,
    }

    uploadManager := s3.NewUploadManager(
        s3ContentClient,
        config.UserID,
        config.AssetID,
        config.ContentBucket,
        uploadConfig,
    )

    transcodedDir := filepath.Join(workDir, "transcoded")
    if err := uploadManager.UploadAllParallel(transcodedDir); err != nil {
        log.Printf("Upload failed: %v", err)
        updateState(ctx, updater, userID, assetID, db.StateUploadTranscodedFootage, false)
        os.Exit(1)
    }
    updateState(ctx, updater, userID, assetID, db.StateUploadTranscodedFootage, true)
    sw.Stop()
}