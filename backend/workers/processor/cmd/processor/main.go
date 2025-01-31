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
    Start time.Time
    name  string
}

type Config struct {
    TaskID              string
    UserID              string
    AssetID             string
    FootageDir          string
    AWSRegion           string
    TransportBucket     string
    ContentBucket       string
    MetadataTable       string
    InputKey            string
    OutputKey           string
    CompletionTrigger   string
}

func loadConfig() (*Config, error) {
    config := &Config{}
    envVars := map[string]*string{
        "TASK_ID":              &config.TaskID,
        "USER_ID":              &config.UserID,
        "ASSET_ID":             &config.AssetID,
        "FOOTAGE_DIR":          &config.FootageDir,
        "AWS_REGION":           &config.AWSRegion,
        "TRANSPORT_BUCKET":     &config.TransportBucket,
        "CONTENT_BUCKET":       &config.ContentBucket,
        "METADATA_TABLE":       &config.MetadataTable,
        "INPUT_KEY":            &config.InputKey,
        "OUTPUT_KEY":           &config.OutputKey,
        "COMPLETION_TRIGGER":   &config.CompletionTrigger,
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
        Start: time.Now(),
        name:  name,
    }
    return sw
}
func (sw *StopWatch) GetStartTimeString() string {
    return sw.Start.UTC().Format("2006-01-02T15:04:05.000Z")
}

func (sw *StopWatch) Stop() {
    duration := time.Since(sw.Start)
    fmt.Printf(`{"step": "%s", "duration": %.3f}%s`, sw.name, duration.Seconds(), "\n")
}

func updateState(ctx context.Context, updater *db.ProgressUpdater, currentStage, nextStage string, sw *StopWatch, err error) {
    var status string
    var errorMsg string
    
    if err == nil {
        status = "COMPLETED"
        errorMsg = "N.A"
    } else {
        status = "FAILED"
        errorMsg = err.Error()
    }

    updateErr := updater.UpdateProgress(ctx, currentStage, nextStage, db.StageProgressUpdate{
        Status:    status,
        StartTime: sw.GetStartTimeString(),
        Error:     errorMsg,
    })
    
    if updateErr != nil {
        log.Printf("Failed to update %s state: %v", currentStage, updateErr)
    }
}

func createCompletionJSON(userId, assetId string, fileCount int) []byte {
    completionJSON := fmt.Sprintf(`{
    "userId": "%s",
    "assetId": "%s",
    "timestamp": "%s",
    "fileCount": %d,
    "status": "complete"
}`,
        userId,
        assetId,
        time.Now().UTC().Format(time.RFC3339),
        fileCount,
    )
    return []byte(completionJSON)
}

