let activeUtterance = null; // Safari Garbage Collector fix
// CORE APPLICATION DATABASE ENGINE (Mevcut CSV yapısıyla tam uyumlu)
let appData = {
    decks: [
        { id: "genel", name: "Genel Kelimeler" },
        { id: "fiiller", name: "Sık Kullanılan Fiiller" }
    ],
    cards: [
        { id: "c1", deckId: "genel", word: "de auto", meaning: "araba", sentence: "Ik koop een nieuwe auto.", repetitions: 0, wrong: 0, modeStats: {} },
        { id: "c2", deckId: "genel", word: "het huis", meaning: "ev", sentence: "Dit is een groot huis.", repetitions: 0, wrong: 0, modeStats: {} },
        { id: "c3", deckId: "fiiller", word: "maken", meaning: "yapmak", sentence: "Zij maken hun huiswerk.", repetitions: 0, wrong: 0, modalConjugation: "maak,maakt,maken", verbPresent: "maak", verbPastSingular: "maakte", verbPastPlural: "maakten", verbPerfect: "gemaakt" }
    ],
    stats: { streak: 0, lastStudyDate: null, totalRepetitions: 0, totalErrors: 0 },
    groqKey: null,
    encryptedGroqKey: null,
    multiDeckIds: [],
    achievements: [
        { id: 0, name: "İlk Adım", earned: false },
        { id: 1, name: "İstikrarlı Öğrenci", earned: false }
    ]
};

let saveTimeout = null;
let currentCard = null;
let currentCardIndex = 0;
let currentFilteredCards = [];
let activeDeckId = "genel";
let activeMode = "classic";
let studyDirection = "NL2TR"; // NL2TR | TR2NL | random
let sessionHistory = [];
let matchingSelected = null;
let matchingAnswers = {};
let matchingPairs = [];
let rpgHistory = [];
let rpgCq = 50;
let waHistory = [];
let voiceRecog = null;
let voiceListening = false;
let podcastPlaying = false;
let podcastLines = [];
let podcastCurrentLine = 0;
let deferredPrompt = null; // PWA Install event placeholder
let renderToken = 0; // Eski render zamanlayıcılarını geçersiz kılmak için

const THEMATIC_DECKS = [
    { id: "tema_market", name: "Market", color: "#D97706" },
    { id: "tema_doktor", name: "Doktor", color: "#16A34A" },
    { id: "tema_is", name: "İş", color: "#2563EB" },
    { id: "tema_belediye", name: "Belediye", color: "#7C3AED" },
    { id: "tema_okul", name: "Okul", color: "#0891B2" },
    { id: "tema_randevu", name: "Randevu", color: "#BE123C" },
    { id: "tema_ulasim", name: "Ulaşım", color: "#475569" },
    { id: "tema_fiiller", name: "Günlük Fiiller", color: "#0F766E" }
];

const LEVEL_PATTERN = {
    A1: /^(de auto|het huis|maken|gaan|komen|hebben|zijn|eten|drinken|kopen|goed|dag|ja|nee)/i,
    A2: /(afspraak|winkel|dokter|school|werk|gemeente|station|trein|bus|betalen)/i,
    B1: /(vergadering|aanvraag|verzekering|ervaring|bespreken|regelen|uitleggen)/i
};

// PREMIUM MASCOT SVG COMPONENT
const MASCOTS = {
    happy: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="45" fill="#F97316" fill-opacity="0.1" stroke="#F97316" stroke-width="2"/><circle cx="35" cy="40" r="5" fill="#F97316"/><circle cx="65" cy="40" r="5" fill="#F97316"/><path d="M30 65 Q50 80 70 65" stroke="#F97316" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`,
    thinking: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="45" fill="#8B5CF6" fill-opacity="0.1" stroke="#8B5CF6" stroke-width="2"/><circle cx="35" cy="45" r="4" fill="#8B5CF6"/><circle cx="65" cy="45" r="4" fill="#8B5CF6"/><path d="M40 70 h20" stroke="#8B5CF6" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`,
    empty: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="45" fill="#94A3B8" fill-opacity="0.1" stroke="#94A3B8" stroke-width="2"/><circle cx="35" cy="45" r="3" fill="#94A3B8"/><circle cx="65" cy="45" r="3" fill="#94A3B8"/><path d="M35 70 Q50 60 65 70" stroke="#94A3B8" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`,
    sad: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="45" fill="#EF4444" fill-opacity="0.1" stroke="#EF4444" stroke-width="2"/><circle cx="35" cy="45" r="4" fill="#EF4444"/><circle cx="65" cy="45" r="4" fill="#EF4444"/><path d="M30 75 Q50 60 70 75" stroke="#EF4444" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`
};

function setMascot(id, type) {
    const container = document.getElementById(id);
    if (container) container.innerHTML = MASCOTS[type] || MASCOTS.happy;
}

// INITIALIZATION LOADER
function initApp() {
    if (localStorage.getItem("linguaprime_data_v2")) {
        try {
            const savedData = JSON.parse(localStorage.getItem("linguaprime_data_v2"));
            // Deep merging to ensure structural integrity
            appData = { ...appData, ...savedData };
            appData.stats = { ...appData.stats, ...(savedData.stats || {}) };
        } catch(e) { console.error("Veri okuma hatası, varsayılanlar yüklendi."); }
    }

    if (!appData.stats) appData.stats = { streak: 0, lastStudyDate: null, totalRepetitions: 0, totalErrors: 0 };
    if (!appData.stats.weeklyData) appData.stats.weeklyData = {};
    if (!appData.decks) appData.decks = [];
    if (!appData.cards) appData.cards = [];
    if (appData.stats.todayReps === undefined) appData.stats.todayReps = 0;
    ensureLearningCoachData();
    
    // Kılavuz 1.1: SessionStorage Tabanlı Güvenli Başlatma
    const sessionKey = sessionStorage.getItem("groq_api_key");
    if (sessionKey) {
        if (window.setGroqKey) window.setGroqKey(sessionKey);
        document.getElementById("groqSetupScreen").style.display = "none";
    } else if (appData.encryptedGroqKey) {
        document.getElementById("groqSetupScreen").style.display = "flex";
        document.getElementById("groqKeyInput").style.display = "none";
        document.getElementById("saveGroqKeyBtn").style.display = "none";
        document.getElementById("unlockGroqBtn").style.display = "block";
        document.getElementById("groqSetupDesc").innerHTML = "Eski şifreli anahtarınız var. Master şifrenizle çözün veya yeni anahtar girin.";
    } else if (appData.groqKey) {
        if (window.setGroqKey) window.setGroqKey(appData.groqKey);
        appData.groqKey = null;
        save();
        document.getElementById("groqSetupScreen").style.display = "none";
    } else {
        document.getElementById("groqSetupScreen").style.display = "flex";
    }
    
    setupEventListeners();
    applyStoredTheme();
    applyStoredOled();
    renderSidebar();
    applyDyslexicPreference();
    selectDeck(activeDeckId);
    updateGlobalStreak();
    registerServiceWorker();
}

// REGISTER SERVICE WORKER FOR OFFLINE AND PWA INSTALLATION
function registerServiceWorker() {
    // PWA banner dismissal check
    if (localStorage.getItem("pwa-banner-dismissed") === "true") {
        return;
    }

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker kayıtlı:', reg))
            .catch(err => console.warn('Service Worker kaydı başarısız:', err));
    }

    // iOS Safari PWA Installation Logic
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

    if (isIOS && !isStandalone) {
        const banner = document.getElementById("pwaInstallBanner");
        const installBtn = document.getElementById("pwaInstallBtn");
        const iosHint = document.getElementById("iosHint");
        if (banner && installBtn && iosHint) {
            banner.classList.add("show");
            installBtn.style.display = "none";
            iosHint.style.display = "block";
        }
    }

    // PWA Kurulum tetikleyicisini dinle
    window.addEventListener('beforeinstallprompt', (e) => {
        // Varsayılan tarayıcı kurulum banner'ını engelle
        e.preventDefault();
        // Olayı daha sonra tetiklemek üzere sakla
        deferredPrompt = e;
        // Şık PWA banner'ımızı ekranda kaydırarak göster
        const banner = document.getElementById("pwaInstallBanner");
        if (banner) {
            banner.classList.add("show");
        }
    });

    // Yükle butonuna basıldığında
    document.getElementById("pwaInstallBtn").addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`Kullanıcı kurulum kararı: ${outcome}`);
            deferredPrompt = null;
            hidePwaBanner();
        }
    });

    // Banner kapatma butonu
    document.getElementById("pwaCloseBtn").addEventListener('click', () => {
        hidePwaBanner();
        localStorage.setItem("pwa-banner-dismissed", "true");
    });
}

function hidePwaBanner() {
    const banner = document.getElementById("pwaInstallBanner");
    if (banner) {
        banner.classList.remove("show");
    }
}

function ensureLearningCoachData() {
    THEMATIC_DECKS.forEach(deck => {
        if (!appData.decks.some(d => d.id === deck.id)) {
            appData.decks.push({ ...deck });
        }
    });

    appData.cards.forEach(card => {
        if (!card.level) card.level = inferLevel(card);
        if (!card.context) card.context = inferUsageContext(card);
        if (!card.register) card.register = inferRegister(card);
        if (!card.article) card.article = inferArticle(card.word);
        if (!card.ease) card.ease = 2.5;
        if (card.interval === undefined) card.interval = 0;
        if (!card.nextReview) card.nextReview = Date.now();
    });
}

function inferLevel(card) {
    const source = `${card.word || ""} ${card.meaning || ""} ${card.sentence || ""}`;
    if (LEVEL_PATTERN.A1.test(source)) return "A1";
    if (LEVEL_PATTERN.A2.test(source)) return "A2";
    if (LEVEL_PATTERN.B1.test(source)) return "B1";
    return "B2";
}

function inferUsageContext(card) {
    const text = `${card.deckId || ""} ${card.word || ""} ${card.meaning || ""} ${card.sentence || ""}`.toLowerCase();
    if (/market|winkel|kopen|betalen|prijs|albert|boodschap/.test(text)) return "Market ve alışveriş";
    if (/dokter|huisarts|pijn|ziek|gezondheid|afspraak/.test(text)) return "Sağlık ve randevu";
    if (/werk|baan|vergadering|collega|sollicitatie/.test(text)) return "İş ve günlük profesyonel dil";
    if (/gemeente|aanvraag|formulier|belasting|vergunning/.test(text)) return "Resmi işlem";
    if (/school|les|cursus|leren|docent/.test(text)) return "Okul ve kurs";
    if (/bus|trein|tram|station|fiets|auto/.test(text)) return "Ulaşım";
    if (/en$/.test((card.word || "").trim().toLowerCase())) return "Günlük eylem";
    return "Günlük konuşma";
}

function inferRegister(card) {
    const text = `${card.word || ""} ${card.sentence || ""}`.toLowerCase();
    if (/\bu\b|meneer|mevrouw|gemeente|aanvraag|vergunning/.test(text)) return "Resmi";
    if (/hoi|doei|lekker|prima|vriend/.test(text)) return "Günlük";
    return "Nötr";
}

function inferArticle(word) {
    const match = String(word || "").trim().match(/^(de|het)\s+/i);
    return match ? match[1].toLowerCase() : null;
}

// Global sidebar control functions
function openSidebar() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("overlay");
    if (!sidebar || !overlay) return;
    sidebar.classList.add("open");
    overlay.classList.add("show");
    document.body.classList.add("sidebar-open");
}

function closeSidebar() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("overlay");
    if (!sidebar || !overlay) return;
    sidebar.classList.remove("open");
    overlay.classList.remove("show");
    document.body.classList.remove("sidebar-open");
}

function save() {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(() => {
        localStorage.setItem("linguaprime_data_v2", JSON.stringify(appData));
        saveTimeout = null; // Reset the timeout ID
    }, 100); // Debounce for 100ms
}

function flushSave() {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
    }
    try { localStorage.setItem("linguaprime_data_v2", JSON.stringify(appData)); } catch (_) {}
}
// Debounce sonrası beklemeden sayfa kapanırsa veri kaybolmasın
window.addEventListener("beforeunload", flushSave);
window.addEventListener("pagehide", flushSave);

function toggleSidebar(e) {
    if (e && e.cancelable) { e.preventDefault(); e.stopPropagation(); }
    const sidebar = document.getElementById("sidebar");
    if (sidebar.classList.contains("open")) { closeSidebar(); } else { openSidebar(); }
}


