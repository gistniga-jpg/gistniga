// chat-redirect.js
if (/Mobi|Android|iPhone|iPad|iPod|Windows Phone|IEMobile|BlackBerry/i.test(navigator.userAgent)) {
  if (!location.pathname.endsWith('/mobile.html')) {
    location.replace('/mobile.html');
  }
}
