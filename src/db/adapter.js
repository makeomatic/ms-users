/**
 * Created by Stainwoortsel on 30.05.2016.
 */
const RedisStorage = require('./redisstorage');
const Errors = require('common-errors');

class Users{
  constructor(adapter){

    this.adapter = adapter;

/*
    let opts = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    // init configuration
    const config = this._config = _extends({}, defaultOpts, opts);

    // setup hooks
    forOwn(config.hooks, (_hooks, eventName) => {
      const hooks = Array.isArray(_hooks) ? _hooks : [_hooks];
      each(hooks, hook => this.on(eventName, hook));
    });
*/

  }

  /**
   * Initialize connection
   * @return {Promise}
   */
  connect(){
    // ????
  }

  /**
   * Close connection
   * return {Promise}
   */
  close(){
    // ????
  }


  /**
   * Lock user
   * @param username
   * @param reason
   * @param whom
   * @param remoteip
   * @returns {Redis}
   */
  lockUser({ username, reason, whom, remoteip }){
    return this.adapter.lockUser({ username, reason, whom, remoteip });
  }

  /**
   * Unlock user
   * @param username
   * @returns {Redis}
   */
  unlockUser(username){
    return this.adapter.unlockUser(username);
  }

  /**
   * Check existance of user
   * @param username
   * @returns {Redis}
   */
  isExists(username){
    return this.adapter.isExists(username);
  }

  isAliasExists(alias, thunk){
    return this.adapter.isAliasExists(alias, thunk);
  }

  /**
   * User is public
   * @param username
   * @param audience
   * @returns {function()}
   */
  isPublic(username, audience) {
    return this.adapter.isPublic(username, audience);
  }

  /**
   * Check that user is active
   * @param data
   * @returns {boolean}
   */
  isActive(data){
    return this.adapter.isActive(data);
  }

  /**
   * Check that user is banned
   * @param data
   * @returns {Promise}
   */
  isBanned(data){
    return this.adapter.isBanned(data);
  }

  /**
   * Activate user account
   * @param user
   * @returns {Redis}
   */
  activateAccount(user){
    return this.adapter.activateAccount(user);
  }

  /**
   * Get user internal data
   * @param username
   * @returns {Object}
   */
  getUser(username){
    return this.adapter.getUser(username);
  }

  /**
   * Get users metadata by username and audience
   * @param username
   * @param audience
   * @returns {Object}
   */

  getMetadata(username, _audiences, fields = {}) {
    return this.adapter.getMetadata(username, _audiences, fields);
  }


  /**
   * Return the list of users by specified params
   * @param opts
   * @returns {Array}
   */
  getList(opts){
    return this.adapter.getList(opts);
  }
  
  /**
   * Check that user is admin
   * @param meta
   * @returns {boolean}
   */
  isAdmin(meta){
    return this.adapter.isAdmin(meta);
  }

  /**
   * Make the linkage between username and alias into the USERS_ALIAS_TO_LOGIN
   * @param username
   * @param alias
   * @returns {Redis}
   */
  storeAlias(username, alias){
    return this.adapter.storeAlias(username, alias);
  }

  /**
   * Assign alias to the user record, marked by username
   * @param username
   * @param alias
   * @returns {Redis}
   */
  assignAlias(username, alias){
    return this.adapter.assignAlias(username, alias);
  }

  /**
   * Return current login attempts count
   * @returns {int}
   */
  getAttempts(){
    return this.adapter.getAttempts();
  }

  /**
   * Drop login attempts counter
   * @returns {Redis}
   */
  dropAttempts(){
    return this.adapter.dropAttempts();
  }

  /**
   * Check login attempts
   * @param data
   * @returns {Redis}
   */
  checkLoginAttempts(data) {
    return this.adapter.checkLoginAttempts(data);
  }

  /**
   * Set user password
   * @param username
   * @param hash
   * @returns {Redis}
   */
  setPassword(username, hash){
    return this.adapter.setPassword(username, hash);
  }

  /**
   * Reset the lock by IP
   * @param username
   * @param ip
   * @returns {Redis}
   */
  resetIPLock(username, ip){
    return this.adapter.resetIPLock(username, ip);
  }

  /**
   *
   * @param username
   * @param audience
   * @param metadata
   * @returns {Object}
   */
  updateMetadata({username, audience, metadata}) {
    return this.adapter.updateMetadata({username, audience, metadata});
  }

