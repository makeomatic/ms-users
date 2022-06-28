module.exports = {
  name: 'raw-request',
  register(server) {
    server.ext('onRequest', (request, h) => {
      const dataChunks = [];
      request.plugins['raw-request'] = {};

      request.raw.req.on('data', (chunk) => {
        dataChunks.push(chunk);
      });

      request.raw.req.on('end', () => {
        request.plugins['raw-request'] = {
          body: Buffer.concat(dataChunks),
        };
      });

      return h.continue;
    });
  },
};