func main() {
    var workDir string

    swm := NewStopWatch("Overall")
    defer func() {
        if r := recover(); r != nil {
            log.Printf("Recovered from fatal panic: %v", r)
            os.Exit(1)
        }
        if workDir != "" {
            if err := os.RemoveAll(workDir); err != nil {
                log.Printf("Failed to cleanup working directory: %v", err)
                os.Exit(1)
            }
        }
        swm.Stop()
        os.Exit(0)
    }()

    // Step 1: Initialize
    sw := NewStopWatch("Initialization")
    config, err := loadConfig()
    if err != nil {
        log.Printf("Initialization failed: %v", err)
        os.Exit(1)
    }
    sw.Stop()

    ctx := context.Background()
    userID := config.UserID
    assetID := config.AssetID
    updater, err := db.NewProgressUpdater(config.AWSRegion, config.MetadataTable , userID, assetID)


    // Step 2: Download
    sw = NewStopWatch("Download")
    s3client, err := s3.NewS3Client(config.AWSRegion, config.TransportBucket)
    if err != nil {
        log.Printf("S3 client creation failed: %v", err)
        updateState(ctx, updater, db.StateDownload, db.StateWriteToStorage,sw ,err)
        os.Exit(1)
    }
    downloadedData, err := s3client.DownloadFile(config.InputKey)
    if err != nil {
        log.Printf("Download failed: %v", err)
        updateState(ctx, updater, db.StateDownload, db.StateWriteToStorage,sw ,err)
        os.Exit(1)
    }
    updateState(ctx, updater, db.StateDownload, db.StateWriteToStorage,sw ,err)
    sw.Stop()

    // Step 3: Write to temp
    sw = NewStopWatch("Write Temp")
    workDir = filepath.Join(config.FootageDir, config.UserID, config.AssetID)
    if err := os.MkdirAll(workDir, 0755); err != nil {
        log.Printf("Failed to create working directory: %v", err)
        updateState(ctx, updater, db.StateWriteToStorage, db.StateInitializeProcessor,sw ,err)
        os.Exit(1)
    }
    tempFile := filepath.Join(workDir, "input")
    if err := os.WriteFile(tempFile, downloadedData, 0644); err != nil {
        log.Printf("Failed to write temp file: %v", err)
        updateState(ctx, updater, db.StateWriteToStorage, db.StateInitializeProcessor,sw ,err)
        os.Exit(1)
    }
    updateState(ctx, updater, db.StateWriteToStorage, db.StateInitializeProcessor,sw ,err)
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
        updateState(ctx, updater, db.StateInitializeProcessor, db.StateGenerateThumbnail,sw ,err)
        os.Exit(1)
    }
    updateState(ctx, updater, db.StateInitializeProcessor, db.StateGenerateThumbnail,sw ,err)
    sw.Stop()

    // Step 5: Create Thumbnail
    sw = NewStopWatch("GenerateThumbnail")
    err = processor.GenerateThumbnail();
    if err != nil {
        log.Printf("GenerateThumbnail failed: %v", err)
        updateState(ctx, updater, db.StateGenerateThumbnail, db.StateGenerateMP4Files,sw ,err)
        os.Exit(1)
    }
    updateState(ctx, updater, db.StateGenerateThumbnail, db.StateGenerateMP4Files,sw ,err)
    sw.Stop()


    // Step 6: GenerateMP4Files
    sw = NewStopWatch("GenerateMP4Files")
    err = processor.GenerateMP4Files(); 
    if err != nil {
        log.Printf("GenerateMP4Files failed: %v", err)
        updateState(ctx, updater, db.StateGenerateMP4Files, db.StateGenerateHLSPlaylists,sw ,err)
        os.Exit(1)
    }
    updateState(ctx, updater, db.StateGenerateMP4Files, db.StateGenerateHLSPlaylists,sw ,err)
    sw.Stop()


    // Step 7: GenerateHLSPlaylists
    sw = NewStopWatch("GenerateHLSPlaylists")
    err = processor.GenerateHLSPlaylists(); 
    if err != nil {
        log.Printf("GenerateHLSPlaylists failed: %v", err)
        updateState(ctx, updater, db.StateGenerateHLSPlaylists, db.StateGenerateIframePlaylists,sw ,err)
        os.Exit(1)
    }
    updateState(ctx, updater, db.StateGenerateHLSPlaylists, db.StateGenerateIframePlaylists,sw ,err)
    sw.Stop()

    // Step 8: IframePlaylist
    sw = NewStopWatch("GenerateIframePlaylists")
    err = processor.GenerateIframePlaylists(); 
    if err != nil {
        log.Printf("GenerateIframePlaylists failed: %v", err)
        os.Exit(1)
    }
    updateState(ctx, updater, db.StateGenerateIframePlaylists, db.StateUploadTranscodedFootage,sw ,err)
    sw.Stop()

    // Step 9: Upload
    sw = NewStopWatch("UploadAllParallel")
    s3ContentClient, err := s3.NewS3Client(config.AWSRegion, config.ContentBucket)
    if err != nil {
        log.Printf("S3 content client creation failed: %v", err)
        updateState(ctx, updater, db.StateUploadTranscodedFootage, db.StatePostProcessingValidation,sw ,err)
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
    fileCount, err := uploadManager.UploadAllParallel(transcodedDir)
    if err != nil {
        log.Printf("Upload failed after processing %d files: %v", fileCount, err)
        updateState(ctx, updater, db.StateUploadTranscodedFootage, db.StatePostProcessingValidation,sw ,err)
        os.Exit(1)
    }
    updateState(ctx, updater, db.StateUploadTranscodedFootage, db.StatePostProcessingValidation,sw ,err)
    if err := updater.UpdateFileCount(ctx, fileCount); err != nil {
        log.Printf("Failed to update file count: %v", err)
    }
    sw.Stop()

    // Step 10: Upload Completion.json
    sw = NewStopWatch("UploadCompletion")
    completionKey := filepath.Join(config.UserID, config.AssetID, config.CompletionTrigger)
    completionData := createCompletionJSON(config.UserID, config.AssetID, fileCount)

    if err := s3ContentClient.UploadFile(completionKey,completionData,"application/json"); err != nil {
        log.Printf("Failed to upload completion marker: %v", err)
        os.Exit(1)
    }
    sw.Stop()
}