package s3

import (
    "context"
    "fmt"
	"bytes"
    "io"

    "github.com/aws/aws-sdk-go-v2/config"
    "github.com/aws/aws-sdk-go-v2/service/s3"
)

type S3Client struct {
    client     *s3.Client
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

    return &S3Client{
        client:     client,
        bucketName: bucketName,
    }, nil
}

func (s *S3Client) DownloadFile(key string) ([]byte, error) {
    output, err := s.client.GetObject(context.TODO(), &s3.GetObjectInput{
        Bucket:                     &s.bucketName,
        Key:                        &key,
    })
    if err != nil {
        return nil, err
    }
    defer output.Body.Close()
    return io.ReadAll(output.Body)
}

func (s *S3Client) UploadFile(key string, data []byte) error {
    _, err := s.client.PutObject(context.TODO(), &s3.PutObjectInput{
        Bucket: &s.bucketName,
        Key:    &key,
        Body:   bytes.NewReader(data),
    })
    return err
}