// EVENT LISTENER ENGINE
function setupEventListeners() {
    // Layout hooks
    const menuBtn = document.getElementById("menuBtn");
    if (menuBtn) {
        // Dokunmatik cihazlarda touchstart + click'in çift tetiklemesini önler.
        menuBtn.addEventListener("touchstart", (e) => {
            e.preventDefault();
            toggleSidebar(e);
        }, { passive: false });
        menuBtn.onclick = toggleSidebar;
    }

    const streakBadge = document.getElementById("streakBadge");
    if (streakBadge) streakBadge.onclick = () => openModal("statsModal");

    const coachStartBtn = document.getElementById("coachStartBtn");
    if (coachStartBtn) coachStartBtn.onclick = () => {
        activeDeckId = "all";
        renderSidebar();
        selectDeck("all");
        document.getElementById("mainCard")?.scrollIntoView({ behavior: "smooth", block: "center" });
    };

    const overlay = document.getElementById("overlay");
    if (overlay) overlay.onclick = closeAllDrawers;

    const themeBtn = document.getElementById("themeToggleBtn");
    if (themeBtn) themeBtn.onclick = toggleTheme;

    const dyslexicToggle = document.getElementById("dyslexicToggle");
    if (dyslexicToggle) dyslexicToggle.onchange = (e) => {
        appData.dyslexicMode = e.target.checked;
        save();
        applyDyslexicPreference();
    };
    
    const oledToggle = document.getElementById("oledToggle");
    if (oledToggle) oledToggle.onchange = (e) => {
        document.body.classList.toggle("oled", e.target.checked);
        localStorage.setItem("linguaprime_oled", e.target.checked);
    };

    // Deste renk seçici
    document.addEventListener("click", (e) => {
        if (e.target.classList.contains("deck-color-opt")) {
            document.querySelectorAll(".deck-color-opt").forEach(el => {
                el.style.border = "none";
                el.removeAttribute("data-selected");
            });
            e.target.style.border = "3px solid white";
            e.target.setAttribute("data-selected", "true");
        }
    });

    // Deste arama
    const deckSearchInput = document.getElementById("deckSearch");
    if (deckSearchInput) {
        deckSearchInput.oninput = () => {
            const q = deckSearchInput.value.toLowerCase();
            document.querySelectorAll("#deckListSidebar .sidebar-item").forEach(item => {
                item.style.display = item.textContent.toLowerCase().includes(q) ? "" : "none";
            });
        };
    }

    // Drawer shortcuts
    const bindings = {
        "aiCardGenBtn": () => { openModal("aiCardGenModal"); populateAiGenDeckTarget(); },
        "addDeckBtn": () => openModal("addDeckModal"),
        "manageCardsBtn": () => openModal("manageCardsModal"),
        "quickAddBtn": () => { openModal("manageCardsModal"); document.getElementById("manualCardForm").style.display="flex"; },
        "kesfetBtn": () => { closeAllDrawers(); selectDeck("all"); },
        "storyBtn": () => { openModal("storyModal"); populateStoryDeckSelector(); },
        "correctBtn": () => openModal("correctModal"),
        "weaknessBtn": () => openModal("weaknessModal"),
        "aiDictBtn": () => openModal("aiDictModal"),
        "chatBtn": () => openModal("chatModal"),
        "podcastBtn": () => openModal("podcastModal"),
        "rpgBtn": () => { openModal("rpgModal"); initRpg(); },
        "whatsappBtn": () => { openModal("whatsappModal"); initWhatsApp(); },
        "personalityBtn": () => { openModal("personalityModal"); renderPersonalityProfile(); },
        "memoryBtn": () => openModal("memoryModal"),
        "socialBtn": () => openModal("socialModal"),
        "matchingBtn": () => { openModal("matchingModal"); generateMatchingGame(); },
        "newsBtn": () => openModal("newsModal"),
        "accentBtn": () => openModal("accentModal"),
        "lyricsBtn": () => openModal("lyricsModal"),
        "linguaDnaBtn": () => { closeAllDrawers(); openModal("linguaDnaModal"); },
        "errorMuseumBtn": () => { openModal("errorMuseumModal"); renderErrorMuseum(); },
        "statsBtn": () => openModal("statsModal"),
        "settingsBtn": () => openModal("settingsModal"),
        "multiDeckStudyBtn": () => { closeAllDrawers(); openModal("multiDeckModal"); populateMultiDeckList(); }
    };

    Object.entries(bindings).forEach(([id, fn]) => {
        const el = document.getElementById(id);
        if (el) el.onclick = fn;
    });

    // Modal Buttons
    document.getElementById("saveGroqKeyBtn").onclick = saveGroqKey;
    document.getElementById("unlockGroqBtn").onclick = unlockGroqKey;
    document.getElementById("saveNewDeckBtn").onclick = addNewDeck;
    document.getElementById("saveManualCardBtn").onclick = addNewCardManual;
    document.getElementById("startMultiDeckBtn").onclick = startMultiDeckSession;
    
    // Study actions
    document.getElementById("btnAgain").onclick = () => handleAnswer("again");
    document.getElementById("btnHard").onclick = () => handleAnswer("hard");
    document.getElementById("btnGood").onclick = () => handleAnswer("good");
    document.getElementById("btnEasy").onclick = () => handleAnswer("easy");
    document.getElementById("undoBtn").onclick = triggerUndo;
    
    // TIKLAMA VE DOKUNMA ÇAKIŞMASINI ÖNLEYEN FLIP MANTIĞI
    const handleFlip = (e) => {
        // Eğer tıklanan yer test alanları, butonlar, girdiler veya etkileşimli kutular ise kartı ÇEVİRME
        if (
            e.target.closest('button') || 
            e.target.closest('input') || 
            e.target.closest('.wv-word') || 
            e.target.closest('.woordvolgorde-zone') || 
            e.target.closest('#testArea') || 
            e.target.closest('.verb-drill-row')
        ) return;
        
        // Eğer kart kaydırılıyorsa çevirme
        if (window.isDraggingCard) return; 
        
        document.getElementById("mainCard").classList.toggle("flipped");
    };

    document.getElementById("mainCard").addEventListener('click', handleFlip);

    // SWIPE GESTURE DESTEĞI (iOS Safari dahil)
    (function() {
        const card = document.getElementById("mainCard");
        let startX = 0, startY = 0, startTime = 0;
        let isDragging = false;
        const SWIPE_THRESHOLD = 60;
        const SWIPE_TIME_LIMIT = 400;

        function onTouchStart(e) {
            if (e.target.closest('button') || e.target.closest('input')) return;
            const touch = e.touches ? e.touches[0] : e;
            startX = touch.clientX;
            startY = touch.clientY;
            startTime = Date.now();
            window.isDraggingCard = false;
        }

        function onTouchMove(e) {
            if (!startX) return;
            const touch = e.touches ? e.touches[0] : e;
            const dx = touch.clientX - startX;
            const dy = touch.clientY - startY;
            if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
                window.isDraggingCard = true;
                if (e.cancelable) e.preventDefault();
                const opacity = Math.min(Math.abs(dx) / SWIPE_THRESHOLD, 1);
                card.style.transform = `translate3d(${dx * 0.4}px, 0, 0) rotate(${dx * 0.08}deg)`;
                const rightIcon = card.querySelector('.swipe-icon.right');
                const leftIcon = card.querySelector('.swipe-icon.left');
                if (rightIcon) rightIcon.style.opacity = dx > 0 ? opacity : 0;
                if (leftIcon) leftIcon.style.opacity = dx < 0 ? opacity : 0;
            }
        }

        function onTouchEnd(e) {
            if (!startX) return;
            const touch = e.changedTouches ? e.changedTouches[0] : e;
            const dx = touch.clientX - startX;
            const dy = touch.clientY - startY;
            const elapsed = Date.now() - startTime;
            
            card.classList.add('snapping');
            card.style.transform = '';
            const rightIcon = card.querySelector('.swipe-icon.right');
            const leftIcon = card.querySelector('.swipe-icon.left');
            if (rightIcon) rightIcon.style.opacity = 0;
            if (leftIcon) leftIcon.style.opacity = 0;
            setTimeout(() => { card.classList.remove('snapping'); }, 450);

            if (window.isDraggingCard && elapsed < SWIPE_TIME_LIMIT) {
                if (dx > SWIPE_THRESHOLD) {
                    handleAnswer("good");
                } else if (dx < -SWIPE_THRESHOLD) {
                    handleAnswer("again");
                }
            }
            
            // Küçük bir gecikmeyle dragging durumunu sıfırla ki click tetiklenmesin
            setTimeout(() => { window.isDraggingCard = false; }, 50);
            startX = 0; startY = 0;
        }

        card.addEventListener('touchstart', onTouchStart, { passive: true });
        card.addEventListener('touchmove', onTouchMove, { passive: false });
        card.addEventListener('touchend', onTouchEnd, { passive: true });
    })();

    // Çift yönlü çalışma yön seçimi
    ["dirNL2TR","dirTR2NL","dirRandom"].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.onclick = () => {
            document.querySelectorAll(".direction-btn").forEach(b => b.classList.remove("active"));
            el.classList.add("active");
            studyDirection = id === "dirNL2TR" ? "NL2TR" : id === "dirTR2NL" ? "TR2NL" : "random";
            renderCurrentCardMode();
        };
    });

    // Klavye kısayolları
    document.addEventListener("keydown", (e) => {
        // Modal açıksa veya input odaklanmışsa çalıştırma
        if (document.querySelector(".modal.open")) return;
        if (["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName)) return;
        switch(e.key) {
            case " ": case "Enter":
                e.preventDefault();
                document.getElementById("mainCard").classList.toggle("flipped");
                break;
            case "1": handleAnswer("again"); break;
            case "2": handleAnswer("hard"); break;
            case "3": handleAnswer("good"); break;
            case "4": handleAnswer("easy"); break;
            case "z": case "Z": triggerUndo(); break;
            case "ArrowLeft": 
                if (activeMode === "mcq") {
                    // MCQ modunda 1. şıkkı seçebiliriz
                }
                handleAnswer("again"); 
                break;
            case "ArrowRight": handleAnswer("good"); break;
        }
    });

    // Mod seçimi
    document.querySelectorAll(".mode-btn").forEach(btn => {
        btn.onclick = (e) => {
            document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
            activeMode = e.target.getAttribute("data-mode");
            renderCurrentCardMode();
        };
    });

    // Advanced AI Request Bindings
    document.getElementById("aiGenCardsBtn").onclick = handleAiCardGeneration;
    document.getElementById("generateStoryBtn").onclick = handleStoryAi;
    document.getElementById("checkCorrectionBtn").onclick = handleSentenceCorrection;
    document.getElementById("searchAiDictBtn").onclick = handleAiDictionary;
    document.getElementById("sendChatBtn").onclick = handleLiveChat;
    document.getElementById("generatePodcastBtn").onclick = handlePodcastAi;
    document.getElementById("sendRpgBtn").onclick = handleRpgMove;
    document.getElementById("waSendBtn").onclick = handleWhatsAppMessage;
    document.getElementById("generateMemoryBtn").onclick = handleMemoryPalace;
    document.getElementById("runSocialBtn").onclick = handleSocialEngine;
    document.getElementById("generateNewsBtn").onclick = handleNewsFeed;
    document.getElementById("generateAccentBtn").onclick = handleAccentDecoder;
    document.getElementById("generateLyricsBtn").onclick = handleLyricsBreakdown;
    document.getElementById("analyzeDnaBtn").onclick = handleLinguisticDna;
    document.getElementById("museumAiBtn").onclick = handleMuseumAiAnalysis;

    // System setup bindings
    document.getElementById("exportDataBtn").onclick = exportSystemData;
    document.getElementById("importFileInput").onchange = importSystemData;
    document.getElementById("importCsvInput").onchange = importCsvData;
    document.getElementById("resetApiKeyBtn").onclick = resetApiKey;
    
    // Voice Badge voice command
    document.getElementById("voiceBadge").onclick = toggleVoiceRecog;

    // TTS binding
    document.getElementById("frontTTSBtn").onclick = (e) => { e.stopPropagation(); speakTts(document.getElementById("cardFrontWord").textContent, "nl-NL"); };
    document.getElementById("backTTSBtn").onclick = (e) => { e.stopPropagation(); speakTts(document.getElementById("cardBackMeaning").textContent, "tr-TR"); };

    // ENTER TUŞU DESTEĞİ - tüm inputlar için
    const enterBindings = {
        "chatInput":       () => handleLiveChat(),
        "waInput":         () => handleWhatsAppMessage(),
        "rpgCustomInput":  () => handleRpgMove(),
        "newDeckNameInput":() => addNewDeck(),
        "groqKeyInput":    () => saveGroqKey(),
        "masterPasswordInput": () => appData.encryptedGroqKey ? unlockGroqKey() : saveGroqKey(),
        "aiDictQuery":     () => handleAiDictionary(),
        "memoryWordInput": () => handleMemoryPalace(),
        "correctionInput": () => handleSentenceCorrection(),
        "lyricsSongInput": () => handleLyricsBreakdown(),
        "accentWordInput": () => handleAccentDecoder()
    };
    Object.entries(enterBindings).forEach(([id, fn]) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); fn(); } });
    });
}

// SIDEBAR RENDERING SYSTEM
function renderSidebar() {
    const container = document.getElementById("deckListSidebar");
    container.innerHTML = "";
    
    // "Tüm Kartlar" statik girişi
    const allItem = document.createElement("div");
    const allNewCount = appData.cards.filter(c => (c.repetitions || 0) === 0 && (c.wrong || 0) === 0).length;
    const allDueCount = getDueCards(appData.cards).length;
    allItem.className = `sidebar-item ${activeDeckId === "all" ? 'active' : ''}`;
    allItem.innerHTML = `<span>📚 Tüm Kartlar <span style="opacity:0.6; font-size:11px;">${appData.cards.length} kart · ${allNewCount} yeni · ${allDueCount} bekliyor</span></span>`;
    allItem.onclick = () => { activeDeckId = "all"; renderSidebar(); selectDeck("all"); closeAllDrawers(); };
    container.appendChild(allItem);

    // Çoklu Deste Oturumu başlığı (eğer aktifse)
    if (activeDeckId === "multi") {
        const multiItem = document.createElement("div");
        multiItem.className = "sidebar-item active";
        multiItem.innerHTML = `<span>🎯 Çoklu Deste Çalışması</span>`;
        container.appendChild(multiItem);
    }

    appData.decks.forEach(deck => {
        const deckCards = appData.cards.filter(c => c.deckId === deck.id);
        const count = deckCards.length;
        const newCount = deckCards.filter(c => (c.repetitions || 0) === 0 && (c.wrong || 0) === 0).length;
        const dueCount = getDueCards(deckCards).length;
        const item = document.createElement("div");
        item.className = `sidebar-item ${deck.id === activeDeckId ? 'active' : ''}`;
        const color = deck.color || "#F97316";
        const emoji = deck.emoji || "📁";
        item.innerHTML = `
            <span style="display:flex; align-items:center; gap:6px;">
                <span class="deck-color-dot" style="background:${color};"></span>
                ${escapeHtml(emoji)} ${escapeHtml(deck.name)} <span style="opacity:0.6; font-size:11px;">${count} kart · ${newCount} yeni · ${dueCount} bekliyor</span>
            </span>
            <div class="sidebar-item-actions">
                <button class="delete-deck-btn" onclick="deleteDeck('${deck.id}', event)">🗑</button>
            </div>
        `;
        item.onclick = () => { activeDeckId = deck.id; renderSidebar(); selectDeck(deck.id); closeAllDrawers(); };
        container.appendChild(item);
    });
}

// POPULATE DECK SELECTOR FOR MULTI-DECK STUDY
function populateMultiDeckList() {
    const container = document.getElementById("multiDeckList");
    container.innerHTML = "";
    appData.decks.forEach(deck => {
        const checked = appData.multiDeckIds.includes(deck.id) ? "checked" : "";
        const count = appData.cards.filter(c => c.deckId === deck.id).length;
        const div = document.createElement("div");
        div.style.cssText = "display: flex; align-items: center; gap: 8px; padding: 8px;";
        div.innerHTML = `
            <input type="checkbox" class="deck-checkbox" value="${deck.id}" ${checked} style="width: 18px; height: 18px;">
            <span style="font-size: 13px; font-weight: 600; color: var(--text);">${escapeHtml(deck.name)} (${count})</span>
        `;
        container.appendChild(div);
    });
}

function startMultiDeckSession() {
    const checkedBoxes = document.querySelectorAll("#multiDeckList .deck-checkbox:checked");
    const selectedIds = Array.from(checkedBoxes).map(cb => cb.value);
    
    if (selectedIds.length === 0) {
        showToast("Lütfen en az bir deste seçin!", "var(--red)");
        return;
    }

    appData.multiDeckIds = selectedIds;
    activeDeckId = "multi";
    save();
    closeModal("multiDeckModal");
    renderSidebar();
    selectDeck("multi");
    showToast("Çoklu deste oturumu başlatıldı!", "var(--green)");
}

// POPULATE DECK SELECTOR FOR AI STORIES
function populateStoryDeckSelector() {
    const container = document.getElementById("storyDeckSelectorZone");
    container.innerHTML = "";
    appData.decks.forEach(deck => {
        const div = document.createElement("div");
        div.style.cssText = "display: flex; align-items: center; gap: 8px; padding: 4px;";
        div.innerHTML = `
            <input type="checkbox" class="story-deck-checkbox" value="${deck.id}" style="width: 16px; height: 16px;">
            <span style="font-size: 12px; color: var(--text);">${escapeHtml(deck.name)}</span>
        `;
        container.appendChild(div);
    });
}

// Refactored card selection and display logic
function setActionButtonsState(enabled) {
    ['btnAgain','btnHard','btnGood','btnEasy','undoBtn'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.disabled = !enabled;
    });
}

function getDueCards(cards) {
    const now = Date.now();
    // nextReview yoksa veya geçmişse göster
    return cards
        .filter(c => !c.nextReview || c.nextReview <= now)
        .sort((a, b) => getCardPriority(b) - getCardPriority(a));
}

function getCardPriority(card) {
    const wrong = card.wrong || 0;
    const reps = card.repetitions || 0;
    const overdueHours = card.nextReview ? Math.max(0, (Date.now() - card.nextReview) / 36e5) : 12;
    const isNew = reps === 0 && wrong === 0 ? 1 : 0;
    return wrong * 6 + overdueHours * 0.35 + isNew * 2 - reps * 0.25;
}

