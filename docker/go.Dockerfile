FROM plder-dev-base:latest

USER root

# Go 1.24
RUN curl -fsSL "https://go.dev/dl/go1.24.2.linux-amd64.tar.gz" | tar -C /usr/local -xzf -
ENV PATH="/usr/local/go/bin:/home/dev/go/bin:${PATH}"

# Go tools
RUN go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest \
    && go install golang.org/x/tools/gopls@latest \
    && go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest

# buf (protobuf)
RUN curl -fsSL "https://github.com/bufbuild/buf/releases/latest/download/buf-Linux-x86_64" \
    -o /usr/local/bin/buf && chmod +x /usr/local/bin/buf

USER dev
WORKDIR /home/dev
