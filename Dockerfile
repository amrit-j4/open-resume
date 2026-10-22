FROM node:18-alpine as builder
WORKDIR /app
COPY . .
# NEXT_PUBLIC_* values are baked into the browser bundle when it is built, so they must be present here, not only at run time.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_JOB_BOARD_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_JOB_BOARD_URL=$NEXT_PUBLIC_JOB_BOARD_URL
RUN npm install --include=dev
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next/standalone .
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]