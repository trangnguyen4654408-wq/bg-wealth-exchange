import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, onSnapshot, updateDoc, arrayUnion, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db } from "./config.js";

// --- UI LOGIC & DEFINITIONS ---
const coins = ['BTC','ETH','BNB','SOL','XRP','USDC','ADA','AVAX','DOGE','TRX','LINK','DOT','MATIC','LTC'];
let currentCoin = 'BTC';
let tradeMode = 'buy';
let coinPrices = {};
let chart; // Lightweight Chart Instance
let candleSeries;

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

    // Separate loop for Market List to use unique IDs
    let hm = "";
    coins.forEach(c => {
        hm += `<div class="coin-row" id="market-row-${c}" onclick="selectCoin('${c}')">
            <div style="display:flex;align-items:center;"><img class="coin-logo" src="https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${c.toLowerCase()}.png"><b>${c}/USDT</b></div>
            <div style="text-align:right"><b class="p-val" style="color:white">---</b><div class="pc-val" style="font-size:11px;">0.00%</div></div>
        </div>`;
    });
    document.getElementById('market-full-list').innerHTML = hm;

    // Menu coin
    let mh = "";
    coins.forEach(c => mh += `<div class="coin-row" onclick="selectCoin('${c}');openCoinMenu()">${c}/USDT</div>`);
    document.getElementById('coin-menu-list').innerHTML = mh;
}
window.renderLists();

// 2. Hàm điều hướng
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

    // Auto-close menu if open
    document.getElementById('coin-menu').style.display = 'none';

    loadChart(c);
    updateAvailableBalance(); // Optimized update
    // Force update price UI for this coin immediately
    if(coinPrices[c]) {
        document.getElementById('inp-price').value = coinPrices[c];
        document.getElementById('trade-price').innerText = coinPrices[c] < 1 ? coinPrices[c].toFixed(6) : coinPrices[c].toFixed(2);
    }
}

window.setTradeMode = (m) => {
    tradeMode = m;
    document.getElementById('btn-buy').className = m==='buy'?'type-btn active-buy':'type-btn';
    document.getElementById('btn-sell').className = m==='sell'?'type-btn active-sell':'type-btn';
    const btn = document.getElementById('btn-action');
    btn.style.background = m==='buy'?'var(--green)':'var(--red)';
    btn.innerText = m==='buy'?'MUA NGAY':'BÁN NGAY';
    updateAvailableBalance();
}

function updateAvailableBalance() {
    if(!window.userData) return;
    const w = window.userData.wallet;
    const avail = tradeMode === 'buy' ? (w.usdt||0) : (w[currentCoin.toLowerCase()]||0);
    const suffix = tradeMode === 'buy' ? ' USDT' : ' ' + currentCoin;
    document.getElementById('avail-trade').innerText = avail.toFixed(4) + suffix;
}

window.calcTotal = () => {
    const p = parseFloat(document.getElementById('inp-price').value) || 0;
    const a = parseFloat(document.getElementById('inp-amt').value) || 0;
    const total = p * a;
    const fee = total * 0.001; // 0.1%

    document.getElementById('trade-total').innerText = total.toFixed(2) + " $";
    document.getElementById('trade-fee').innerText = fee.toFixed(4) + " $";
}

window.doTrade = () => {
    if(!window.userData) return showToast("Đang tải dữ liệu ví...", "info");
    const p = parseFloat(document.getElementById('inp-price').value);
    const a = parseFloat(document.getElementById('inp-amt').value);

    if(!p || !a) return showToast("Vui lòng nhập số lượng", "error");

    // Check KYC
    if(!window.userData.verified && !sessionStorage.getItem('isTestMode')) {
        return showToast("Vui lòng xác minh danh tính (KYC) để giao dịch!", "error");
    }

    window.execTrade(tradeMode, currentCoin, p, a);
}

window.fakeAction = (type) => {
    const amt = parseFloat(prompt("Nhập số tiền USDT:"));
    if(amt) window.execFakeTrans(type, amt);
}

window.verifyIdentity = async () => {
    if(window.userData && window.userData.verified) return showToast("Tài khoản đã được xác minh!", "success");

    const btn = document.getElementById('btn-kyc');
    btn.innerText = "Đang xác minh...";
    btn.disabled = true;

    // Simulate delay
    setTimeout(async () => {
        if(sessionStorage.getItem('isTestMode') === 'true') {
            window.userData.verified = true;
            updateKYCUI(true);
            showToast("Xác minh thành công (Test Mode)!", "success");
        } else {
            // Real update to Firestore
            try {
                await updateDoc(doc(db,"users",window.currentUser.uid), { verified: true });
                // Firestore listener will handle the UI update via onSnapshot
                showToast("Xác minh thành công!", "success");
            } catch(e) {
                showToast("Lỗi xác minh: " + e.message, "error");
                btn.innerText = "Xác minh lại";
                btn.disabled = false;
            }
        }
    }, 2000);
}

