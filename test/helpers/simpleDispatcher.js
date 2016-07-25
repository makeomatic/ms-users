function simpleDispatcher(router) {
  return function dispatch(route, params) {
    return router.dispatch(route, { params, transport: 'amqp' });
  }
}

module.exports = simpleDispatcher;
