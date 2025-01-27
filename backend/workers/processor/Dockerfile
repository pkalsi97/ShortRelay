FROM --platform=linux/arm64 golang:1.21-alpine AS builder

WORKDIR /app
COPY . .
RUN GOOS=linux GOARCH=arm64 go build -o processor ./cmd/processor

FROM --platform=linux/arm64 alpine:latest

RUN mkdir -p /tmp/footage

COPY --from=builder /app/processor /processor

RUN chmod +x /processor

CMD ["/processor"]