function formatNextReview(card) {
    if (!card || !card.nextReview || card.nextReview <= Date.now()) return "Bugün";
    const days = Math.ceil((card.nextReview - Date.now()) / (24 * 60 * 60 * 1000));
    if (days <= 1) return "Yarın";
    return `${days} gün sonra`;
}

function getDeckCards(deckId) {
    if (deckId === "all") {
        return appData.cards;
    }
    if (deckId === "multi") {
        return appData.cards.filter(c => appData.multiDeckIds.includes(c.deckId));
    }
    return appData.cards.filter(c => c.deckId === deckId);
}

function initializeStudySession(deckId) {
    activeDeckId = deckId;
    let allCardsInScope = getDeckCards(deckId);
    let dueCards = getDueCards(allCardsInScope);
    
    currentFilteredCards = dueCards.length > 0 ? dueCards : allCardsInScope;
    currentCardIndex = 0; // Always start from the beginning of the filtered list
    
    // Shuffle the cards for a fresh session (Fisher-Yates)
    currentFilteredCards = shuffleArray(currentFilteredCards);

    selectCardForDisplay();
}

function selectCardForDisplay() {
    if (currentFilteredCards.length > 0) {
        // Ensure index is within bounds
        if (currentCardIndex >= currentFilteredCards.length) currentCardIndex = 0;
        if (currentCardIndex < 0) currentCardIndex = currentFilteredCards.length - 1;

        currentCard = currentFilteredCards[currentCardIndex];
        renderCurrentCardMode();
        setActionButtonsState(true);
    } else {
        currentCard = null;
        document.getElementById("cardFrontWord").textContent = "Kart Yok";
        document.getElementById("cardBackMeaning").textContent = "Lütfen Bu Desteye Kart Ekleyin";
        document.getElementById("cardBackSentence").textContent = "Örnek cümle bulunmuyor.";
        setCardStory("", "");
        const storyBtn = document.getElementById("generateCardStoryBtn");
        if (storyBtn) storyBtn.disabled = true;
        setActionButtonsState(false);
    }
    updateProgress();
    updateAmbientGlow();
}

function moveToNextCard(lastCardId) {
    if (!currentFilteredCards || currentFilteredCards.length === 0) return;
    
    currentCardIndex++;
    // Eğer son karta ulaşıldıysa desteyi yenile veya başa dön
    if (currentCardIndex >= currentFilteredCards.length) {
        currentCardIndex = 0;
        initializeStudySession(activeDeckId);
    } else {
        selectCardForDisplay();
    }
}

function updateAmbientGlow() {
    const ambientGlow = document.getElementById("ambientGlow");
    if (ambientGlow) {
        const activeDeck = appData.decks.find(d => d.id === activeDeckId);
        ambientGlow.style.background = activeDeck ? activeDeck.color : "var(--orange)";
    }
}

/**
 * CORE STUDY FLOW MECHANICS
 * Modified to include index management and prevent transition bugs.
 */
function selectDeck(deckId, resetIndex = true) {
    let allFiltered = getDeckCards(deckId);
    
    if (resetIndex) {
        currentCardIndex = 0;
        activeDeckId = deckId;
    } else if (activeDeckId !== deckId) {
        activeDeckId = deckId;
    }

    // Update Ambient Glow
    const ambientGlow = document.getElementById("ambientGlow");
    if (ambientGlow) {
        const activeDeck = appData.decks.find(d => d.id === deckId);
        ambientGlow.style.background = activeDeck ? activeDeck.color : "var(--orange)";
    }

    // Filter cards: Due cards first, then fallback to all cards
    currentFilteredCards = getDueCards(allFiltered);
    if (currentFilteredCards.length === 0) currentFilteredCards = allFiltered;

    if (currentFilteredCards.length > 0) {
        // Index Safety Check (Adım 1: İndeks Sınır Yönetimi)
        if (currentCardIndex >= currentFilteredCards.length) currentCardIndex = 0;
        if (currentCardIndex < 0) currentCardIndex = currentFilteredCards.length - 1;

        currentCard = currentFilteredCards[currentCardIndex];
        renderCurrentCardMode();
        setActionButtonsState(true);
    } else {
        currentCard = null;
        document.getElementById("cardFrontWord").textContent = "Kart Yok";
        document.getElementById("cardBackMeaning").textContent = "Lütfen Bu Desteye Kart Ekleyin";
        document.getElementById("cardBackSentence").textContent = "Örnek cümle bulunmuyor.";
        setCardStory("", "");
        const storyBtn = document.getElementById("generateCardStoryBtn");
        if (storyBtn) storyBtn.disabled = true;
        setActionButtonsState(false);
    }
    updateProgress();
}

function renderCurrentCardMode() {
    if (!currentCard) return;
    const cardEl = document.getElementById("mainCard");
    cardEl.classList.remove("flipped");

    // Render token: eski 300ms zamanlayıcılarının yeni karta yazmasını engeller
    const token = ++renderToken;
    const cardId = currentCard.id;

    // Yönü belirle
    let dir = studyDirection;
    if (dir === "random") dir = Math.random() > 0.5 ? "NL2TR" : "TR2NL";
    const isReversed = (dir === "TR2NL");

    // Ön yüz: NL2TR → Hollandaca, TR2NL → Türkçe
    const frontText  = isReversed ? currentCard.meaning : currentCard.word;
    const backText   = isReversed ? currentCard.word    : currentCard.meaning;
    const frontLang  = isReversed ? "TR" : "NL";
    const backLang   = isReversed ? "NL" : "TR";
    const frontTTS   = isReversed ? "tr-TR" : "nl-NL";
    const backTTS    = isReversed ? "nl-NL" : "tr-TR";

    setTimeout(() => {
        if (token !== renderToken || !currentCard || currentCard.id !== cardId) return;
        document.getElementById("cardDeckBadge").textContent = appData.decks.find(d => d.id === currentCard.deckId)?.name || "Genel";
        document.getElementById("cardLevelBadge").textContent = currentCard.level || inferLevel(currentCard);
        document.getElementById("cardNextBadge").textContent = formatNextReview(currentCard);
        document.getElementById("cardFrontWord").textContent = frontText;
        document.getElementById("cardBackMeaning").textContent = backText;
        document.getElementById("cardBackSentence").textContent = currentCard.sentence || "Örnek cümle bulunmuyor.";
        document.getElementById("cardUsageContext").textContent = currentCard.context || inferUsageContext(currentCard);
        document.getElementById("cardRegister").textContent = currentCard.register || inferRegister(currentCard);
        document.getElementById("cardArticleInfo").textContent = currentCard.article || inferArticle(currentCard.word) || "Gerekmez";
        setCardStory(currentCard.story || "", currentCard.storyTranslation || "");
        
        // Zengin İçerik (Fiil Çekimi & Zıt Anlam) Kontrolü
        enrichCardMetadata(currentCard);
        updateMasteryBars();

        const mnemonicBox = document.getElementById("cardMnemonic");
        if (mnemonicBox) { mnemonicBox.textContent = currentCard.mnemonic || ""; mnemonicBox.style.display = currentCard.mnemonic ? "block" : "none"; }
        
        // Doğruluk oranı
        const totalAns = (currentCard.repetitions || 0) + (currentCard.wrong || 0);
        const accuracy = totalAns > 0 ? Math.round((1 - (currentCard.wrong || 0) / totalAns) * 100) : null;
        const accBadge = document.getElementById("cardAccuracyBadge");
        if (accBadge) {
            accBadge.textContent = accuracy !== null
                ? `Doğruluk: %${accuracy} · ${totalAns} tekrar · sıradaki: ${formatNextReview(currentCard)}`
                : "Henüz çalışılmadı";
            accBadge.style.color = accuracy === null ? "var(--subtle)" : accuracy >= 80 ? "var(--green)" : accuracy >= 50 ? "var(--orange)" : "var(--red)";
        }
        document.getElementById("frontTTSBtn").textContent = `Telaffuz (${frontLang})`;
        document.getElementById("frontTTSBtn").onclick = (e) => { e.stopPropagation(); speakTts(frontText, frontTTS); };
        document.getElementById("backTTSBtn").textContent = `Oku (${backLang})`;
        document.getElementById("backTTSBtn").onclick = (e) => { e.stopPropagation(); speakTts(backText, backTTS); };
        const storyBtn = document.getElementById("generateCardStoryBtn");
        if (storyBtn) {
            storyBtn.onclick = (e) => { e.stopPropagation(); generateStoryForCurrentCard(); };
        }

        const testArea = document.getElementById("testArea");
        testArea.innerHTML = "";

        if (activeMode === "typing") {
            // Yazarak öğrenme: ön yüzde sorulan şeyin cevabını yaz
            const inp = document.createElement("input");
            inp.type = "text";
            inp.className = "type-input";
            inp.placeholder = `${backLang} karşılığını yazın...`;
            inp.autocomplete = "off";
            inp.autocorrect = "off";
            inp.autocapitalize = "off";
            inp.spellcheck = false;
            const hint = document.createElement("div");
            hint.className = "type-hint";
            hint.textContent = `${backText.length} karakter`;
            const checkBtn = document.createElement("button");
            checkBtn.className = "btn-primary";
            checkBtn.style.cssText = "margin-top:8px; width:100%; max-width:340px;";
            checkBtn.textContent = "Kontrol Et ↵";
            const checkTyping = () => {
                const val = inp.value.trim().toLowerCase();
                const correct = backText.trim().toLowerCase();
                if (val === correct) {
                    inp.className = "type-input correct";
                    showToast("✓ Doğru!", "var(--green)");
                    cardEl.classList.add("flipped");
                    handleAnswer("good");
                } else {
                    inp.className = "type-input wrong";
                    inp.disabled = true;
                    checkBtn.disabled = true;
                    hint.textContent = `Doğru cevap: ${backText}`;
                    hint.style.color = "var(--red)";
                    showToast("✗ Yanlış!", "var(--red)");
                    setTimeout(() => handleAnswer("again"), 1200);
                }
            };
            checkBtn.onclick = (e) => { e.stopPropagation(); checkTyping(); };
            inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); checkTyping(); } });
            const wrap = document.createElement("div");
            wrap.className = "type-input-area";
            wrap.appendChild(inp);
            wrap.appendChild(hint);
            wrap.appendChild(checkBtn);
            testArea.appendChild(wrap);
            setTimeout(() => inp.focus(), 50);
        } else if (activeMode === "hint") {
            // 1. Gelişmiş Harf İpucu (Hint) Modülü
            let revealed = 0;
            const targetWord = backText;
            
            const hintDisplay = document.createElement("div");
            hintDisplay.style.cssText = "font-size: 20px; font-family: 'Space Mono', monospace; letter-spacing: 2px; margin: 10px 0; min-height: 30px; color: var(--orange);";
            
            const updateHintDisplay = () => {
                let displayStr = "";
                for (let i = 0; i < targetWord.length; i++) {
                    const char = targetWord[i];
                    if (char === " ") {
                        displayStr += "  ";
                    } else if (i < revealed) {
                        displayStr += char;
                    } else {
                        displayStr += "_";
                    }
                }
                hintDisplay.textContent = displayStr;
            };
            
            const hintBtn = document.createElement("button");
            hintBtn.className = "btn-secondary";
            hintBtn.style.cssText = "font-size: 11px; padding: 6px 12px; margin-top: 5px;";
            hintBtn.textContent = "💡 Harf İste";
            hintBtn.onclick = (e) => {
                e.stopPropagation();
                if (revealed < targetWord.length) {
                    revealed++;
                    updateHintDisplay();
                }
                if (revealed >= targetWord.length) {
                    hintBtn.disabled = true;
                    cardEl.classList.add("flipped");
                }
            };
            
            updateHintDisplay();
            const wrap = document.createElement("div");
            wrap.className = "type-input-area";
            wrap.appendChild(hintDisplay);
            wrap.appendChild(hintBtn);
            testArea.appendChild(wrap);
        } else if (activeMode === "mcq") {
            // Çoktan Seçmeli (MCQ) Modu - Kullanıcı Önerisiyle Güncellendi
            const mcqGrid = document.createElement("div");
            mcqGrid.style.cssText = "display: grid; grid-template-columns: 1fr; gap: 8px; width: 100%; max-width: 340px; margin: 10px auto 0;";
            
            let pool = appData.cards.filter(c => c.id !== currentCard.id).map(c => isReversed ? (c.word || "") : (c.meaning || ""));
            pool = [...new Set(pool)];
            pool = shuffleArray(pool);
            let choices = pool.slice(0, 3);
            choices.push(backText);
            choices = shuffleArray(choices);
            
            choices.forEach(choice => {
                const btn = document.createElement("button");
                btn.className = "btn-secondary";
                btn.style.cssText = "text-align: left; padding: 10px 14px; font-size: 13px; font-weight: 600; width: 100%;";
                btn.textContent = choice;
                btn.onclick = (e) => {
                    e.stopPropagation();
                    if (choice === backText) {
                        showToast("✓ Doğru Seçenek!", "var(--green)");
                        cardEl.classList.add("flipped");
                        handleAnswer("good");
                    } else {
                        btn.style.borderColor = "var(--red)";
                        btn.style.background = "rgba(239,68,68,0.05)";
                        mcqGrid.querySelectorAll("button").forEach(b => b.disabled = true);
                        const correctBtn = Array.from(mcqGrid.children).find(b => b.textContent === backText);
                        if (correctBtn) {
                            correctBtn.style.borderColor = "var(--green)";
                            correctBtn.style.background = "rgba(34,197,94,0.1)";
                        }
                        showToast("✗ Yanlış! Doğru seçenek yeşil işaretlendi.", "var(--red)");
                        setTimeout(() => handleAnswer("again"), 1200);
                    }
                };
                mcqGrid.appendChild(btn);
            });
            testArea.appendChild(mcqGrid);
        } else if (activeMode === "verbdrill") {
            let conj = currentCard.aiConj || null;
            if (!conj && currentCard.modalConjugation) {
                const parts = currentCard.modalConjugation.split(",").map(s => s.trim());
                conj = { ik: parts[0] || "", jij: parts[1] || "", wij: parts[2] || "" };
            }
            if (!conj) {
                const p = document.createElement("p");
                p.style.color = "var(--subtle)";
                p.textContent = "Bu kart için çekim bilgisi yok.";
                testArea.appendChild(p);
            } else {
                const grid = document.createElement("div");
                grid.className = "verb-drill-grid";
                const inputs = [];
                [["ik", conj.ik], ["jij", conj.jij], ["wij", conj.wij]].forEach(([person, form]) => {
                    const row = document.createElement("div");
                    row.className = "verb-drill-row";
                    const span = document.createElement("span");
                    span.className = "verb-person";
                    span.textContent = person;
                    const inp = document.createElement("input");
                    inp.type = "text";
                    inp.className = "verb-input";
                    inp.id = "v" + (inputs.length + 1);
                    inp.placeholder = form || "";
                    row.append(span, inp);
                    grid.appendChild(row);
                    inputs.push(inp);
                });
                testArea.appendChild(grid);
                const checkBtn = document.createElement("button");
                checkBtn.className = "btn-primary";
                checkBtn.style.cssText = "width:100%; margin-top:8px;";
                checkBtn.textContent = "Kontrol Et";
                checkBtn.onclick = (e) => { e.stopPropagation(); checkVerbDrill(); };
                testArea.appendChild(checkBtn);
            }
        } else if (activeMode === "grammarfill") {
            const article = currentCard.article || "unknown";
            const grammarWrap = document.createElement("div");
            grammarWrap.className = "grammar-options";
            [["de", article], ["het", article]].forEach(([chosen, correct]) => {
                const gBtn = document.createElement("button");
                gBtn.className = "grammar-opt-btn";
                gBtn.textContent = chosen;
                gBtn.onclick = (e) => { e.stopPropagation(); checkGrammarFill(chosen, correct, e); };
                grammarWrap.appendChild(gBtn);
            });
            testArea.appendChild(grammarWrap);
        } else if (activeMode === "woordvolgorde") {
            buildSentencePuzzle(currentCard.sentence);
        }
    }, 300); // Kılavuz 4.3: Gecikme 460ms -> 300ms
}

