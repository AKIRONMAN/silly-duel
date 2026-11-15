/* CrazyGames Basic Launch: no ad requests. Keep the same API so match flow never freezes.
   Re-enable SDK banners/midgame when you move to Full Launch. */
window.SD = window.SD || {};
(function () {
  'use strict';
  var A = SD.ads = {};
  function go(cb) { try { if (cb) cb(); } catch (e) {} }
  A.init = function () {};
  A.ready = function () {};
  A.showBar = function () {};
  A.showHomeBanner = function () {};
  A.showMoreBanner = function () {};
  A.onScreen = function () {};
  A.hideBanners = function () {};
  A.afterMatch = function (cb) { go(cb); };
})();
