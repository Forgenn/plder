FROM node:20-bookworm-slim

ARG TARGETARCH=amd64

# System essentials
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl wget build-essential python3 openssh-client \
    zsh fish vim htop jq unzip tmux file ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# kubectl
RUN curl -fsSL "https://dl.k8s.io/release/$(curl -fsSL https://dl.k8s.io/release/stable.txt)/bin/linux/${TARGETARCH}/kubectl" \
    -o /usr/local/bin/kubectl && chmod +x /usr/local/bin/kubectl

# helm
RUN curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update && apt-get install -y gh && rm -rf /var/lib/apt/lists/*

# Pi coding agent + plder package
RUN npm install -g @mariozechner/pi-coding-agent \
    && pi install git:github.com/Forgenn/plder

# Claude Code CLI (backward compat / fallback)
RUN npm install -g @anthropic-ai/claude-code

# tmux config
RUN echo 'set -g history-limit 50000\nset -g mouse off\nset -g default-terminal "xterm-256color"' > /etc/tmux.conf

# Non-root user
RUN useradd -m -s /bin/zsh -u 1000 dev
USER dev
WORKDIR /home/dev

# oh-my-zsh for dev user
RUN sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended

ENV TERM=xterm-256color
ENV SHELL=/bin/zsh

CMD ["sleep", "infinity"]
