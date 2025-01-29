package main

import (
    "fmt"
    "log"
    "os"
    "path/filepath"
    "runtime"

    "github.com/pkalsi97/ShortRelay/backend/workers/processor/internal/storage/s3"
    "github.com/pkalsi97/ShortRelay/backend/workers/processor/internal/validation"
    "github.com/pkalsi97/ShortRelay/backend/workers/processor/internal/transcoder"
    "github.com/pkalsi97/ShortRelay/backend/workers/processor/internal/models"
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
    steps := &models.ProcessingSteps{}

    steps.OverView = models.NewMasterInfo();
    defer func() {
        steps.OverView.MasterComplete()
        log.Printf("Basic Validation Result: %+v",steps)
    }()
    
    // Step 1: Initialize -> get env Variables
    steps.Initialization = models.NewStepInfo()
    config, err := loadConfig()
    steps.Initialization.Complete(err)
    workDir := filepath.Join(config.FootageDir, config.UserID, config.AssetID)
    steps.Initialization.Complete(err)

    // Step 2: Download Footage from s3
    steps.Download = models.NewStepInfo()
    s3TransportClient, err := s3.NewS3Client(config.AWSRegion, config.TransportBucket)
    downloadedData, err := s3TransportClient.DownloadFile(config.InputKey)
    steps.Download.Complete(err)

    // Step 3: Write footage to tmp
    steps.WriteToTemp = models.NewStepInfo()
    tempFile := filepath.Join(workDir, "input")
    err = os.WriteFile(tempFile, downloadedData, 0644);
    steps.WriteToTemp.Complete(err)


    // VALIDATION 
    validator := validation.NewValidator()

    // Step 4: Basic Validation of footage
    steps.BasicValidation = models.NewStepInfo()
    basicResult, err := validator.ValidateBasic(tempFile)
    steps.BasicValidation.Complete(err)
    log.Printf("Basic Validation Result: %+v",basicResult)

    // Step 5: Stream Validation of footage
    steps.StreamValidation = models.NewStepInfo()
    streamResult, err := validator.ValidateStream(tempFile)
    steps.StreamValidation.Complete(err)
    log.Printf("Basic Validation Result: %+v",streamResult)


    // Step 6: Metadata Extraction from footage
    steps.MetadataExtraction = models.NewStepInfo()
    extractor := validation.NewMetadataExtractor()
    metadata, err := extractor.GetContentMetadata(tempFile)
    steps.MetadataExtraction.Complete(err)
    log.Printf("Basic Validation Result: %+v",metadata)

    // TRANSCODING
    resolutions := []transcoder.Resolution{
        { Name:    "1080p", Width:   1920, Height:  1080, Bitrate: "3000k",},
        { Name:    "720p", Width:   1280, Height:  720, Bitrate: "2000k", },
        { Name:    "480p", Width:   854, Height:  480, Bitrate: "800k", },
        { Name:    "360p", Width:   640, Height:  360, Bitrate: "400k", },
    }
    
    // Step 7: Initialize Processor
    steps.InitializeProcessor = models.NewStepInfo()
    processor, err := transcoder.NewProcessor(tempFile, resolutions)
    steps.InitializeProcessor.Complete(err)

    // Step 8: Create Thumbnail
    steps.Thumbnail = models.NewStepInfo()
    err = processor.GenerateThumbnail();
    steps.Thumbnail.Complete(err)


    // Step 9: GenerateMP4Files
    steps.MP4Generation = models.NewStepInfo()
    err = processor.GenerateMP4Files(); 
    steps.MP4Generation.Complete(err)


    // Step 10: GenerateHLSPlaylists
    steps.HLSGeneration = models.NewStepInfo()
    err = processor.GenerateHLSPlaylists(); 
    steps.HLSGeneration.Complete(err)
    

    // Step 11: IframePlaylist
    steps.IframePlaylist = models.NewStepInfo()
  
    err = processor.GenerateIframePlaylists(); 
    steps.IframePlaylist.Complete(err)


    // Step 12: Upload
    steps.Upload = models.NewStepInfo()
    s3ContentClient, err := s3.NewS3Client(config.AWSRegion, config.ContentBucket)
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
    err = uploadManager.UploadAllParallel(transcodedDir)
    steps.Upload.Complete(err)
    
    defer func() {
        if err := os.RemoveAll(workDir); err != nil {
            log.Printf("Failed to cleanup working directory: %v", err)
        }
    }()
}