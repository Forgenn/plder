FROM plder-dev-base:latest

USER root

# pnpm + bun
RUN npm install -g pnpm \
    && curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

USER dev
WORKDIR /home/dev

# bun for dev user
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/home/dev/.bun/bin:${PATH}"
