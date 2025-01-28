package validation

type ffprobeFormat struct {
    FormatName string            `json:"format_name"`
    Duration   string            `json:"duration"`
    BitRate    string           `json:"bit_rate"`
    Tags       map[string]string `json:"tags"`
}

type ffprobeStream struct {
    CodecType         string `json:"codec_type"`
    CodecName         string `json:"codec_name"`
    Width            int    `json:"width"`
    Height           int    `json:"height"`
    DisplayAspectRatio string `json:"display_aspect_ratio"`
    RFrameRate        string `json:"r_frame_rate"`
    BitRate          string `json:"bit_rate"`
    NbFrames         string `json:"nb_frames"`
    ColorSpace       string `json:"color_space"`
}

type ffprobeData struct {
    Format  ffprobeFormat   `json:"format"`
    Streams []ffprobeStream `json:"streams"`
}