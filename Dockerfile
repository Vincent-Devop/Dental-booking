FROM node:22-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.0.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json vite.config.ts app.config.ts ./
COPY client ./client
COPY server ./server
COPY shared ./shared
RUN pnpm install --frozen-lockfile && pnpm build
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["pnpm", "start"]
