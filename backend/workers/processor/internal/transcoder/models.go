package transcoder

type Resolution struct {
    Name    string
    Width   int
    Height  int
    Bitrate string
}

type OutputPaths struct {
    BaseDir    string
    MP4Dir     string
    HLSDir     string
    AssetsDir  string
    LogsDir    string
}

type VideoInfo struct {
    Width      int
    Height     int
    Duration   float64
    HasAudio   bool
    IsVertical bool
}