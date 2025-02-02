package transcoder

import (
    "fmt"
    "os"
    "log"
    "os/exec"
    "path/filepath"
    "strings"
)
 
func NewProcessor(inputPath string, resolutions []Resolution) (*Processor, error) {
    dir := filepath.Dir(inputPath)    
    outputDir := filepath.Join(dir, "transcoded")
    paths := &OutputPaths{
        BaseDir:    outputDir,
        MP4Dir:     filepath.Join(outputDir, "mp4"),
        HLSDir:     filepath.Join(outputDir, "hls"),
        AssetsDir:  filepath.Join(outputDir, "assets"),
        LogsDir:    filepath.Join(outputDir, "logs"),
    }

    if err := createDirectories(paths); err != nil {
        return nil, err
    }

    videoInfo, err := getVideoInfo(inputPath)
    if err != nil {
        return nil, err
    }

    return &Processor{
        InputPath:   inputPath,
        Paths:       paths,
        Resolutions: resolutions,
        VideoInfo:   videoInfo,
    }, nil
}

func (p *Processor) GenerateThumbnail() error {    
    args := []string{
        "-v", "error",
        "-y",
        "-ss", fmt.Sprintf("%.2f", p.VideoInfo.Duration/2),
        "-i", p.InputPath,
        "-frames:v", "1",
        "-f", "image2",
        "-vf", "scale=w='min(1920,iw)':h='min(1080,ih)':force_original_aspect_ratio=decrease",
        "-update", "1",
        filepath.Join(p.Paths.AssetsDir, "thumbnail.png"),
    }

    cmd := exec.Command("ffmpeg", args...)
    cmd.Stdout = os.Stdout
    cmd.Stderr = os.Stderr

    if err := cmd.Run(); err != nil {
        return fmt.Errorf("thumbnail generation failed: %v", err)
    }

    return nil
}

func (p *Processor) GenerateMP4Files() error {
    if p.VideoInfo.HasAudio {
        if err := p.extractAudio(p.InputPath); err != nil {
            return err
        }
    }

    for _, res := range p.Resolutions {
        if err := p.generateMP4(p.InputPath, res); err != nil {
            return err
        }
    }

    return nil
}

func (p *Processor) extractAudio(inputPath string) error {
    args := []string{
        "-v", "error",
        "-i", inputPath,
        "-vn",
        "-c:a", "aac",
        "-b:a", "128k",
        "-ar", "44100",
        "-ac", "2",
        "-af", "loudnorm=I=-16:LRA=11:TP=-1.5",
        "-metadata", "encoded_by=ShortRelay",
        "-y",
        filepath.Join(p.Paths.MP4Dir, "audio.m4a"),
    }
    return runFFmpeg(args)
}

func (p *Processor) generateMP4(inputPath string, res Resolution) error {
    outputFile := filepath.Join(p.Paths.MP4Dir, fmt.Sprintf("%s.mp4", res.Name))

    var scaleFilter string
    if p.VideoInfo.IsVertical {
        scaleFilter = fmt.Sprintf("scale=-2:%d", res.Height)
    } else {
        scaleFilter = fmt.Sprintf("scale=%d:-2", res.Width)
    }

    filterComplex := fmt.Sprintf("%s,format=yuv420p", scaleFilter)

    args := []string{
        "-v", "error",
        "-i", inputPath,
        "-an",
        "-c:v", "libx264",

        "-b:v", res.Bitrate,
        "-maxrate", res.Bitrate,
        "-bufsize", fmt.Sprintf("%dk", getBufsize(res.Bitrate)),

        "-vf", filterComplex,

        "-preset", "veryfast",
        "-tune", "zerolatency",
        "-profile:v", "high",
        "-level", "4.1",
        
        "-keyint_min", "30",
        "-g", "60",
        "-sc_threshold", "0",
        
        "-movflags", "+faststart+rtphint",
        "-pix_fmt", "yuv420p",
        
        "-metadata", "encoded_by=ShortRelay",
        
        "-y",
        outputFile,
    }

    return runFFmpeg(args)
}

