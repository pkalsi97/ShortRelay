FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY . .
RUN go build -o processor ./cmd/processor

FROM alpine:latest

RUN mkdir -p /tmp/footage

COPY --from=builder /app/processor /processor

RUN chmod +x /processor

CMD ["/processor"]