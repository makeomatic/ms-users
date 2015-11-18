FROM alpine:3.2

ARG VERSION=v5.0.0
ARG NPM_VERSION=3

RUN apk add --update bash curl make gcc g++ python linux-headers paxctl libgcc libstdc++
RUN curl -sSL https://nodejs.org/dist/${VERSION}/node-${VERSION}.tar.gz | tar -xz && \
  cd /node-${VERSION} && \
  ./configure --prefix=/usr ${CONFIG_FLAGS} && \
  make -j$(grep -c ^processor /proc/cpuinfo 2>/dev/null || 1) && \
  make install && \
  paxctl -cm /usr/bin/node && \
  cd / && \
  if [ -x /usr/bin/npm ]; then \
    npm install -g npm@${NPM_VERSION} && \
    find /usr/lib/node_modules/npm -name test -o -name .bin -type d | xargs rm -rf; \
  fi && \
  apk del linux-headers paxctl ${DEL_PKGS} && \
  rm -rf /etc/ssl /node-${VERSION} ${RM_DIRS} \
    /usr/share/man /tmp/* /var/cache/apk/* /root/.npm /root/.node-gyp \
    /usr/lib/node_modules/npm/man /usr/lib/node_modules/npm/doc /usr/lib/node_modules/npm/html

RUN apk add --update ruby ruby-bundler

# install things globally, for great justice
ENV GEM_HOME /usr/local/bundle
ENV PATH $GEM_HOME/bin:$PATH
ENV BUNDLER_VERSION 1.10.6

RUN echo 'gem: --no-document' >> ~/.gemrc

RUN gem install redis

RUN rm -rf ${RM_DIRS} /usr/share/man /tmp/* /var/cache/apk/*


VOLUME "/usr/src/app"
WORKDIR "/usr/src/app"

CMD [ "bash" ]