async function enrichCardMetadata(card) {
    if (!card.enriched && window.runGroqAi) {
        const prompt = `"${card.word}" kelimesini Hollandaca dilbilgisi kurallarına göre analiz et.
        Kesin Kurallar:
        1. "type" alanı sadece "fiil", "isim", "sıfat", "zarf", "edat" veya "diğer" olabilir.
        2. "isVerb" sadece kelime bir eylem/fiil ise true; aksi halde false olmalı.
        3. "conj" yalnızca "isVerb" true ise (ik, jij, wij, past, perfect) içermeli. Fiil değilse null olmalı.
        4. "article" yalnızca isimler için "de" veya "het" olmalı; diğer durumlarda null.
        5. "plural" yalnızca isimler için çoğul hâlini içermeli; diğer durumlarda null.
        6. "antonym" varsa tek bir karşıt anlam kelimesi olsun; yoksa null.
        Sadece geçerli JSON döndür. Başka hiçbir açıklama veya ek metin ekleme.
        JSON formatı:
        {"type":"...", "isVerb":true|false, "conj":{"ik":"...","jij":"...","wij":"...","past":"...","perfect":"..."}|null, "plural":"..."|null, "antonym":"..."|null, "article":"de"|"het"|null}`;
        
        try {
            const res = await runGroqAi(prompt, null, 0.0);
            const rawData = parseAiJson(res);
            const data = validateWordAnalysis(rawData, card.word);
            card.aiConj = data.isVerb ? data.conj : null;
            card.antonym = data.antonym || null;
            card.wordType = data.type || null;
            card.plural = data.plural || null;
            card.article = data.article;
            card.enriched = true;
            save();
        } catch (e) {
            console.error("Enrichment error", e);
            const fallback = getFallbackWordAnalysis(card.word, card.meaning);
            card.aiConj = fallback.isVerb ? fallback.conj : null;
            card.antonym = fallback.antonym;
            card.wordType = fallback.type;
            card.plural = fallback.plural;
            card.article = fallback.article;
            card.enriched = true;
            save();
        }
    }
}

function checkMcq(opt, correct, btn) {
    if (opt === correct) {
        btn.style.background = "var(--green)"; btn.style.color = "white";
        showToast("✓ Doğru!", "var(--green)");
        setTimeout(() => { document.getElementById("mainCard").classList.add("flipped"); handleAnswer("good"); }, 500);
    } else {
        btn.style.background = "var(--red)"; btn.style.color = "white";
        showToast("✗ Yanlış!", "var(--red)");
    }
}

// 3. PUZZLE MODE (WORDVOLGORDE) - Gelişmiş ve Güvenli Versiyon
function buildSentencePuzzle(sentence) {
    const testArea = document.getElementById("testArea");
    testArea.innerHTML = `
        <div id="puzzleInputZone" class="woordvolgorde-zone" style="min-height: 52px; border: 2px dashed var(--orange); margin-bottom: 10px;"></div>
        <div id="puzzleArea" class="woordvolgorde-zone" style="min-height: 52px; border: 1px solid var(--border);"></div>
        <button class="btn-primary" style="width:100%; margin-top:12px;" onclick="checkPuzzleAnswer()">Kontrol Et ↵</button>
    `;
    
    const puzzleArea = document.getElementById("puzzleArea");
    const inputZone = document.getElementById("puzzleInputZone");
    
    if(!sentence) {
        puzzleArea.innerHTML = "<p style='color:var(--subtle); font-size:12px;'>Bu kart için örnek cümle bulunamadı.</p>";
        return;
    }
    
    let words = sentence.trim().split(/\s+/);
    let shuffled = [...words];
    
    // Güvenli karıştırma: Tek kelimelik cümlelerde sonsuz döngüyü engeller
    if (words.length > 1) {
        let attempts = 0;
        while(shuffled.join(" ") === sentence.trim() && attempts < 12) {
            shuffled.sort(() => Math.random() - 0.5);
            attempts++;
        }
    }
    
    shuffled.forEach(w => {
        let btn = document.createElement("span");
        btn.className = "wv-word";
        btn.textContent = w;
        btn.onclick = (e) => {
            e.stopPropagation();
            if (btn.parentElement === puzzleArea) {
                inputZone.appendChild(btn);
            } else {
                puzzleArea.appendChild(btn);
            }
        };
        puzzleArea.appendChild(btn);
    });
}

function checkPuzzleAnswer() {
    if(!currentCard) return;
    let zone = document.getElementById("puzzleInputZone");
    let userAns = Array.from(zone.querySelectorAll(".wv-word")).map(b => b.textContent).join(" ");
    let target = currentCard.sentence ? currentCard.sentence.trim() : "";
    
    if(normalizeForComparison(userAns) === normalizeForComparison(target)) {
        showToast("Mükemmel! Cümle dizilimi doğru.", "var(--green)");
        triggerConfetti();
        speakTts(target, "nl-NL"); // Bilişsel Nörobilimci Tavsiyesi: İşitsel Pekiştirme
        document.getElementById("mainCard").classList.add("flipped");
        handleAnswer("good");
    } else {
        showToast("Hatalı dizilim! Doğru sıralama gösteriliyor.", "var(--red)");
        document.querySelectorAll("#testArea .wv-word").forEach(b => b.classList.add("wv-disabled"));
        const correctLine = document.createElement("div");
        correctLine.className = "puzzle-correct";
        correctLine.textContent = target;
        zone.parentElement.appendChild(correctLine);
        setTimeout(() => handleAnswer("again"), 1500);
    }
}

function checkVerbDrill(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!currentCard) return;
    let conj = currentCard.aiConj || null;
    if (!conj && currentCard.modalConjugation) {
        const parts = currentCard.modalConjugation.split(",").map(s => s.trim());
        conj = { ik: parts[0] || "", jij: parts[1] || "", wij: parts[2] || "" };
    }
    if (!conj) {
        showToast("Bu kart için çekim bilgisi yok.", "var(--orange)");
        return;
    }
    const u1 = (document.getElementById("v1")?.value || "").trim();
    const u2 = (document.getElementById("v2")?.value || "").trim();
    const u3 = (document.getElementById("v3")?.value || "").trim();
    const norm = (s) => normalizeForComparison(s);
    const c1 = norm(u1) === norm(conj.ik);
    const c2 = norm(u2) === norm(conj.jij);
    const c3 = norm(u3) === norm(conj.wij);

    if (document.getElementById("v1")) document.getElementById("v1").className = `verb-input ${c1 ? 'correct' : 'wrong'}`;
    if (document.getElementById("v2")) document.getElementById("v2").className = `verb-input ${c2 ? 'correct' : 'wrong'}`;
    if (document.getElementById("v3")) document.getElementById("v3").className = `verb-input ${c3 ? 'correct' : 'wrong'}`;

    if (c1 && c2 && c3) {
        showToast("Tüm çekimler doğru!", "var(--green)");
        document.getElementById("mainCard").classList.add("flipped");
        handleAnswer("good");
    } else {
        showToast("Bazı çekimler hatalı, tekrar deneyin.", "var(--red)");
    }
}

function checkGrammarFill(chosen, correctArticle, e) {
    e.stopPropagation();
    if (correctArticle === "unknown") {
        showToast("Bu kart için artikel bilgisi yok, lütfen önce zenginleştirin.", "var(--orange)");
        return;
    }
    if (chosen === correctArticle) {
        showToast("Harika! Doğru artikel.", "var(--green)");
        document.getElementById("mainCard").classList.add("flipped");
        handleAnswer("good");
    } else {
        showToast(`Yanlış! Doğrusu "${correctArticle}" idi.`, "var(--red)");
        handleAnswer("again");
    }
}

function handleAnswer(rating) {
    if (!currentCard) return;

    // Geri al (Undo) için tam durum yedeği al
    sessionHistory.push({
        cardId: currentCard.id,
        cardState: JSON.parse(JSON.stringify(currentCard)),
        statsState: JSON.parse(JSON.stringify(appData.stats)),
        currentCardIndex,
        activeDeckId
    });
    if (sessionHistory.length > 15) sessionHistory.shift();
    const answeredCardId = currentCard.id;

    // ---- SM-2 ALGORİTMASI (Uzman Raporu 3.2-1 & Dilbilimci Elif Taş Düzeltmesi) ----
    if (!currentCard.interval) currentCard.interval = 0;
    if (!currentCard.ease) currentCard.ease = 2.5;
    if (!currentCard.repetitions) currentCard.repetitions = 0;
    if (!currentCard.wrong) currentCard.wrong = 0;

    const qScore = { again: 0, hard: 2, good: 4, easy: 5 }[rating];

    if (qScore === 0) {
        // Sadece 'Again' cevabı süreci tamamen sıfırlar
        currentCard.interval = 0;
        currentCard.repetitions = 0;
        currentCard.wrong++;
        appData.stats.totalErrors = (appData.stats.totalErrors || 0) + 1;
    } else if (qScore === 2) {
        // 'Hard' cevabı: Hatırlanan ama zorlanılan kart. Interval çarpanı düşük tutulur.
        currentCard.interval = Math.max(1, Math.round((currentCard.interval || 0) * 1.2));
        currentCard.repetitions++;
    } else {
        if (currentCard.repetitions === 0) currentCard.interval = 1;
        else if (currentCard.repetitions === 1) currentCard.interval = 6;
        else currentCard.interval = Math.round(currentCard.interval * currentCard.ease);
        currentCard.repetitions++;
    }

    // EF güncelle: EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
    currentCard.ease = currentCard.ease + (0.1 - (5 - qScore) * (0.08 + (5 - qScore) * 0.02));
    if (currentCard.ease < 1.3) currentCard.ease = 1.3;

    // Bir Sonraki İnceleme Zamanı
    currentCard.nextReview = Date.now() + currentCard.interval * 24 * 60 * 60 * 1000;
    // ----------------------------------

    // Seri hesaplama (yerel tarih tabanlı - UTC kayması düzeltildi)
    const today = new Date().toDateString();
    const todayStr = getLocalDateStr();
    if (appData.stats.lastStudyDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        appData.stats.streak = appData.stats.lastStudyDate === yesterday.toDateString()
            ? (appData.stats.streak || 0) + 1 : 1;
        appData.stats.lastStudyDate = today;
        updateGlobalStreak();
    }

    if (appData.stats.todayDate !== todayStr) {
        appData.stats.todayDate = todayStr;
        appData.stats.todayReps = 0;
    }
    appData.stats.todayReps = (appData.stats.todayReps || 0) + 1;
    appData.stats.totalRepetitions = (appData.stats.totalRepetitions || 0) + 1;

    // Haftalık veri: {dateStr: count}
    if (!appData.stats.weeklyData) appData.stats.weeklyData = {};
    appData.stats.weeklyData[todayStr] = (appData.stats.weeklyData[todayStr] || 0) + 1;

    // Günlük hedefe ulaşıldıysa kutla
    const goal = appData.stats.dailyGoal || 10;
    if (appData.stats.todayReps === goal) {
        showToast(`🎉 Günlük hedefinize ulaştınız! ${goal} kart!`, "var(--green)");
        triggerConfetti();
    }

    save();
    showToast(`${rating === "again" ? "↩ Tekrar" : rating === "hard" ? "😅 Zor" : rating === "good" ? "✓ İyi" : "⚡ Kolay"}`, 
              rating === "again" ? "var(--red)" : rating === "hard" ? "var(--orange)" : rating === "good" ? "var(--green)" : "var(--blue)");
    
    // Başarı kontrolü (Gamification)
    checkAchievements();
    
    // Proceed to next card (Adım 2: Sonraki Buton Mantığı)
    setTimeout(() => {
        moveToNextCard(answeredCardId);
    }, 150);
}

function checkAchievements() {
    if (!Array.isArray(appData.achievements) || appData.achievements.length === 0) {
        appData.achievements = [
            { id: 0, name: "İlk Adım", earned: false },
            { id: 1, name: "İstikrarlı Öğrenci", earned: false }
        ];
    }
    const reps = appData.stats.totalRepetitions || 0;
    if (reps === 10 && !appData.achievements[0].earned) {
        appData.achievements[0].earned = true;
        showToast("🏆 Başarı Açıldı: İlk Adım!", "var(--purple)");
        triggerConfetti();
    }
    if ((appData.stats.streak || 0) >= 5 && !appData.achievements[1].earned) {
        appData.achievements[1].earned = true;
        showToast("🔥 Başarı Açıldı: İstikrarlı Öğrenci!", "var(--orange)");
        triggerConfetti();
    }
}

function triggerUndo() {
    if (sessionHistory.length === 0) {
        showToast("Geri alınacak hamle yok!", "var(--orange)");
        return;
    }
    const previous = sessionHistory.pop();
    const cardIdx = appData.cards.findIndex(c => c.id === previous.cardId);
    if (cardIdx !== -1) {
        appData.cards[cardIdx] = previous.cardState;
        if (previous.statsState) appData.stats = previous.statsState;
        currentCardIndex = previous.currentCardIndex || 0;
        activeDeckId = previous.activeDeckId || activeDeckId;
        save();
        selectDeck(activeDeckId, false);
        showToast("Son hamle geri alındı ↩", "var(--purple)");
    }
}

// TEXT TO SPEECH SERVICE - Safari uyumlu
function speakTts(text, lang) {
    if (!('speechSynthesis' in window)) {
        showToast("TTS tarayıcınızda desteklenmiyor.", "var(--red)");
        return;
    }
    // Safari'de önceki konuşmayı durdur
    window.speechSynthesis.cancel();
    activeUtterance = new SpeechSynthesisUtterance(text);
    activeUtterance.lang = lang;
    activeUtterance.rate = 0.9;
    // Safari'de ses listesi gecikmeli yüklenir
    const trySpeak = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
            const preferred = voices.find(v => v.lang && v.lang.startsWith(lang.split('-')[0]));
            if (preferred) activeUtterance.voice = preferred;
        }
        window.speechSynthesis.speak(activeUtterance);
    };
    if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = trySpeak;
    } else {
        trySpeak();
    }
}

function cleanAiJson(raw) {
    if (!raw) throw new Error("AI yanıtı boş geldi.");
    const text = String(raw).replace(/```json|```/gi, "").trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
        throw new Error("AI yanıtında JSON bulunamadı.");
    }
    return text.slice(start, end + 1);
}

function parseAiJson(raw) {
    return JSON.parse(cleanAiJson(raw));
}

function normalizeAiString(value) {
    return value ? String(value).trim().toLowerCase() : "";
}

function isValidWordType(type) {
    return ["fiil", "isim", "sıfat", "zarf", "edat", "diğer"].includes(normalizeAiString(type));
}

function isValidArticle(article) {
    return ["de", "het"].includes(normalizeAiString(article));
}

