// ==UserScript==
// @name         VK Tools Widget
// @namespace    http://tampermonkey.net/
// @version      1.7
// @description  A tool to remove blur/restrictions and add quick shortcut buttons to VK channels (smart ID extraction).
// @author       Abdalrahman Saad
// @icon         https://raw.githubusercontent.com/3bd2lra7man/vk-tools-widget/main/logo.svg
// @homepageURL  https://github.com/3bd2lra7man/vk-tools-widget
// @updateURL    https://github.com/3bd2lra7man/vk-tools-widget/raw/refs/heads/main/vk-tools.user.js
// @downloadURL  https://github.com/3bd2lra7man/vk-tools-widget/raw/refs/heads/main/vk-tools.user.js
// @match        *://*.vk.com/*
// @match        *://*.vkvideo.ru/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function() {
    'use strict';

    // ==========================================
    // 1. CSS injection and removal for restriction bypass
    // ==========================================
    const BLUR_STYLE_ID = 'vk-tools-blur-remover-style';

    const cssRules = `
        [class*="imgBlurredSize"] { filter: none !important; }
        [class*="imgBlurred"] { transform: none !important; }
        [class*="imageBlur"] { filter: none !important; }
        [data-testid="video_card_restriction_overlay"] { display: none !important; }
        [class*="colorTextContrastThemed"][class*="vkitOverlay"] { display: none !important; }
        img[class*="PreviewImage"] { filter: none !important; transform: none !important; }
    `;

    function toggleRestrictionBlur(enable) {
        let styleTag = document.getElementById(BLUR_STYLE_ID);
        if (enable) {
            if (!styleTag) {
                styleTag = document.createElement('style');
                styleTag.id = BLUR_STYLE_ID;
                styleTag.textContent = cssRules;
                document.head.appendChild(styleTag);
            }
        } else {
            if (styleTag) styleTag.remove();
        }
        GM_setValue('vk_blur_bypass_enabled', enable);
    }

    // ==========================================
    // 2. Channel ID extraction and navigation
    // ==========================================
    function extractChannelId() {
        // Attempt 1: Extract from URL if it matches /@...
        const path = window.location.pathname;
        const urlMatch = path.match(/^\/@([^/]+)/);
        if (urlMatch && urlMatch[1]) {
            return urlMatch[1];
        }

        // Attempt 2: Extract from DOM if not found in URL
        const links = document.querySelectorAll('div[data-testid="video_owner_container"] a[href][data-testid="video_owner"]');
        if (links.length > 0) {
            const href = links[0].getAttribute('href');
            const parts = href.split('@');
            if (parts.length > 1) {
                return parts[1].replace(/\//g, '');
            }
        }

        alert('❌ Channel ID not found in the URL or on this page.');
        return null;
    }

    function gotoChannel() {
        const id = extractChannelId();
        if (id) window.open(`https://vk.com/${id}`, '_blank');
    }

    function gotoVideos() {
        const id = extractChannelId();
        if (id) window.open(`https://vk.com/video/@${id}`, '_blank');
    }

    // ==========================================
    // 3. UI Construction (Shadow DOM)
    // ==========================================
    function createUI() {
        const isEnabled = GM_getValue('vk_blur_bypass_enabled', true);
        const isUiHidden = GM_getValue('vk_ui_hidden', true);
        const savedLeft = GM_getValue('vk_widget_left', null);
        const savedTop = GM_getValue('vk_widget_top', null);

        toggleRestrictionBlur(isEnabled);

        const container = document.createElement('div');
        const shadow = container.attachShadow({ mode: 'closed' });

        const wrapper = document.createElement('div');
        wrapper.className = 'vk-tools-widget';
        wrapper.style.display = isUiHidden ? 'none' : 'block';

        if (savedLeft && savedTop) {
            wrapper.style.right = 'auto'; 
            wrapper.style.left = savedLeft;
            wrapper.style.top = savedTop;
        }

        wrapper.innerHTML = `
            <style>
                :host { all: initial; }
                .vk-tools-widget {
                    position: fixed;
                    top: 20px;
                    right: 20px; 
                    background: #202020;
                    color: #e0e0e0;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    border-radius: 8px;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.6);
                    width: 300px;
                    z-index: 2147483647;
                    border: 1px solid #383838;
                    user-select: none;
                }

                .header {
                    padding: 10px 16px;
                    border-bottom: 1px solid #333;
                    background: #252525;
                    display: flex;
                    align-items: center;
                    border-top-left-radius: 8px;
                    border-top-right-radius: 8px;
                    cursor: grab; 
                }

                .header:active {
                    cursor: grabbing; 
                }

                .close-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    padding: 4px;
                    margin-right: 10px;
                    border-radius: 4px;
                    transition: 0.2s;
                }

                .close-btn:hover { background: #3a1a1a; }
                .close-btn svg { width: 18px; height: 18px; fill: #ff4c4c; transition: 0.2s; }
                .close-btn:hover svg { fill: #ff7676; transform: scale(1.1); }

                .title-container {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-weight: bold;
                    font-size: 15px;
                }

                .menu-list {
                    display: flex;
                    flex-direction: column;
                    padding: 6px 0;
                }

                .menu-item {
                    display: flex;
                    align-items: center;
                    padding: 12px 16px;
                    font-size: 13px;
                    cursor: pointer;
                    transition: background 0.2s;
                    gap: 12px;
                }

                .menu-item:hover { background: #333; }
                .menu-item.disabled { display: none; }

                .icon { width: 18px; height: 18px; fill: #888; }
                .menu-item:hover .icon { fill: #fff; }

                .switch-container {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    width: 100%;
                    cursor: default;
                }
                .switch {
                    position: relative;
                    display: inline-block;
                    width: 34px;
                    height: 18px;
                }
                .switch input { opacity: 0; width: 0; height: 0; }
                .slider {
                    position: absolute;
                    cursor: pointer;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background-color: #555;
                    transition: .3s;
                    border-radius: 18px;
                }
                .slider:before {
                    position: absolute;
                    content: "";
                    height: 12px;
                    width: 12px;
                    left: 3px;
                    bottom: 3px;
                    background-color: white;
                    transition: .3s;
                    border-radius: 50%;
                }
                input:checked + .slider { background-color: #538e1a; }
                input:checked + .slider:before { transform: translateX(16px); }
            </style>

            <div class="header" id="widgetHeader">
                <div class="close-btn" id="btnCloseWidget" title="Close">
                    <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </div>

                <div class="title-container">
                    <svg viewBox="0 0 256 256" width="24" height="24">
                        <defs>
                            <linearGradient id="vkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stop-color="#0077FF" />
                                <stop offset="100%" stop-color="#0055CC" />
                            </linearGradient>
                            <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
                                <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000000" flood-opacity="0.25"/>
                            </filter>
                        </defs>
                        <rect width="256" height="256" rx="56" fill="url(#vkGrad)" />
                        <text x="128" y="135" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="115" font-weight="900" fill="#FFFFFF" text-anchor="middle" letter-spacing="-6" filter="url(#shadow)">VK</text>
                        <rect x="42" y="160" width="172" height="44" rx="22" fill="#252525" filter="url(#shadow)" />
                        <rect x="42" y="160" width="172" height="44" rx="22" fill="none" stroke="#383838" stroke-width="1.5" />
                        <text x="105" y="188" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="18" font-weight="bold" fill="#e0e0e0" text-anchor="middle" letter-spacing="4">TOOLS</text>
                        <rect x="155" y="172" width="34" height="20" rx="10" fill="#538e1a" />
                        <circle cx="179" cy="182" r="7" fill="#FFFFFF" />
                    </svg>
                    VK Tools
                </div>
            </div>

            <div class="menu-list">
                <div class="menu-item" style="cursor: default;">
                    <div class="switch-container">
                        <span style="display:flex; align-items:center; gap:12px;">
                            <svg class="icon" viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                            Block restriction blur
                        </span>
                        <label class="switch">
                            <input type="checkbox" id="blurToggle" ${isEnabled ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                    </div>
                </div>

                <div class="menu-item disabled" id="btnGotoChannel">
                    <svg class="icon" viewBox="0 0 24 24"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>
                    Goto to channel
                </div>

                <div class="menu-item disabled" id="btnGotoVideos">
                    <svg class="icon" viewBox="0 0 24 24"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z"/></svg>
                    Goto videos of channel
                </div>
            </div>
        `;

        shadow.appendChild(wrapper);
        document.body.appendChild(container);

        // --- Event Listeners ---

        shadow.getElementById('btnCloseWidget').addEventListener('click', () => {
            wrapper.style.display = 'none';
            GM_setValue('vk_ui_hidden', true);
        });

        shadow.getElementById('blurToggle').addEventListener('change', (e) => {
            toggleRestrictionBlur(e.target.checked);
        });

        shadow.getElementById('btnGotoChannel').addEventListener('click', gotoChannel);
        shadow.getElementById('btnGotoVideos').addEventListener('click', gotoVideos);

        GM_registerMenuCommand("👁️ Show / Hide VK Tools Menu", () => {
            const isHidden = wrapper.style.display === 'none';
            wrapper.style.display = isHidden ? 'block' : 'none';
            GM_setValue('vk_ui_hidden', !isHidden);
        });

        // ==========================================
        // 4. Drag & Drop Logic
        // ==========================================
        const header = shadow.getElementById('widgetHeader');
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('#btnCloseWidget')) return;

            isDragging = true;
            const rect = wrapper.getBoundingClientRect();
            wrapper.style.right = 'auto';
            wrapper.style.left = rect.left + 'px';
            wrapper.style.top = rect.top + 'px';

            startX = e.clientX;
            startY = e.clientY;
            initialLeft = rect.left;
            initialTop = rect.top;
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            wrapper.style.left = `${initialLeft + dx}px`;
            wrapper.style.top = `${initialTop + dy}px`;
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                GM_setValue('vk_widget_left', wrapper.style.left);
                GM_setValue('vk_widget_top', wrapper.style.top);
            }
        });

        // ==========================================
        // 5. Smart URL Checker (SPA support)
        // ==========================================
        const btnChannel = shadow.getElementById('btnGotoChannel');
        const btnVideos = shadow.getElementById('btnGotoVideos');

        function checkUrlAndToggleButtons() {
            const hostname = window.location.hostname;
            const pathname = window.location.pathname;

            // Show buttons if domain is vkvideo.ru and path starts with /video or /@
            const isValidUrl = hostname === 'vkvideo.ru' && (pathname.startsWith('/video') || pathname.startsWith('/@'));

            if (isValidUrl) {
                btnChannel.classList.remove('disabled');
                btnVideos.classList.remove('disabled');
            } else {
                btnChannel.classList.add('disabled');
                btnVideos.classList.add('disabled');
            }
        }

        checkUrlAndToggleButtons();

        let lastUrl = location.href;
        setInterval(() => {
            const currentUrl = location.href;
            if (currentUrl !== lastUrl) {
                lastUrl =
