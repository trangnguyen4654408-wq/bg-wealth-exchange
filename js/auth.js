import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, GoogleAuthProvider, signInWithRedirect, getRedirectResult }
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth } from "./config.js";

const googleProvider = new GoogleAuthProvider();

let isRegister = false;
let loginMethod = 'email';

// 1. KIỂM TRA ĐĂNG NHẬP & KẾT QUẢ REDIRECT
// Xử lý khi Google Redirect quay lại
getRedirectResult(auth).then((result) => {
    if (result) {
        window.location.href = "app.html";
    }
}).catch((error) => {
    console.error(error);
    document.getElementById('error-msg').innerText = "Lỗi đăng nhập Google: " + error.message;
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        window.location.href = "app.html";
    } else {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('auth-screen').style.display = 'block';
    }
});

// 2. HÀM ĐĂNG NHẬP GOOGLE MỚI (REDIRECT)
window.loginGoogleRedirect = () => {
    document.getElementById('loading').style.display = 'flex';
    signInWithRedirect(auth, googleProvider);
}

// 3. LOGIC UI CŨ
window.switchTab = (method) => {
    loginMethod = method;
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    if(method === 'email') {
        document.getElementById('field-email').classList.remove('hidden');
        document.getElementById('field-phone').classList.add('hidden');
    } else {
        document.getElementById('field-email').classList.add('hidden');
        document.getElementById('field-phone').classList.remove('hidden');
    }
}

window.toggleAuthMode = () => {
    isRegister = !isRegister;
    const regElems = document.querySelectorAll('.register-mode');
    if(isRegister) {
        document.getElementById('page-title').innerText = "Tạo tài khoản";
        document.getElementById('btn-submit').innerText = "Đăng ký";
        document.getElementById('switch-text').innerText = "Đã có tài khoản?";
        document.getElementById('switch-btn').innerText = "Đăng nhập";
        regElems.forEach(el => el.classList.remove('hidden'));
    } else {
        document.getElementById('page-title').innerText = "Đăng nhập";
        document.getElementById('btn-submit').innerText = "Đăng nhập";
        document.getElementById('switch-text').innerText = "Chưa có tài khoản?";
        document.getElementById('switch-btn').innerText = "Đăng ký ngay";
        regElems.forEach(el => el.classList.add('hidden'));
    }
    document.getElementById('error-msg').innerText = "";
}

window.handleAuth = () => {
    const email = document.getElementById('email-input').value;
    const pass = document.getElementById('pass-input').value;
    const confirmPass = document.getElementById('confirm-input').value;
    const errorMsg = document.getElementById('error-msg');

    errorMsg.innerText = "";

    // Logic đơn giản hóa
    if(!email || !pass) { errorMsg.innerText = "Vui lòng nhập đầy đủ thông tin"; return; }
    if(pass.length < 6) { errorMsg.innerText = "Mật khẩu tối thiểu 6 ký tự"; return; }

    if (isRegister) {
        if(!document.getElementById('terms-check').checked) { errorMsg.innerText = "Bạn chưa đồng ý điều khoản."; return; }
        if(pass !== confirmPass) { errorMsg.innerText = "Mật khẩu không khớp"; return; }

        createUserWithEmailAndPassword(auth, email, pass)
        .then(() => showToast("Đăng ký thành công!", "success"))
        .catch(e => errorMsg.innerText = e.message);
    } else {
        signInWithEmailAndPassword(auth, email, pass)
        .catch(e => errorMsg.innerText = "Sai tài khoản hoặc mật khẩu.");
    }
}

// TEST LOGIN
window.handleTestLogin = () => {
    sessionStorage.setItem('isTestMode', 'true');
    window.location.href = "app.html";
}