function normalizeWordAnalysis(data) {
    const normalized = {
        type: isValidWordType(data.type) ? normalizeAiString(data.type) : "diğer",
        isVerb: data.isVerb === true || String(data.isVerb).toLowerCase() === "true",
        conj: null,
        plural: data.plural || null,
        antonym: data.antonym || null,
        article: isValidArticle(data.article) ? normalizeAiString(data.article) : null
    };

    if (normalized.isVerb) {
        if (data.conj && typeof data.conj === "object") {
            normalized.conj = {
                ik: data.conj.ik || "",
                jij: data.conj.jij || "",
                wij: data.conj.wij || "",
                past: data.conj.past || null,
                perfect: data.conj.perfect || null
            };
        } else {
            normalized.conj = { ik: "", jij: "", wij: "", past: null, perfect: null };
        }
    }

    if (!normalized.isVerb) {
        normalized.conj = null;
        normalized.plural = normalized.plural || null;
    }

    return normalized;
}

function validateWordAnalysis(data, word) {
    const result = normalizeWordAnalysis(data || {});
    if (!result.type || (result.isVerb && result.type !== "fiil")) {
        result.type = result.isVerb ? "fiil" : result.type || "diğer";
    }
    if (result.isVerb && result.conj && !result.conj.ik && !result.conj.jij && !result.conj.wij) {
        result.conj = { ik: "", jij: "", wij: "", past: null, perfect: null };
    }
    return result;
}

function getFallbackWordAnalysis(word, meaning) {
    const cleanWord = normalizeAiString(word);
    const fallback = {
        type: "diğer",
        isVerb: false,
        conj: null,
        plural: null,
        antonym: null,
        article: null
    };

    if (/en$/.test(cleanWord) && cleanWord.length > 3) {
        fallback.type = "fiil";
        fallback.isVerb = true;
        fallback.conj = { ik: cleanWord, jij: `${cleanWord}s`, wij: cleanWord, past: null, perfect: null };
    } else if (/^(de|het)\s+/i.test(meaning) || /^(de|het)\b/i.test(meaning)) {
        fallback.type = "isim";
        fallback.article = normalizeAiString(meaning.split(" ")[0]);
    }

    return fallback;
}

function setCardStory(story, translation) {
    const storyBox = document.getElementById("cardBackStory");
    const storyText = document.getElementById("cardBackStoryText");
    const storyTranslation = document.getElementById("cardBackStoryTranslation");
    if (!storyBox || !storyText || !storyTranslation) return;

    if (story || translation) {
        storyText.textContent = story || "";
        storyTranslation.textContent = translation || "";
        storyTranslation.style.display = translation ? "block" : "none";
        storyBox.style.display = "block";
    } else {
        storyText.textContent = "";
        storyTranslation.textContent = "";
        storyBox.style.display = "none";
    }
}

async function generateStoryForCurrentCard() {
    if (!currentCard) return;
    const btn = document.getElementById("generateCardStoryBtn");
    if (btn) {
        btn.disabled = true;
        btn.textContent = "✨ Üretiliyor...";
    }

    const prompt = `"${currentCard.word}" kelimesi için A1-A2 seviyesinde 2 cümlelik mini hikaye üret.
    Anlam: "${currentCard.meaning}". Örnek cümle: "${currentCard.sentence || ""}".
    Kurallar: "story" sadece doğal Hollandaca olsun, "translation" sadece Türkçe çeviri olsun.
    Sadece geçerli JSON döndür: {"story":"Hollandaca mini hikaye","translation":"Türkçe çeviri"}`;

    const res = await runGroqAi(prompt);
    if (!res) {
        showToast("API Anahtarı bulunamadı.", "var(--red)");
        btn.disabled = false;
        return;
    }
    try {
        const data = parseAiJson(res);
        currentCard.story = data.story || "";
        currentCard.storyTranslation = data.translation || "";
        setCardStory(currentCard.story, currentCard.storyTranslation);
        save();
        showToast("Mini hikaye karta eklendi.", "var(--green)");
    } catch (e) {
        showToast("Mini hikaye üretilemedi.", "var(--red)");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = "✨ Mini Hikaye Üret";
        }
    }
}

// FULL MODULE ACTIONS IMPLEMENTATIONS
async function handleStoryAi() {
    let level = document.getElementById("storyLevel").value;
    let theme = document.getElementById("storyTheme").value;
    setMascot("storyMascot", "thinking");
    let outBox = document.getElementById("storyOutput");
    outBox.style.display = "block";
    showSkeleton("storyTextContainer");

    // Çoklu destede seçili olan destelerin kelimelerini çekelim
    const checkedStoryDecks = document.querySelectorAll(".story-deck-checkbox:checked");
    const selectedStoryDeckIds = Array.from(checkedStoryDecks).map(cb => cb.value);
    
    let storyPool = appData.cards;
    if (selectedStoryDeckIds.length > 0) {
        storyPool = appData.cards.filter(c => selectedStoryDeckIds.includes(c.deckId));
    }

    if (storyPool.length === 0) {
        showToast("Seçili destelerde kullanılacak kart bulunamadı!", "var(--red)");
        document.getElementById("storyTextContainer").textContent = "Lütfen önce kart ekleyin veya farklı bir deste seçin.";
        return;
    }

    const selectedWords = storyPool.slice(0, 8).map(c => c.word).join(", ");
    
    let prompt = `Seviye: ${level}. Tema: ${theme ? theme : 'Günlük Yaşam'}.
    Şu kelimeleri doğal Hollandaca bir hikaye içinde kullan: ${selectedWords}.
    Kurallar:
    - "story" alanı sadece doğal Hollandaca olsun; Türkçe kelime kullanma.
    - "translation" alanı sadece Türkçe çeviri olsun.
    - Hikaye kısa, mantıklı ve ${level} seviyesine uygun olsun.
    - Kullanılan hedef kelimeleri **kelime** biçiminde işaretle.
    Sadece geçerli JSON döndür:
    {"story":"Hollandaca hikaye metni","translation":"Türkçe çeviri"}`;
    
    let res = await runGroqAi(prompt);
    try {
        let data = parseAiJson(res);
        setMascot("storyMascot", "happy");
        const container = document.getElementById("storyTextContainer");
        container.innerHTML = "";
        
        const storyP = document.createElement("p");
        storyP.style.cssText = "font-size:15px; line-height:1.6; margin-bottom:12px;";
        const segments = data.story.split(/(\*\*.*?\*\*)/g);
        segments.forEach(seg => {
            if (seg.startsWith("**") && seg.endsWith("**")) {
                const span = document.createElement("span");
                span.className = "story-highlight";
                span.textContent = seg.slice(2, -2);
                storyP.appendChild(span);
            } else {
                storyP.appendChild(document.createTextNode(seg));
            }
        });
        const hr = document.createElement("hr");
        hr.style.cssText = "border:0; border-top:1px dashed var(--border); margin:12px 0;";
        const transP = document.createElement("p");
        transP.style.cssText = "font-size:14px; color:var(--muted); line-height:1.6;";
        transP.textContent = data.translation;
        container.append(storyP, hr, transP);
    } catch(e) {
        console.error("Hikaye Ayrıştırma Hatası:", e);
        document.getElementById("storyTextContainer").innerHTML = `<p style="font-size:13px; color:var(--red);">Hikaye formatı çözümlenemedi. Yapay zeka yanıtı:</p><pre style="white-space:pre-wrap; font-size:12px;">${escapeHtml(res)}</pre>`;
        setMascot("storyMascot", "sad");
    }
}

// 4. SENTENCE CORRECTOR ACTION
async function handleSentenceCorrection() {
    let input = document.getElementById("correctionInput").value.trim();
    if(!input) return;
    let resBox = document.getElementById("correctionResult");
    resBox.style.display = "block";
    showSkeleton("correctionResult");
    
    let prompt = `Şu Hollandaca cümleyi analiz et, gramer hatalarını düzelt ve nedenini kısa net şekilde Türkçe açıkla: "${input}".`;
    let res = await runGroqAi(prompt);
    resBox.textContent = res || "Analiz alınamadı.";
    resBox.style.whiteSpace = "pre-wrap";
}

// 6. AI DICTIONARY & COMPOSER ACTION
async function handleAiDictionary() {
    let query = document.getElementById("aiDictQuery").value.trim();
    if(!query) return;
    let resBox = document.getElementById("aiDictResult");
    resBox.style.display = "block";
    showSkeleton("aiDictResult");
    
    let prompt = `"${query}" kelimesini analiz et. Şu bilgileri Türkçe ver: Kelime türü, De/Het artikeli, Türkçe anlamı, A1-A2 seviyesinde 2 adet örnek Hollandaca cümle ve Türkçe çevirisi.`;
    let res = await runGroqAi(prompt);
    resBox.textContent = res || "Sonuç bulunamadı.";
    resBox.style.whiteSpace = "pre-wrap";
}

// 7. LIVE AI CHAT MENTOR ACTION
async function handleLiveChat() {
    let inputEl = document.getElementById("chatInput");
    let text = inputEl.value.trim();
    if(!text) return;
    
    const addMsg = (box, txt, cls) => {
        const div = document.createElement("div");
        div.className = `chat-msg ${cls}`;
        div.textContent = txt;
        box.appendChild(div);
    };

    let msgBox = document.getElementById("chatMessages");
    addMsg(msgBox, text, "user");
    inputEl.value = "";
    msgBox.scrollTop = msgBox.scrollHeight;
    
    const personaSel = document.getElementById("chatPersona");
    let persona = personaSel.selectedOptions[0]?.textContent || personaSel.value;
    let prompt = `Senin kişiliğin: ${persona}. Kullanıcının yazdığı şu Hollandaca mesaja uygun bir cevap ver (Sadece Hollandaca konuş): "${text}"`;
    
    let res = await runGroqAi(prompt);
    addMsg(msgBox, res, "bot");
    msgBox.scrollTop = msgBox.scrollHeight;
}

async function handlePodcastAi() {
    document.getElementById("podcastOutput").style.display = "block";
    document.getElementById("podcastStatusText").textContent = "Günün yayını akıllı algoritma ile derleniyor...";
    
    // Önceki onclick bağlantısını temizle (çift tetikleme önleme)
    const playBtn = document.getElementById("playPodcastBtn");
    playBtn.onclick = null;
    playBtn.disabled = true;
    
    let prompt = `Hollandalı Sophie ve Ahmet arasında geçen kısa, 6 satırlık bir podcast diyalogu üret. Konu: gündelik Hollanda yaşamı.
    Kurallar: "text" sadece doğal Hollandaca olsun, "translation" sadece Türkçe çeviri olsun.
    Sadece geçerli JSON döndür: {"lines":[{"speaker":"Sophie","text":"Hollandaca konuşma","translation":"Türkçe çeviri"},{"speaker":"Ahmet","text":"Hollandaca konuşma","translation":"Türkçe çeviri"}]}`;
    let res = await runGroqAi(prompt);
    try {
        let data = parseAiJson(res);
        podcastLines = data.lines || [];
        document.getElementById("podcastStatusText").textContent = "Yayın Hazır! (" + podcastLines.length + " satır)";
        playBtn.disabled = false;
        playBtn.onclick = () => {
            podcastCurrentLine = 0;
            window.speechSynthesis.cancel();
            playPodcastLine();
        };
    } catch (e) {
        document.getElementById("podcastStatusText").textContent = "Bir hata oluştu, varsayılan dinleme oynatılıyor.";
        playBtn.disabled = false;
        playBtn.onclick = () => speakTts("Welkom bij LinguaPrime Podcast Station. Vandaag gaan we het hebben over de Nederlandse cultuur.", "nl-NL");
    }
}

function playPodcastLine() {
    if (podcastCurrentLine >= podcastLines.length) return;
    let current = podcastLines[podcastCurrentLine];
    showToast(`${current.speaker}: ${current.text}`, "var(--purple)");
    speakTts(current.text, "nl-NL");
    podcastCurrentLine++;
    setTimeout(playPodcastLine, 4000);
}

function initRpg() {
    rpgHistory = [];
    rpgCq = 50;
    document.getElementById("rpgMessages").innerHTML = "";
    document.getElementById("rpgCqDisplay").textContent = `Kültürel IQ: ${rpgCq}`;
    let msg = document.createElement("div");
    msg.className = "rpg-narrator";
    msg.textContent = "Albert Heijn kasasındasınız. Sıra size geldiğinde kasiyer size 'Bonnetje mee?' diye soruyor. Ne dersiniz?";
    document.getElementById("rpgMessages").appendChild(msg);
    
    // Generate actions
    const options = ["Ja, graag.", "Nee, dank u.", "Hızlıca kafamı sallayıp ayrılırım."];
    const zone = document.getElementById("rpgActionOptions");
    zone.innerHTML = "";
    options.forEach(opt => {
        let btn = document.createElement("button");
        btn.className = "mode-btn";
        btn.textContent = opt;
        btn.onclick = () => handleRpgDecision(opt);
        zone.appendChild(btn);
    });
}

async function handleRpgDecision(decision) {
    let box = document.getElementById("rpgMessages");
    let m = document.createElement("div");
    addToRpgHistory("decision", decision);
    m.className = "chat-msg user";
    m.style.alignSelf = "flex-end";
    m.textContent = decision;
    box.appendChild(m);

    let prompt = `Kullanıcı Albert Heijn kasasında kasiyere "${decision}" yanıtını verdi. Bu durumun Hollanda kültürü uyumluluk değerlendirmesini yap. Kültürel IQ puan değişimi (+10 veya -10 gibi) ve kasiyerin sonraki tepkisini içeren bir JSON döndür: {"npc": "Kasiyerin cevabı (Sadece Hollandaca)", "feedback": "Kültürel analiz geri bildirimi (Sadece Türkçe)", "cqChange": 10}`;
    let res = await runGroqAi(prompt);
    try {
        let data = parseAiJson(res);
        rpgCq += data.cqChange;
        document.getElementById("rpgCqDisplay").textContent = `Kültürel IQ: ${rpgCq}`;
        
        let fb = document.createElement("div");
        fb.className = "rpg-narrator";
        fb.textContent = data.feedback;
        box.appendChild(fb);

        let npcMsg = document.createElement("div");
        npcMsg.className = "rpg-npc";
        npcMsg.textContent = data.npc;
        box.appendChild(npcMsg);
        box.scrollTop = box.scrollHeight;
    } catch (e) {
        showToast("RPG Analiz hatası.", "var(--red)");
    }
}

function addToRpgHistory(type, content) {
    if (!window.rpgLog) window.rpgLog = [];
    window.rpgLog.push({ type, content, time: Date.now() });
}

async function handleRpgMove() {
    let txt = document.getElementById("rpgCustomInput").value.trim();
    if (!txt) return;
    document.getElementById("rpgCustomInput").value = "";
    await handleRpgDecision(txt);
}

function initWhatsApp() {
    document.getElementById("waMessages").innerHTML = "";
    waHistory = [];
    let r = document.createElement("div");
    r.className = "wa-msg them";
    r.innerHTML = `Hoi! Hoe gaat het met je studie? 👍<div class="wa-time">10:00</div>`;
    document.getElementById("waMessages").appendChild(r);
}

async function handleWhatsAppMessage() {
    let box = document.getElementById("waMessages");
    let inp = document.getElementById("waInput");
    let txt = inp.value.trim();
    if(!txt) return;
    
    let m = document.createElement("div");
    m.className = "wa-msg me";
    const txtSpan = document.createElement("span");
    txtSpan.textContent = txt;
    m.appendChild(txtSpan);
    m.innerHTML += `<div class="wa-time">10:01</div>`;
    box.appendChild(m);
    box.scrollTop = box.scrollHeight;
    inp.value = "";
    
    const personaSel = document.getElementById("waPersona");
    const persona = personaSel.selectedOptions[0]?.textContent || personaSel.value;
    let prompt = `WhatsApp simülasyonu. Rolün: ${persona}. Kullanıcının şu mesajına kısa, doğal ve karakterine uygun bir Hollandaca yanıt ver. Sadece Hollandaca konuş: ${txt}`;
    let res = await runGroqAi(prompt);
    
    setTimeout(() => {
        let r = document.createElement("div");
        r.className = "wa-msg them";
        const resSpan = document.createElement("span");
        resSpan.textContent = res;
        r.appendChild(resSpan);
        r.innerHTML += `<div class="wa-time">10:02</div>`;
        box.appendChild(r);
        box.scrollTop = box.scrollHeight;
    }, 1000);
}

