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

# Keep Prisma CLI available because Railway runs database migrations
# from this runtime image during the pre-deploy step.
RUN npm ci

COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/src apps/api/src
COPY --from=build /app/apps/api/prisma apps/api/prisma
COPY --from=build /app/apps/api/prisma.config.ts apps/api/prisma.config.ts

EXPOSE 3001

CMD ["npm", "run", "start", "--workspace=@dhaka-tesla-pool/api"]
