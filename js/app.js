import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, onSnapshot, updateDoc, arrayUnion, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db } from "./config.js";

// --- UI LOGIC & DEFINITIONS ---
const coins = ['BTC','ETH','BNB','SOL','XRP','USDC','ADA','AVAX','DOGE','TRX','LINK','DOT','MATIC','LTC'];
let currentCoin = 'BTC';
let tradeMode = 'buy';
let coinPrices = {};

// 1. Render khung giao diện ngay lập tức
window.renderLists = function() {
    let h = "";
    coins.forEach(c => {
        h += `<div class="coin-row" id="row-${c}" onclick="selectCoin('${c}')">
            <div style="display:flex;align-items:center;"><img class="coin-logo" src="https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${c.toLowerCase()}.png"><b>${c}/USDT</b></div>
            <div style="text-align:right"><b class="p-val" style="color:white">---</b><div class="pc-val" style="font-size:11px;">0.00%</div></div>
        </div>`;
    });
    document.getElementById('home-list').innerHTML = h;
    document.getElementById('market-full-list').innerHTML = h;

    // Menu coin
    let mh = "";
    coins.forEach(c => mh += `<div class="coin-row" onclick="selectCoin('${c}');openCoinMenu()">${c}/USDT</div>`);
    document.getElementById('coin-menu-list').innerHTML = mh;
}
window.renderLists();

// 2. Hàm điều hướng (Đảm bảo luôn chạy)
window.switchTab = (id, idx) => {
    document.querySelectorAll('.view-section').forEach(d=>d.classList.remove('active'));
    document.getElementById('view-'+id).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
    if(document.querySelectorAll('.nav-item')[idx]) document.querySelectorAll('.nav-item')[idx].classList.add('active');
}
window.openProfile = () => { const e=document.getElementById('user-modal'); e.style.display=e.style.display==='flex'?'none':'flex'; }
window.openNoti = () => { const e=document.getElementById('noti-panel'); e.style.display=e.style.display==='flex'?'none':'flex'; }
window.openCoinMenu = () => { const e=document.getElementById('coin-menu'); e.style.display=e.style.display==='flex'?'none':'flex'; }
window.toggleChart = () => { const e=document.getElementById('chart-container'); e.style.display=e.style.display==='block'?'none':'block'; }

// 3. Logic Trade
window.selectCoin = (c) => {
    currentCoin = c;
    document.getElementById('trade-pair').innerText = c+'/USDT';
    window.switchTab('trade', 2);
    loadChart(c);
    window.updateUI();
}

window.setTradeMode = (m) => {
    tradeMode = m;
    document.getElementById('btn-buy').className = m==='buy'?'type-btn active-buy':'type-btn';
    document.getElementById('btn-sell').className = m==='sell'?'type-btn active-sell':'type-btn';
    const btn = document.getElementById('btn-action');
    btn.style.background = m==='buy'?'var(--green)':'var(--red)';
    btn.innerText = m==='buy'?'MUA NGAY':'BÁN NGAY';
    window.updateUI();
}

window.calcTotal = () => {
    const p = parseFloat(document.getElementById('inp-price').value) || 0;
    const a = parseFloat(document.getElementById('inp-amt').value) || 0;
    document.getElementById('trade-total').innerText = (p*a).toFixed(2) + " $";
}

window.doTrade = () => {
    if(!window.userData) return showToast("Đang tải dữ liệu ví...", "info");
    const p = parseFloat(document.getElementById('inp-price').value);
    const a = parseFloat(document.getElementById('inp-amt').value);
    if(!p || !a) return showToast("Vui lòng nhập số lượng", "error");
    window.execTrade(tradeMode, currentCoin, p, a);
}

window.fakeAction = (type) => {
    const amt = parseFloat(prompt("Nhập số tiền USDT:"));
    if(amt) window.execFakeTrans(type, amt);
}

function updatePrice(coin, price, pct) {
    coinPrices[coin] = price;
    const col = pct >= 0 ? 'var(--green)' : 'var(--red)';
    const pStr = price < 1 ? price.toFixed(6) : price.toFixed(2);

    // Update List
    const row = document.getElementById('row-'+coin);
    if(row) {
        row.querySelector('.p-val').innerText = pStr;
        const pc = row.querySelector('.pc-val');
        pc.innerText = pct.toFixed(2) + '%';
        pc.style.color = col;
    }

    // Update Trade Screen
    if(coin === currentCoin) {
        document.getElementById('trade-price').innerText = pStr;
        document.getElementById('trade-change').innerText = pct.toFixed(2) + '%';
        document.getElementById('trade-change').style.color = col;
        document.getElementById('inp-price').value = price;
    }

    if(window.userData) window.updateUI();
}

function loadChart(c) {
    document.getElementById('chart-container').innerHTML = '';
    new TradingView.widget({"autosize": true, "symbol": "BINANCE:"+c+"USDT", "interval": "15", "theme": "dark", "style": "1", "toolbar_bg": "#f1f3f6", "hide_top_toolbar": true, "container_id": "chart-container"});
}

// 5. Cập nhật số dư UI
window.updateUI = () => {
    if(!window.userData) return;
    const w = window.userData.wallet;
    let total = w.usdt || 0;

    let ah = `<div class="coin-row"><div><b>USDT</b></div><div style="text-align:right"><b>${total.toFixed(2)}</b></div></div>`;

    for(let k in w) {
        if(k !== 'usdt' && w[k] > 0) {
            const p = coinPrices[k.toUpperCase()] || 0;
            total += w[k] * p;
            ah += `<div class="coin-row" onclick="selectCoin('${k.toUpperCase()}')"><div><b>${k.toUpperCase()}</b></div><div style="text-align:right"><b>${w[k].toFixed(4)}</b></div></div>`;
        }
    }

    document.getElementById('home-total').innerText = total.toLocaleString('en-US', {style:'currency', currency:'USD'});
    document.getElementById('asset-total').innerText = total.toLocaleString('en-US', {style:'currency', currency:'USD'});
    document.getElementById('asset-list').innerHTML = ah;

    // Avail Trade
    const avail = tradeMode === 'buy' ? (w.usdt||0) : (w[currentCoin.toLowerCase()]||0);
    document.getElementById('avail-trade').innerText = avail.toFixed(4) + (tradeMode==='buy'?' USDT': ' '+currentCoin);
}