async function handleMemoryPalace() {
    let w = document.getElementById("memoryWordInput").value;
    let r = document.getElementById("memoryResult"); r.style.display="block"; r.innerHTML = "Bellek sarayı inşa ediliyor...";
    let res = await runGroqAi(`"${w}" kelimesi için Türkçe akılda kalıcı bir mnemoni, görsel hikaye ve çapa teknikleri üret. Sadece geçerli JSON döndür, açıklamalar kesinlikle Türkçe olsun: {"scenes":[{"title":"Zihinsel Görüntü","desc":"Detaylı sahne açıklaması"},{"title":"Ses Benzerliği","desc":"Fonetik çapa açıklaması"}]}`);
    try {
        let data = parseAiJson(res);
        r.innerHTML = "";
        data.scenes.forEach(s => {
            let div = document.createElement("div");
            div.className = "memory-card";
            div.innerHTML = `<strong>${escapeHtml(s.title)}</strong><p style="font-size: 13px; margin-top: 4px;">${escapeHtml(s.desc)}</p>`;
            r.appendChild(div);
        });
    } catch (e) {
        r.innerHTML = `<div class="memory-card">${escapeHtml(res)}</div>`;
    }
}

async function handleSocialEngine() {
    let txt = document.getElementById("socialScenarioInput").value;
    let r = document.getElementById("socialResult"); r.style.display="block"; r.innerHTML = "Sosyal kurallar taranıyor...";
    let prompt = `Şu duruma Hollanda kültürüne uygun sosyal pragmatik bir tepki stratejisi üret. Açıklamalar Türkçe olmalı: ${txt}. Sadece geçerli JSON döndür: {"layers":[{"title":"Söylenmesi Gereken Hollandaca İfade","desc":"Doğru Hollandaca ifade"},{"title":"Kültürel Görgü Kuralları","desc":"Görgü kuralları Türkçe açıklaması"}]}`;
    let res = await runGroqAi(prompt);
    try {
        let data = parseAiJson(res);
        r.innerHTML = "";
        data.layers.forEach(l => {
            let div = document.createElement("div");
            div.className = "social-layer";
            div.innerHTML = `<span class="social-layer-title">${escapeHtml(l.title)}</span><p style="font-size: 13px; margin-top: 4px;">${escapeHtml(l.desc)}</p>`;
            r.appendChild(div);
        });
    } catch (e) {
        r.innerHTML = `<div class="social-layer">${escapeHtml(res)}</div>`;
    }
}

function generateMatchingGame() {
    let zone = document.getElementById("matchingGameZone");
    zone.innerHTML = "";
    document.getElementById("matchingResult").textContent = "";
    
    matchingPairs = appData.cards.slice(0, 4).map(c => ({ word: c.word, meaning: c.meaning }));
    let shuffledLeft = shuffleArray(matchingPairs);
    let shuffledRight = shuffleArray(matchingPairs);

    shuffledLeft.forEach(item => {
        let btn = document.createElement("button");
        btn.className = "btn-secondary";
        btn.textContent = item.word;
        btn.onclick = () => selectMatch(btn, "left");
        zone.appendChild(btn);
    });

    shuffledRight.forEach(item => {
        let btn = document.createElement("button");
        btn.className = "btn-secondary";
        btn.textContent = item.meaning;
        btn.onclick = () => selectMatch(btn, "right");
        zone.appendChild(btn);
    });
}

function selectMatch(btn, side) {
    if (btn.classList.contains("placed")) return;

    if (matchingSelected && matchingSelected.side !== side) {
        // Check match
        let isMatch = false;
        if (side === "right") {
            isMatch = matchingPairs.some(p => p.word === matchingSelected.btn.textContent && p.meaning === btn.textContent);
        } else {
            isMatch = matchingPairs.some(p => p.meaning === matchingSelected.btn.textContent && p.word === btn.textContent);
        }

        if (isMatch) {
            btn.style.background = "var(--green)";
            btn.classList.add("placed");
            matchingSelected.btn.style.background = "var(--green)";
            matchingSelected.btn.classList.add("placed");
            showToast("Eşleşti!", "var(--green)");
            matchingSelected = null;

            // Check win
            let allMatched = Array.from(document.querySelectorAll("#matchingGameZone button")).every(b => b.classList.contains("placed"));
            if (allMatched) {
                document.getElementById("matchingResult").textContent = "Harika! Tüm kelimeleri eşleştirdiniz!";
                triggerConfetti();
            }
        } else {
            btn.style.background = "var(--red)";
            matchingSelected.btn.style.background = "var(--red)";
            let temp = matchingSelected.btn;
            setTimeout(() => {
                btn.style.background = "";
                temp.style.background = "";
            }, 800);
            matchingSelected = null;
        }
    } else {
        if (matchingSelected) matchingSelected.btn.style.background = "";
        matchingSelected = { btn: btn, side: side };
        btn.style.background = "var(--orange)";
    }
}

async function handleNewsFeed() {
    let box = document.getElementById("newsFeedBox"); box.innerHTML = "Haber ajansları taranıyor...";
    let prompt = "Hollanda gündemi tarzında 2 adet çok kısa, basit düzeyde özgün haber metni yaz. title ve content sadece Hollandaca olsun. vocab sadece Türkçe kelime açıklamaları olsun. Sadece geçerli JSON döndür: {\"news\":[{\"title\":\"Hollandaca haber başlığı\",\"content\":\"Hollandaca haber metni\",\"vocab\":\"Türkçe kelime sözlüğü\"}]}";
    let res = await runGroqAi(prompt);
    try {
        let data = parseAiJson(res);
        box.innerHTML = "";
        data.news.forEach(n => {
            const div = document.createElement("div");
            div.className = "correction-box";
            const strong = document.createElement("strong");
            strong.textContent = n.title;
            const p = document.createElement("p");
            p.style.cssText = "font-size: 13px; margin: 6px 0;";
            p.textContent = n.content;
            const small = document.createElement("small");
            small.style.color = "var(--orange)";
            small.textContent = n.vocab;
            div.append(strong, p, small);
            box.appendChild(div);
        });
    } catch (e) {
        box.innerHTML = `<div class="correction-box">${escapeHtml(res)}</div>`;
    }
}

async function handleAccentDecoder() {
    let type = document.getElementById("accentType").value;
    let word = document.getElementById("accentWordInput").value;
    let r = document.getElementById("accentResult"); r.style.display="block"; r.innerHTML = "Aksan çözülüyor...";
    let prompt = `Hollandaca ${type} aksanına göre "${word || 'genel popüler terimler'}" yapısının okunuşunu, fonetik kaymalarını ve sokak kullanımını Türkçe olarak açıkla. Sadece geçerli JSON döndür: {"standard":"Standart Hollandaca okunuş","slang":"Aksanlı okunuş","meaning":"Türkçe açıklama"}`;
    let res = await runGroqAi(prompt);
    try {
        let data = parseAiJson(res);
        r.innerHTML = "";
        const block = document.createElement("div");
        block.className = "accent-block";
        
        const stdStrong = document.createElement("strong"); stdStrong.textContent = "Standart: ";
        const stdText = document.createTextNode(data.standard);
        const accStrong = document.createElement("strong"); accStrong.textContent = "Aksan: ";
        const accSpan = document.createElement("span");
        accSpan.style.cssText = "color: var(--orange); font-weight: bold;";
        accSpan.textContent = data.slang;
        const meanSmall = document.createElement("small");
        meanSmall.textContent = data.meaning;
        meanSmall.style.display = "block";
        meanSmall.style.marginTop = "4px";

        block.append(stdStrong, stdText, document.createElement("br"), accStrong, accSpan, document.createElement("br"), meanSmall);
        r.appendChild(block);
    } catch (e) {
        r.innerHTML = `<div class="accent-block">${escapeHtml(res)}</div>`;
    }
}

async function handleLyricsBreakdown() {
    let song = document.getElementById("lyricsSongInput").value;
    let r = document.getElementById("lyricsResult"); r.style.display="block"; r.innerHTML="Şarkı yapısı inceleniyor...";
    let prompt = `"${song}" için telifli şarkı sözlerini uzun alıntılama. Varsa en fazla 2 çok kısa ifade veya özgün benzer örnek üzerinden deyim ve kelime anlamlarını Türkçe açıkla. Sadece geçerli JSON döndür: {"lyrics":[{"line":"Çok kısa Hollandaca ifade veya özgün örnek","meaning":"Deyimsel Türkçe anlamı ve açıklaması"}]}`;
    let res = await runGroqAi(prompt);
    try {
        let data = parseAiJson(res);
        r.innerHTML = "";
        data.lyrics.forEach(l => {
            let div = document.createElement("div");
            div.className = "correction-box";
            const strong = document.createElement("strong");
            strong.style.color = "var(--purple)";
            strong.textContent = l.line;
            const p = document.createElement("p");
            p.style.cssText = "font-size: 13px; margin-top: 4px;";
            p.textContent = l.meaning;
            div.append(strong, p);
            r.appendChild(div);
        });
    } catch (e) {
        r.innerHTML = `<div class="correction-box">${escapeHtml(res)}</div>`;
    }
}

async function handleLinguisticDna() {
    let input = document.getElementById("dnaInput").value.trim();
    if (!input) return;
    let r = document.getElementById("linguaDnaResult"); r.style.display = "block"; r.textContent = "Linguistik DNA dizilimi yapılıyor...";
    
    let prompt = `Kullanıcının yazdığı "${input}" Hollandaca metnini incele. Bir Türk beyninin bu dili kurgularken yaptığı tipik morfolojik hataları, kelime dizilim kaymalarını saptayan Türkçe bir DNA raporu üret.`;
    let res = await runGroqAi(prompt);
    r.textContent = res;
}

function renderErrorMuseum() {
    let container = document.getElementById("errorMuseumList");
    container.innerHTML = "";
    let wrongCards = appData.cards.filter(c => (c.wrong || 0) > 0);
    
    document.getElementById("museumStats").innerHTML = `
        <div class="stat-card" style="padding: 6px;"><div style="font-size: 18px; font-weight: bold; color: var(--red);">${wrongCards.length}</div><small style="font-size: 9px;">Kritik Hata</small></div>
        <div class="stat-card" style="padding: 6px;"><div style="font-size: 18px; font-weight: bold; color: var(--green);">${appData.stats.totalRepetitions || 0}</div><small style="font-size: 9px;">Pratik</small></div>
        <div class="stat-card" style="padding: 6px;"><div style="font-size: 18px; font-weight: bold; color: var(--blue);">${appData.stats.streak || 0}</div><small style="font-size: 9px;">İstikrar</small></div>
    `;

    wrongCards.forEach(c => {
        let div = document.createElement("div");
        div.className = "correction-box";
        div.innerHTML = `<strong>${escapeHtml(c.word)}</strong><p style="font-size:12px; color: var(--red);">Bu kelimeyi çalışırken tam ${c.wrong} kez hata kaydı müzeye eklendi.</p>`;
        container.appendChild(div);
    });

    if(wrongCards.length === 0) {
        container.innerHTML = "<p style='text-align:center; padding: 12px;'>Müze henüz boş! Hata yaptıkça sergiler eklenecektir.</p>";
    }
}

async function handleMuseumAiAnalysis() {
    let wrongCards = appData.cards.filter(c => (c.wrong || 0) > 0).map(c => c.word).join(", ");
    let r = document.getElementById("museumAiInsight"); r.style.display = "block"; r.textContent = "Yapay zeka tüm sergileri inceliyor...";
    
    let prompt = `Kullanıcının şu hatalı kelimeleri üzerinden genel bir linguistik öğrenme tıkanıklığı ve bilişsel hata kalıbı analizi çıkar. Analiz tamamen Türkçe olmalıdır: ${wrongCards}`;
    let res = await runGroqAi(prompt);
    r.textContent = res;
}

function renderPersonalityProfile() {
    let container = document.getElementById("personalityOutput");
    let total = appData.cards.length;
    let learned = appData.cards.filter(c => (c.repetitions || 0) >= 2).length;
    let ratio = total > 0 ? (learned / total) * 100 : 0;

    if (total < 3) {
        container.innerHTML = "DNA profiliniz için en az 3 kelime üzerinde çalışmış olmanız gerekmektedir.";
        return;
    }

    let profileType = "Gelişmekte Olan";
    if (ratio > 70) profileType = "Sistematik Ezberci";
    else if (appData.stats.totalErrors > 15) profileType = "Sezgisel Hızlı Öğrenen (Risk Alıcı)";
    
    container.innerHTML = "";
    const title = document.createElement("strong");
    title.textContent = `Profil Tipi: ${profileType}`;
    const stats = document.createElement("small");
    stats.style.display = "block";
    stats.textContent = `Öğrenme Oranı: %${ratio.toFixed(0)} | Toplam Hata: ${appData.stats.totalErrors}`;
    const hr = document.createElement("hr");
    hr.style.margin = "8px 0";
    hr.style.opacity = "0.1";
    const desc = document.createElement("p");
    desc.style.fontSize = "13px";
    desc.textContent = "Kart çalışma paternleriniz beyninizin dil kodlama hızının oldukça dengeli olduğunu gösteriyor.";
    
    container.append(title, stats, hr, desc);
}

// VOICE RECOGNITION COMMANDS
function toggleVoiceRecog() {
    if (voiceListening) {
        stopVoiceRecog();
    } else if (window.SpeechRecognition || window.webkitSpeechRecognition) {
        startVoiceRecog();
    }
}

function startVoiceRecog() {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) {
        showToast("Sesli komut bu tarayıcıda desteklenmiyor.", "var(--red)");
        return;
    }
    voiceRecog = new Speech();
    voiceRecog.lang = "tr-TR";
    // iOS Safari'de continuous=true desteklenmez, false kullan
    voiceRecog.continuous = false;
    voiceRecog.interimResults = false;

    voiceRecog.onstart = () => {
        voiceListening = true;
        document.getElementById("voiceBadge").classList.add("listening");
        showToast("Sesli asistan dinliyor...", "var(--purple)");
    };

    voiceRecog.onresult = (e) => {
        let text = e.results[e.results.length - 1][0].transcript.trim().toLowerCase();
        showToast(`Algılanan Komut: ${text}`, "var(--orange)");
        handleVoiceCommand(text);
    };

    voiceRecog.onerror = (err) => {
        console.warn("Voice error:", err.error);
        stopVoiceRecog();
    };
    voiceRecog.onend = () => {
        // iOS'ta continuous çalışmadığı için manuel yeniden başlat
        if (voiceListening) {
            try { voiceRecog.start(); } catch(e) { stopVoiceRecog(); }
        }
    };
    try {
        voiceRecog.start();
    } catch(e) {
        showToast("Mikrofon erişimi sağlanamadı.", "var(--red)");
    }
}

function stopVoiceRecog() {
    voiceListening = false;
    if (voiceRecog) voiceRecog.stop();
    document.getElementById("voiceBadge").classList.remove("listening");
    showToast("Sesli asistan kapatıldı.", "var(--muted)");
}

