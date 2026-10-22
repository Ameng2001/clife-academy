// 服务端地址。开发：微信开发者工具里勾掉「校验合法域名」，api 用 `sh scripts/dev.sh` 起在 3000。
// 正式：换成 https 域名，并在小程序后台把它加进 request 合法域名。
module.exports = {
  API_BASE: 'http://127.0.0.1:3000'
};
