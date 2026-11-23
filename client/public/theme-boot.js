// Paints the stored theme and text size (src/lib/textSize.js) before first paint. Why and how: src/lib/theme.js.
(function(){var p='system',r=document.documentElement,m;try{var dd=r.getAttribute('data-theme-default');if(dd==='dark'||dd==='light')p=dd;var s=localStorage.getItem('pri.theme');if(s==='light'||s==='dark'||s==='system')p=s}catch(e){}
var d=p==='dark'||(p==='system'&&!!window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches);
r.setAttribute('data-theme',d?'dark':'light');r.setAttribute('data-theme-pref',p);r.style.colorScheme=d?'dark':'light';
m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',d?'#121210':'#f2f0ea');try{var z={large:1.125,larger:1.25,largest:1.4}[localStorage.getItem('pri.textSize')];if(z){r.setAttribute('data-text-size',localStorage.getItem('pri.textSize'));r.style.setProperty('--pri-text-scale',String(z))}}catch(e){}
})();
