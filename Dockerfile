FROM node:20-alpine

WORKDIR /app

COPY . .

RUN npm ci

# build
RUN npx nest build


RUN echo "=== MOVING MAIN.JS ==="
RUN test -f dist/src/main.js && mv dist/src/main.js dist/ && echo "✅ main.js moved to dist/" || echo "❌ main.js not found in dist/src/"


RUN test -d dist/src && (mv dist/src/* dist/ 2>/dev/null || true) && rmdir dist/src 2>/dev/null || true

RUN echo "=== FINAL CHECK ==="
RUN ls -la dist/ && test -f dist/main.js && echo "🎉 READY! dist/main.js exists" || echo "💥 STILL MISSING dist/main.js"

RUN npx prisma generate

EXPOSE 10000
ENV NODE_ENV=production

CMD ["node", "dist/main"]