function handleVoiceCommand(cmd) {
    if (cmd.includes("çevir") || cmd.includes("göster")) {
        document.getElementById("mainCard").classList.toggle("flipped");
    } else if (cmd.includes("iyi") || cmd.includes("doğru")) {
        handleAnswer("good");
    } else if (cmd.includes("tekrar") || cmd.includes("yanlış")) {
        handleAnswer("again");
    } else if (cmd.includes("zor")) {
        handleAnswer("hard");
    } else if (cmd.includes("kolay")) {
        handleAnswer("easy");
    } else if (cmd.includes("geri")) {
        triggerUndo();
    }
}

// MANAGEMENT SUB-FUNCTIONS
function populateManualCardDeckSelect() {
    const sel = document.getElementById("mcDeckSelect");
    if (!sel) return;
    sel.innerHTML = "";
    appData.decks.forEach(d => {
        const opt = document.createElement("option");
        opt.value = d.id;
        opt.textContent = d.name;
        if (d.id === activeDeckId) opt.selected = true;
        sel.appendChild(opt);
    });
}

function populateCardManageDeckFilter() {
    const sel = document.getElementById("cardManageDeckFilter");
    if (!sel) return;
    sel.innerHTML = `<option value="all">Tüm Desteler</option>`;
    appData.decks.forEach(d => {
        const opt = document.createElement("option");
        opt.value = d.id; opt.textContent = d.name;
        sel.appendChild(opt);
    });
    sel.onchange = renderManageCardsTable;
}

function renderManageCardsTable() {
    const tbody = document.getElementById("manageCardsTableBody");
    if (!tbody) return;
    const filterDeck = document.getElementById("cardManageDeckFilter")?.value || "all";
    const searchVal = (document.getElementById("cardManageSearch")?.value || "").toLowerCase();
    
    let filtered = appData.cards.filter(c => {
        const deckMatch = filterDeck === "all" || c.deckId === filterDeck;
        const searchMatch = !searchVal || c.word.toLowerCase().includes(searchVal) || c.meaning.toLowerCase().includes(searchVal);
        return deckMatch && searchMatch;
    });

    tbody.innerHTML = "";
    filtered.forEach(c => {
        const tr = document.createElement("tr");
        // Kılavuz 1.3: innerHTML yerine textContent
        const wordCell = document.createElement("td");
        wordCell.textContent = c.word;
        const meaningCell = document.createElement("td");
        meaningCell.textContent = c.meaning;
        const actionCell = document.createElement("td");
        actionCell.style.display = "flex";
        actionCell.style.gap = "4px";

        const editBtn = document.createElement("button");
        editBtn.className = "edit-deck-btn"; editBtn.textContent = "✏️"; editBtn.style.color = "var(--blue)";
        editBtn.onclick = (e) => { e.stopPropagation(); editCard(c.id, e); };
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "delete-deck-btn"; deleteBtn.textContent = "🗑"; deleteBtn.style.color = "var(--red)";
        deleteBtn.onclick = (e) => { e.stopPropagation(); deleteCard(c.id, e); };

        actionCell.append(editBtn, deleteBtn);
        tr.append(wordCell, meaningCell, actionCell);
        tbody.appendChild(tr);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--subtle);">Kart bulunamadı.</td></tr>`;
    }
}

function editCard(cardId, event) {
    event.stopPropagation();
    const card = appData.cards.find(c => c.id === cardId);
    if (!card) return;

    // Formu aç ve mevcut değerleri doldur
    const form = document.getElementById("manualCardForm");
    form.style.display = "flex";
    populateManualCardDeckSelect();
    document.getElementById("mcWord").value = card.word;
    document.getElementById("mcMeaning").value = card.meaning;
    document.getElementById("mcSentence").value = card.sentence || "";
    document.getElementById("mcLevel").value = card.level || inferLevel(card);
    document.getElementById("mcContext").value = card.context || inferUsageContext(card);
    document.getElementById("mcRegister").value = card.register || inferRegister(card);
    document.getElementById("mcArticle").value = card.article || inferArticle(card.word) || "";
    document.getElementById("mcConjugation").value = card.modalConjugation || "";
    const sel = document.getElementById("mcDeckSelect");
    if (sel) sel.value = card.deckId;

    // Kaydet butonunu düzenleme moduna al
    const saveBtn = document.getElementById("saveManualCardBtn");
    saveBtn.textContent = "Güncelle";
    saveBtn.onclick = () => {
        card.word = document.getElementById("mcWord").value.trim();
        card.meaning = document.getElementById("mcMeaning").value.trim();
        card.sentence = document.getElementById("mcSentence").value.trim();
        card.level = document.getElementById("mcLevel")?.value || inferLevel(card);
        card.context = document.getElementById("mcContext")?.value.trim() || inferUsageContext(card);
        card.register = document.getElementById("mcRegister")?.value || inferRegister(card);
        card.article = document.getElementById("mcArticle")?.value || inferArticle(card.word);
        card.modalConjugation = document.getElementById("mcConjugation").value.trim();
        card.deckId = document.getElementById("mcDeckSelect")?.value || card.deckId;
        if (!card.word || !card.meaning) { showToast("Kelime ve anlam zorunludur.", "var(--red)"); return; }
        save();
        form.style.display = "none";
        saveBtn.textContent = "Kaydet";
        saveBtn.onclick = addNewCardManual;
        renderManageCardsTable();
        showToast("Kart güncellendi.", "var(--green)");
    };
    form.scrollIntoView({ behavior: "smooth" });
}

function deleteCard(cardId, event) {
    event.stopPropagation();
    appData.cards = appData.cards.filter(c => c.id !== cardId);
    save();
    renderManageCardsTable();
    showToast("Kart silindi.", "var(--red)");
}

// Search listener for manage cards
document.addEventListener("DOMContentLoaded", () => {
    const s = document.getElementById("cardManageSearch");
    if (s) s.oninput = renderManageCardsTable;
});

function addNewDeck() {
    let val = document.getElementById("newDeckNameInput").value.trim();
    if(!val) return;
    const selectedColor = document.querySelector(".deck-color-opt[data-selected]")?.dataset.color || "#F97316";
    const emoji = document.getElementById("newDeckEmoji")?.value.trim() || "📁";
    let id = "d_" + Date.now();
    appData.decks.push({ id, name: val, color: selectedColor, emoji });
    save();
    renderSidebar();
    closeModal("addDeckModal");
    document.getElementById("newDeckNameInput").value = "";
    document.getElementById("newDeckEmoji").value = "";
    document.querySelectorAll(".deck-color-opt").forEach(el => el.removeAttribute("data-selected"));
    document.querySelectorAll(".deck-color-opt")[0]?.setAttribute("style", document.querySelectorAll(".deck-color-opt")[0].getAttribute("style").replace(/border:[^;]+;/, "") + " border:2px solid white;");
    showToast("Yeni deste başarıyla eklendi.", "var(--green)");
}

function addNewCardManual() {
    let w = document.getElementById("mcWord").value.trim();
    let m = document.getElementById("mcMeaning").value.trim();
    let sStr = document.getElementById("mcSentence").value.trim();
    let cStr = document.getElementById("mcConjugation").value.trim();
    let level = document.getElementById("mcLevel")?.value || "A1";
    let context = document.getElementById("mcContext")?.value.trim() || "";
    let register = document.getElementById("mcRegister")?.value || "Nötr";
    let article = document.getElementById("mcArticle")?.value || inferArticle(w);
    let targetDeckId = document.getElementById("mcDeckSelect")?.value || activeDeckId;
    
    if(!w || !m) { showToast("Kelime ve anlam alanları zorunludur.", "var(--red)"); return; }
    
    appData.cards.push({
        id: "c_" + Date.now(),
        deckId: targetDeckId,
        word: w,
        meaning: m,
        sentence: sStr,
        level,
        context: context || inferUsageContext({ word: w, meaning: m, sentence: sStr, deckId: targetDeckId }),
        register,
        article,
        modalConjugation: cStr || "maak,maakt,maken",
        // SM-2 Algoritma başlangıç değerleri
        interval: 0,
        repetitions: 0,
        ease: 2.5,
        nextReview: Date.now()
    });
    save();
    document.getElementById("manualCardForm").style.display = "none";
    document.getElementById("mcWord").value = "";
    document.getElementById("mcMeaning").value = "";
    document.getElementById("mcSentence").value = "";
    document.getElementById("mcContext").value = "";
    document.getElementById("mcArticle").value = "";
    document.getElementById("mcConjugation").value = "";
    renderManageCardsTable();
    selectDeck(activeDeckId);
    showToast("Yeni manuel kart başarıyla işlendi.", "var(--green)");
}

function deleteDeck(deckId, event) {
    event.stopPropagation();
    if(appData.decks.length <= 1) { showToast("Sistemde en az bir deste bulunmalıdır.", "var(--orange)"); return; }
    appData.decks = appData.decks.filter(d => d.id !== deckId);
    appData.cards = appData.cards.filter(c => c.deckId !== deckId);
    if(activeDeckId === deckId) activeDeckId = appData.decks[0].id;
    save();
    renderSidebar();
    selectDeck(activeDeckId);
}

// GLOBAL CONFIG SYSTEM PLATFORM
// Kılavuz 1.1: SessionStorage Tabanlı Kayıt
function saveGroqKey() {
    let keyVal = document.getElementById("groqKeyInput").value.trim();
    let masterPass = document.getElementById("masterPasswordInput").value.trim();
    if(!keyVal) { showToast("Lütfen geçerli bir anahtar girin.", "var(--orange)"); return; }
    if (!masterPass) { showToast("Master şifre belirleyin.", "var(--orange)"); return; }

    try {
        const sc = new SimpleCrypto(masterPass);
        const encrypted = sc.encrypt(keyVal);
        appData.encryptedGroqKey = encrypted;
        appData.groqKey = null;
        save();
        sessionStorage.setItem("groq_api_key", keyVal);
        if (window.setGroqKey) window.setGroqKey(keyVal);
        document.getElementById("groqSetupScreen").style.display = "none";
        showToast("Anahtar şifrelendi ve kaydedildi.", "var(--green)");
    } catch(e) {
        showToast("Şifreleme hatası!", "var(--red)");
    }
}

function unlockGroqKey() {
    let passVal = document.getElementById("masterPasswordInput").value.trim();
    if(!passVal) return;
    try {
        const sc = new SimpleCrypto(passVal);
        let decrypted = sc.decrypt(appData.encryptedGroqKey);
        if (decrypted && decrypted.startsWith("gsk_")) {
            sessionStorage.setItem("groq_api_key", decrypted);
            if (window.setGroqKey) window.setGroqKey(decrypted);
            document.getElementById("groqSetupScreen").style.display = "none";
            showToast("AI Erişimi Açıldı!", "var(--green)");
        } else throw new Error("Geçersiz anahtar");
    } catch(e) { 
        showToast("Master şifre yanlış veya anahtar bozuk.", "var(--red)");
    }
}

function resetApiKey() {
    sessionStorage.removeItem("groq_api_key");
    appData.encryptedGroqKey = null;
    appData.groqKey = null;
    save();
    showToast("API anahtarı silindi, sayfa yenileniyor...", "var(--orange)");
    setTimeout(() => location.reload(), 500);
}

function toggleTheme() {
    document.body.classList.toggle("light");
    let isLight = document.body.classList.contains("light");
    document.getElementById("themeToggleBtn").textContent = isLight ? "🌙 Karanlık Mod" : "☀️ Işık Modu";
    localStorage.setItem("linguaprime_theme", isLight ? "light" : "dark");
    renderWeekChart();
}

function applyStoredTheme() {
    const saved = localStorage.getItem("linguaprime_theme");
    if (saved === "light") {
        document.body.classList.add("light");
        const btn = document.getElementById("themeToggleBtn");
        if (btn) btn.textContent = "🌙 Karanlık Mod";
    }
}

function applyStoredOled() {
    const oled = localStorage.getItem("linguaprime_oled") === "true";
    document.body.classList.toggle("oled", oled);
    const toggle = document.getElementById("oledToggle");
    if (toggle) toggle.checked = oled;
}

function applyDyslexicPreference() {
    const isEnabled = appData.dyslexicMode || false;
    document.body.classList.toggle("dyslexic", isEnabled);
    if (document.getElementById("dyslexicToggle")) document.getElementById("dyslexicToggle").checked = isEnabled;
}

function updateGlobalStreak() {
    document.getElementById("streakCount").textContent = appData.stats.streak || 0;
    updateMasteryBars();
    updateDailyCoach();
}

function updateMasteryBars() {
    if (!currentCard) return;
    const reps = currentCard.repetitions || 0;
    const wrong = currentCard.wrong || 0;
    const pct = Math.min(Math.max((reps * 20) - (wrong * 10), 0), 100);
    document.querySelectorAll(".learning-level-fill").forEach(el => {
        el.style.width = pct + "%";
    });
}

let statsChartInstance = null;
function renderWeekChart() {
    if (!window.Chart || !document.getElementById("statsChart")) return;
    
    const canvas = document.getElementById("statsChart");
    if (!canvas) return;
    
    const days = ["Pzt","Sal","Çar","Per","Cum","Cmt","Paz"];
    const today = new Date();
    const weeklyData = appData.stats.weeklyData || {};
    const labels = [];
    const dataPoints = [];

    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const isoKey = getLocalDateStr(d);
        labels.push(days[d.getDay() === 0 ? 6 : d.getDay() - 1]);
        dataPoints.push(weeklyData[isoKey] || 0);
    }

    if (statsChartInstance) statsChartInstance.destroy();

    const isLight = document.body.classList.contains("light");
    const accentColor = "#16A34A";

    statsChartInstance = new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Tamamlanan Kart',
                data: dataPoints,
                borderColor: accentColor,
                backgroundColor: 'rgba(22, 163, 74, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: accentColor,
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: isLight ? '#E2E8F0' : '#1E293B' }, ticks: { color: '#64748B' } },
                x: { grid: { display: false }, ticks: { color: '#64748B' } }
            }
        }
    });
}

// AI KART ÜRETİCİ
let aiGeneratedCards = [];

function showSkeleton(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = `
        <div class="skeleton-loader">
            <div class="skeleton-item" style="width: 80%"></div>
            <div class="skeleton-item" style="width: 100%"></div>
            <div class="skeleton-item" style="width: 90%"></div>
        </div>`;
}

function populateAiGenDeckTarget() {
    const sel = document.getElementById("aiGenDeckTarget");
    if (!sel) return;
    sel.innerHTML = "";
    appData.decks.forEach(d => {
        const opt = document.createElement("option");
        opt.value = d.id; opt.textContent = d.name;
        if (d.id === activeDeckId) opt.selected = true;
        sel.appendChild(opt);
    });
}

