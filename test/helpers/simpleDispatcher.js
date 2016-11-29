function simpleDispatcher(router) {
  return function dispatch(route, params) {
    return router.dispatch(route, { params, headers: {}, query: {}, method: 'amqp', transport: 'amqp' });
  };
}

module.exports = simpleDispatcher;
