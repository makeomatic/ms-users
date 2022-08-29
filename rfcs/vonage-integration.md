# Vonage integration

## Vonage Video API (TokBox OpenTok)

### docs

[basic documentation](https://tokbox.com/developer/sdks/node/)

[API reference](https://tokbox.com/developer/sdks/node/reference/)

### required

* apiKey
* apiSecret

`opentok` module installed
```shell
npm install opentok
```

### integration

#### 1) session creation

```js
const OpenTok = require("opentok");
const opentok = new OpenTok(apiKey, apiSecret);

opentok.createSession(function (error, session) {
    // session
});
```

The session must be stored on the server side.

#### 2) token generation

```js
const OpenTok = require("opentok");
const opentok = new OpenTok(apiKey, apiSecret);

opentok.createSession(function (error, session) {
  const token = session.generateToken({
    role: "moderator",
    expireTime: new Date().getTime() / 1000 + 7 * 24 * 60 * 60, // in one week
    data: "name=Johnny",
    initialLayoutClassList: ["focus"],
  });
  // or
  const token2 = opentok.generateToken(session.sessionId);
});
```

The token must be sent to the client.
