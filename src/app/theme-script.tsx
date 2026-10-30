// Applies the saved theme before paint so there is no flash.
export const themeScript = `try{var t=localStorage.getItem('oko-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;