function updateKYCUI(isVerified) {
    const badge = document.getElementById('kyc-status-home');
    const modalBadge = document.getElementById('kyc-badge-modal');

    if(isVerified) {
        if(badge) {
            badge.innerHTML = 'Verified <i class="fas fa-check-circle" style="color:var(--green)"></i>';
            badge.style.color = 'var(--green)';
        }
        if(modalBadge) modalBadge.innerHTML = '<div style="color:var(--green); font-weight:bold; border:1px solid var(--green); padding:10px; border-radius:4px;">ĐÃ XÁC MINH <i class="fas fa-check-circle"></i></div>';
    } else {
        if(badge) badge.innerHTML = 'Unverified <i class="fas fa-times-circle"></i>';
        if(modalBadge) modalBadge.innerHTML = '<button onclick="verifyIdentity()" id="btn-kyc" style="background:#333; border:1px solid #555; color:white; padding:5px 10px; border-radius:4px;">Xác minh danh tính (KYC)</button>';
    }
}

// OPTIMIZED PRICE UPDATE
function updatePrice(coin, price, pct) {
    coinPrices[coin] = price;
    const col = pct >= 0 ? 'var(--green)' : 'var(--red)';
    const pStr = price < 1 ? price.toFixed(6) : price.toFixed(2);

    // Direct DOM update (Home List)
    const row = document.getElementById('row-'+coin);
    if(row) {
        row.querySelector('.p-val').innerText = pStr;
        const pc = row.querySelector('.pc-val');
        pc.innerText = pct.toFixed(2) + '%';
        pc.style.color = col;
    }

    // Direct DOM update (Market List)
    const mRow = document.getElementById('market-row-'+coin);
    if(mRow) {
        mRow.querySelector('.p-val').innerText = pStr;
        const pc = mRow.querySelector('.pc-val');
        pc.innerText = pct.toFixed(2) + '%';
        pc.style.color = col;
    }

    // Update Trade Screen if active
    if(coin === currentCoin) {
        const tPrice = document.getElementById('trade-price');
        if(tPrice) tPrice.innerText = pStr;

        const tChange = document.getElementById('trade-change');
        if(tChange) {
            tChange.innerText = pct.toFixed(2) + '%';
            tChange.style.color = col;
        }

        const inp = document.getElementById('inp-price');
        if(inp && document.activeElement !== inp) inp.value = price; // Don't overwrite if user typing

    // Update Chart Candle (Real-time)
        if(candleSeries) {
             const time = Math.floor(Date.now() / 1000);
             // We use a simplified update where High/Low/Open match Close for the tick update
             // Ideally we need the real KLine stream, but updating the current candle's close price makes it "alive"
             // Using update() with the same time modifies the existing candle.
             // We need to know the current candle's open/high/low to update correctly,
             // but here we just want movement.
             // Better approach: fetch the specific kline or just set close = price

             // Lightweight charts handles 'update' by merging.
             // If we don't have O/H/L, we can't accurately update the candle shape.
             // However, strictly adhering to user request "nhảy mượt theo giá thị trường":
             candleSeries.update({
                time: time,
                close: price,
                // If we don't provide O/H/L, it might glitch if it's a new candle.
                // Assuming we are updating the LATEST candle:
                // We really need a KLine socket for perfect candles.
                // But for "visual movement", let's try just updating close.
             });
        }
    }

    // Throttle Total Balance Update?
    // Actually, recalculating total balance is relatively cheap for < 20 coins
    // But we shouldn't rebuild the entire asset list HTML
    updateTotalBalanceOnly();
}

function updateTotalBalanceOnly() {
    if(!window.userData) {
        console.log("No userData found for balance update");
        return;
    }
    const w = window.userData.wallet;
    let total = w.usdt || 0;

    for(let k in w) {
        if(k !== 'usdt' && w[k] > 0) {
            const p = coinPrices[k.toUpperCase()] || 0;
            total += w[k] * p;
        }
    }

    const s = total.toLocaleString('en-US', {style:'currency', currency:'USD'});
    const e1 = document.getElementById('home-total');
    if(e1) {
        e1.innerText = s;
        console.log("Updated home-total to " + s);
    }
    const e2 = document.getElementById('asset-total');
    if(e2) e2.innerText = s;
}