async function handleAiCardGeneration() {
    const topic = document.getElementById("aiGenTopic").value.trim() || "genel kelimeler";
    const level = document.getElementById("aiGenLevel").value;
    const count = Math.min(parseInt(document.getElementById("aiGenCount").value) || 10, 30);
    const btn = document.getElementById("aiGenCardsBtn");
    const preview = document.getElementById("aiGenPreview");
    const saveBtn = document.getElementById("aiGenSaveBtn");

    btn.disabled = true;
    btn.innerHTML = `<span class="ai-spinner"></span> Üretiliyor...`;
    preview.style.display = "none";
    saveBtn.style.display = "none";
    aiGeneratedCards = [];

    const prompt = `"${topic}" konusunda ${level} seviyesinde ${count} adet Hollandaca-Türkçe kelime kartı üret.
    Kurallar:
    - "word" doğal Hollandaca kelime/ifade olsun.
    - "meaning" sadece Türkçe anlam olsun.
    - "sentence" kısa, doğru, seviyeye uygun Hollandaca örnek cümle olsun.
    - "context" Türkçe ve kısa olsun: nerede kullanılır?
    - "register" sadece "Günlük", "Nötr" veya "Resmi" olsun.
    - "article" isimlerde "de" veya "het", diğerlerinde null olsun.
    Sadece geçerli JSON döndür:
    {"cards":[{"word":"Hollandaca kelime","meaning":"Türkçe anlam","sentence":"Hollandaca örnek cümle","level":"${level}","context":"Kısa kullanım bağlamı","register":"Nötr","article":"de"}]}`;

    const res = await runGroqAi(prompt);
    btn.disabled = false;
    btn.textContent = "✨ Kartları Üret";

    try {
        const data = parseAiJson(res);
        aiGeneratedCards = data.cards || [];
        preview.style.display = "flex";
        preview.innerHTML = "";
        aiGeneratedCards.forEach((c, i) => {
            const div = document.createElement("div");
            div.style.cssText = "background:var(--surface2); border-radius:10px; padding:10px 12px; border-left:3px solid var(--orange); font-size:13px;";
            const meta = [c.level || level, c.context, c.register].filter(Boolean).join(" · ");
            div.innerHTML = `<strong>${escapeHtml(c.word)}</strong> — ${escapeHtml(c.meaning)}<br><small style="color:var(--subtle);">${escapeHtml(c.sentence || "")}</small><br><small style="color:var(--subtle);">${escapeHtml(meta)}</small>`;
            preview.appendChild(div);
        });
        saveBtn.style.display = aiGeneratedCards.length > 0 ? "block" : "none";
        showToast(`${aiGeneratedCards.length} kart üretildi!`, "var(--green)");
    } catch(e) {
        showToast("Kart üretimi başarısız, tekrar deneyin.", "var(--red)");
    }
}

function saveAiGeneratedCards() {
    const deckId = document.getElementById("aiGenDeckTarget")?.value || activeDeckId;
    aiGeneratedCards.forEach(c => {
        appData.cards.push({
            id: "c_" + Date.now() + "_" + Math.random().toString(36).slice(2,5),
            deckId,
            word: c.word,
            meaning: c.meaning,
            sentence: c.sentence || "",
            level: c.level || inferLevel(c),
            context: c.context || inferUsageContext({ ...c, deckId }),
            register: c.register || inferRegister(c),
            article: c.article || inferArticle(c.word),
            interval: 0,
            ease: 2.5,
            nextReview: Date.now(),
            repetitions: 0,
            wrong: 0
        });
    });
    save();
    renderSidebar();
    selectDeck(activeDeckId);
    closeModal("aiCardGenModal");
    showToast(`${aiGeneratedCards.length} kart "${appData.decks.find(d=>d.id===deckId)?.name}" destesine eklendi!`, "var(--green)");
    aiGeneratedCards = [];
}

function saveDailyGoal() {
    const val = parseInt(document.getElementById("dailyGoalInput").value) || 10;
    appData.stats.dailyGoal = val;
    save();
    updateProgress();
    showToast(`Günlük hedef ${val} kart olarak ayarlandı.`, "var(--green)");
}

function updateProgress() {
    let currentAreaCount = 0;
    let pool = [];
    if (activeDeckId === "all") {
        pool = appData.cards;
    } else if (activeDeckId === "multi") {
        pool = appData.cards.filter(c => appData.multiDeckIds.includes(c.deckId));
    } else {
        pool = appData.cards.filter(c => c.deckId === activeDeckId);
    }
    currentAreaCount = pool.length;

    // Üst progress bar aktif desteye göre; istatistik kartları global kalsın
    const globalLearnedCount = appData.cards.filter(c => (c.repetitions || 0) > 0).length;
    const learnedCount = pool.filter(c => (c.repetitions || 0) > 0).length;
    const progressPercent = pool.length > 0 ? (learnedCount / pool.length) * 100 : 0;

    const dueCount = pool.filter(c => !c.nextReview || c.nextReview <= Date.now()).length;
    const newCount = pool.filter(c => (c.repetitions || 0) === 0 && (c.wrong || 0) === 0).length;
    const seenCount = Math.max(currentAreaCount - newCount, 0);
    const progressTextEl = document.getElementById("progressText");
    if (progressTextEl) {
        if (currentAreaCount > 0) {
            progressTextEl.textContent = `Destede ${currentAreaCount} kart · ${newCount} yeni · ${dueCount} tekrar bekliyor · ${seenCount} görülmüş`;
        } else {
            progressTextEl.textContent = "Çalışılacak kart kalmadı!";
        }
    }

    document.getElementById("statsTotalCards").textContent = appData.cards.length;
    document.getElementById("statsLearnedCards").textContent = globalLearnedCount;
    document.getElementById("statsTotalRepetitions").textContent = appData.stats.totalRepetitions;
    document.getElementById("statsTotalErrors").textContent = appData.stats.totalErrors;
    document.getElementById("progressBarFill").style.width = `${progressPercent}%`;

    // Günlük hedef güncelle
    const goal = appData.stats.dailyGoal || 10;
    const todayReps = appData.stats.todayReps || 0;
    const goalPercent = Math.min((todayReps / goal) * 100, 100);
    const goalBar = document.getElementById("dailyGoalBar");
    const goalText = document.getElementById("dailyGoalText");
    const goalInput = document.getElementById("dailyGoalInput");
    if (goalBar) goalBar.style.width = `${goalPercent}%`;
    if (goalText) goalText.textContent = `${todayReps} / ${goal}`;
    if (goalInput) goalInput.value = goal;

    updateDailyCoach(pool, { currentAreaCount, newCount, dueCount, seenCount, learnedCount });
    renderWeekChart();
}

function getTodayCoachStats(poolOverride = null) {
    const pool = poolOverride || (activeDeckId === "all"
        ? appData.cards
        : activeDeckId === "multi"
            ? appData.cards.filter(c => appData.multiDeckIds.includes(c.deckId))
            : appData.cards.filter(c => c.deckId === activeDeckId));
    const due = pool.filter(c => !c.nextReview || c.nextReview <= Date.now()).length;
    const weak = pool.filter(c => (c.wrong || 0) > 0 && (c.wrong || 0) >= Math.max(1, Math.floor((c.repetitions || 0) / 2))).length;
    const fresh = pool.filter(c => (c.repetitions || 0) === 0 && (c.wrong || 0) === 0).length;
    const goal = appData.stats.dailyGoal || 10;
    const today = appData.stats.todayReps || 0;
    return { pool, due, weak, fresh, goal, today };
}

function updateDailyCoach(poolOverride = null) {
    const title = document.getElementById("dailyPlanTitle");
    const subtitle = document.getElementById("dailyPlanSubtitle");
    const summary = document.getElementById("studySummaryBox");
    if (!title && !subtitle && !summary) return;

    const { pool, due, weak, fresh, goal, today } = getTodayCoachStats(poolOverride);
    const remaining = Math.max(goal - today, 0);
    const planned = Math.min(Math.max(due + weak, fresh > 0 ? Math.min(fresh, 5) : 0), Math.max(goal, 1));

    if (title) {
        title.textContent = pool.length === 0
            ? "Önce birkaç kart ekleyelim"
            : planned > 0
                ? `Bugün ${planned} kart hazır`
                : "Bugünkü tekrarlar tamam";
    }
    if (subtitle) {
        subtitle.textContent = pool.length === 0
            ? "Market, doktor, iş veya ulaşım destelerinden başlayabilirsin."
            : `${due} tekrar · ${weak} zayıf kelime · ${fresh} yeni kart · hedefe ${remaining} kaldı`;
    }
    if (summary) {
        summary.textContent = pool.length === 0
            ? "Henüz ölçülecek çalışma yok. Kart ekledikçe günlük plan ve tekrar takvimi burada sade biçimde görünür."
            : `Bugün ${today}/${goal} kart tamamlandı. Sistem önceliği zamanı gelen ${due} karta ve tekrar hata yapılan ${weak} kelimeye veriyor.`;
    }
}

// SYSTEM BACKUP MANAGER
function exportSystemData() {
    let blob = new Blob([JSON.stringify(appData)], { type: "application/json" });
    let url = URL.createObjectURL(blob);
    let a = document.createElement("a");
    a.href = url;
    a.download = `linguaprime_backup_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
}

function parseCsvLine(line) {
    const result = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
            else if (ch === '"') inQuotes = false;
            else current += ch;
        } else {
            if (ch === '"') inQuotes = true;
            else if (ch === ",") { result.push(current.trim()); current = ""; }
            else current += ch;
        }
    }
    result.push(current.trim());
    return result;
}

function importCsvData(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        const lines = evt.target.result.split(/\r?\n/).filter(l => l.trim());
        let added = 0, skipped = 0;
        lines.forEach(line => {
            const parts = parseCsvLine(line);
            if (parts.length >= 2 && parts[0] && parts[1]) {
                appData.cards.push({
                    id: "c_" + Date.now() + "_" + Math.random().toString(36).slice(2,6),
                    deckId: activeDeckId !== "all" && activeDeckId !== "multi" ? activeDeckId : appData.decks[0]?.id || "genel",
                    word: parts[0],
                    meaning: parts[1],
                    sentence: parts[2] || "",
                    level: parts[3] || inferLevel({ word: parts[0], meaning: parts[1], sentence: parts[2] || "" }),
                    context: parts[4] || inferUsageContext({ word: parts[0], meaning: parts[1], sentence: parts[2] || "", deckId: activeDeckId }),
                    register: parts[5] || "Nötr",
                    article: parts[6] || inferArticle(parts[0]),
                    interval: 0,
                    ease: 2.5,
                    nextReview: Date.now(),
                    repetitions: 0,
                    wrong: 0
                });
                added++;
            } else {
                skipped++;
            }
        });
        save();
        renderSidebar();
        selectDeck(activeDeckId);
        showToast(`${added} kart eklendi${skipped > 0 ? ", " + skipped + " satır atlandı" : ""}.`, "var(--green)");
        e.target.value = "";
    };
    reader.readAsText(file);
}

function importSystemData(e) {
    let file = e.target.files[0];
    if (!file) return;
    let reader = new FileReader();
    reader.onload = function(evt) {
        try {
            let parsed = JSON.parse(evt.target.result);
            if(parsed && Array.isArray(parsed.cards) && Array.isArray(parsed.decks)) {
                // Mevcut varsayılan yapıyı korumak için yüklenen veriyi güvenli bir şekilde birleştir
                appData = Object.assign({}, appData, parsed);
                
                save();
                location.reload();
            } else {
                showToast("Geçersiz JSON formatı! 'cards' ve 'decks' alanları zorunludur.", "var(--red)");
            }
        } catch(err) { showToast("Dosya okuma hatası veya geçersiz JSON!", "var(--red)"); }
    };
    reader.readAsText(file);
}

// TOAST ENGINE & DRAWERS WINDOWS CONTROLLER
function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
}

function getLocalDateStr(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function normalizeForComparison(str) {
    if (!str) return "";
    // Uzman Raporu 3.2-4: 'Ğ' -> 'G' ve diğer Türkçe karakterler için geliştirilmiş normalizasyon
    return str.trim()
        .toLocaleLowerCase('tr-TR')
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g,"") // Noktalama işaretlerini temizle
        .replace(/\s+/g, " ") // Fazla boşlukları temizle
        .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
        .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
        .replace(/i̇/g, 'i'); // Noktalı i düzeltmesi
}

function showToast(text, bg) {
    const toast = document.getElementById("toast");
    toast.textContent = text;
    toast.style.background = bg || "var(--orange)";
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2500);
}

function openModal(id) {
    closeAllDrawers();
    const modal = document.getElementById(id);
    modal.classList.add("open");
    
    // Uzman Raporu 1.5: Klavye odak yönetimi - İlk input'a odaklan
    const firstInput = modal.querySelector('input, textarea, select');
    if (firstInput) setTimeout(() => firstInput.focus(), 100);
    
    // AI Focus Mode logic
    const aiModals = ["storyModal", "chatModal", "rpgModal", "whatsappModal", "aiDictModal"];
    if (aiModals.includes(id)) {
        document.body.classList.add("modal-open");
        document.getElementById("focusOverlay").style.display = "block";
    }
    if (id === "storyModal") setMascot("storyMascot", "happy");

    document.getElementById("overlay").classList.add("show");
    
    // Dynamic render calls on open if applicable
    if(id === "weaknessModal") {
        let list = document.getElementById("weaknessListContainer"); list.innerHTML = "";
        appData.cards.filter(c => (c.wrong || 0) > 0).forEach(c => {
            let div = document.createElement("div"); div.className = "weakness-item";
            div.innerHTML = `<strong>${escapeHtml(c.word)}</strong><p>Hata Payı: ${c.wrong} Kez | Anlamı: ${escapeHtml(c.meaning)}</p>`;
            list.appendChild(div);
        });
        if(!list.innerHTML) list.innerHTML = "Harika! Şu an kronik zayıf kartınız bulunmuyor.";
    } else if(id === "errorMuseumModal") {
        renderErrorMuseum();
    } else if(id === "matchingModal") {
        generateMatchingGame();
    } else if(id === "manageCardsModal") {
        renderManageCardsTable();
        populateCardManageDeckFilter();
        populateManualCardDeckSelect();
    } else if(id === "statsModal") {
        updateProgress();
    }
}

function closeModal(id) {
    document.getElementById(id).classList.remove("open");
    document.body.classList.remove("modal-open");
    document.getElementById("focusOverlay").style.display = "none";
    if (!document.querySelector(".modal.open")) {
        document.getElementById("overlay").classList.remove("show");
    }
}

function closeAllDrawers() {
    document.body.classList.remove("modal-open");
    document.getElementById("focusOverlay").style.display = "none";
    closeSidebar();
    document.querySelectorAll(".modal").forEach(m => m.classList.remove("open"));
}

// CONFETTI CANVAS EFFECT
function triggerConfetti() {
    const canvas = document.getElementById("confettiCanvas");
    canvas.style.display = "block";
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext("2d");
    
    const pieces = Array.from({ length: 80 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        w: Math.random() * 8 + 4,
        h: Math.random() * 6 + 3,
        color: `hsl(${Math.random() * 360},80%,60%)`,
        vx: Math.random() * 2 - 1,
        vy: Math.random() * 3 + 2,
        rot: Math.random() * 360,
        rotV: Math.random() * 6 - 3
    }));
    let frame, elapsed = 0;
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        pieces.forEach(p => {
            ctx.save();
            ctx.translate(p.x + p.w/2, p.y + p.h/2);
            ctx.rotate(p.rot * Math.PI / 180);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
            ctx.restore();
            p.x += p.vx; p.y += p.vy; p.rot += p.rotV;
        });
        elapsed++;
        if (elapsed < 90) frame = requestAnimationFrame(draw);
        else { cancelAnimationFrame(frame); canvas.style.display = "none"; }
    }
    draw();
}

// TRIGGER ON APPLICATION READY
function bootLinguaPrime() {
    if (window.__linguaPrimeStarted) return;

    const start = () => {
        if (window.__linguaPrimeStarted) return;
        window.__linguaPrimeStarted = true;
        initApp();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
}

if (window.runGroqAi && window.setGroqKey) {
    bootLinguaPrime();
} else {
    window.addEventListener('ai-service-ready', bootLinguaPrime, { once: true });
    setTimeout(bootLinguaPrime, 500);
}