func (p *Processor) GenerateHLSPlaylists() error {

    if err := createHLSDirectories(p.Paths, p.Resolutions); err != nil {
        return err
    }

    for _, res := range p.Resolutions {
        if err := p.generateHLSStream(res); err != nil {
            return err
        }
    }

    if p.VideoInfo.HasAudio {
        if err := p.generateAudioStream(); err != nil {
            return err
        }
    }

    return p.generateMasterPlaylist()
}

func (p *Processor) generateHLSStream(res Resolution) error {
    streamDir := filepath.Join(p.Paths.HLSDir, "video", res.Name)
    if err := os.MkdirAll(streamDir, 0755); err != nil {
        return fmt.Errorf("failed to create video directory: %v", err)
    }

    inputFile := filepath.Join(p.Paths.MP4Dir, fmt.Sprintf("%s.mp4", res.Name))
    audioFile := filepath.Join(p.Paths.MP4Dir, "audio.m4a")

    args := []string{
        "-i", inputFile,
    }

    if p.VideoInfo.HasAudio {
        args = append(args,
            "-i", audioFile,
            "-map", "0:v:0",
            "-map", "1:a:0")
    }

    args = append(args,
        "-v", "error",
        "-c:v", "copy",
        "-c:a", "copy",
        "-f", "hls",
        "-hls_time", "2",
        "-hls_playlist_type", "vod",
        "-hls_flags", "independent_segments+program_date_time+discont_start",
        "-hls_segment_type", "fmp4",
        "-hls_fmp4_init_filename", "init.mp4",
        "-hls_list_size", "0",
        "-start_number", "0",
        "-hls_segment_filename", "data%03d.m4s",
        "stream.m3u8")

    cmd := exec.Command("ffmpeg", args...)
    cmd.Dir = streamDir
    cmd.Stdout = os.Stdout
    cmd.Stderr = os.Stderr
    return cmd.Run()
}

func (p *Processor) generateAudioStream() error {
    audioDir := filepath.Join(p.Paths.HLSDir, "audio")
    if err := os.MkdirAll(audioDir, 0755); err != nil {
        return fmt.Errorf("failed to create audio directory: %v", err)
    }

    args := []string{
        "-v", "error",
        "-i", filepath.Join(p.Paths.MP4Dir, "audio.m4a"),
        "-c:a", "copy",
        "-f", "hls",
        "-hls_time", "2",
        "-hls_playlist_type", "vod",
        "-hls_flags", "independent_segments+program_date_time",
        "-hls_segment_type", "fmp4",
        "-hls_fmp4_init_filename", "init.mp4",
        "-hls_list_size", "0",
        "-hls_segment_filename", "data%03d.m4s",
        "stream.m3u8",
    }

    cmd := exec.Command("ffmpeg", args...)
    cmd.Dir = audioDir
    cmd.Stdout = os.Stdout
    cmd.Stderr = os.Stderr
    return cmd.Run()
}

func (p *Processor) generateMasterPlaylist() error {
    masterPlaylist := []string{
        "#EXTM3U",
        "#EXT-X-VERSION:6",
        "",
    }

    if p.VideoInfo.HasAudio {
        masterPlaylist = append(masterPlaylist,
            "#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID=\"audio\",NAME=\"Original\","+
                "DEFAULT=YES,AUTOSELECT=YES,LANGUAGE=\"und\","+
                "CHANNELS=\"2\",URI=\"audio/stream.m3u8\"",
            "")
    }

    for _, res := range p.Resolutions {
        bandwidth := getBandwidth(res.Bitrate)
        frameRate := "30"
        
        masterPlaylist = append(masterPlaylist,
            fmt.Sprintf("#EXT-X-STREAM-INF:BANDWIDTH=%d,RESOLUTION=%dx%d,"+
                "FRAME-RATE=%s,CODECS=\"avc1.640028,mp4a.40.2\",AUDIO=\"audio\"",
                bandwidth, res.Width, res.Height, frameRate),
            fmt.Sprintf("video/%s/stream.m3u8", res.Name))
    }

    masterFile := filepath.Join(p.Paths.HLSDir, "master.m3u8")
    return os.WriteFile(masterFile, []byte(strings.Join(masterPlaylist, "\n")), 0644)
}

