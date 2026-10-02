// Paints the stored theme before first paint. Why and how: src/lib/theme.js.
(function(){var p='light',r=document.documentElement,m;try{var s=localStorage.getItem('pri.theme');if(s==='light'||s==='dark'||s==='system')p=s}catch(e){}
var d=p==='dark'||(p==='system'&&!!window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches);
r.setAttribute('data-theme',d?'dark':'light');r.setAttribute('data-theme-pref',p);r.style.colorScheme=d?'dark':'light';
m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',d?'#121210':'#f2f0ea')})();
