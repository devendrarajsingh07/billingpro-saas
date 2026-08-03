# Plain Node service — no compile/bundle step, so a single stage is enough.
# (A prior multi-stage version copied the builder stage's full node_modules
# — including devDependencies like jest/nodemon — over the production-only
# install in the final stage, defeating the point of --only=production.)
FROM node:20-alpine

WORKDIR /usr/src/app

# better-sqlite3 ships prebuilt binaries for common platforms; if none match
# this image's arch, npm falls back to node-gyp, which needs these.
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 5001

ENV NODE_ENV=production
ENV PORT=5001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 5001) + '/api/v1/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "server.js"]