  /**
   * Removing user by username (and data?)
   * @param username
   * @param data
   * @returns {Redis}
   */
  removeUser(username, data){
    return this.adapter.removeUser(username, data);
  }

  /**
   * Verify ip limits
   * @param  {redisCluster} redis
   * @param  {Object} registrationLimits
   * @param  {String} ipaddress
   * @return {Function}
   */
  checkLimits(registrationLimits, ipaddress) {
    return this.adapter.checkLimits(registrationLimits, ipaddress);
  }

  /**
   * Creates user with a given hash
   * @param redis
   * @param username
   * @param activate
   * @param deleteInactiveAccounts
   * @param userDataKey
   * @returns {Function}
   */
  createUser(username, activate, deleteInactiveAccounts) {
    return this.adapter.createUser(username, activate, deleteInactiveAccounts);
  }

  /**
   * Performs captcha check, returns thukn
   * @param  {String} username
   * @param  {String} captcha
   * @param  {Object} captchaConfig
   * @return {Function}
   */
  checkCaptcha(username, captcha) {
    return this.adapter.checkCaptcha(username, captcha);
  }

  /**
   * Stores username to the index set
   * @param username
   * @returns {Redis}
   */
  storeUsername(username){
    return this.adapter.storeUsername(username);
  }

  /**
   * Running a custom script or query
   * @param script
   * @returns {*|Promise}
     */

  customScript(script){
    return this.adapter.customScript(script);
  }

  /**
   * The error wrapper for the front-level HTTP output
   * @param e
   */
  static mapErrors(e){
    const err = new Errors.HttpStatusError(e.status_code || 500 , e.message);
    if(err.status_code >= 500) {
      err.message = Errors.HttpStatusError.message_map[500]; //hide the real error from the user
    }
  }

}

module.exports =  function modelCreator(){
  return new Users(RedisStorage);
};


/*
 ВОПРОСЫ:
 Не превращается ли адаптер в полноценную модель?
 Что делать с промисами? Правильно ли частично их пихать в адаптер (по идее, соединение -- ресурс, так что да)?
 Архитектура MServices, где берется redis?
 Оставить Errors снаружи?

+  ЭМИТТЕР НЕ НУЖЕН
+  МОЖНО СДЕЛАТЬ ХУКИ, но только если нужно
~  ЭРРОРЫ НАДО ВЫНЕСТИ НАРУЖУ с сообщениями, а внутри генерить женерик-эрроры с кодами, врапить их в экшне в HTTPошикби
 sandbox/activate.js -> Если это модель, то оствлять ли всякие verifyToken, emailVerification и хуки снаружи?
  СНАРУЖИ
+ sandbox/alias.js -> 18, 25 (запихнуть их в User?) не надо, все верно
 sandbox/getMetadata -> волевым решением, логика Metadata вместе с промисами запихнута в метод getMetadata. С точки зрения абстракции всё соблюдено, но правильно ли это для текущей ситуации?
  ДА, МОЖНО
  но надо сделать разницу между трансформатором данных
  и селектором
  плюс вытянуть свежую репу
 sandbox/list -> метод getList настолько широк, что поглатил в себя всю реализацию этого экшна. разве это хорошо?
  ВСЕ ОК, дефолты можно вытащить наружу. подумать над общим форматом ответа и соотв-но вытащить кое что в методы сторожа
 sandbox/login -> 25, передаем options в адаптер... что-то не в порядке в королевстве Датском!
  МЕНЯЕМ логику работы промисов. чтобы не городить нерабочий огород в адаптере

 redisstorage -> 394 this.log. раньше this брался из экшна, к чему относится метод log?
 redisstorage -> 148,157 оборачивать ли эти методы? эти статусы потенциально зависят от адаптера, но должны выводить значение в чистом виде. С другой стороны, в чистом виде значение не используется, а используется промис
  ЛОГИЧНЕЕ будет сформить метод с промисом и кидаться ошибками на верхний уровень, собстна в sql логика будет та же
  нафига нужны просто флаги -- не понятно
 redisstorage -> 105 что на счет методов с thunk'ом?
  ПОСМОТРЕТЬ что делает thunk и где он участвует, вожможно придется оставить

 bluebird: tap

 ПОСМОТРЕТЬ levelDB и схожие адаптеры для работы с логикой

 МОЖНО в адаптере сделать трансмиттер ошибок адаптера в ошибки HTTP

 */
