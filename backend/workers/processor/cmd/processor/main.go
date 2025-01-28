package main

import (
    "fmt"
    "log"
    "os"
    "time" 
    "path/filepath"

    "github.com/pkalsi97/ShortRelay/backend/workers/processor/internal/storage/s3"
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

    s3TransportClient, err := s3.NewS3Client(config.AWSRegion, config.TransportBucket)
    if err != nil {
        log.Fatalf("Failed to create transport S3 client: %v", err)
    }

    s3ContentClient, err := s3.NewS3Client(config.AWSRegion, config.ContentBucket)
    if err != nil {
        log.Fatalf("Failed to create content S3 client: %v", err)
    }

    workDir := filepath.Join(config.FootageDir, config.TaskID)
    if err := os.MkdirAll(workDir, 0755); err != nil {
        log.Fatalf("Failed to create working directory: %v", err)
    }

    downloadedData, err := s3TransportClient.DownloadFile(config.InputKey)
    if err != nil {
        log.Fatalf("Failed to download file: %v", err)
    }

    if err := s3ContentClient.UploadFile(config.OutputKey, downloadedData); err != nil {
        log.Fatalf("Failed to upload file: %v", err)
    }

    defer func() {
        if err := os.RemoveAll(workDir); err != nil {
            log.Printf("Failed to cleanup working directory: %v", err)
        }
    }()
}