package transcoder

import (
    "fmt"
    "log"
    "os"
    "os/exec"
    "path/filepath"
    "strings"
)
type Processor struct {
    Paths       *OutputPaths
    Resolutions []Resolution
    VideoInfo   *VideoInfo
}

func NewProcessor(inputPath string, resolutions []Resolution) (*Processor, error) {
    dir := filepath.Dir(inputPath)
    filename := filepath.Base(inputPath)
    nameWithoutExt := strings.TrimSuffix(filename, filepath.Ext(filename))
    
    outputDir := filepath.Join(dir, nameWithoutExt+"_transcoded")
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
        Paths:       paths,
        Resolutions: resolutions,
        VideoInfo:   videoInfo,
    }, nil
}

func (p *Processor) GenerateThumbnail(inputPath string) error {
    log.Printf("Generating thumbnail...")
    
    args := []string{
        "-y",
        "-ss", fmt.Sprintf("%.2f", p.VideoInfo.Duration/2),
        "-i", inputPath,
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

func (p *Processor) GenerateMP4Files(inputPath string) error {
    if p.VideoInfo.HasAudio {
        if err := p.extractAudio(inputPath); err != nil {
            return err
        }
    }

    for _, res := range p.Resolutions {
        if err := p.generateMP4(inputPath, res); err != nil {
            return err
        }
    }

    return nil
}

func (p *Processor) extractAudio(inputPath string) error {
    args := []string{
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
        
        "-hls_segment_filename", filepath.Join(streamDir, "segments", "data%03d.m4s"),
        
        filepath.Join(streamDir, "stream.m3u8"))

    cmd := exec.Command("ffmpeg", args...)
    cmd.Stdout = os.Stdout
    cmd.Stderr = os.Stderr

    return cmd.Run()
}

func (p *Processor) generateAudioStream() error {
    audioDir := filepath.Join(p.Paths.HLSDir, "audio")
    args := []string{
        "-i", filepath.Join(p.Paths.MP4Dir, "audio.m4a"),
        "-c:a", "copy",
        "-f", "hls",
        
        "-hls_time", "2",
        "-hls_playlist_type", "vod",
        "-hls_flags", "independent_segments+program_date_time",
        "-hls_segment_type", "fmp4",
        "-hls_fmp4_init_filename", "init.mp4",
        "-hls_list_size", "0",
        
        "-hls_segment_filename", filepath.Join(audioDir, "segments", "data%03d.m4s"),
        filepath.Join(audioDir, "stream.m3u8"),
    }

    return runFFmpeg(args)
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
        log.Printf("Generating IFRAME playlist for %s...", res.Name)
        if err := p.generateIframePlaylist(res); err != nil {
            return err
        }
        log.Printf("Completed IFRAME playlist for %s", res.Name)
    }

    return p.generateMasterIframePlaylist()
}

func (p *Processor) generateIframePlaylist(res Resolution) error {
    resIframeDir := filepath.Join(p.Paths.HLSDir, "iframe", res.Name)
    if err := os.MkdirAll(filepath.Join(resIframeDir, "segments"), 0755); err != nil {
        return err
    }

    inputFile := filepath.Join(p.Paths.MP4Dir, fmt.Sprintf("%s.mp4", res.Name))
    args := []string{
        "-i", inputFile,
        "-c:v", "copy",
        "-an",
        "-f", "hls",

        "-hls_time", "1",
        "-hls_playlist_type", "vod",
        "-hls_flags", "independent_segments+discont_start",
        "-hls_segment_type", "fmp4",
        "-hls_fmp4_init_filename", "init.mp4",
        
        "-force_key_frames", "expr:gte(t,n_forced*1)",
        "-g", "30",
        "-keyint_min", "30",
        
        "-hls_segment_filename", filepath.Join(resIframeDir, "segments", "iframe%03d.m4s"),
        filepath.Join(resIframeDir, "iframe.m3u8"),
    }

    cmd := exec.Command("ffmpeg", args...)
    cmd.Stdout = os.Stdout
    cmd.Stderr = os.Stderr
    return cmd.Run()
}

func (p *Processor) generateMasterIframePlaylist() error {
    masterPlaylist := []string{
        "#EXTM3U",
        "#EXT-X-VERSION:6",
        "",
    }

    for _, res := range p.Resolutions {
        bandwidth := getBandwidth(res.Bitrate) / 4
        
        codecs := "avc1.640028"
        
        masterPlaylist = append(masterPlaylist,
            fmt.Sprintf("#EXT-X-I-FRAME-STREAM-INF:"+
                "BANDWIDTH=%d,"+
                "RESOLUTION=%dx%d,"+
                "CODECS=\"%s\","+
                "URI=\"iframe/%s/iframe.m3u8\"",
                bandwidth,
                res.Width, res.Height,
                codecs,
                res.Name))
    }

    masterFile := filepath.Join(p.Paths.HLSDir, "master_iframe.m3u8")
    return os.WriteFile(masterFile, []byte(strings.Join(masterPlaylist, "\n")), 0644)
}
func Process(inputPath string, resolutions []Resolution) error {
    processor, err := NewProcessor(inputPath, resolutions)
    if err != nil {
        return err
    }

    if err := processor.GenerateThumbnail(inputPath); err != nil {
        return err
    }

    if err := processor.GenerateMP4Files(inputPath); err != nil {
        return err
    }

    if err := processor.GenerateHLSPlaylists(); err != nil {
        return err
    }

    if err := processor.GenerateIframePlaylists(); err != nil {
        return err
    }
    return nil
}