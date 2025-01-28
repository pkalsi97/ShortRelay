FROM --platform=linux/arm64 public.ecr.aws/docker/library/golang:1.21-alpine AS builder

WORKDIR /app
COPY go.* ./
RUN go mod download

COPY . .
RUN GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -o processor ./cmd/processor

FROM --platform=linux/arm64 public.ecr.aws/docker/library/alpine:latest

LABEL maintainer="pkalsi97"
LABEL version="1.0"

RUN apk update && \
    apk add --no-cache \
    ffmpeg \
    x264 \
    fdk-aac \
    ffmpeg-libs \
    libpng \
    coreutils && \
    ffmpeg -version && \
    ffprobe -version && \
    rm -rf /var/cache/apk/*


RUN adduser -D processor
RUN mkdir -p /tmp/footage && \
    chown -R processor:processor /tmp/footage

WORKDIR /app

COPY --from=builder /app/processor .
RUN chmod +x processor

USER processor

CMD ["./processor"]