// --- FIREBASE / TEST LOGIC ---
try {
    const isTestMode = sessionStorage.getItem('isTestMode') === 'true';

    if (isTestMode) {
        // --- TEST MODE ---
        window.currentUser = { uid: "test_user", email: "test@bgwealth.com" };
        setTimeout(() => {
            document.getElementById('user-name-home').innerText = "Test User";
            document.getElementById('modal-email').innerText = "test@bgwealth.com";
        }, 100);

        window.userData = { wallet: { usdt: 10000, btc: 0.5, eth: 2.0 }, history: [] };

        // This will now work because updateUI is defined above
        window.updateUI();

        showToast("Đang chạy chế độ Test (Không lưu dữ liệu)", "info");

        window.userLogout = () => {
            sessionStorage.removeItem('isTestMode');
            window.location.href = "index.html";
        }

        window.execTrade = async (mode, coin, price, amount) => {
            const w = window.userData.wallet;
            const k = coin.toLowerCase();
            const total = price * amount;

            if(mode === 'buy') {
                if((w.usdt||0) < total) return showToast("Không đủ USDT", "error");
                w.usdt -= total;
                w[k] = (w[k]||0) + amount;
            } else {
                if((w[k]||0) < amount) return showToast("Không đủ Coin", "error");
                w[k] -= amount;
                w.usdt = (w.usdt||0) + total;
            }

            window.updateUI();
            showToast("Giao dịch thành công (Test Mode)!", "success");
            document.getElementById('inp-amt').value = "";
        }

        window.execFakeTrans = async (type, amt) => {
            const w = window.userData.wallet;
            if(type === 'Rút') { if((w.usdt||0) < amt) return showToast("Không đủ tiền", "error"); w.usdt -= amt; }
            else w.usdt = (w.usdt||0) + amt;

            window.updateUI();
            showToast("Giao dịch thành công (Test Mode)", "success");
        }

    } else {
        // --- NORMAL MODE ---
        onAuthStateChanged(auth, (user) => {
            if (user) {
                window.currentUser = user;
                document.getElementById('user-name-home').innerText = user.email.split('@')[0];
                document.getElementById('modal-email').innerText = user.email;

                const ref = doc(db, "users", user.uid);
                onSnapshot(ref, (d) => {
                    if(d.exists()) {
                        window.userData = d.data();
                        window.updateUI(); // Cập nhật giao diện khi có data
                    } else {
                        setDoc(ref, { wallet: {usdt: 10000}, history: [] });
                    }
                });
            } else {
                window.location.href = "index.html";
            }
        });

        window.userLogout = () => signOut(auth).then(()=>window.location.href="index.html");

        window.execTrade = async (mode, coin, price, amount) => {
            const w = window.userData.wallet;
            const k = coin.toLowerCase();
            const total = price * amount;

            if(mode === 'buy') {
                if((w.usdt||0) < total) return showToast("Không đủ USDT", "error");
                w.usdt -= total;
                w[k] = (w[k]||0) + amount;
            } else {
                if((w[k]||0) < amount) return showToast("Không đủ Coin", "error");
                w[k] -= amount;
                w.usdt = (w.usdt||0) + total;
            }

            await updateDoc(doc(db,"users",window.currentUser.uid), {
                wallet: w,
                history: arrayUnion({type: mode, pair: coin, price: price, amount: amount, time: new Date().toLocaleTimeString()})
            });
            showToast("Giao dịch thành công!", "success");
            document.getElementById('inp-amt').value = "";
        }

        window.execFakeTrans = async (type, amt) => {
            const w = window.userData.wallet;
            if(type === 'Rút') { if((w.usdt||0) < amt) return showToast("Không đủ tiền", "error"); w.usdt -= amt; }
            else w.usdt = (w.usdt||0) + amt;

            await updateDoc(doc(db,"users",window.currentUser.uid), { wallet: w });
            showToast("Giao dịch thành công", "success");
        }
    }

} catch(e) { console.log("Lỗi Firebase:", e); }

// --- DATA FETCHING ---
// 4. Lấy dữ liệu giá (Chạy 2 nguồn: API + Socket)
function fetchPrices() {
    fetch('https://api.binance.com/api/v3/ticker/24hr').then(r=>r.json()).then(data => {
        data.forEach(d => {
            if(d.symbol.endsWith('USDT')) {
                const s = d.symbol.replace('USDT','');
                if(coins.includes(s)) updatePrice(s, parseFloat(d.lastPrice), parseFloat(d.priceChangePercent));
            }
        });
    });
}
fetchPrices(); setInterval(fetchPrices, 5000); // Dự phòng nếu Socket chết

// Socket Realtime
const ws = new WebSocket("wss://stream.binance.com:443/ws/!miniTicker@arr");
ws.onmessage = (e) => {
    const data = JSON.parse(e.data);
    data.forEach(d => {
        if(d.s.endsWith('USDT')) {
            const s = d.s.replace('USDT','');
            if(coins.includes(s)) updatePrice(s, parseFloat(d.c), parseFloat(d.P));
        }
    });
};
