const RecallApp = (() => {
    const STAGES = {
        TYPE_IT: "type-it",
        MEMORIZE_IT: "memorize-it",
        MASTER_IT: "master-it"
    };

    const STAGE_ORDER = [STAGES.TYPE_IT, STAGES.MEMORIZE_IT, STAGES.MASTER_IT];

    const STAGE_HINTS = {
        [STAGES.TYPE_IT]: "Type the full verse. Match every character.",
        [STAGES.MEMORIZE_IT]: "Type the first letter of each word to test recall.",
        [STAGES.MASTER_IT]: "Words are hidden. Type from memory to reveal them."
    };

    const STAGE_LABELS = {
        [STAGES.TYPE_IT]: "Type It",
        [STAGES.MEMORIZE_IT]: "Memorize It",
        [STAGES.MASTER_IT]: "Master It"
    };

    const PROGRESS_KEY = "recall-progress";

    let collections = [];
    let verses = [];
    let currentVerse = null;
    let currentStage = STAGES.TYPE_IT;
    let typedChars = [];
    let startTime = null;
    let timerInterval = null;
    let isComplete = false;

    function loadProgress() {
        try {
            return JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}");
        } catch {
            return {};
        }
    }

    function saveProgress(progress) {
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    }

    function getVerseProgress(verseId) {
        const progress = loadProgress();
        return progress[verseId] || {
            stage: STAGES.TYPE_IT,
            accuracy: 0,
            bestWpm: 0,
            reviewCount: 0,
            lastReviewed: null,
            completedStages: []
        };
    }

    function updateVerseProgress(verseId, updates) {
        const progress = loadProgress();
        progress[verseId] = { ...getVerseProgress(verseId), ...updates };
        saveProgress(progress);
    }

    async function fetchJson(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Request failed: ${url}`);
        }
        return response.json();
    }

    function normalizeText(text) {
        return text.replace(/\s+/g, " ").trim();
    }

    function getWords(text) {
        return normalizeText(text).split(" ");
    }

    function getTargetChars(stage, text) {
        const words = getWords(text);

        if (stage === STAGES.MEMORIZE_IT) {
            return words.map((word, index) => ({
                word,
                wordIndex: index,
                char: word[0],
                isFirstLetter: true
            }));
        }

        const chars = [];
        words.forEach((word, wordIndex) => {
            for (let i = 0; i < word.length; i++) {
                chars.push({
                    word,
                    wordIndex,
                    char: word[i],
                    isFirstLetter: false,
                    charIndex: i
                });
            }

            if (wordIndex < words.length - 1) {
                chars.push({
                    word: " ",
                    wordIndex,
                    char: " ",
                    isFirstLetter: false,
                    isSpace: true
                });
            }
        });

        return chars;
    }

    function renderWords() {
        const display = document.getElementById("words-display");
        if (!currentVerse) {
            display.innerHTML = "";
            return;
        }

        const targetChars = getTargetChars(currentStage, currentVerse.text);
        const words = getWords(currentVerse.text);
        let html = "";

        if (currentStage === STAGES.MEMORIZE_IT) {
            words.forEach((word, wordIndex) => {
                const typed = typedChars[wordIndex];
                const expected = word[0];
                let charClass = "char first-letter";

                if (typed !== undefined) {
                    charClass += typed.toLowerCase() === expected.toLowerCase() ? " correct" : " incorrect";
                } else if (wordIndex === typedChars.length) {
                    charClass += " current";
                } else {
                    charClass += " pending";
                }

                html += `<span class="word"><span class="${charClass}">${escapeHtml(expected)}</span></span>`;
            });
        } else if (currentStage === STAGES.MASTER_IT) {
            words.forEach((word, wordIndex) => {
                const wordStart = getWordStartIndex(wordIndex);
                const wordTypedLength = Math.max(0, typedChars.length - wordStart);
                const isRevealed = wordTypedLength >= word.length;
                const isCurrentWord = typedChars.length >= wordStart && typedChars.length < wordStart + word.length;

                html += `<span class="word">`;

                for (let i = 0; i < word.length; i++) {
                    let charClass = "char";
                    const globalIndex = wordStart + i;
                    const typed = typedChars[globalIndex];
                    const expected = word[i];

                    if (isRevealed) {
                        charClass += typed === expected ? " correct revealed" : " incorrect revealed";
                        html += `<span class="${charClass}">${escapeHtml(expected)}</span>`;
                    } else if (typed !== undefined) {
                        charClass += typed === expected ? " correct" : " incorrect";
                        html += `<span class="${charClass}">${escapeHtml(expected)}</span>`;
                    } else {
                        charClass += " hidden";
                        if (globalIndex === typedChars.length) {
                            charClass += " current";
                        }
                        html += `<span class="${charClass}">${escapeHtml(expected)}</span>`;
                    }
                }

                html += `</span>`;
            });
        } else {
            let globalIndex = 0;
            words.forEach((word, wordIndex) => {
                html += `<span class="word">`;
                for (let i = 0; i < word.length; i++) {
                    const typed = typedChars[globalIndex];
                    const expected = word[i];
                    let charClass = "char";

                    if (typed !== undefined) {
                        charClass += typed === expected ? " correct" : " incorrect";
                    } else if (globalIndex === typedChars.length) {
                        charClass += " current";
                    } else {
                        charClass += " pending";
                    }

                    html += `<span class="${charClass}">${escapeHtml(expected)}</span>`;
                    globalIndex++;
                }
                html += `</span>`;

                if (wordIndex < words.length - 1) {
                    const typed = typedChars[globalIndex];
                    let charClass = "char";
                    if (typed !== undefined) {
                        charClass += typed === " " ? " correct" : " incorrect";
                    } else if (globalIndex === typedChars.length) {
                        charClass += " current";
                    } else {
                        charClass += " pending";
                    }
                    html += `<span class="${charClass}"> </span>`;
                    globalIndex++;
                }
            });
        }

        display.innerHTML = html;
        updateStats();
    }

    function getWordStartIndex(wordIndex) {
        const words = getWords(currentVerse.text);
        let index = 0;
        for (let i = 0; i < wordIndex; i++) {
            index += words[i].length + 1;
        }
        return index;
    }

    function getTotalTargetLength() {
        if (currentStage === STAGES.MEMORIZE_IT) {
            return getWords(currentVerse.text).length;
        }
        return normalizeText(currentVerse.text).length;
    }

    function getExpectedCharAt(index) {
        const targetChars = getTargetChars(currentStage, currentVerse.text);
        return targetChars[index]?.char ?? null;
    }

    function handleInput(char) {
        if (isComplete || !currentVerse) {
            return;
        }

        if (!startTime) {
            startTime = Date.now();
            startTimer();
        }

        const expected = getExpectedCharAt(typedChars.length);
        if (expected === null) {
            return;
        }

        if (currentStage === STAGES.MEMORIZE_IT) {
            typedChars.push(char.toLowerCase());
        } else {
            typedChars.push(char);
        }

        renderWords();

        if (typedChars.length >= getTotalTargetLength()) {
            finishSession();
        }
    }

    function handleBackspace() {
        if (isComplete || typedChars.length === 0) {
            return;
        }

        typedChars.pop();
        renderWords();
    }

    function calculateStats() {
        const total = typedChars.length;
        let correct = 0;

        for (let i = 0; i < typedChars.length; i++) {
            const expected = getExpectedCharAt(i);
            if (currentStage === STAGES.MEMORIZE_IT) {
                if (typedChars[i].toLowerCase() === expected?.toLowerCase()) {
                    correct++;
                }
            } else if (typedChars[i] === expected) {
                correct++;
            }
        }

        const accuracy = total === 0 ? 100 : Math.round((correct / total) * 100);
        const elapsedMinutes = startTime ? (Date.now() - startTime) / 60000 : 0;
        const wordsTyped = currentStage === STAGES.MEMORIZE_IT
            ? typedChars.length
            : typedChars.filter(c => c !== " ").length / 5;
        const wpm = elapsedMinutes > 0 ? Math.round(wordsTyped / elapsedMinutes) : 0;

        return { accuracy, wpm, elapsed: startTime ? Math.floor((Date.now() - startTime) / 1000) : 0 };
    }

    function updateStats() {
        const { accuracy, wpm, elapsed } = calculateStats();
        document.getElementById("stat-wpm").textContent = wpm;
        document.getElementById("stat-accuracy").textContent = accuracy;
        document.getElementById("stat-time").textContent = elapsed;
        document.getElementById("stat-progress").textContent =
            `${Math.min(typedChars.length, getTotalTargetLength())}/${getTotalTargetLength()}`;
    }

    function startTimer() {
        stopTimer();
        timerInterval = setInterval(updateStats, 250);
    }

    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    function resetSession(keepStage = true) {
        typedChars = [];
        startTime = null;
        isComplete = false;
        stopTimer();
        document.getElementById("completion-overlay").classList.add("hidden");
        document.getElementById("typing-input").value = "";
        updateStats();
        renderWords();
        focusTypingArea();

        if (!keepStage) {
            return;
        }

        document.getElementById("stage-hint").textContent = STAGE_HINTS[currentStage];
    }

    function finishSession() {
        isComplete = true;
        stopTimer();

        const { accuracy, wpm } = calculateStats();
        const verseProgress = getVerseProgress(currentVerse.id);
        const completedStages = new Set(verseProgress.completedStages || []);

        if (accuracy >= 90) {
            completedStages.add(currentStage);
        }

        const nextStageIndex = STAGE_ORDER.indexOf(currentStage) + 1;
        const suggestedNextStage = STAGE_ORDER[nextStageIndex] || null;

        updateVerseProgress(currentVerse.id, {
            accuracy,
            bestWpm: Math.max(verseProgress.bestWpm || 0, wpm),
            reviewCount: (verseProgress.reviewCount || 0) + 1,
            lastReviewed: new Date().toISOString(),
            completedStages: [...completedStages],
            stage: accuracy >= 90 && suggestedNextStage ? suggestedNextStage : currentStage
        });

        document.getElementById("completion-reference").textContent = currentVerse.reference;
        document.getElementById("completion-wpm").textContent = wpm;
        document.getElementById("completion-accuracy").textContent = accuracy;

        const stageMessage = accuracy >= 90
            ? `${STAGE_LABELS[currentStage]} complete! Great work.`
            : `${STAGE_LABELS[currentStage]} finished. Aim for 90%+ accuracy to advance.`;
        document.getElementById("completion-stage").textContent = stageMessage;

        const nextStageBtn = document.getElementById("btn-next-stage");
        const nextVerseBtn = document.getElementById("btn-next-verse");

        if (accuracy >= 90 && suggestedNextStage) {
            nextStageBtn.classList.remove("hidden");
            nextVerseBtn.classList.add("hidden");
        } else {
            nextStageBtn.classList.add("hidden");
            nextVerseBtn.classList.remove("hidden");
        }

        document.getElementById("completion-overlay").classList.remove("hidden");
    }

    function setStage(stage) {
        currentStage = stage;
        document.querySelectorAll(".stage-tab").forEach(tab => {
            const isActive = tab.dataset.stage === stage;
            tab.classList.toggle("active", isActive);
            tab.setAttribute("aria-selected", isActive ? "true" : "false");
        });
        document.getElementById("stage-hint").textContent = STAGE_HINTS[stage];
        resetSession();
    }

    function setVerse(verseId) {
        currentVerse = verses.find(v => v.id === verseId) || verses[0];
        if (!currentVerse) {
            return;
        }

        document.getElementById("verse-select").value = currentVerse.id;
        document.getElementById("verse-reference").textContent = currentVerse.reference;

        const progress = getVerseProgress(currentVerse.id);
        if (progress.stage && STAGE_ORDER.includes(progress.stage)) {
            setStage(progress.stage);
        } else {
            resetSession();
        }
    }

    function populateCollections() {
        const select = document.getElementById("collection-select");
        select.innerHTML = collections.map(c =>
            `<option value="${c.id}">${escapeHtml(c.name)}</option>`
        ).join("");

        select.addEventListener("change", () => {
            filterVersesByCollection(select.value);
        });
    }

    function filterVersesByCollection(collectionId) {
        const filtered = verses.filter(v => v.collectionId === collectionId);
        populateVerseSelect(filtered);
        if (filtered.length > 0) {
            setVerse(filtered[0].id);
        }
    }

    function populateVerseSelect(verseList) {
        const select = document.getElementById("verse-select");
        select.innerHTML = verseList.map(v =>
            `<option value="${v.id}">${escapeHtml(v.reference)}</option>`
        ).join("");

        select.onchange = () => setVerse(select.value);
    }

    function focusTypingArea() {
        document.getElementById("typing-input").focus();
    }

    function bindPracticeEvents() {
        const input = document.getElementById("typing-input");
        const typingArea = document.getElementById("typing-area");

        typingArea.addEventListener("click", focusTypingArea);
        document.addEventListener("click", (event) => {
            if (!event.target.closest(".controls, .action-bar, .completion-overlay, select, button")) {
                focusTypingArea();
            }
        });

        input.addEventListener("input", (event) => {
            const value = event.target.value;
            if (!value) {
                return;
            }

            for (const char of value) {
                handleInput(char);
            }

            event.target.value = "";
        });

        input.addEventListener("keydown", (event) => {
            if (event.key === "Backspace") {
                event.preventDefault();
                handleBackspace();
            }

            if (event.key === "Escape") {
                resetSession();
            }

            if (event.key === "Tab") {
                event.preventDefault();
            }
        });

        document.querySelectorAll(".stage-tab").forEach(tab => {
            tab.addEventListener("click", () => setStage(tab.dataset.stage));
        });

        document.getElementById("btn-reset").addEventListener("click", () => resetSession());
        document.getElementById("btn-restart").addEventListener("click", () => resetSession());

        document.getElementById("btn-practice-again").addEventListener("click", () => resetSession());

        document.getElementById("btn-next-stage").addEventListener("click", () => {
            const nextIndex = STAGE_ORDER.indexOf(currentStage) + 1;
            if (STAGE_ORDER[nextIndex]) {
                setStage(STAGE_ORDER[nextIndex]);
            }
        });

        document.getElementById("btn-next-verse").addEventListener("click", () => {
            const collectionId = document.getElementById("collection-select").value;
            const filtered = verses.filter(v => v.collectionId === collectionId);
            const currentIndex = filtered.findIndex(v => v.id === currentVerse.id);
            const nextVerse = filtered[currentIndex + 1] || filtered[0];
            if (nextVerse) {
                setVerse(nextVerse.id);
            }
        });
    }

    function escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    function getCollectionName(collectionId) {
        return collections.find(c => c.id === collectionId)?.name || collectionId;
    }

    function renderStageDots(verseId) {
        const progress = getVerseProgress(verseId);
        const completed = new Set(progress.completedStages || []);
        const current = progress.stage || STAGES.TYPE_IT;

        return STAGE_ORDER.map(stage => {
            let className = "stage-dot";
            if (completed.has(stage)) {
                className += " complete";
            } else if (stage === current) {
                className += " current";
            }
            return `<div class="${className}" title="${STAGE_LABELS[stage]}"></div>`;
        }).join("");
    }

    async function initPractice() {
        [collections, verses] = await Promise.all([
            fetchJson("/api/collections"),
            fetchJson("/api/verses")
        ]);

        populateCollections();

        const params = new URLSearchParams(window.location.search);
        const requestedVerse = params.get("verse");
        const requestedStage = params.get("stage");

        if (collections.length > 0) {
            document.getElementById("collection-select").value = collections[0].id;
            filterVersesByCollection(collections[0].id);
        }

        if (requestedVerse && verses.some(v => v.id === requestedVerse)) {
            const verse = verses.find(v => v.id === requestedVerse);
            document.getElementById("collection-select").value = verse.collectionId;
            filterVersesByCollection(verse.collectionId);
            setVerse(requestedVerse);
        }

        if (requestedStage && STAGE_ORDER.includes(requestedStage)) {
            setStage(requestedStage);
        }

        bindPracticeEvents();
        focusTypingArea();
    }

    async function initLibrary() {
        [collections, verses] = await Promise.all([
            fetchJson("/api/collections"),
            fetchJson("/api/verses")
        ]);

        const collectionSelect = document.getElementById("library-collection");
        collections.forEach(c => {
            const option = document.createElement("option");
            option.value = c.id;
            option.textContent = c.name;
            collectionSelect.appendChild(option);
        });

        collectionSelect.addEventListener("change", renderLibrary);
        renderLibrary();
    }

    function renderLibrary() {
        const collectionId = document.getElementById("library-collection").value;
        const grid = document.getElementById("library-grid");
        const filtered = collectionId
            ? verses.filter(v => v.collectionId === collectionId)
            : verses;

        grid.innerHTML = filtered.map(verse => {
            const progress = getVerseProgress(verse.id);
            const completedCount = (progress.completedStages || []).length;

            return `
                <article class="library-card">
                    <div class="library-card-header">
                        <span class="library-reference">${escapeHtml(verse.reference)}</span>
                        <span class="library-collection-tag">${escapeHtml(getCollectionName(verse.collectionId))}</span>
                    </div>
                    <p class="library-text">${escapeHtml(verse.text)}</p>
                    <div class="stage-progress">${renderStageDots(verse.id)}</div>
                    <div class="library-meta">
                        <span>${completedCount}/3 stages</span>
                        <span>${progress.bestWpm ? `${progress.bestWpm} wpm best` : "not started"}</span>
                    </div>
                    <a class="library-practice-link" href="/?verse=${encodeURIComponent(verse.id)}">practice →</a>
                </article>
            `;
        }).join("");
    }

    return {
        initPractice,
        initLibrary
    };
})();
