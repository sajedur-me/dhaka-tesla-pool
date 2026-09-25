FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN npm ci

COPY apps/api apps/api

RUN npm exec --workspace=@dhaka-tesla-pool/api -- prisma generate
RUN npm run build --workspace=@dhaka-tesla-pool/api


FROM node:24-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN npm ci --omit=dev

COPY --from=build /app/apps/api/dist apps/api/dist

EXPOSE 3001

CMD ["npm", "run", "start", "--workspace=@dhaka-tesla-pool/api"]
