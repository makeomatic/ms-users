# Улучшения логина

## Требования

1. Блокировать ip на 7 дней если в течение 24 часов было сделано 25 неудачных попыток логина или попыток залогинить несуществующего пользователя
2. Блокировать связку ip+userId на 24 часа если в течение 24 часов было сделано 5 неудачных попыток логина
3. Уведомлять пользователя через какое время пропадет блокировка

Бонусом учитывать MFA (src/utils/mfa.js)

## Реализация

1. В src/utils/mfa.js создавать инстанс UserIpRateLimiter и сохранять его в locals
2. В конструкторе сервиса создавать инстанс UserIp и в src/utils/mfa.js сохранять ip пользователя
3. В нужных местах расставить UserIpRateLimiter.reserveForIp или UserIpRateLimiter.reserveForUserIp
4. При удачном логине делать cleanup

### Скрипты для Redis

Необходимо написать три редис скрипта.

#### slidingWindowReserve.lua

В интервале блокировки (текущее время минус интервал блокировки) проверяем количество токенов (получить скор последнего элемента в интервале блокировки, это будет максимальный скор, посчитать минимальный скор как максимальный скор минус интевал плавающего окна, посчитать количество элементов в этом окне), если токенов больше или равно лимиту считаем время до разблокировки, если меньше резервируем токен и возвращаем информацию по использованию.

##### Ключи

1. Ключ для сохранения токенов типа `zset`

##### Входящие параметры

Название | Обязательный | Описание
--- | --- | ---
`microCurrentTime` | да | Текущее время в микросекундах, положительное целое число
`interval` | да | Интервал плавающего окна, положительное целое число миллисекунд или 0 для постоянной блокировки
`limit` | да | Лимит токенов в плавающем окне, положительное целое число
`reserveToken` | нет | Если равен `false` не резервировать токен, просто выводить информацию по использованию, по умолчанию `false`
`token` | обязательные если `reserveToken` равен `true` | Уникальная строка uuid v4
`blockInterval | нет | Интервал блокировки по истечении лимита токенов, если не передан равен `interval`, положительное целое число миллисекунд или 0

##### Ответ

Массив из 4 элементов.

[  
  `usage` -- сколько токенов в окне, положительное целое число  
  `limit` -- лимит токенов, положительное целое число  
  `token` -- строка или nil  
  `reset` -- время до до разблокировки в миллисекундах, 0 если вечная блокировка или nil  
]

Пример

[10, 10, 'uuidv4', 12000]

#### slidingWindowCancel.lua

Удаляет токен из `zset`.

##### Ключи

1. Ключ для сохранения токенов типа `zset`

##### Параметры

Название | Обязательный | Описание
--- | --- | ---
`token` | да | Уникальная строка uuid v4

#### slidingWindowCleanup.lua

Удаляет все токены из основного ключа (предварительно сохранив их) и удаляет эти токены из дополнительных ключей.

##### Ключи

1. Основной ключ
2. Любое количество дополнительных ключей

### Класс для работы со скриптами redis

```js
class SlidingWindowRedisBackend {
  /**
   * @param redis ioredis instance
   * @param {object} config
   * @param {boolean} config.enabled
   * @param {integer} config.limit
   * @param {integer} config.interval
   * @param {integer} config.blockInterval
   */
  constructor(redis, config) {}

  /**
   * @param {string} key
   * @param {string} token
   * @throws RateLimitError
   */
  async reserve(key, token) {}

  /**
   * @param {string} key
   * @throws RateLimitError
   */
  async check(key) {}

  /**
   * @param {string} key
   * @param {string} token
   */
  async cancel(key, token) {}

  /**
   * @param {string} key
   * @param {string[]} additionalKeys
   */
  async cleanup(key, ...additionalKeys) {}
}
```

### Класс для работы со блокировками

```js
class UserIpRateLimiter {
  /**
   * 1. Generates token (uuid v4)
   * 2. Create SlidingWindowRedisBackend instance for ip rate limiter
   * 3. Create SlidingWindowRedisBackend instance for user and ip rate limiter
   * @param redis ioredis instance
   * @param {object} ipRateLimiterConfig
   * @param {object} userIpRateLimiterConfig
   */
  constructor(redis, ipRateLimiterConfig, userIpRateLimiterConfig) {}

  /**
   * @param {string} ip
   * @throws RateLimitError
   */
  async reserveForIp(ip) {}

  /**
   * @param {string} userId
   * @param {string} ip
   * @throws RateLimitError
   */
  async reserveForUserIp(userId, ip) {}

  /**
   * @param {string} userId
   * @param {string[]} ips
   */
  async cleanupForUserIps(userId, ...ips) {}
}
```

### Класс для сохранения ip пользовтеля

```js
class UserIp {
  /**
   * @param redis ioredis instance
   */
  constructor(redis) {}

  async save(userId, ip) {}

  async getAll(userId) {}
}
```
