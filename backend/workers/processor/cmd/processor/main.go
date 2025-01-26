package main

import (
    "log"
    "os"
    "path/filepath"
)

const footageDir = "/tmp/footage"

func main() {
    taskId := os.Getenv("TASK_ID")
    userId := os.Getenv("USER_ID")
    assetId := os.Getenv("ASSET_ID")

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