// TRADINGVIEW CHART (Reverted as requested)
function loadChart(c) {
    const container = document.getElementById('chart-container');
    container.innerHTML = ''; // Clear previous

    // Inject TradingView Widget Script & Container
    const div = document.createElement('div');
    div.id = 'tradingview_widget';
    div.style.height = "300px";
    container.appendChild(div);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
        if(typeof TradingView !== 'undefined') {
            new TradingView.widget({
                "width": "100%",
                "height": 300,
                "symbol": "BINANCE:" + c + "USDT",
                "interval": "15",
                "timezone": "Asia/Ho_Chi_Minh",
                "theme": "dark",
                "style": "1",
                "locale": "vi_VN",
                "toolbar_bg": "#f1f3f6",
                "enable_publishing": false,
                "hide_top_toolbar": true,
                "save_image": false,
                "container_id": "tradingview_widget"
            });
        }
    };
    container.appendChild(script);
}

// 5. Cập nhật số dư UI (Detailed Wallet)
window.renderWallet = () => {
    if(!window.userData) return;
    const w = window.userData.wallet;

    // Create Table Structure
    let h = `<table class="wallet-table" style="width:100%; border-collapse:collapse; font-size:12px;">
        <tr style="color:var(--text-secondary); text-align:left;">
            <th style="padding:10px;">Coin</th>
            <th style="text-align:right;">Số dư</th>
            <th style="text-align:right;">Giá trị</th>
        </tr>`;

    // USDT First
    const usdtVal = w.usdt || 0;
    h += `<tr style="border-bottom:1px solid var(--border);">
            <td style="padding:10px; font-weight:bold;">USDT</td>
            <td style="text-align:right;">${usdtVal.toFixed(2)}</td>
            <td style="text-align:right;">${usdtVal.toFixed(2)} $</td>
          </tr>`;

    // Others
    for(let k in w) {
        if(k !== 'usdt' && w[k] > 0) {
            const p = coinPrices[k.toUpperCase()] || 0;
            const val = w[k] * p;
            h += `<tr style="border-bottom:1px solid var(--border);">
                <td style="padding:10px; font-weight:bold;">${k.toUpperCase()}</td>
                <td style="text-align:right;">${w[k].toFixed(4)}</td>
                <td style="text-align:right;">${val.toFixed(2)} $</td>
              </tr>`;
        }
    }
    h += `</table>`;

    document.getElementById('asset-list').innerHTML = h;
    updateTotalBalanceOnly();
}

window.updateUI = () => {
    // Legacy function name, map to specific updates
    updateKYCUI(window.userData.verified);
    renderWallet();
    updateAvailableBalance();
}


// --- FIREBASE / TEST LOGIC ---
try {
    const isTestMode = sessionStorage.getItem('isTestMode') === 'true';

    if (isTestMode) {
        // --- TEST MODE ---
        window.currentUser = { uid: "test_user", email: "test@bgwealth.com" };
        setTimeout(() => {
            if(document.getElementById('user-name-home')) document.getElementById('user-name-home').innerText = "Test User";
            if(document.getElementById('modal-email')) document.getElementById('modal-email').innerText = "test@bgwealth.com";
        }, 100);

        window.userData = { wallet: { usdt: 10000, btc: 0.5, eth: 2.0 }, history: [], verified: false };

        // Mock Prices for Test Mode (Fallback if API fails)
        coins.forEach(c => {
            coinPrices[c] = Math.random() * 1000 + 100; // Random price
        });
        coinPrices['BTC'] = 65000.00;
        coinPrices['ETH'] = 3500.00;

        // Init UI
        console.log("Initializing UI in Test Mode...");
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
                        setDoc(ref, { wallet: {usdt: 10000}, history: [], verified: false });
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
fetchPrices(); setInterval(fetchPrices, 5000); // Polling backup

// Socket Realtime
try {
    // Use port 9443 and !ticker@arr as requested
    const ws = new WebSocket("wss://stream.binance.com:9443/ws/!ticker@arr");
    ws.onopen = () => console.log("Connected to Binance WebSocket");
    ws.onmessage = (e) => {
        const data = JSON.parse(e.data);

        // LOGGING FOR VERIFICATION
        if(data.length > 0 && Math.random() < 0.05) { // Log occasionally to avoid spam
            console.log("WS Data Received:", data[0].s, data[0].c);
        }

        data.forEach(d => {
            if(d.s.endsWith('USDT')) {
                const s = d.s.replace('USDT','');
                // Sync price to single source of truth: coinPrices
                if(coins.includes(s)) updatePrice(s, parseFloat(d.c), parseFloat(d.P));
            }
        });
    };
    ws.onerror = (e) => console.log("WebSocket Error:", e);
} catch(e) {
    console.log("WebSocket Setup Error:", e);
}
