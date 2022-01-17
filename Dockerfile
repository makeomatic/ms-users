FROM node:17-alpine as base
RUN apk add --no-cache python3 build-base
WORKDIR /app
COPY package.json yarn.lock ./

FROM base as build
RUN yarn install --frozen-lockfile
COPY src ./src
RUN yarn compile

FROM base
RUN apk add --no-cache perf
ENV NCONF_NAMESPACE=MS_USERS NODE_ENV=production
RUN yarn install --frozen-lockfile --production
COPY schemas ./schemas
COPY scripts ./scripts
COPY --from=build /app/lib ./lib
