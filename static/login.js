function showLogin() {
    const loginContainer = document.getElementById('login-container');
    const registerContainer = document.getElementById('register-container');
    const forgotContainer = document.getElementById('forgot-password-container');
    
    if (loginContainer) loginContainer.style.display = 'block';
    if (registerContainer) registerContainer.style.display = 'none';
    if (forgotContainer) forgotContainer.style.display = 'none';
}

function showRegister() {
    const loginContainer = document.getElementById('login-container');
    const registerContainer = document.getElementById('register-container');
    const forgotContainer = document.getElementById('forgot-password-container');
    
    if (loginContainer) loginContainer.style.display = 'none';
    if (registerContainer) registerContainer.style.display = 'block';
    if (forgotContainer) forgotContainer.style.display = 'none';
}

function showForgotPassword() {
    const loginContainer = document.getElementById('login-container');
    const registerContainer = document.getElementById('register-container');
    const forgotContainer = document.getElementById('forgot-password-container');
    
    if (loginContainer) loginContainer.style.display = 'none';
    if (registerContainer) registerContainer.style.display = 'none';
    if (forgotContainer) forgotContainer.style.display = 'block';
}

// async function login() {
//     const identifier = document.getElementById('username').value; // 可以是用户名或邮箱
//     const password = document.getElementById('password').value;
    
//     try {
//         const response = await fetch('/login', {
//             method: 'POST',
//             headers: {'Content-Type': 'application/x-www-form-urlencoded'},
//             body: `username=${encodeURIComponent(identifier)}&password=${encodeURIComponent(password)}`
//         });
//         const data = await response.json();
        
//         console.log('Login response:', data); // 添加日志查看响应
        
//         if (data.success) {
//             window.location.href = '/'; // 跳转到主界面
//         } else {
//             document.getElementById('login-error').textContent = data.error || '登录失败，请检查用户名/邮箱或密码';
//         }
//     } catch (error) {
//         console.error('Login error:', error); // 捕获网络错误
//         document.getElementById('login-error').textContent = '网络错误，请稍后重试';
//     }
// }
async function login() {
    const identifier = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: `username=${encodeURIComponent(identifier)}&password=${encodeURIComponent(password)}`
        });
        const data = await response.json();
        
        console.log('Login response:', data);
        
        if (data.success) {
            window.location.href = '/index'; // 跳转到主界面
        } else {
            document.getElementById('login-error').textContent = data.error || '登录失败，请检查用户名/邮箱或密码';
        }
    } catch (error) {
        console.error('Login error:', error);
        document.getElementById('login-error').textContent = '网络错误，请稍后重试';
    }
}
async function register() {
    const username = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    
    const response = await fetch('/register', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: `username=${encodeURIComponent(username)}&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`
    });
    const data = await response.json();
    
    if (data.success) {
        alert('注册成功，请登录');
        showLogin();
    } else {
        document.getElementById('register-error').textContent = data.error || '注册失败，请重试';
    }
}

async function sendVerificationCode() {
    const email = document.getElementById('forgot-email').value;
    
    const response = await fetch('/send_verification_code', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: `email=${encodeURIComponent(email)}`
    });
    const data = await response.json();
    
    if (data.success) {
        document.getElementById('forgot-error').textContent = '验证码已发送，请检查邮箱';
        document.getElementById('verification-code').style.display = 'block';
        document.getElementById('new-password').style.display = 'block';
        document.getElementById('reset-btn').style.display = 'block';
    } else {
        document.getElementById('forgot-error').textContent = data.error || '发送验证码失败';
    }
}

async function resetPassword() {
    const email = document.getElementById('forgot-email').value;
    const code = document.getElementById('verification-code').value;
    const newPassword = document.getElementById('new-password').value;
    
    const response = await fetch('/reset_password', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: `email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}&new_password=${encodeURIComponent(newPassword)}`
    });
    const data = await response.json();
    
    if (data.success) {
        alert('密码重置成功，请登录');
        showLogin();
    } else {
        document.getElementById('forgot-error').textContent = data.error || '重置密码失败';
    }
}