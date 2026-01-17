# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base


WORKDIR /workspace

ENV NODE_ENV=development
ENV PNPM_HOME="/workspace/.pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    python3 \
    python3-venv \
    python3-pip \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

