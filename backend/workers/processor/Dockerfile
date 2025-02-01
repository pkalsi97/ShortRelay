FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=arm64 \
    go build \
    -ldflags="-s -w" \
    -trimpath \
    -o processor ./cmd/processor
RUN mkdir -p /tmp/footage

FROM scratch
COPY --from=builder /app/processor /processor
COPY ffmpeg/ffmpeg /usr/local/bin/ffmpeg
COPY ffmpeg/ffprobe /usr/local/bin/ffprobe
COPY --from=builder /tmp/footage /tmp/footage
WORKDIR /tmp
ENV FOOTAGE_DIR=/tmp/footage
CMD ["/processor"]