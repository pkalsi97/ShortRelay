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

type ProgressUpdater struct {
    client    *dynamodb.Client
    tableName string
}

const (
    StateDownload              = "download"
    StateWriteToTemp           = "writeToTemp"
    StateInitializeProcessor   = "initializeProcessor"
    StateGenerateThumbnail     = "generateThumbnail"
    StateGenerateMP4Files      = "generateMP4Files"
    StateGenerateHLSPlaylists  = "generateHLSPlaylists"
    StateGenerateIframePlaylists = "generateIframePlaylists"
    StateUploadTranscodedFootage = "uploadTranscodedFootage"
    StateTotalFiles = "totalFiles"
)

func NewProgressUpdater(region, tableName string) (*ProgressUpdater, error) {
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
    }, nil
}

func (p *ProgressUpdater) UpdateProgress(ctx context.Context, userId, assetId, state string, value bool) error {
    input := &dynamodb.UpdateItemInput{
        TableName: &p.tableName,
        Key: map[string]types.AttributeValue{
            "userId":  &types.AttributeValueMemberS{Value: userId},
            "assetId": &types.AttributeValueMemberS{Value: assetId},
        },
        UpdateExpression: aws.String("SET #progress.#state = :value, #progress.updatedAt = :time"),
        ExpressionAttributeNames: map[string]string{
            "#progress": "progress",
            "#state":    state,
        },
        ExpressionAttributeValues: map[string]types.AttributeValue{
            ":value": &types.AttributeValueMemberBOOL{Value: value},
            ":time":  &types.AttributeValueMemberS{Value: time.Now().UTC().Format(time.RFC3339)},
        },
    }

    _, err := p.client.UpdateItem(ctx, input)
    if err != nil {
        return fmt.Errorf("failed to update progress: %v", err)
    }

    return nil
}

func (p *ProgressUpdater) UpdateFileCount(ctx context.Context, userId, assetId string, count int) error {
    input := &dynamodb.UpdateItemInput{
        TableName: &p.tableName,
        Key: map[string]types.AttributeValue{
            "userId":  &types.AttributeValueMemberS{Value: userId},
            "assetId": &types.AttributeValueMemberS{Value: assetId},
        },
        UpdateExpression: aws.String("SET #progress.#totalFiles = :count, #progress.updatedAt = :time"),
        ExpressionAttributeNames: map[string]string{
            "#progress":   "progress",
            "#totalFiles": StateTotalFiles,
        },
        ExpressionAttributeValues: map[string]types.AttributeValue{
            ":count": &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", count)},
            ":time":  &types.AttributeValueMemberS{Value: time.Now().UTC().Format(time.RFC3339)},
        },
    }

    _, err := p.client.UpdateItem(ctx, input)
    if err != nil {
        return fmt.Errorf("failed to update file count: %v", err)
    }

    return nil
}

func (p *ProgressUpdater) BatchUpdateProgress(ctx context.Context, userId, assetId string, states map[string]bool) error {
    updateExp := "SET progress.M.updatedAt = :time"
    expNames := make(map[string]string)
    expValues := map[string]types.AttributeValue{
        ":time": &types.AttributeValueMemberS{Value: time.Now().UTC().Format(time.RFC3339)},
    }

    i := 0
    for state, value := range states {
        placeholder := fmt.Sprintf("#state%d", i)
        valuePlaceholder := fmt.Sprintf(":value%d", i)
        updateExp += fmt.Sprintf(", progress.M.%s = %s", placeholder, valuePlaceholder)
        expNames[placeholder] = state
        expValues[valuePlaceholder] = &types.AttributeValueMemberBOOL{Value: value}
        i++
    }

    input := &dynamodb.UpdateItemInput{
        TableName: &p.tableName,
        Key: map[string]types.AttributeValue{
            "userId":  &types.AttributeValueMemberS{Value: userId},
            "assetId": &types.AttributeValueMemberS{Value: assetId},
        },
        UpdateExpression:          &updateExp,
        ExpressionAttributeNames:  expNames,
        ExpressionAttributeValues: expValues,
    }

    _, err := p.client.UpdateItem(ctx, input)
    if err != nil {
        return fmt.Errorf("failed to batch update progress: %v", err)
    }

    return nil
}