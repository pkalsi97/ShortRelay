package s3

import (
    "context"
    "fmt"
    "bytes"
    "log"
    "runtime"
    "time"
    
    "github.com/aws/aws-sdk-go-v2/config"
    "github.com/aws/aws-sdk-go-v2/service/s3"
    "github.com/aws/aws-sdk-go-v2/feature/s3/manager"
)

type S3Client struct {
    client     *s3.Client
    downloader *manager.Downloader
    uploader   *manager.Uploader
    bucketName string
}

func NewS3Client(region string, bucketName string) (*S3Client, error) {
    cfg, err := config.LoadDefaultConfig(context.TODO(),
        config.WithRegion(region),
    )
    if err != nil {
        return nil, fmt.Errorf("unable to load SDK config: %v", err)
    }

    client := s3.NewFromConfig(cfg)
    
    concurrency := runtime.NumCPU()
    if concurrency > 4 {
        concurrency = 4
    }

    downloader := manager.NewDownloader(client, func(d *manager.Downloader) {
        d.PartSize = 18 * 1024 * 1024 
        d.Concurrency = concurrency 
        d.BufferProvider = manager.NewPooledBufferedWriterReadFromProvider(512 * 1024)
    })

    uploader := manager.NewUploader(client, func(u *manager.Uploader) {
        u.PartSize = 18 * 1024 * 1024 
        u.Concurrency = concurrency 
        u.LeavePartsOnError = false
    })

    return &S3Client{
        client:     client,
        downloader: downloader,
        uploader:   uploader,
        bucketName: bucketName,
    }, nil
}

func (s *S3Client) UploadFile(key string, data []byte, contentType string) error {
    startTime := time.Now()
    size := len(data)

    _, err := s.uploader.Upload(context.TODO(), &s3.PutObjectInput{
        Bucket:      &s.bucketName,
        Key:         &key,
        Body:        bytes.NewReader(data),
        ContentType: &contentType,
    })

    duration := time.Since(startTime)
    speed := float64(size) / 1024 / 1024 / duration.Seconds()

    log.Printf("Uploaded %s - Size: %.2f MB, Time: %.2fs, Speed: %.2f MB/s",
        key,
        float64(size)/1024/1024,
        duration.Seconds(),
        speed)

    return err
}


func (s *S3Client) DownloadFile(key string) ([]byte, error) {
    buffer := manager.NewWriteAtBuffer([]byte{})

    startTime := time.Now()

    numBytes, err := s.downloader.Download(context.TODO(), buffer, &s3.GetObjectInput{
        Bucket: &s.bucketName,
        Key:    &key,
    })
    if err != nil {
        return nil, fmt.Errorf("failed to download file: %v", err)
    }

    duration := time.Since(startTime)
    speed := float64(numBytes) / 1024 / 1024 / duration.Seconds()

    log.Printf("Downloaded %s - Size: %.2f MB, Time: %.2fs, Speed: %.2f MB/s",
        key,
        float64(numBytes)/1024/1024,
        duration.Seconds(),
        speed)

    return buffer.Bytes(), nil
}

