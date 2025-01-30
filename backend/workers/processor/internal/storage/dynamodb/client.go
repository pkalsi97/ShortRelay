package db

import (
    "context"
    "fmt"
    "time"

    "github.com/aws/aws-sdk-go-v2/aws"
    "github.com/aws/aws-sdk-go-v2/config"
    "github.com/aws/aws-sdk-go-v2/service/dynamodb"
    "github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

type StageProgressUpdate struct {
    Status    string
    StartTime string
    Error     string
}

type ProgressUpdater struct {
    client    *dynamodb.Client
    tableName string
    userId string
    assetId string
}
const TimeFormat = "2006-01-02T15:04:05.000Z"

const (
    StateDownload              = "download"
    StateWriteToStorage          = "writeToStorage"
    StateInitializeProcessor   = "initializeProcessor"
    StateGenerateThumbnail     = "generateThumbnail"
    StateGenerateMP4Files      = "generateMP4Files"
    StateGenerateHLSPlaylists  = "generateHLSPlaylists"
    StateGenerateIframePlaylists = "generateIframePlaylists"
    StateUploadTranscodedFootage = "uploadTranscodedFootage"
    StatePostProcessingValidation = "postProcessingValidation"
    StateTotalFiles = "totalFiles"
)

func NewProgressUpdater(region, tableName string, userId string, assetId string) (*ProgressUpdater, error) {
    cfg, err := config.LoadDefaultConfig(context.TODO(),
        config.WithRegion(region),
    )
    if err != nil {
        return nil, fmt.Errorf("unable to load SDK config: %v", err)
    }

    client := dynamodb.NewFromConfig(cfg)

    return &ProgressUpdater{
        client:    client,
        tableName: tableName,
        userId: userId,
        assetId: assetId,
    }, nil
}

func (p *ProgressUpdater) UpdateProgress(ctx context.Context, currentStage string, nextStage string, progressData StageProgressUpdate) error {
    now := time.Now().UTC().Format(TimeFormat)
    
    input := &dynamodb.UpdateItemInput{
        TableName: &p.tableName,
        Key: map[string]types.AttributeValue{
            "userId":  &types.AttributeValueMemberS{Value: p.userId},
            "assetId": &types.AttributeValueMemberS{Value: p.assetId},
        },
        UpdateExpression: aws.String(`
            SET progress.#currentStage.#status = :status,
                progress.#currentStage.#startTime = :startTime,
                progress.#currentStage.#endTime = :endTime,
                progress.#currentStage.#error = :error,
                stage = :nextStage,
                updatedAt = :updateTime
        `),
        ExpressionAttributeNames: map[string]string{
            "#currentStage": currentStage,
            "#status":      "status",
            "#startTime":   "startTime",
            "#endTime":     "endTime",
            "#error":       "error",
        },
        ExpressionAttributeValues: map[string]types.AttributeValue{
            ":status":    &types.AttributeValueMemberS{Value: progressData.Status},
            ":startTime": &types.AttributeValueMemberS{Value: progressData.StartTime},
            ":endTime":   &types.AttributeValueMemberS{Value: now},
            ":error":     &types.AttributeValueMemberS{Value: progressData.Error},
            ":nextStage": &types.AttributeValueMemberS{Value: nextStage},
            ":updateTime": &types.AttributeValueMemberS{Value: now},
        },
    }

    _, err := p.client.UpdateItem(ctx, input)
    if err != nil {
        return fmt.Errorf("failed to update progress: %v", err)
    }

    return nil
}

func (p *ProgressUpdater) UpdateFileCount(ctx context.Context, count int) error {
    input := &dynamodb.UpdateItemInput{
        TableName: &p.tableName,
        Key: map[string]types.AttributeValue{
            "userId":  &types.AttributeValueMemberS{Value: p.userId},
            "assetId": &types.AttributeValueMemberS{Value: p.assetId},
        },
        UpdateExpression: aws.String("SET #totalFiles = :count, updatedAt = :time"),
        ExpressionAttributeNames: map[string]string{
            "#totalFiles": StateTotalFiles,
        },
        ExpressionAttributeValues: map[string]types.AttributeValue{
            ":count": &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", count)},
            ":time":  &types.AttributeValueMemberS{Value: time.Now().UTC().Format(TimeFormat)},
        },
    }

    _, err := p.client.UpdateItem(ctx, input)
    if err != nil {
        return fmt.Errorf("failed to update file count: %v", err)
    }

    return nil
}