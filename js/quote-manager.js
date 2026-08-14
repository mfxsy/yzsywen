// js/quote-manager.js
(function() {
    'use strict';

    // 引用状态
    let isQuoteEnabled = false;
    let quotedMessage = null;
    let chatArea = null;

    // 全局唯一按钮引用
    window._quoteBtn = null;

    // ★ 使用全局安全存储与防御性键生成，并增加 localStorage 备用
    async function loadSettings() {
        let data = null;
        try {
            const key = getStorageKey('quoteSettings');
            data = await safeGetItem(key);
        } catch (e) {}

        if (!data || typeof data.enabled !== 'boolean') {
            try {
                const raw = localStorage.getItem('quoteSettings_fallback');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (typeof parsed.enabled === 'boolean') {
                        data = parsed;
                        console.warn('[quote] 从 localStorage 恢复设置');
                    }
                }
            } catch (e) {}
        }

        isQuoteEnabled = data?.enabled ?? false;
        await saveSettings();
        console.log('[引用] 加载成功:', isQuoteEnabled);
    }

    async function saveSettings() {
        try {
            const key = getStorageKey('quoteSettings');
            await safeSetItem(key, { enabled: isQuoteEnabled });
        } catch (e) { console.warn('保存引用设置失败:', e); }
        try {
            localStorage.setItem('quoteSettings_fallback', JSON.stringify({ enabled: isQuoteEnabled }));
        } catch (e) {}
    }

    async function setEnabled(val) {
        isQuoteEnabled = !!val;
        await saveSettings();
        document.dispatchEvent(new CustomEvent('quoteSettingsChanged', { 
            detail: { enabled: isQuoteEnabled } 
        }));
    }

    function getEnabled() { return isQuoteEnabled; }

    // ---------- 单击触发引用（取代旧的长按） ----------
    function initClickQuote(container) {
        chatArea = container;
        // 事件监听由 listeners.js 统一处理
    }

    // ---------- 清除当前引用按钮 ----------
    function clearQuoteButton() {
        if (window._quoteBtn) {
            window._quoteBtn.remove();
            window._quoteBtn = null;
        }
        // 移除可能残留的 document 监听器（通过标志控制）
        if (window._quoteCleaner) {
            document.removeEventListener('click', window._quoteCleaner);
            window._quoteCleaner = null;
        }
    }

    // ---------- 显示引用按钮（纯图标，尺寸为 1/4） ----------
    function showQuoteButton(row) {
        // 先清除旧按钮
        clearQuoteButton();

        const msgId = row.dataset.msgId;
        const msg = window.messages.find(m => String(m.id) === String(msgId));
        if (!msg) return; // 找不到消息则不显示

        const bubble = row.querySelector('.msg-bubble');
        if (!bubble) return;

        const rect = bubble.getBoundingClientRect();
        const isSent = row.classList.contains('sent');

        const btn = document.createElement('button');
        btn.className = 'quote-action-btn';
        btn.innerHTML = '<i class="fas fa-reply"></i>';
        
        // ★ 缩小到原尺寸的 1/4（38 → 10）
        const size = 22; 
        btn.style.cssText = `
            position: fixed;
            z-index: 999;
            width: ${size}px; height: ${size}px;
            border-radius: 50%;
            border: none;
            background: var(--wechat-green);
            color: #fff;
            font-size: 12px;
            cursor: pointer;
            box-shadow: 0 1px 4px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.15s;
            padding: 0;
            top: ${rect.top + rect.height/2 - size/2}px;
            ${isSent ? `left: ${rect.left - size - 6}px;` : `left: ${rect.right + 6}px;`}
        `;
        document.body.appendChild(btn);
        window._quoteBtn = btn;

        // 点击按钮触发引用，并自动清理
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            clearQuoteButton();
            showQuote(msg);
        });

        // 点击页面其他区域时清除按钮（延迟绑定，避免立即触发）
        const cleaner = function(e) {
            if (!e.target.closest('.quote-action-btn')) {
                clearQuoteButton();
            }
        };
        window._quoteCleaner = cleaner;
        setTimeout(() => {
            document.addEventListener('click', cleaner);
        }, 0);
    }

    // ---------- 显示引用UI（顶部预览栏） ----------
    function showQuote(quotedMsg) {
        if (!quotedMsg) return;
        quotedMessage = quotedMsg;
        let quoteBar = document.getElementById('quoteBar');
        if (!quoteBar) {
            quoteBar = document.createElement('div');
            quoteBar.id = 'quoteBar';
            const inputBar = document.getElementById('inputBar');
            if (inputBar) inputBar.appendChild(quoteBar); 
        }
        const sender = quotedMsg.sender === 'me' ? '我' : '对方';
        
        // 支持图片和文字混合预览
        let contentHtml = '';
        if (quotedMsg.image) {
            contentHtml = `<img src="${quotedMsg.image}" style="max-width:40px;max-height:40px;border-radius:4px;vertical-align:middle;margin-right:4px;" />`;
            if (quotedMsg.text) contentHtml += `<span style="vertical-align:middle;">${quotedMsg.text}</span>`;
        } else {
            contentHtml = quotedMsg.text || '';
        }

        if (quoteBar) {
            quoteBar.innerHTML = `
                <span style="display:flex;align-items:center;gap:4px;flex:1;overflow:hidden;">
                    <span style="font-weight:500;flex-shrink:0;">${sender}：</span>
                    <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${contentHtml}</span>
                </span>
                <button id="clearQuoteBtn" style="background:none;border:none;color:var(--wechat-text-secondary);cursor:pointer;font-size:14px;flex-shrink:0;"><i class="fas fa-times"></i></button>
            `;
            quoteBar.style.display = 'flex';
            document.getElementById('clearQuoteBtn').addEventListener('click', function() {
                clearQuote();
            });
        }
        if (DOM.msgInput) DOM.msgInput.focus();

        // 更新聊天区域底部间距
        if (typeof window.updateChatPadding === 'function') {
            window.updateChatPadding();
        }
    }

    function clearQuote() {
        const quoteBar = document.getElementById('quoteBar');
        if (quoteBar) quoteBar.style.display = 'none';
        quotedMessage = null;
        // 同时清除引用按钮
        clearQuoteButton();

        // 恢复聊天区域底部间距
        if (typeof window.updateChatPadding === 'function') {
            window.updateChatPadding();
        }
    }

    function getQuotedMessage() {
        return quotedMessage;
    }

    // ---------- 对外接口 ----------
    window.quoteManager = {
        getEnabled,
        setEnabled,
        initClickQuote,
        showQuoteButton,
        showQuote,
        clearQuote,
        getQuotedMessage,
        loadSettings,
    };

    console.log('✅ quoteManager 已加载，单击+按钮模式，按钮尺寸缩小为1/4，修复切换消息失效问题');
})();