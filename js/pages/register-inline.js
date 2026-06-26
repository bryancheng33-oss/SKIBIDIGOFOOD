if (typeof State !== 'undefined') {
    if (State.isLoggedIn()) window.location.href = 'home';
    if (State.isAdmin())   window.location.href = 'admin';
  }

  function switchTab(tab) {
    const isLogin = tab === 'login';
    const loginTab = document.getElementById('tab-login');
    const registerTab = document.getElementById('tab-register');
    const loginForm = document.getElementById('form-login');
    const registerForm = document.getElementById('form-register');

    loginTab.classList.toggle('active', isLogin);
    registerTab.classList.toggle('active', !isLogin);
    loginTab.setAttribute('aria-selected', String(isLogin));
    registerTab.setAttribute('aria-selected', String(!isLogin));
    loginTab.setAttribute('tabindex', isLogin ? '0' : '-1');
    registerTab.setAttribute('tabindex', isLogin ? '-1' : '0');
    loginForm.classList.toggle('active', isLogin);
    registerForm.classList.toggle('active', !isLogin);
    loginForm.hidden = !isLogin;
    registerForm.hidden = isLogin;
    document.getElementById('auth-heading').textContent = isLogin ? 'Welcome back' : 'Create account';
    document.getElementById('auth-sub').textContent = isLogin
      ? 'Sign in to your Skibidi GoFood account'
      : 'Join us and enjoy campus food delivery';
    document.body.classList.toggle('register-mode', !isLogin);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function togglePass(inputId, icon) {
    const inp = document.getElementById(inputId);
    const i   = icon.querySelector('i');
    if (inp.type === 'password') {
      inp.type = 'text';
      i.className = 'fas fa-eye-slash';
    } else {
      inp.type = 'password';
      i.className = 'fas fa-eye';
    }
  }
