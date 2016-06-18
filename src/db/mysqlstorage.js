/**
 * Created by Stainwoortsel on 14.06.2016.
 */
let loginAttempts;

/**
 * Generate hash key string
 * @param args
 * @returns {string}
 */
const generateKey = (...args) => {
  const SEPARATOR = '!';
  return args.join(SEPARATOR);
};

module.exports = {
  /**
   * Lock user
   * @param username
   * @param reason
   * @param whom
   * @param remoteip
   * @returns {Redis|{index: number, input: string}}
   */
  lockUser({ username, reason, whom, remoteip }) {
    /*
        SET @aud = '*.localhost';
        SELECT @id=id FROM users WHERE username=:username;
        UPDATE users SET isbanned=1 WHERE id=@id;
        INSERT INTO user_meta (user_id, audience, k, v)
          SELECT @id, @aud, 'banned', 'true' UNION
          SELECT @id, @aud, 'banned:reason', :reason UNION
          SELECT @id, @aud, 'banned:whom', :whom UNION
          SELECT @id, @aud, 'banned:remoteip', :remoteip;
        DELETE FROM user_tokens WHERE user_id=@id;
     */
  },

  /**
   * Unlock user
   * @param username
   * @returns {Redis|{index: number, input: string}}
   */
  unlockUser({ username }) {
    /*
       SET @aud = '*.localhost';
       SELECT @id=id FROM users WHERE username=:username;
       DELETE FROM user_meta WHERE user_id=@id and k like 'banned%';
          // селект для наглядности, а вообще городят DELETE c 2 таблицами
     */
  },

  /**
   * Check existance of user
   * @param username
   * @returns {Redis|username}
   */
  isExists(username) {  //ПЕРЕИМЕНОВАТЬ скорее fetchUsername resolve
    /*
       SELECT count(id) FROM users WHERE username=:username;

       return username | throw new Errors.HttpStatusError(404, `"${username}" does not exists`);
     */
  },

  /**
   * Check the existance of alias
   * @param alias
   * @returns {username|''}
   */
  aliasAlreadyExists(alias) {   // УДАЛИТЬ в логику регистрации или setAlias который и юзать
    /*
       SELECT (SELECT count(id) FROM users WHERE alias=:alias) +
              (SELECT count(user_id) FROM user_alias WHERE alias=:alias);

       return '' | throw new Errors.HttpStatusError(409, `"${alias}" already exists`); ??? почему пустая строка?
     */
  },

  /**
   * User is public
   * @param username
   * @param audience
   * @returns {function()}
   */
  isPublic(username, audience) { // УДАЛИТЬ на самом деле, этот метод проверяет по какому полю запрашиваются
    // метадата. если это емайл то мы ему кукишь, ибо низзя по имэйлу спрашивать, то есть это
    // элемент метода гет-метадата, а значит пихаем в логику getMetadata
    /*
       SELECT ispublic FROM users WHERE username=:username ?????
       ||
       SELECT um.v
       FROM user_meta um
       JOIN users u ON u.id=um.user_id AND u.username=:username
       WHERE
          um.audience=:audience AND
          um.k = 'alias'

       return v === username | throw new Errors.HttpStatusError(404, 'username was not found')
     */
  },


  /**
   * Check that user is active
   * @param data
   * @returns {Promise}
   */
  isActive(data) {
    /*
    логика из даты, лучше такие методы запихнуть в утилиты адаптера которые просто будут кидать ошибки
     */
  },

  /**
   * Check that user is banned
   * @param data
   * @returns {Promise}
   */
  isBanned(data) {
    /*
    см выше
     */
  },

  /**
   * Activate user account
   * @param user
   * @returns {Redis}
   */
  activateAccount(username) {
    /*
        UPDATE users SET isactive=1 WHERE username=:username;
        достаточно просто апдейта, не надо страдать фигней
        можно ошибку кидать по кол-ву обработанных строчек
        если 0 то уже активировали


        ||
        SELECT @id=id, @active=isactive FROM users WHERE username=:username;
        // проверяем есть ли пользователь и активирован ли он?
        UPDATE users SET isactive=1 WHERE id=@id;
        // throw new Errors.HttpStatusError(417, `Account ${user} was already activated`); нужна ли проверка?..
     */
  },

  /**
   * Get user internal data
   * @param username
   * @returns {Object}
   */
  getUser(username) {
    /*
        SELECT @id=id, ..... FROM users WHERE username=:username OR alias=:username;
              // возможно нужна проверка по таблице user_aliases
        // SELECT audience, k, v FROM user_meta WHERE user_id=@id;
     */
  },

  _getMeta(username, audience) {
    /*
     SELECT audience, k, v
     FROM user_meta
     JOIN
     WHERE user_id=@id;
     */
  },
  _remapMeta(data, audiences, fields) {
    // ...
    // сериализацию десериализацию можно оставить во вне, она скорее всего будет одинаковой
  },


  /**
   * Get users metadata by username and audience
   * @param username
   * @param audience
   * @param fields
   * @returns {Object}
   */
  getMetadata(username, _audiences, fields = {}) {
    /*
        _getMeta
        _remapData
     */
  },


  /**
   * Return the list of users by specified params
   * @param opts
   * @returns {Array}
   */
  getList(opts) {
    /*

        fsort -- это и селект и сортировка и всё вместе



        SELECT
        FROM users, user_meta

        WHERE :criteria

        ORDER BY :order
        LIMIT :offset, :limit

        // здесь возможен селект с join-ами на user_meta,
        // если критерии выборки будут в полях таблицы user_meta
     */
  },

  /**
   * Check that user is admin
   * @param meta
   * @returns {boolean}
   */
  isAdmin(meta) {
    /*
        это выносим в утилиты, работает по метаданным
     */
  },

  /**
   * Make the linkage between username and alias into the USERS_ALIAS_TO_LOGIN
   * @param username
   * @param alias
   * @returns {Redis}
   */
  storeAlias(username, alias) {
    /*
        сделать метод setAlias

        INSERT INTO user_aliases(user_id, alias)
        SELECT id, :alias
        FROM users
        WHERE username=:username;
     */
  },

  /**
   * Assign alias to the user record, marked by username
   * @param username
   * @param alias
   * @returns {Redis}
   */
  assignAlias(username, alias) {
    /*
     сделать метод setAlias


      SElECT @id = id FROM users WHERE username=:username;
      UPDATE users SET alias=:alias, ispublic=1 WHERE id=@id;
      UPDATE user_meta SET v = :alias WHERE user_id=@id AND audience='*.localhost' AND k='alias'
     */
  },

  /**
   * Return current login attempts count
   * @returns {int}
   */
  getAttempts() {
    return loginAttempts;
  },
  /**
   * Drop login attempts counter
   * @returns {Redis}
   */
  dropAttempts() {
    loginAttempts = 0;
    /*
      DELETE FROM login_attempts WHERE ip=:ip
     */
  },

  /**
   * Check login attempts
   * @param data
   * @param _remoteip
   * @returns {Redis}
   */
  checkLoginAttempts(data, _remoteip) {
    /*
           SELECT attempts, lastattempt FROM login_attempts WHERE ip=:ip AND username=:username;

              // здесь смотрим на кол-во попыток и на expire, само собой expire удаляем ВРУЧНУЮ!

           UPDATE login_attempts
           SET attempts=attempts + 1, lastattempt=NOW()
           WHERE ip=:ip AND username=:username;

     */
  },

  /**
   * Set user password
   * @param username
   * @param hash
   * @returns {Redis}
   */
  setPassword({ username, hash }) {
    /*
        UPDATE users SET pass=:hash WHERE username=:username
     */
  },

  /**
   * Reset the lock by IP
   * @param username
   * @param ip
   * @returns {Redis}
   */
  resetIPLock(username, ip) {
    /*
        DELETE FROM login_attempts WHERE ip=:id AND username=:username
     */
  },


  /**
   * Process metadata update operation for a passed audience / inner method
   * @param  {Object} pipeline
   * @param  {String} audience
   * @param  {Object} metadata
   */
  _handleAudience(pipeline, key, metadata) {
      // ... updating user_meta, да это чисто внутренний метод, в sql он будет другой
  },


  /**
   *
   * @param username
   * @param audience
   * @param metadata
   * @returns {Object}
   */
  updateMetadata({ username, audience, metadata, script }) {
      // ... updating user_meta
      // скрипт вынести за логику апдейта, толкьо для эдванст-юзыч
  },

  /**
   * Removing user by username (and data?)
   * @param username
   * @param data
   * @returns {*|{arity, flags, keyStart, keyStop, step}|Array|{index: number, input: string}}
   */
  removeUser(username, data) {
    /*
        SELECT @id = id FROM users WHERE username=:username;
        DELETE FROM users WHERE id=@id;
        DELETE FROM user_aliases WHERE user_id=@id;
        DELETE FROM user_meta WHERE user_id=@id;
        DELETE FROM user_tokens WHERE user_id=@id;
        DELETE FROM login_attempts WHERE username=:username; ??
     */
  },

  /**
   * Verify ip limits
   * @param  {redisCluster} redis
   * @param  {Object} registrationLimits
   * @param  {String} ipaddress
   * @return {Function}
   */
  checkLimits(ipaddress) {
    /*
          INSERT INTO register2ip (ip, uuid, registered)
          SELECT :ip, :uuid, NOW();

          SELECT * FROM register2ip WHERE ip=:ipaddress

          DELETE FROM register2ip WHERE ip=:ipaddress AND registered < :old

          SELECT count(*) FROM register2ip WHERE ip=:ipaddress

          // проверка на ограничения
     */
  },

  /**
   * Creates user with a given hash
   * @param redis
   * @param username
   * @param activate
   * @param userDataKey
   * @returns {Function}
   */
  createUser(username, activate) {
    /*
        можно сразу с алиасом
        т.е. обеспечить атомарность

        проверить на наличие пользователя

          INSERT INTO users (username, isactive, registered)
          SELECT :username, :activate, NOW();

        // проверка на существование
     */
  },

  /**
   * Performs captcha check, returns thukn
   * @param  {String} username
   * @param  {String} captcha
   * @return {Function}
   */
  checkCaptcha(username, captcha) {
    // ...
  },

  /**
   * Stores username to the index set
   * @param username
   * @returns {Redis}
   */
  storeUsername(username) {
    // по сути метод не нужен
    // это все из логики регистрации
    // а вообще это логика активации пользователя,
    // просто при регистрации не нужен персист, ибо сразу, а для активации персист нуежн
    // то есть если я его лишний раз вызову, ничего страшного
    // это намек на отдельный большой метод activateUser для регистрации и активации
    // ... у users в РСУБД есть поле ID, этот метод будет пустым
  },

  /**
   * Execute custom script on LUA
   * @param script
   * @returns {Promise}
   */
  customScript(script, keys) {
    // ...
  },

  handleAudience(key, metadata) {
      // updating user_meta
  }
};
