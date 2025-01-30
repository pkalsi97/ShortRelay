FROM public.ecr.aws/docker/library/golang:1.21-alpine AS builder
WORKDIR /app
COPY . .
RUN GOOS=linux GOARCH=arm64 go build -o processor ./cmd/processor

FROM public.ecr.aws/docker/library/alpine:latest

WORKDIR /usr/local/bin
COPY ffmpeg-download/ffmpeg-git-*/ffmpeg .
COPY ffmpeg-download/ffmpeg-git-*/ffprobe .
RUN chmod +x ffmpeg ffprobe

RUN mkdir -p /tmp/footage

COPY --from=builder /app/processor /processor
RUN chmod +x /processor

ENV FOOTAGE_DIR=/tmp/footage

CMD ["/processor"]