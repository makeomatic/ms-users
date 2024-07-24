FROM makeomatic/node:$NODE_VERSION

ENV NCONF_NAMESPACE=MS_USERS \
    NODE_ENV=$NODE_ENV

WORKDIR /src

# pnpm fetch does require only lockfile
COPY --chown=node:node pnpm-lock.yaml ./
RUN \
  apk --update --upgrade \
    add ca-certificates --virtual .buildDeps git ca-certificates openssl g++ make python3 linux-headers \
  && update-ca-certificates \
  && chown node:node /src \
  && su node sh -c "cd /src && pnpm fetch --prod" \
  && su node sh -c "rm -rf ~/.cache && pnpm store prune" \
  && apk del .buildDeps \
  && rm -rf \
    /tmp/* \
    /root/.node-gyp \
    /root/.npm \
    /etc/apk/cache/* \
    /var/cache/apk/*

USER node
COPY --chown=node:node . /src
RUN pnpm install --offline --prod

CMD [ "./node_modules/.bin/mfleet" ]
