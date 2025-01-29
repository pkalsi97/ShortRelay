package main

import (
    "fmt"
    "log"
    "os"
    "path/filepath"

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
    if err != nil {
        steps.Initialization.Complete(nil, err)
        steps.OverView.MarkCriticalFailure()
    }

    workDir := filepath.Join(config.FootageDir, config.TaskID)
    if err := os.MkdirAll(workDir, 0755); err != nil {
        steps.Initialization.Complete(nil, err)
        steps.OverView.MarkCriticalFailure()
    } else {
        steps.Initialization.Complete(config, nil)
    }

    // Step 2: Download Footage from s3
    steps.Download = models.NewStepInfo()

    s3TransportClient, err := s3.NewS3Client(config.AWSRegion, config.TransportBucket)
    if err != nil {
        steps.Download.Complete(nil, err)
        steps.OverView.MarkCriticalFailure()
    }

    downloadedData, err := s3TransportClient.DownloadFile(config.InputKey)
    if err != nil {
        steps.Download.Complete(nil, err)
        steps.OverView.MarkCriticalFailure()
    } else {
        steps.Download.Complete(downloadedData, nil)
    } 

    // Step 3: Write footage to tmp
    steps.WriteToTemp = models.NewStepInfo()
    
    tempFile := filepath.Join(workDir, "input.mp4")
    if err := os.WriteFile(tempFile, downloadedData, 0644); err != nil {
        steps.WriteToTemp.Complete(nil,err)
        steps.OverView.MarkCriticalFailure()
    } else {
        steps.WriteToTemp.Complete("success", err)
    }

    // VALIDATION 
    validator := validation.NewValidator()

    // Step 4: Basic Validation of footage
    steps.BasicValidation = models.NewStepInfo()

    basicResult, err := validator.ValidateBasic(tempFile)
    if err != nil {
        steps.BasicValidation.Complete(nil,err)
    } else {
        steps.BasicValidation.Complete(basicResult, nil)
    }

    // Step 5: Stream Validation of footage
    steps.StreamValidation = models.NewStepInfo()

    streamResult, err := validator.ValidateStream(tempFile)
    if err != nil {
        steps.StreamValidation.Complete(nil,err)
    } else {
        steps.StreamValidation.Complete(streamResult, nil)
    }

    // Step 6: Metadata Extraction from footage
    steps.MetadataExtraction = models.NewStepInfo()

    extractor := validation.NewMetadataExtractor()
    metadata, err := extractor.GetContentMetadata(tempFile)
    if err != nil {
        steps.MetadataExtraction.Complete(nil,err)
    } else {
        steps.MetadataExtraction.Complete(metadata, nil)
    }
    
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
    if err != nil {
        steps.InitializeProcessor.Complete(nil, err)
    } else {
        steps.InitializeProcessor.Complete("success", nil)
    }

    // Step 8: Create Thumbnail
    steps.Thumbnail = models.NewStepInfo()

    if err := processor.GenerateThumbnail(); err != nil {
        steps.Thumbnail.Complete(nil, err)
    } else {
        steps.Thumbnail.Complete("success", nil)
    }

    // Step 9: GenerateMP4Files
    steps.MP4Generation = models.NewStepInfo()

    if err := processor.GenerateMP4Files(); err != nil {
        steps.MP4Generation.Complete(nil, err)
    } else {
        steps.MP4Generation.Complete("success", nil)
    }

    // Step 10: GenerateHLSPlaylists
    steps.HLSGeneration = models.NewStepInfo()

    if err := processor.GenerateHLSPlaylists(); err != nil {
        steps.HLSGeneration.Complete(nil, err)
    } else {
        steps.HLSGeneration.Complete("success", nil)
    }

    // Step 11: IframePlaylist
    steps.IframePlaylist = models.NewStepInfo()
  
    if err := processor.GenerateIframePlaylists(); err != nil {
        steps.IframePlaylist.Complete(nil, err)
    } else {
        steps.IframePlaylist.Complete("success", nil)
    }

    defer func() {
        if err := os.RemoveAll(workDir); err != nil {
            log.Printf("Failed to cleanup working directory: %v", err)
        }
    }()
}