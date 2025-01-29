package s3

import (
    "fmt"
    "os"
    "path/filepath"
    "runtime"
    "sync"
)

type UploadManagerConfig struct {
    MaxWorkers int
    BufferSize int
}

type UploadManager struct {
    client        *S3Client
    userID        string
    assetID       string
    contentBucket string
    maxWorkers    int
    bufferSize    int
}

type uploadTask struct {
    localPath string
    s3Key     string
}

func NewUploadManager(client *S3Client, userID, assetID, contentBucket string, config *UploadManagerConfig) *UploadManager {
    if config == nil {
        config = &UploadManagerConfig{
            MaxWorkers: runtime.NumCPU(),
            BufferSize: 100,
        }
    }

    return &UploadManager{
        client:        client,
        userID:        userID,
        assetID:       assetID,
        contentBucket: contentBucket,
        maxWorkers:    config.MaxWorkers,
        bufferSize:    config.BufferSize,
    }
}

func (u *UploadManager) UploadAllParallel(workDir string) error {
    files := make(chan uploadTask, u.bufferSize)
    errors := make(chan error, u.bufferSize)
    var wg sync.WaitGroup

    for i := 0; i < u.maxWorkers; i++ {
        wg.Add(1)
        go u.uploadWorker(files, errors, &wg)
    }

    go func() {
        err := filepath.Walk(workDir, func(path string, info os.FileInfo, err error) error {
            if err != nil {
                errors <- fmt.Errorf("walk error at %s: %v", path, err)
                return nil 
            }

            if !info.IsDir() {
                relPath, err := filepath.Rel(workDir, path)
                if err != nil {
                    errors <- fmt.Errorf("failed to get relative path for %s: %v", path, err)
                    return nil
                }

                files <- uploadTask{
                    localPath: path,
                    s3Key:    filepath.Join(u.userID, u.assetID, relPath),
                }
            }
            return nil
        })

        if err != nil {
            errors <- fmt.Errorf("walk error: %v", err)
        }
        close(files)
    }()

    go func() {
        wg.Wait()
        close(errors)
    }()

    var errs []error
    for err := range errors {
        errs = append(errs, err)
    }

    if len(errs) > 0 {
        return fmt.Errorf("upload errors (%d): %v", len(errs), errs)
    }
    return nil
}

func (u *UploadManager) uploadWorker(files <-chan uploadTask, errors chan<- error, wg *sync.WaitGroup) {
    defer wg.Done()

    for file := range files {
        data, err := os.ReadFile(file.localPath)
        if err != nil {
            errors <- fmt.Errorf("failed to read file %s: %v", file.localPath, err)
            continue
        }

        contentType := u.getContentType(file.localPath)

        if err := u.client.UploadFile(file.s3Key, data, contentType); err != nil {
            errors <- fmt.Errorf("failed to upload %s to %s: %v", file.localPath, file.s3Key, err)
        }
    }
}

func (u *UploadManager) getContentType(filename string) string {
    ext := filepath.Ext(filename)
    switch ext {
    case ".m3u8":
        return "application/vnd.apple.mpegurl"
    case ".mp4":
        return "video/mp4"
    case ".m4s":
        return "video/iso.segment"
    case ".m4a":
        return "audio/mp4"
    case ".png":
        return "image/png"
    case ".jpg", ".jpeg":
        return "image/jpeg"
    default:
        return "application/octet-stream"
    }
}

func (u *UploadManager) UploadSingleFile(localPath, relativePath string) error {
    data, err := os.ReadFile(localPath)
    if err != nil {
        return fmt.Errorf("failed to read file %s: %v", localPath, err)
    }

    s3Key := filepath.Join(u.userID, u.assetID, relativePath)
    contentType := u.getContentType(localPath)

    if err := u.client.UploadFile(s3Key, data, contentType); err != nil {
        return fmt.Errorf("failed to upload %s to %s: %v", localPath, s3Key, err)
    }

    return nil
}