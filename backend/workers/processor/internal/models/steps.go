package models

import (
    "time"
    "fmt"
)

type ProcessingSteps struct {
    OverView            *Master
    Initialization      *StepInfo
    WriteToTemp         *StepInfo
    Download            *StepInfo
    BasicValidation     *StepInfo
    StreamValidation    *StepInfo
    MetadataExtraction  *StepInfo
    InitializeProcessor *StepInfo
    Thumbnail           *StepInfo
    MP4Generation       *StepInfo
    HLSGeneration       *StepInfo
    IframePlaylist      *StepInfo
    Upload              *StepInfo
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
    Success       bool
    Error         error
}

func NewStepInfo() *StepInfo {
    return &StepInfo{
        StartTime: time.Now(),
        Success:   false,
    }
}

func (s *StepInfo) Complete(err error) {
    s.EndTime = time.Now()
    s.ExecutionTime = s.EndTime.Sub(s.StartTime)
    s.Success = (err == nil)
    s.Error = err
}

func NewMasterInfo() *Master {
    return &Master{
        StartTime:       time.Now(),
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

func (ps *ProcessingSteps) String() string {
    formatDuration := func(d time.Duration) string {
        return fmt.Sprintf("%.2fs", d.Seconds())
    }

    formatStatus := func(success bool, err error) string {
        if err != nil {
            return fmt.Sprintf("❌ %v", err)
        }
        if success {
            return "✅ Success"
        }
        return "❌ Failed"
    }

    return fmt.Sprintf(`
╔═════════════════════════════════════════════════
║ Processing Summary
╠═════════════════════════════════════════════════
║ Total Duration: %s
║ Critical Failure: %v
╠═════════════════════════════════════════════════
║ Step Details
╠═════════════════════════════════════════════════
║ %-20s │ %-10s │ %s
║ %-20s │ %-10s │ %s
║ %-20s │ %-10s │ %s
║ %-20s │ %-10s │ %s
║ %-20s │ %-10s │ %s
║ %-20s │ %-10s │ %s
║ %-20s │ %-10s │ %s
║ %-20s │ %-10s │ %s
║ %-20s │ %-10s │ %s
║ %-20s │ %-10s │ %s
║ %-20s │ %-10s │ %s
║ %-20s │ %-10s │ %s
╚═══════════════════════════════════════════════════`,
        formatDuration(ps.OverView.ExecutionTime),
        ps.OverView.CriticalFailure,
        
        "Initialization",      formatDuration(ps.Initialization.ExecutionTime),      formatStatus(ps.Initialization.Success, ps.Initialization.Error),
        "Write to Temp",       formatDuration(ps.WriteToTemp.ExecutionTime),         formatStatus(ps.WriteToTemp.Success, ps.WriteToTemp.Error),
        "Download",            formatDuration(ps.Download.ExecutionTime),            formatStatus(ps.Download.Success, ps.Download.Error),
        "Basic Validation",    formatDuration(ps.BasicValidation.ExecutionTime),     formatStatus(ps.BasicValidation.Success, ps.BasicValidation.Error),
        "Stream Validation",   formatDuration(ps.StreamValidation.ExecutionTime),    formatStatus(ps.StreamValidation.Success, ps.StreamValidation.Error),
        "Metadata Extraction", formatDuration(ps.MetadataExtraction.ExecutionTime),  formatStatus(ps.MetadataExtraction.Success, ps.MetadataExtraction.Error),
        "Initialize Processor",formatDuration(ps.InitializeProcessor.ExecutionTime), formatStatus(ps.InitializeProcessor.Success, ps.InitializeProcessor.Error),
        "Thumbnail",           formatDuration(ps.Thumbnail.ExecutionTime),           formatStatus(ps.Thumbnail.Success, ps.Thumbnail.Error),
        "MP4 Generation",      formatDuration(ps.MP4Generation.ExecutionTime),       formatStatus(ps.MP4Generation.Success, ps.MP4Generation.Error),
        "HLS Generation",      formatDuration(ps.HLSGeneration.ExecutionTime),       formatStatus(ps.HLSGeneration.Success, ps.HLSGeneration.Error),
        "Iframe Playlist",     formatDuration(ps.IframePlaylist.ExecutionTime),      formatStatus(ps.IframePlaylist.Success, ps.IframePlaylist.Error),
        "Upload",              formatDuration(ps.Upload.ExecutionTime),              formatStatus(ps.Upload.Success, ps.Upload.Error),
    )
}