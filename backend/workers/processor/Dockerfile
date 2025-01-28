FROM public.ecr.aws/docker/library/golang:1.21-alpine AS builder

WORKDIR /app
COPY . .
RUN GOOS=linux GOARCH=arm64 go build -o processor ./cmd/processor

FROM public.ecr.aws/docker/library/alpine:latest

RUN apk add --no-cache curl tar xz

RUN curl -L https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-arm64-static.tar.xz -o ffmpeg.tar.xz && \
    tar xf ffmpeg.tar.xz && \
    mv ffmpeg-*-arm64-static/ffmpeg /usr/local/bin/ && \
    mv ffmpeg-*-arm64-static/ffprobe /usr/local/bin/ && \
    chmod +x /usr/local/bin/ffmpeg && \
    chmod +x /usr/local/bin/ffprobe && \
    rm -rf ffmpeg.tar.xz ffmpeg-*-arm64-static

RUN echo "=== FFmpeg Version ===" && \
    ffmpeg -version && \
    echo "=== AAC Encoders ===" && \
    ffmpeg -encoders | grep -i aac && \
    echo "=== HLS Support ===" && \
    ffmpeg -formats | grep -i hls && \
    echo "=== DASH Support ===" && \
    ffmpeg -formats | grep -i dash && \
    echo "=== PNG Support ===" && \
    ffmpeg -version | grep png && \
    echo "=== Verification Complete ==="

RUN mkdir -p /tmp/footage

COPY --from=builder /app/processor /processor
RUN chmod +x /processor

ENV FOOTAGE_DIR=/tmp/footage

CMD ["/processor"]