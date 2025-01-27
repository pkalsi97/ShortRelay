FROM public.ecr.aws/docker/library/golang:1.21-alpine AS builder

WORKDIR /app
COPY . .
RUN GOOS=linux GOARCH=arm64 go build -o processor ./cmd/processor

FROM public.ecr.aws/docker/library/alpine:latest

RUN mkdir -p /tmp/footage

COPY --from=builder /app/processor /processor

RUN chmod +x /processor

CMD ["/processor"]