func (p *Processor) GenerateIframePlaylists() error {

    iframeDir := filepath.Join(p.Paths.HLSDir, "iframe")
    if err := os.MkdirAll(iframeDir, 0755); err != nil {
        return fmt.Errorf("failed to create iframe directory: %v", err)
    }

    for _, res := range p.Resolutions {
        if err := p.generateIframePlaylist(res); err != nil {
            return err
        }
    }

    return p.generateMasterIframePlaylist()
}

func (p *Processor) generateIframePlaylist(res Resolution) error {
    resIframeDir := filepath.Join(p.Paths.HLSDir, "iframe", res.Name)
    if err := os.MkdirAll(resIframeDir, 0755); err != nil {
        return err
    }

    inputFile := filepath.Join(p.Paths.MP4Dir, fmt.Sprintf("%s.mp4", res.Name))

    tempFile := filepath.Join(resIframeDir, "keyframes.mp4")
    keyframeArgs := []string{
        "-v", "error",
        "-i", inputFile,
        "-c:v", "libx264",
        "-an",
        "-x264-params", "keyint=1:scenecut=0",
        "-crf", "17",
        "-preset", "veryfast",
        tempFile,
    }

    cmd := exec.Command("ffmpeg", keyframeArgs...)
    if err := cmd.Run(); err != nil {
        return fmt.Errorf("keyframe generation failed: %v", err)
    }

    args := []string{
        "-v", "error",
        "-i", tempFile,
        "-c:v", "copy",
        "-an",
        "-f", "hls",
        "-hls_time", "2",
        "-hls_playlist_type", "vod",
        "-hls_flags", "independent_segments+program_date_time+discont_start",
        "-hls_segment_type", "fmp4",
        "-hls_fmp4_init_filename", "init.mp4",
        "-hls_list_size", "0",
        "-start_number", "0",
        "-hls_segment_filename", "iframe%03d.m4s",
        "iframe.m3u8",
    }

    cmd = exec.Command("ffmpeg", args...)
    cmd.Dir = resIframeDir
    cmd.Stdout = os.Stdout
    cmd.Stderr = os.Stderr
    err := cmd.Run()

    os.Remove(tempFile)

    return err
}

func (p *Processor) generateMasterIframePlaylist() error {
    masterPlaylist := []string{
        "#EXTM3U",
        "#EXT-X-VERSION:6",
        "",
        "#EXT-X-PLAYLIST-TYPE:VOD",
        "#EXT-X-INDEPENDENT-SEGMENTS",
    }

    for _, res := range p.Resolutions {
        bandwidth := getBandwidth(res.Bitrate) / 4
        
        masterPlaylist = append(masterPlaylist,
            fmt.Sprintf("#EXT-X-STREAM-INF:"+
                "BANDWIDTH=%d,"+
                "RESOLUTION=%dx%d,"+
                "CODECS=\"avc1.640028\"",
                bandwidth,
                res.Width, res.Height),
            fmt.Sprintf("iframe/%s/iframe.m3u8", res.Name))
    }

    masterFile := filepath.Join(p.Paths.HLSDir, "master_iframe.m3u8")
    return os.WriteFile(masterFile, []byte(strings.Join(masterPlaylist, "\n")), 0644)
}

func Process(inputPath string, resolutions []Resolution) error {
    processor, err := NewProcessor(inputPath, resolutions)
    if err != nil {
        return err
    }
    log.Printf("GenerateThumbnail")
    if err := processor.GenerateThumbnail(); err != nil {
        return err
    }
    log.Printf("GenerateMP4Files")
    if err := processor.GenerateMP4Files(); err != nil {
        return err
    }
    log.Printf("GenerateHLSPlaylists")
    if err := processor.GenerateHLSPlaylists(); err != nil {
        return err
    }
    log.Printf("GenerateIframePlaylists")
    if err := processor.GenerateIframePlaylists(); err != nil {
        return err
    }
    return nil
}
