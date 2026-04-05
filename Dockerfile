FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci \
    && npx prisma generate \
    && npm prune --omit=dev \
    && npm cache clean --force

COPY . .

EXPOSE 5000

CMD ["npm", "start"]
