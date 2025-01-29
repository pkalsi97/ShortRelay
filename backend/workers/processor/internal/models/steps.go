package models

import (
    "time"
)

type ProcessingSteps struct {
	OverView            *Master
	Initialization  	*StepInfo
    WriteToTemp         *StepInfo
	Download        	*StepInfo
	BasicValidation 	*StepInfo
    StreamValidation    *StepInfo
    MetadataExtraction  *StepInfo
    InitializeProcessor *StepInfo
    Thumbnail           *StepInfo
    MP4Generation       *StepInfo
    HLSGeneration       *StepInfo
    IframePlaylist      *StepInfo
}

type Master struct {
	StartTime       time.Time
	EndTime         time.Time
	ExecutionTime   time.Duration
	CriticalFailure bool
}

type StepInfo struct {
    StartTime     time.Time
    EndTime       time.Time
    ExecutionTime time.Duration
    Result        interface{}
    Error         error
}

func NewStepInfo() *StepInfo {
    return &StepInfo{
        StartTime: time.Now(),
    }
}

func (s *StepInfo) Complete(result interface{}, err error) {
    s.EndTime = time.Now()
    s.ExecutionTime = s.EndTime.Sub(s.StartTime)
    s.Result = result
    s.Error = err
}

func NewMasterInfo() *Master {
    return &Master{
        StartTime: time.Now(),
        CriticalFailure: false,
    }
}

func (m *Master) MasterComplete() {
    m.EndTime = time.Now()
    m.ExecutionTime = m.EndTime.Sub(m.StartTime)
}

func (m *Master) MarkCriticalFailure() {
    m.CriticalFailure = true
}