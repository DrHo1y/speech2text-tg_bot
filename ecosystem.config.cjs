module.exports = {
  apps : [{
    name   : "tg-bot",
    script : `export NODE_TLS_REJECT_UNAUTHORIZED='0'
node app.js`
  }]
}
