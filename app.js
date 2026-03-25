if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (window.__gananSwReloading) return;
                window.__gananSwReloading = true;
                window.location.reload();
            });

            const registration = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });

            if (registration.waiting) {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }

            registration.addEventListener('updatefound', () => {
                const installing = registration.installing;
                if (!installing) return;
                installing.addEventListener('statechange', () => {
                    if (installing.state === 'installed' && registration.waiting) {
                        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                    }
                });
            });

            // Ask the browser to check for an updated service worker on each load.
            registration.update().catch(() => {});
        } catch (err) {
            console.error('Service Worker registration failed:', err);
        }
    });
}

const STORAGE_KEYS = {
    activeSessionId: 'ganan_activeSessionId',
    legacyPeople: 'ganan_people',
    legacyExpenses: 'ganan_expenses',
    legacyConversions: 'ganan_conversions',
    legacySmartSettlement: 'ganan_smartSettlement',
    legacyCollectorPerson: 'ganan_collectorPerson'
};

const FIREBASE_CONFIG = window.GANAN_FIREBASE_CONFIG || window.firebaseConfig || null;
const FIRESTORE_COLLECTIONS = {
    users: 'users',
    sessions: 'sessions',
    people: 'people',
    expenses: 'expenses'
};

const EPSILON = 0.01;
const BASE_CURRENCY = 'LKR';
const currencyFormatter = new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: BASE_CURRENCY,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

const currencyFormatters = new Map();
function formatMoney(amount, currency) {
    const normalized = normalizeCurrency(currency);
    if (normalized === BASE_CURRENCY) return currencyFormatter.format(amount);

    if (!currencyFormatters.has(normalized)) {
        try {
            currencyFormatters.set(
                normalized,
                new Intl.NumberFormat('en', {
                    style: 'currency',
                    currency: normalized,
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                })
            );
        } catch (error) {
            currencyFormatters.set(normalized, null);
        }
    }

    const formatter = currencyFormatters.get(normalized);
    if (!formatter) return `${normalized} ${Number(amount).toFixed(2)}`;
    return formatter.format(amount);
}

function normalizeCurrency(code) {
    const normalized = String(code || '').trim().toUpperCase();
    if (!normalized) return BASE_CURRENCY;
    return normalized;
}

function roundMoney(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function generateId(prefix) {
    const safePrefix = prefix ? `${prefix}_` : '';
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `${safePrefix}${crypto.randomUUID()}`;
    }
    return `${safePrefix}${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function showPage(pageId) {
    const pages = document.querySelectorAll('.page');
    pages.forEach((page) => {
        page.classList.toggle('active', page.id === pageId);
    });

    document.querySelectorAll('.nav-btn[data-page]').forEach((button) => {
        const isActive = button.getAttribute('data-page') === pageId;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-current', isActive ? 'page' : 'false');
    });

    closeMenu();
}

function toggleMenu() {
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('navMenu');
    const isOpen = navMenu.classList.toggle('active');
    hamburger.classList.toggle('active', isOpen);
    hamburger.setAttribute('aria-expanded', String(isOpen));
}

function closeMenu() {
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('navMenu');
    navMenu.classList.remove('active');
    hamburger.classList.remove('active');
    hamburger.setAttribute('aria-expanded', 'false');
}

const app = {
    firebaseApp: null,
    auth: null,
    db: null,
    currentUser: null,
    authReady: false,
    syncingSession: false,
    sessionsUnsubscribe: null,
    activeSessionUnsubscribe: null,
    pendingSaveTimer: null,
    joiningSessionId: null,
    loadingFromRemote: false,
    latestSessionPayloadSignature: '',
    sessions: [],
    activeSessionId: null,
    people: [],
    expenses: [],
    conversions: [],
    balances: {},
    editingIndex: null,
    smartSettlement: true,
    collectorPerson: null,
    fxAllocationsContextKey: null,
    conversionAllocationsContextKey: null,

    elements: {},

    initElements() {
        this.elements = {
            personInput: document.getElementById('personInput'),
            peopleList: document.getElementById('peopleList'),
            payerSelect: document.getElementById('payerSelect'),
            expenseCurrencyInput: document.getElementById('expenseCurrencyInput'),
            amountInput: document.getElementById('amountInput'),
            descriptionInput: document.getElementById('descriptionInput'),
            beneficiariesContainer: document.getElementById('beneficiariesContainer'),
            expenseForm: document.getElementById('expenseForm'),
            submitExpenseBtn: document.getElementById('submitExpenseBtn'),
            cancelEditBtn: document.getElementById('cancelEditBtn'),
            fxGroup: document.getElementById('fxGroup'),
            fxMethodSelect: document.getElementById('fxMethodSelect'),
            fxManualGroup: document.getElementById('fxManualGroup'),
            fxRateInput: document.getElementById('fxRateInput'),
            fxAllocationsGroup: document.getElementById('fxAllocationsGroup'),
            fxAutoFillBtn: document.getElementById('fxAutoFillBtn'),
            fxClearAllocationsBtn: document.getElementById('fxClearAllocationsBtn'),
            fxAllocationsContainer: document.getElementById('fxAllocationsContainer'),
            fxPreviewGroup: document.getElementById('fxPreviewGroup'),
            fxBasePreview: document.getElementById('fxBasePreview'),
            fxRatePreview: document.getElementById('fxRatePreview'),
            expenseListContainer: document.getElementById('expenseListContainer'),
            balancesContainer: document.getElementById('balancesContainer'),
            settlementsContainer: document.getElementById('settlementsContainer'),
            smartSettlementToggle: document.getElementById('smartSettlementToggle'),
            collectorGroup: document.getElementById('collectorGroup'),
            collectorSelect: document.getElementById('collectorSelect'),
            modeIndicator: document.getElementById('modeIndicator'),
            statPeople: document.getElementById('statPeople'),
            statExpenses: document.getElementById('statExpenses'),
            statTotal: document.getElementById('statTotal'),
            conversionForm: document.getElementById('conversionForm'),
            conversionPersonSelect: document.getElementById('conversionPersonSelect'),
            conversionFromAmount: document.getElementById('conversionFromAmount'),
            conversionFromCurrency: document.getElementById('conversionFromCurrency'),
            conversionToAmount: document.getElementById('conversionToAmount'),
            conversionToCurrency: document.getElementById('conversionToCurrency'),
            conversionNoteInput: document.getElementById('conversionNoteInput'),
            conversionFundingGroup: document.getElementById('conversionFundingGroup'),
            conversionFundingMethodSelect: document.getElementById('conversionFundingMethodSelect'),
            conversionManualGroup: document.getElementById('conversionManualGroup'),
            conversionFromRateToLkrInput: document.getElementById('conversionFromRateToLkrInput'),
            conversionAllocationsGroup: document.getElementById('conversionAllocationsGroup'),
            conversionAutoFillBtn: document.getElementById('conversionAutoFillBtn'),
            conversionClearAllocationsBtn: document.getElementById('conversionClearAllocationsBtn'),
            conversionAllocationsContainer: document.getElementById('conversionAllocationsContainer'),
            conversionPreviewGroup: document.getElementById('conversionPreviewGroup'),
            conversionCostPreview: document.getElementById('conversionCostPreview'),
            conversionRatePreview: document.getElementById('conversionRatePreview'),
            holdingsContainer: document.getElementById('holdingsContainer'),
            conversionListContainer: document.getElementById('conversionListContainer'),
            sessionSelect: document.getElementById('sessionSelect'),
            newSessionNameInput: document.getElementById('newSessionNameInput'),
            createSessionBtn: document.getElementById('createSessionBtn'),
            renameSessionNameInput: document.getElementById('renameSessionNameInput'),
            renameSessionBtn: document.getElementById('renameSessionBtn'),
            deleteSessionBtn: document.getElementById('deleteSessionBtn'),
            sessionSummaryContainer: document.getElementById('sessionSummaryContainer'),
            sessionMetaText: document.getElementById('sessionMetaText'),
            authStatusText: document.getElementById('authStatusText'),
            authSignedOutView: document.getElementById('authSignedOutView'),
            authSignedInView: document.getElementById('authSignedInView'),
            authUserText: document.getElementById('authUserText'),
            authEmailInput: document.getElementById('authEmailInput'),
            authPasswordInput: document.getElementById('authPasswordInput'),
            loginBtn: document.getElementById('loginBtn'),
            signupBtn: document.getElementById('signupBtn'),
            googleLoginBtn: document.getElementById('googleLoginBtn'),
            logoutBtn: document.getElementById('logoutBtn'),
            inviteGroup: document.getElementById('inviteGroup'),
            inviteLinkInput: document.getElementById('inviteLinkInput'),
            copyInviteBtn: document.getElementById('copyInviteBtn')
        };
    },

    addPerson(name) {
        const normalized = name.trim();
        if (!normalized || this.people.includes(normalized)) return;

        this.people.push(normalized);

        if (!this.collectorPerson) {
            this.collectorPerson = normalized;
        }

        this.render();
    },

    removePerson(name) {
        if (!confirm(`Are you sure you want to remove "${name}"?`)) return;

        this.people = this.people.filter((person) => person !== name);

        // Clean up expenses referencing removed person.
        this.expenses = this.expenses
            .map((expense) => ({
                ...expense,
                for: expense.for.filter((beneficiary) => beneficiary !== name)
            }))
            .filter((expense) => expense.payer !== name && expense.for.length > 0);

        this.conversions = this.conversions.filter((conversion) => conversion.person !== name);
        this.pruneMissingConversionReferences();

        if (this.collectorPerson === name) {
            this.collectorPerson = this.people[0] || null;
        }

        this.render();
    },

    upsertExpense(payload) {
        if (!payload?.payer || payload.amount <= 0 || payload.for.length === 0) return;

        if (this.editingIndex !== null) {
            this.expenses[this.editingIndex] = payload;
            this.editingIndex = null;
        } else {
            this.expenses.push(payload);
        }

        this.render();
    },

    getExpenseOriginal(expense) {
        const currency = normalizeCurrency(expense?.original?.currency || BASE_CURRENCY);
        const originalAmount = Number(expense?.original?.amount);
        if (Number.isFinite(originalAmount) && originalAmount > 0) {
            return { currency, amount: originalAmount };
        }
        return { currency: BASE_CURRENCY, amount: Number(expense?.amount) || 0 };
    },

    getConversionById(id) {
        return this.conversions.find((conversion) => conversion.id === id) || null;
    },

    getConversionLotRate(conversion) {
        const toAmount = Number(conversion?.to?.amount);
        const lkrCost = Number(conversion?.lkrCost);
        if (!Number.isFinite(toAmount) || toAmount <= 0) return null;
        if (!Number.isFinite(lkrCost) || lkrCost < 0) return null;
        return lkrCost / toAmount;
    },

    computeConversionUsage({ excludeExpenseId = null, excludeConversionId = null } = {}) {
        const used = {};
        const add = (conversionId, amount) => {
            if (!conversionId) return;
            const parsed = Number(amount);
            if (!Number.isFinite(parsed) || parsed <= 0) return;
            used[conversionId] = (used[conversionId] || 0) + parsed;
        };

        this.expenses.forEach((expense) => {
            if (excludeExpenseId && expense.id === excludeExpenseId) return;
            const sources = expense?.fx?.sources || [];
            sources.forEach((source) => {
                if (source?.kind !== 'conversion') return;
                add(source.conversionId, source.amount);
            });
        });

        this.conversions.forEach((conversion) => {
            if (excludeConversionId && conversion.id === excludeConversionId) return;
            const sources = conversion?.funding?.sources || [];
            sources.forEach((source) => {
                if (source?.kind !== 'conversion') return;
                add(source.conversionId, source.amount);
            });
        });

        return used;
    },

    getAvailableLots(person, currency, { excludeExpenseId = null, excludeConversionId = null } = {}) {
        const normalizedCurrency = normalizeCurrency(currency);
        const used = this.computeConversionUsage({ excludeExpenseId, excludeConversionId });

        return this.conversions
            .filter((conversion) => conversion.person === person && normalizeCurrency(conversion?.to?.currency) === normalizedCurrency)
            .map((conversion) => {
                const toAmount = Number(conversion?.to?.amount) || 0;
                const usedAmount = used[conversion.id] || 0;
                const remaining = Math.max(0, toAmount - usedAmount);
                return { conversion, remaining };
            })
            .filter(({ remaining }) => remaining > EPSILON)
            .sort((a, b) => (a.conversion.createdAt || 0) - (b.conversion.createdAt || 0));
    },

    computeSourcesLkrCost(sources) {
        let total = 0;
        for (const source of sources || []) {
            if (!source) continue;
            if (source.kind === 'manual') {
                const amount = Number(source.amount);
                const rate = Number(source.rateToBase);
                if (!Number.isFinite(amount) || amount <= 0) return null;
                if (!Number.isFinite(rate) || rate <= 0) return null;
                total += amount * rate;
                continue;
            }

            if (source.kind === 'conversion') {
                const amount = Number(source.amount);
                if (!Number.isFinite(amount) || amount <= 0) return null;
                const conversion = this.getConversionById(source.conversionId);
                const rate = this.getConversionLotRate(conversion);
                if (!conversion || rate === null) return null;
                total += amount * rate;
                continue;
            }
        }
        return total;
    },

    pruneMissingConversionReferences() {
        const existing = new Set(this.conversions.map((conversion) => conversion.id));
        const pruneSources = (sources) =>
            (sources || []).filter((source) => source?.kind !== 'conversion' || existing.has(source.conversionId));

        this.expenses = this.expenses.map((expense) => {
            if (!expense?.fx?.sources) return expense;
            const nextSources = pruneSources(expense.fx.sources);
            if (nextSources.length === expense.fx.sources.length) return expense;
            return { ...expense, fx: { ...expense.fx, sources: nextSources } };
        });

        this.conversions = this.conversions.map((conversion) => {
            if (!conversion?.funding?.sources) return conversion;
            const nextSources = pruneSources(conversion.funding.sources);
            if (nextSources.length === conversion.funding.sources.length) return conversion;
            return { ...conversion, funding: { ...conversion.funding, sources: nextSources } };
        });
    },

    calculateBalances() {
        const balances = Object.fromEntries(this.people.map((person) => [person, 0]));

        this.expenses.forEach((expense) => {
            const share = expense.amount / expense.for.length;
            balances[expense.payer] = (balances[expense.payer] || 0) + expense.amount;

            expense.for.forEach((beneficiary) => {
                balances[beneficiary] = (balances[beneficiary] || 0) - share;
            });
        });

        this.balances = balances;
        return balances;
    },

    calculateSettlements() {
        const balances = this.calculateBalances();

        const debtors = [];
        const creditors = [];

        Object.entries(balances).forEach(([person, balance]) => {
            if (balance < -EPSILON) {
                debtors.push({ person, amount: Math.abs(balance) });
            } else if (balance > EPSILON) {
                creditors.push({ person, amount: balance });
            }
        });

        debtors.sort((a, b) => a.amount - b.amount);
        creditors.sort((a, b) => a.amount - b.amount);

        const settlements = [];
        let debtorIndex = 0;
        let creditorIndex = 0;

        while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
            const debtor = debtors[debtorIndex];
            const creditor = creditors[creditorIndex];
            const settleAmount = Math.min(debtor.amount, creditor.amount);

            settlements.push({
                from: debtor.person,
                to: creditor.person,
                amount: settleAmount
            });

            debtor.amount -= settleAmount;
            creditor.amount -= settleAmount;

            if (debtor.amount < EPSILON) debtorIndex += 1;
            if (creditor.amount < EPSILON) creditorIndex += 1;
        }

        return settlements;
    },

    calculateSimpleSettlements(collector) {
        const balances = this.calculateBalances();

        return Object.entries(balances)
            .filter(([person]) => person !== collector)
            .flatMap(([person, balance]) => {
                if (balance < -EPSILON) {
                    return [{ from: person, to: collector, amount: Math.abs(balance) }];
                }
                if (balance > EPSILON) {
                    return [{ from: collector, to: person, amount: balance }];
                }
                return [];
            });
    },

    save() {
        if (this.loadingFromRemote) return;
        this.persistActiveSessionToMemory();
        this.queueRemoteSave();
    },

    async initFirebaseAndAuth() {
        if (typeof firebase === 'undefined' || !FIREBASE_CONFIG) {
            this.authReady = true;
            this.updateAuthUI();
            if (this.elements.authStatusText) {
                this.elements.authStatusText.textContent = 'Firebase is not configured. Add window.GANAN_FIREBASE_CONFIG before app.js.';
            }
            return;
        }

        try {
            this.firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
            this.auth = firebase.auth();
            this.db = firebase.firestore();
        } catch (error) {
            console.error('Firebase initialization failed:', error);
            this.authReady = true;
            this.updateAuthUI();
            if (this.elements.authStatusText) {
                this.elements.authStatusText.textContent = 'Failed to initialize Firebase. Check config.';
            }
            return;
        }

        this.auth.onAuthStateChanged(async (user) => {
            this.currentUser = user || null;
            this.authReady = true;
            this.updateAuthUI();

            if (!user) {
                this.stopSessionSync();
                this.sessions = [];
                this.activeSessionId = null;
                this.people = [];
                this.expenses = [];
                this.conversions = [];
                this.collectorPerson = null;
                this.render();
                return;
            }

            await this.ensureUserProfile(user);

            const inviteSessionId = this.getInviteSessionId();
            if (inviteSessionId) {
                await this.joinSessionByInvite(inviteSessionId);
            }

            this.startSessionSync();
        });
    },

    updateAuthUI() {
        const {
            authStatusText,
            authSignedOutView,
            authSignedInView,
            authUserText,
            inviteGroup
        } = this.elements;

        const isSignedIn = !!this.currentUser;
        if (authSignedOutView) authSignedOutView.hidden = isSignedIn;
        if (authSignedInView) authSignedInView.hidden = !isSignedIn;
        if (inviteGroup) inviteGroup.hidden = !isSignedIn || !this.activeSessionId;

        if (!this.authReady) {
            if (authStatusText) authStatusText.textContent = 'Loading authentication...';
            return;
        }

        if (!isSignedIn) {
            if (authStatusText) authStatusText.textContent = 'Sign in to sync sessions across devices and collaborators.';
            return;
        }

        if (authStatusText) authStatusText.textContent = 'Signed in. Session data is synced with Firestore.';
        if (authUserText) authUserText.textContent = this.currentUser.email || 'Signed in user';
    },

    async ensureUserProfile(user) {
        if (!this.db || !user?.uid) return;
        try {
            await this.db.collection(FIRESTORE_COLLECTIONS.users).doc(user.uid).set(
                {
                    uid: user.uid,
                    email: user.email || null,
                    displayName: user.displayName || null,
                    updatedAt: Date.now()
                },
                { merge: true }
            );
        } catch (error) {
            console.error('Failed to upsert user profile:', error);
        }
    },

    stopSessionSync() {
        if (this.sessionsUnsubscribe) {
            this.sessionsUnsubscribe();
            this.sessionsUnsubscribe = null;
        }
        if (this.pendingSaveTimer) {
            clearTimeout(this.pendingSaveTimer);
            this.pendingSaveTimer = null;
        }
    },

    startSessionSync() {
        if (!this.db || !this.currentUser?.uid) return;
        this.stopSessionSync();

        this.sessionsUnsubscribe = this.db
            .collection(FIRESTORE_COLLECTIONS.sessions)
            .where('memberIds', 'array-contains', this.currentUser.uid)
            .onSnapshot(
                async (snapshot) => {
                    const nextSessions = snapshot.docs
                        .map((doc) => ({ id: doc.id, ...doc.data() }))
                        .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));

                    if (nextSessions.length === 0) {
                        await this.createDefaultRemoteSession();
                        return;
                    }

                    this.sessions = nextSessions;

                    const inviteSessionId = this.getInviteSessionId();
                    const savedActiveId = localStorage.getItem(STORAGE_KEYS.activeSessionId);
                    const activeExists = (candidate) => candidate && this.sessions.some((session) => session.id === candidate);
                    const nextActiveId = activeExists(this.activeSessionId)
                        ? this.activeSessionId
                        : activeExists(inviteSessionId)
                        ? inviteSessionId
                        : activeExists(savedActiveId)
                        ? savedActiveId
                        : this.sessions[0].id;

                    if (nextActiveId !== this.activeSessionId) {
                        this.activeSessionId = nextActiveId;
                    }

                    localStorage.setItem(STORAGE_KEYS.activeSessionId, this.activeSessionId || '');
                    this.loadActiveSessionData();
                    this.render();
                },
                (error) => {
                    console.error('Failed to sync sessions:', error);
                    alert('Failed to sync sessions from Firestore.');
                }
            );
    },

    queueRemoteSave() {
        if (!this.db || !this.currentUser?.uid || !this.activeSessionId) return;

        if (this.pendingSaveTimer) {
            clearTimeout(this.pendingSaveTimer);
        }

        this.pendingSaveTimer = setTimeout(() => {
            this.pendingSaveTimer = null;
            this.flushActiveSessionToFirestore().catch((error) => {
                console.error('Failed to save session to Firestore:', error);
            });
        }, 250);
    },

    getActiveSessionSignature() {
        return JSON.stringify({
            activeSessionId: this.activeSessionId,
            people: this.people,
            expenses: this.expenses,
            conversions: this.conversions,
            smartSettlement: this.smartSettlement,
            collectorPerson: this.collectorPerson
        });
    },

    async flushActiveSessionToFirestore() {
        if (!this.db || !this.currentUser?.uid || !this.activeSessionId) return;
        const signature = this.getActiveSessionSignature();
        if (signature === this.latestSessionPayloadSignature) return;

        const session = this.getActiveSession();
        if (!session) return;

        const memberProfiles = session.memberProfiles || {};
        const memberIds = Array.from(new Set([...(Array.isArray(session.memberIds) ? session.memberIds : []), this.currentUser.uid]));
        const payload = {
            name: session.name || 'Session',
            ownerId: session.ownerId || this.currentUser.uid,
            memberIds,
            memberProfiles,
            createdAt: Number(session.createdAt) || Date.now(),
            updatedAt: Date.now(),
            data: {
                people: this.people,
                expenses: this.expenses,
                conversions: this.conversions,
                smartSettlement: this.smartSettlement,
                collectorPerson: this.collectorPerson
            }
        };

        await this.db.collection(FIRESTORE_COLLECTIONS.sessions).doc(this.activeSessionId).set(payload, { merge: true });
        await this.syncSessionScopedCollections(this.activeSessionId, payload.data, memberProfiles);
        this.latestSessionPayloadSignature = signature;
    },

    async syncSessionScopedCollections(sessionId, data, memberProfiles) {
        if (!this.db || !sessionId) return;

        const reverseMemberMap = new Map();
        Object.entries(memberProfiles || {}).forEach(([uid, personName]) => {
            if (!personName) return;
            reverseMemberMap.set(String(personName), uid);
        });

        const peopleSnapshot = await this.db.collection(FIRESTORE_COLLECTIONS.people).where('sessionId', '==', sessionId).get();
        const peopleById = new Map(peopleSnapshot.docs.map((doc) => [doc.id, doc]));
        const desiredPeopleIds = new Set();
        const peopleBatch = this.db.batch();

        (data.people || []).forEach((personName) => {
            const docId = `${sessionId}__${encodeURIComponent(String(personName)).slice(0, 120)}`;
            desiredPeopleIds.add(docId);
            peopleBatch.set(
                this.db.collection(FIRESTORE_COLLECTIONS.people).doc(docId),
                {
                    sessionId,
                    name: personName,
                    linkedUserId: reverseMemberMap.get(String(personName)) || null,
                    updatedAt: Date.now()
                },
                { merge: true }
            );
        });

        peopleById.forEach((doc, docId) => {
            if (!desiredPeopleIds.has(docId)) {
                peopleBatch.delete(doc.ref);
            }
        });
        await peopleBatch.commit();

        const expenseSnapshot = await this.db.collection(FIRESTORE_COLLECTIONS.expenses).where('sessionId', '==', sessionId).get();
        const expenseById = new Map(expenseSnapshot.docs.map((doc) => [doc.id, doc]));
        const desiredExpenseIds = new Set();
        const expenseBatch = this.db.batch();

        (data.expenses || []).forEach((expense) => {
            if (!expense?.id) return;
            desiredExpenseIds.add(expense.id);
            expenseBatch.set(
                this.db.collection(FIRESTORE_COLLECTIONS.expenses).doc(expense.id),
                {
                    ...expense,
                    sessionId,
                    updatedAt: Date.now()
                },
                { merge: true }
            );
        });

        expenseById.forEach((doc, docId) => {
            if (!desiredExpenseIds.has(docId)) {
                expenseBatch.delete(doc.ref);
            }
        });
        await expenseBatch.commit();
    },

    persistActiveSessionToMemory() {
        if (!this.activeSessionId) return;
        const session = this.sessions.find((item) => item.id === this.activeSessionId);
        if (!session) return;

        session.data = {
            people: this.people,
            expenses: this.expenses,
            conversions: this.conversions,
            smartSettlement: this.smartSettlement,
            collectorPerson: this.collectorPerson
        };
        session.updatedAt = Date.now();
    },

    readLegacyData() {
        const safeParse = (key, fallback) => {
            try {
                return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
            } catch {
                return fallback;
            }
        };

        const legacyPeople = safeParse(STORAGE_KEYS.legacyPeople, []);
        const legacyExpenses = safeParse(STORAGE_KEYS.legacyExpenses, []);
        const legacyConversions = safeParse(STORAGE_KEYS.legacyConversions, []);
        const legacySmartSettlement = safeParse(STORAGE_KEYS.legacySmartSettlement, true);
        const legacyCollectorPerson = localStorage.getItem(STORAGE_KEYS.legacyCollectorPerson) || null;

        return {
            people: Array.isArray(legacyPeople) ? legacyPeople : [],
            expenses: Array.isArray(legacyExpenses) ? legacyExpenses : [],
            conversions: Array.isArray(legacyConversions) ? legacyConversions : [],
            smartSettlement: typeof legacySmartSettlement === 'boolean' ? legacySmartSettlement : true,
            collectorPerson: legacyCollectorPerson || null
        };
    },

    async createDefaultRemoteSession() {
        if (!this.db || !this.currentUser?.uid) return;
        const legacy = this.readLegacyData();
        const now = Date.now();
        const id = generateId('sess');

        await this.db
            .collection(FIRESTORE_COLLECTIONS.sessions)
            .doc(id)
            .set({
                name: 'Default',
                ownerId: this.currentUser.uid,
                memberIds: [this.currentUser.uid],
                memberProfiles: {},
                createdAt: now,
                updatedAt: now,
                data: legacy
            });

        localStorage.setItem(STORAGE_KEYS.activeSessionId, id);
    },

    getInviteSessionId() {
        const params = new URLSearchParams(window.location.search);
        const inviteSessionId = params.get('session');
        return inviteSessionId ? String(inviteSessionId).trim() : null;
    },

    async joinSessionByInvite(sessionId) {
        if (!this.db || !this.currentUser?.uid || !sessionId || this.joiningSessionId === sessionId) return;
        this.joiningSessionId = sessionId;

        try {
            const ref = this.db.collection(FIRESTORE_COLLECTIONS.sessions).doc(sessionId);
            const snapshot = await ref.get();
            if (!snapshot.exists) {
                alert('Invite link is invalid or session no longer exists.');
                return;
            }

            const session = snapshot.data() || {};
            const memberIds = Array.isArray(session.memberIds) ? session.memberIds : [];
            const memberProfiles = session.memberProfiles && typeof session.memberProfiles === 'object' ? session.memberProfiles : {};

            if (memberIds.includes(this.currentUser.uid)) {
                this.activeSessionId = sessionId;
                localStorage.setItem(STORAGE_KEYS.activeSessionId, sessionId);
                return;
            }

            const sessionData = session.data && typeof session.data === 'object' ? session.data : {};
            const sessionPeople = Array.isArray(sessionData.people) ? sessionData.people.map((name) => String(name).trim()).filter(Boolean) : [];

            const linkedPerson = this.promptForPersonLink(sessionPeople);
            if (!linkedPerson) {
                alert('Joining cancelled.');
                return;
            }

            if (!sessionPeople.includes(linkedPerson)) {
                sessionPeople.push(linkedPerson);
            }

            memberProfiles[this.currentUser.uid] = linkedPerson;

            await ref.set(
                {
                    memberIds: firebase.firestore.FieldValue.arrayUnion(this.currentUser.uid),
                    memberProfiles,
                    updatedAt: Date.now(),
                    data: {
                        ...sessionData,
                        people: sessionPeople
                    }
                },
                { merge: true }
            );

            this.activeSessionId = sessionId;
            localStorage.setItem(STORAGE_KEYS.activeSessionId, sessionId);
        } catch (error) {
            console.error('Failed to join invited session:', error);
            alert('Failed to join the session.');
        } finally {
            this.joiningSessionId = null;
        }
    },

    promptForPersonLink(existingPeople) {
        const cleanPeople = Array.isArray(existingPeople) ? existingPeople.filter(Boolean) : [];
        if (cleanPeople.length === 0) {
            const createdName = prompt('No people in this session yet. Enter your name to join:');
            return String(createdName || '').trim() || null;
        }

        const list = cleanPeople.map((name, index) => `${index + 1}. ${name}`).join('\n');
        const response = prompt(
            `Join as which person?\n${list}\n\nType a number from the list, or type a new name to create another person:`,
            cleanPeople[0]
        );
        const trimmed = String(response || '').trim();
        if (!trimmed) return null;

        const index = Number(trimmed);
        if (Number.isFinite(index) && index >= 1 && index <= cleanPeople.length) {
            return cleanPeople[index - 1];
        }
        return trimmed;
    },

    getInviteLinkForActiveSession() {
        if (!this.activeSessionId) return '';
        const url = new URL(window.location.href);
        url.searchParams.set('session', this.activeSessionId);
        return url.toString();
    },

    async copyInviteLink() {
        const inviteLink = this.getInviteLinkForActiveSession();
        if (!inviteLink) return;

        try {
            await navigator.clipboard.writeText(inviteLink);
            alert('Invite link copied.');
        } catch {
            if (this.elements.inviteLinkInput) {
                this.elements.inviteLinkInput.focus();
                this.elements.inviteLinkInput.select();
            }
        }
    },

    async signUpWithEmail() {
        if (!this.auth) return;
        const email = this.elements.authEmailInput?.value?.trim();
        const password = this.elements.authPasswordInput?.value || '';
        if (!email || !password) {
            alert('Enter email and password.');
            return;
        }
        await this.auth.createUserWithEmailAndPassword(email, password);
    },

    async loginWithEmail() {
        if (!this.auth) return;
        const email = this.elements.authEmailInput?.value?.trim();
        const password = this.elements.authPasswordInput?.value || '';
        if (!email || !password) {
            alert('Enter email and password.');
            return;
        }
        await this.auth.signInWithEmailAndPassword(email, password);
    },

    async loginWithGoogle() {
        if (!this.auth) return;
        const provider = new firebase.auth.GoogleAuthProvider();
        await this.auth.signInWithPopup(provider);
    },

    async logout() {
        if (!this.auth) return;
        await this.auth.signOut();
    },

    getActiveSession() {
        if (!this.activeSessionId) return null;
        return this.sessions.find((session) => session.id === this.activeSessionId) || null;
    },

    loadActiveSessionData() {
        const session = this.getActiveSession();
        const data = session?.data || {};

        const clone = (value, fallback) => {
            try {
                return value ? JSON.parse(JSON.stringify(value)) : fallback;
            } catch {
                return fallback;
            }
        };

        this.people = clone(data.people, []);
        this.expenses = clone(data.expenses, []);
        this.conversions = clone(data.conversions, []);
        this.smartSettlement = typeof data.smartSettlement === 'boolean' ? data.smartSettlement : true;
        this.collectorPerson = data.collectorPerson || null;
        this.latestSessionPayloadSignature = this.getActiveSessionSignature();

        this.migrateData();

        if (this.people.length > 0 && (!this.collectorPerson || !this.people.includes(this.collectorPerson))) {
            this.collectorPerson = this.people[0];
        }

        this.resetExpenseForm();
        this.conversionAllocationsContextKey = null;
        this.fxAllocationsContextKey = null;
        this.syncSettlementControls();
    },

    syncSettlementControls() {
        if (!this.elements?.smartSettlementToggle) return;

        this.elements.smartSettlementToggle.checked = this.smartSettlement;
        this.elements.collectorGroup.hidden = this.smartSettlement;
        this.elements.modeIndicator.textContent = this.smartSettlement ? '(Optimized)' : '(Simple Collection)';

        if (!this.smartSettlement && !this.collectorPerson && this.people.length > 0) {
            this.collectorPerson = this.people[0];
        }

        if (this.collectorPerson) {
            this.elements.collectorSelect.value = this.collectorPerson;
        }
    },

    setActiveSession(sessionId) {
        const nextId = String(sessionId || '').trim();
        if (!nextId || nextId === this.activeSessionId) return;
        if (!this.sessions.some((session) => session.id === nextId)) return;

        this.activeSessionId = nextId;
        localStorage.setItem(STORAGE_KEYS.activeSessionId, this.activeSessionId);
        this.loadActiveSessionData();
        this.render();
    },

    async createSession(name) {
        if (!this.db || !this.currentUser?.uid) {
            alert('Please sign in first.');
            return;
        }

        const trimmed = String(name || '').trim();
        const sessionName = trimmed || `Session ${this.sessions.length + 1}`;
        const now = Date.now();
        const id = generateId('sess');

        await this.db
            .collection(FIRESTORE_COLLECTIONS.sessions)
            .doc(id)
            .set({
                name: sessionName,
                ownerId: this.currentUser.uid,
                memberIds: [this.currentUser.uid],
                memberProfiles: {},
                createdAt: now,
                updatedAt: now,
                data: {
                    people: [],
                    expenses: [],
                    conversions: [],
                    smartSettlement: true,
                    collectorPerson: null
                }
            });

        this.activeSessionId = id;
        localStorage.setItem(STORAGE_KEYS.activeSessionId, id);
    },

    async renameActiveSession(name) {
        const trimmed = String(name || '').trim();
        if (!trimmed) return;
        const session = this.getActiveSession();
        if (!session || !this.db) return;
        await this.db.collection(FIRESTORE_COLLECTIONS.sessions).doc(session.id).set({ name: trimmed, updatedAt: Date.now() }, { merge: true });
    },

    async deleteActiveSession() {
        if (this.sessions.length <= 1) {
            alert('You must keep at least one session.');
            return;
        }

        const session = this.getActiveSession();
        if (!session || !this.db) return;

        if (!confirm(`Delete session "${session.name}"? This will remove its people, expenses, and conversions.`)) return;

        await this.db.collection(FIRESTORE_COLLECTIONS.sessions).doc(session.id).delete();

        const peopleSnapshot = await this.db.collection(FIRESTORE_COLLECTIONS.people).where('sessionId', '==', session.id).get();
        const peopleBatch = this.db.batch();
        peopleSnapshot.forEach((doc) => peopleBatch.delete(doc.ref));
        await peopleBatch.commit();

        const expenseSnapshot = await this.db.collection(FIRESTORE_COLLECTIONS.expenses).where('sessionId', '==', session.id).get();
        const expenseBatch = this.db.batch();
        expenseSnapshot.forEach((doc) => expenseBatch.delete(doc.ref));
        await expenseBatch.commit();
    },

    migrateData() {
        if (!Array.isArray(this.people)) this.people = [];
        if (!Array.isArray(this.expenses)) this.expenses = [];
        if (!Array.isArray(this.conversions)) this.conversions = [];

        const knownPeople = new Set(this.people);

        this.expenses = this.expenses
            .map((expense) => {
                const baseAmount = Number(expense?.amount);
                const payer = String(expense?.payer || '').trim();
                const beneficiaries = Array.isArray(expense?.for) ? expense.for.filter((p) => knownPeople.has(p)) : [];
                const description = String(expense?.description || 'No description');

                const id = expense?.id || generateId('exp');
                const originalCurrency = normalizeCurrency(expense?.original?.currency || BASE_CURRENCY);
                const originalAmount = Number(expense?.original?.amount);

                const original =
                    Number.isFinite(originalAmount) && originalAmount > 0
                        ? { amount: originalAmount, currency: originalCurrency }
                        : { amount: Number.isFinite(baseAmount) ? baseAmount : 0, currency: BASE_CURRENCY };

                const fx = expense?.fx && typeof expense.fx === 'object' ? expense.fx : null;

                const normalizedFx = fx
                    ? {
                          method: fx.method,
                          rateToBase: fx.rateToBase,
                          sources: Array.isArray(fx.sources)
                              ? fx.sources
                                    .filter((source) => source && (source.kind === 'conversion' || source.kind === 'manual'))
                                    .map((source) => ({
                                        kind: source.kind,
                                        conversionId: source.conversionId,
                                        amount: Number(source.amount),
                                        rateToBase: Number(source.rateToBase)
                                    }))
                              : []
                      }
                    : null;

                return {
                    id,
                    payer,
                    amount: Number.isFinite(baseAmount) ? baseAmount : 0,
                    original,
                    fx: normalizedFx || undefined,
                    for: beneficiaries,
                    description,
                    createdAt: Number(expense?.createdAt) || 0
                };
            })
            .filter((expense) => knownPeople.has(expense.payer) && expense.for.length > 0 && expense.amount > 0);

        this.conversions = this.conversions
            .map((conversion) => {
                const id = conversion?.id || generateId('fx');
                const person = String(conversion?.person || '').trim();
                const fromCurrency = normalizeCurrency(conversion?.from?.currency || BASE_CURRENCY);
                const toCurrency = normalizeCurrency(conversion?.to?.currency || BASE_CURRENCY);
                const fromAmount = Number(conversion?.from?.amount) || 0;
                const toAmount = Number(conversion?.to?.amount) || 0;

                const funding = conversion?.funding && typeof conversion.funding === 'object' ? conversion.funding : null;
                const normalizedFunding = funding
                    ? {
                          method: funding.method,
                          rateToBase: Number(funding.rateToBase),
                          sources: Array.isArray(funding.sources)
                              ? funding.sources
                                    .filter((source) => source && (source.kind === 'conversion' || source.kind === 'manual'))
                                    .map((source) => ({
                                        kind: source.kind,
                                        conversionId: source.conversionId,
                                        amount: Number(source.amount),
                                        rateToBase: Number(source.rateToBase)
                                    }))
                              : []
                      }
                    : null;

                let lkrCost = Number(conversion?.lkrCost);
                if (!Number.isFinite(lkrCost) || lkrCost < 0) {
                    if (fromCurrency === BASE_CURRENCY) {
                        lkrCost = fromAmount;
                    } else if (normalizedFunding?.method === 'manual' && Number.isFinite(normalizedFunding.rateToBase) && normalizedFunding.rateToBase > 0) {
                        lkrCost = fromAmount * normalizedFunding.rateToBase;
                    } else if (Array.isArray(normalizedFunding?.sources) && normalizedFunding.sources.length > 0) {
                        const computed = this.computeSourcesLkrCost(normalizedFunding.sources);
                        lkrCost = computed === null ? 0 : computed;
                    } else {
                        lkrCost = 0;
                    }
                }

                return {
                    id,
                    person,
                    from: { amount: fromAmount, currency: fromCurrency },
                    to: { amount: toAmount, currency: toCurrency },
                    note: String(conversion?.note || ''),
                    funding: normalizedFunding || undefined,
                    lkrCost: Number.isFinite(lkrCost) ? lkrCost : 0,
                    createdAt: Number(conversion?.createdAt) || 0
                };
            })
            .filter((conversion) => knownPeople.has(conversion.person) && conversion.from.amount > 0 && conversion.to.amount > 0);
    },

    clearAll() {
        const sessionName = this.getActiveSession()?.name || 'current session';
        if (!confirm(`Clear all people, expenses, and conversions in "${sessionName}"? This cannot be undone.`)) return;

        this.people = [];
        this.expenses = [];
        this.conversions = [];
        this.balances = {};
        this.editingIndex = null;
        this.collectorPerson = null;

        this.resetExpenseForm();
        this.render();
    },

    resetExpenseForm() {
        this.elements.expenseForm.reset();
        this.editingIndex = null;
        this.fxAllocationsContextKey = null;
        this.elements.expenseCurrencyInput.value = BASE_CURRENCY;
        this.elements.fxRateInput.value = '';
        this.clearAllocations(this.elements.fxAllocationsContainer);
        this.refreshExpenseFxUI();
        this.elements.submitExpenseBtn.textContent = 'Add Expense';
        this.elements.cancelEditBtn.hidden = true;
    },

    render() {
        this.updateAuthUI();
        this.renderSessions();
        this.renderPeople();
        this.renderExpenseForm();
        this.renderConversionForm();
        this.renderExpenseList();
        this.renderHoldings();
        this.renderConversionList();
        this.renderBalances();
        this.renderSettlements();
        this.renderHomeStats();
        this.save();
    },

    renderHomeStats() {
        const total = this.expenses.reduce((sum, expense) => sum + expense.amount, 0);
        this.elements.statPeople.textContent = String(this.people.length);
        this.elements.statExpenses.textContent = String(this.expenses.length);
        this.elements.statTotal.textContent = currencyFormatter.format(total);
    },

    renderSessions() {
        const select = this.elements.sessionSelect;
        const container = this.elements.sessionSummaryContainer;
        if (!select || !container) return;

        const previousValue = select.value;
        const options = this.sessions
            .map((session) => `<option value="${this.escape(session.id)}">${this.escape(session.name || 'Session')}</option>`)
            .join('');

        select.innerHTML = options || '<option value="">No sessions</option>';
        select.value = this.activeSessionId || previousValue || (this.sessions[0]?.id || '');

        const active = this.getActiveSession();
        if (!active) {
            container.innerHTML = '<p class="empty-message">No session selected</p>';
            if (this.elements.inviteGroup) this.elements.inviteGroup.hidden = true;
            return;
        }

        if (this.elements.deleteSessionBtn) {
            this.elements.deleteSessionBtn.disabled = this.sessions.length <= 1;
        }
        if (this.elements.inviteGroup) {
            this.elements.inviteGroup.hidden = !this.currentUser;
        }
        if (this.elements.inviteLinkInput) {
            this.elements.inviteLinkInput.value = this.getInviteLinkForActiveSession();
        }

        const total = this.expenses.reduce((sum, expense) => sum + expense.amount, 0);
        const createdLabel = active.createdAt ? new Date(active.createdAt).toLocaleString() : '-';
        const updatedLabel = active.updatedAt ? new Date(active.updatedAt).toLocaleString() : '-';
        const memberCount = Array.isArray(active.memberIds) ? active.memberIds.length : 0;

        container.innerHTML = `
            <div class="stats-grid" aria-label="Session summary">
                <div class="stat-card">
                    <p class="stat-label">People</p>
                    <p class="stat-value">${this.people.length}</p>
                </div>
                <div class="stat-card">
                    <p class="stat-label">Expenses</p>
                    <p class="stat-value">${this.expenses.length}</p>
                </div>
                <div class="stat-card">
                    <p class="stat-label">Total (LKR)</p>
                    <p class="stat-value">${currencyFormatter.format(total)}</p>
                </div>
                <div class="stat-card">
                    <p class="stat-label">Members</p>
                    <p class="stat-value">${memberCount}</p>
                </div>
            </div>
            <p class="text-muted text-small">Created: ${this.escape(createdLabel)} • Updated: ${this.escape(updatedLabel)}</p>
        `;
    },

    renderPeople() {
        if (this.people.length === 0) {
            this.elements.peopleList.innerHTML = '<p class="empty-message">No people added yet</p>';
            return;
        }

        this.elements.peopleList.innerHTML = this.people
            .map(
                (person) => `
                    <li class="list-item">
                        <span>${this.escape(person)}</span>
                        <button class="btn-remove" data-person="${this.escape(person)}" type="button">Remove</button>
                    </li>
                `
            )
            .join('');
    },

    renderExpenseForm() {
        const previousPayer = this.elements.payerSelect.value;
        const previousCollector = this.elements.collectorSelect.value;
        const previousConversionPerson = this.elements.conversionPersonSelect.value;

        const buildOptions = (placeholder) => [
            `<option value="">${placeholder}</option>`,
            ...this.people.map((person) => `<option value="${this.escape(person)}">${this.escape(person)}</option>`)
        ].join('');

        this.elements.payerSelect.innerHTML = buildOptions('Select person');
        this.elements.collectorSelect.innerHTML = buildOptions('Select person to collect');
        this.elements.conversionPersonSelect.innerHTML = buildOptions('Select person');

        if (previousPayer) this.elements.payerSelect.value = previousPayer;
        if (previousCollector) this.elements.collectorSelect.value = previousCollector;
        if (previousConversionPerson) this.elements.conversionPersonSelect.value = previousConversionPerson;

        if (this.collectorPerson) {
            this.elements.collectorSelect.value = this.collectorPerson;
        }

        this.elements.beneficiariesContainer.innerHTML = this.people
            .map(
                (person) => `
                    <label class="checkbox-label">
                        <input type="checkbox" value="${this.escape(person)}" class="beneficiary-checkbox">
                        <span>${this.escape(person)}</span>
                    </label>
                `
            )
            .join('');

        this.refreshExpenseFxUI();
    },

    renderConversionForm() {
        this.refreshConversionFundingUI();
    },

    getEditingExpenseId() {
        if (this.editingIndex === null) return null;
        const expense = this.expenses[this.editingIndex];
        return expense?.id || null;
    },

    getAllocationsMapFromSources(sources) {
        const allocations = {};
        (sources || []).forEach((source) => {
            if (!source || source.kind !== 'conversion') return;
            const amount = Number(source.amount);
            if (!Number.isFinite(amount) || amount <= 0) return;
            allocations[source.conversionId] = (allocations[source.conversionId] || 0) + amount;
        });
        return allocations;
    },

    readAllocationSourcesFromContainer(container) {
        const sources = [];
        if (!container) return sources;

        container.querySelectorAll('input[data-conversion-id]').forEach((input) => {
            const conversionId = input.getAttribute('data-conversion-id');
            const amount = Number(input.value);
            if (!conversionId) return;
            if (!Number.isFinite(amount) || amount <= 0) return;
            sources.push({ kind: 'conversion', conversionId, amount });
        });

        return sources;
    },

    renderAllocationsEditor(container, lotsWithRemaining, allocationsMap) {
        if (!container) return;

        if (!lotsWithRemaining || lotsWithRemaining.length === 0) {
            container.innerHTML = '<p class="empty-message">No matching converted funds available</p>';
            return;
        }

        container.innerHTML = lotsWithRemaining
            .map(({ conversion, remaining }) => {
                const usedByDraft = allocationsMap?.[conversion.id] || 0;
                const availableForDraft = remaining;
                const rate = this.getConversionLotRate(conversion);
                const rateLabel = rate === null ? '' : `Rate: ${roundMoney(rate)} LKR/${this.escape(conversion.to.currency)}`;
                const remainingLabel = `Available: ${formatMoney(remaining, conversion.to.currency)}`;

                return `
                    <div class="allocation-item">
                        <div class="allocation-meta">
                            <div class="allocation-title">${this.escape(conversion.person)} • ${formatMoney(conversion.to.amount, conversion.to.currency)}</div>
                            <div class="allocation-subtitle">${this.escape(remainingLabel)} • Cost: ${formatMoney(conversion.lkrCost, BASE_CURRENCY)} • ${this.escape(rateLabel)}</div>
                        </div>
                        <input
                            type="number"
                            class="allocation-input"
                            data-conversion-id="${this.escape(conversion.id)}"
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                            max="${availableForDraft}"
                            value="${usedByDraft > 0 ? usedByDraft : ''}"
                        >
                    </div>
                `;
            })
            .join('');
    },

    autoFillAllocations(container, lotsWithRemaining, targetAmount) {
        if (!container) return;
        const remainingToFill = Number(targetAmount);
        if (!Number.isFinite(remainingToFill) || remainingToFill <= 0) return;

        let left = remainingToFill;
        lotsWithRemaining.forEach(({ conversion, remaining }) => {
            if (left <= EPSILON) return;
            const take = Math.min(left, remaining);
            const escapedId =
                typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(conversion.id) : String(conversion.id).replace(/\"/g, '\\"');
            const input = container.querySelector(`input[data-conversion-id="${escapedId}"]`);
            if (input) {
                input.value = take > 0 ? String(roundMoney(take)) : '';
            }
            left -= take;
        });
    },

    clearAllocations(container) {
        if (!container) return;
        container.querySelectorAll('input[data-conversion-id]').forEach((input) => {
            input.value = '';
        });
    },

    refreshExpenseFxUI() {
        const currency = normalizeCurrency(this.elements.expenseCurrencyInput.value);
        this.elements.expenseCurrencyInput.value = currency;

        const isBase = currency === BASE_CURRENCY;
        this.elements.fxGroup.hidden = isBase;
        this.elements.fxManualGroup.hidden = true;
        this.elements.fxAllocationsGroup.hidden = true;
        this.elements.fxPreviewGroup.hidden = isBase;

        if (isBase) {
            this.fxAllocationsContextKey = null;
            this.elements.fxRateInput.value = '';
            this.elements.fxRatePreview.textContent = '';
            this.elements.fxBasePreview.textContent = formatMoney(0, BASE_CURRENCY);
            return;
        }

        const method = this.elements.fxMethodSelect.value || 'manual';
        const payer = this.elements.payerSelect.value;
        const originalAmount = Number.parseFloat(this.elements.amountInput.value);
        const editingExpenseId = this.getEditingExpenseId();

        if (method === 'manual') {
            this.elements.fxManualGroup.hidden = false;
            const rate = Number.parseFloat(this.elements.fxRateInput.value);
            if (Number.isFinite(originalAmount) && originalAmount > 0 && Number.isFinite(rate) && rate > 0) {
                const base = roundMoney(originalAmount * rate);
                this.elements.fxBasePreview.textContent = formatMoney(base, BASE_CURRENCY);
                this.elements.fxRatePreview.textContent = ` • ${roundMoney(rate)} LKR/${currency}`;
            } else {
                this.elements.fxBasePreview.textContent = formatMoney(0, BASE_CURRENCY);
                this.elements.fxRatePreview.textContent = '';
            }
            return;
        }

        this.elements.fxAllocationsGroup.hidden = false;

        const contextKey = `${payer}|${currency}|${editingExpenseId || ''}`;
        const needsRebuild = this.fxAllocationsContextKey !== contextKey;
        this.fxAllocationsContextKey = contextKey;

        let lots = [];
        if (payer) {
            lots = this.getAvailableLots(payer, currency, { excludeExpenseId: editingExpenseId });
        }

        if (needsRebuild) {
            const existingSources = editingExpenseId
                ? this.expenses.find((expense) => expense.id === editingExpenseId)?.fx?.sources
                : null;
            const allocationsMap = this.getAllocationsMapFromSources(existingSources);
            this.renderAllocationsEditor(this.elements.fxAllocationsContainer, lots, allocationsMap);
        }

        const sources = this.readAllocationSourcesFromContainer(this.elements.fxAllocationsContainer);
        const sumOriginal = sources.reduce((sum, source) => sum + Number(source.amount || 0), 0);
        const cost = this.computeSourcesLkrCost(sources);

        if (cost !== null && Number.isFinite(originalAmount) && originalAmount > 0 && Math.abs(sumOriginal - originalAmount) < EPSILON) {
            const base = roundMoney(cost);
            const effectiveRate = base / originalAmount;
            this.elements.fxBasePreview.textContent = formatMoney(base, BASE_CURRENCY);
            this.elements.fxRatePreview.textContent = ` • ${roundMoney(effectiveRate)} LKR/${currency}`;
        } else {
            this.elements.fxBasePreview.textContent = formatMoney(0, BASE_CURRENCY);
            this.elements.fxRatePreview.textContent = sources.length > 0 ? ' • Allocations must match the amount' : '';
        }
    },

    refreshConversionFundingUI() {
        const person = this.elements.conversionPersonSelect.value;
        const fromCurrency = normalizeCurrency(this.elements.conversionFromCurrency.value);
        const toCurrency = normalizeCurrency(this.elements.conversionToCurrency.value);
        this.elements.conversionFromCurrency.value = fromCurrency;
        this.elements.conversionToCurrency.value = toCurrency;

        const fromAmount = Number.parseFloat(this.elements.conversionFromAmount.value);
        const toAmount = Number.parseFloat(this.elements.conversionToAmount.value);

        const needsFunding = fromCurrency !== BASE_CURRENCY;
        this.elements.conversionFundingGroup.hidden = !needsFunding;
        this.elements.conversionManualGroup.hidden = true;
        this.elements.conversionAllocationsGroup.hidden = true;
        this.elements.conversionPreviewGroup.hidden = false;

        if (!needsFunding) {
            const baseCost = Number.isFinite(fromAmount) && fromAmount > 0 ? roundMoney(fromAmount) : 0;
            const effectiveRate = Number.isFinite(toAmount) && toAmount > 0 ? baseCost / toAmount : null;
            this.elements.conversionCostPreview.textContent = formatMoney(baseCost, BASE_CURRENCY);
            this.elements.conversionRatePreview.textContent =
                effectiveRate !== null && Number.isFinite(effectiveRate) ? ` • ${roundMoney(effectiveRate)} LKR/${toCurrency}` : '';
            this.conversionAllocationsContextKey = null;
            return;
        }

        const method = this.elements.conversionFundingMethodSelect.value || 'allocations';

        if (method === 'manual') {
            this.elements.conversionManualGroup.hidden = false;
            const rate = Number.parseFloat(this.elements.conversionFromRateToLkrInput.value);
            const baseCost =
                Number.isFinite(fromAmount) && fromAmount > 0 && Number.isFinite(rate) && rate > 0 ? roundMoney(fromAmount * rate) : 0;
            const effectiveRate = Number.isFinite(toAmount) && toAmount > 0 ? baseCost / toAmount : null;

            this.elements.conversionCostPreview.textContent = formatMoney(baseCost, BASE_CURRENCY);
            this.elements.conversionRatePreview.textContent =
                effectiveRate !== null && Number.isFinite(effectiveRate) ? ` • ${roundMoney(effectiveRate)} LKR/${toCurrency}` : '';
            return;
        }

        this.elements.conversionAllocationsGroup.hidden = false;
        const contextKey = `${person}|${fromCurrency}`;
        const needsRebuild = this.conversionAllocationsContextKey !== contextKey;
        this.conversionAllocationsContextKey = contextKey;

        const lots = person ? this.getAvailableLots(person, fromCurrency) : [];
        if (needsRebuild) {
            this.renderAllocationsEditor(this.elements.conversionAllocationsContainer, lots, {});
        }

        const sources = this.readAllocationSourcesFromContainer(this.elements.conversionAllocationsContainer);
        const sumOriginal = sources.reduce((sum, source) => sum + Number(source.amount || 0), 0);
        const cost = this.computeSourcesLkrCost(sources);

        if (cost !== null && Number.isFinite(fromAmount) && fromAmount > 0 && Math.abs(sumOriginal - fromAmount) < EPSILON) {
            const baseCost = roundMoney(cost);
            const effectiveRate = Number.isFinite(toAmount) && toAmount > 0 ? baseCost / toAmount : null;
            this.elements.conversionCostPreview.textContent = formatMoney(baseCost, BASE_CURRENCY);
            this.elements.conversionRatePreview.textContent =
                effectiveRate !== null && Number.isFinite(effectiveRate) ? ` • ${roundMoney(effectiveRate)} LKR/${toCurrency}` : '';
        } else {
            this.elements.conversionCostPreview.textContent = formatMoney(0, BASE_CURRENCY);
            this.elements.conversionRatePreview.textContent = sources.length > 0 ? ' • Allocations must match the from amount' : '';
        }
    },

    renderHoldings() {
        const container = this.elements.holdingsContainer;
        if (!container) return;

        if (this.conversions.length === 0) {
            container.innerHTML = '<p class="empty-message">No holdings yet</p>';
            return;
        }

        const used = this.computeConversionUsage();
        const totals = new Map();

        this.conversions.forEach((conversion) => {
            const toAmount = Number(conversion?.to?.amount) || 0;
            const remaining = Math.max(0, toAmount - (used[conversion.id] || 0));
            if (remaining <= EPSILON) return;

            const key = `${conversion.person}__${normalizeCurrency(conversion.to.currency)}`;
            const rate = this.getConversionLotRate(conversion);
            const lkrValue = rate === null ? 0 : remaining * rate;
            const existing = totals.get(key) || {
                person: conversion.person,
                currency: normalizeCurrency(conversion.to.currency),
                remaining: 0,
                lkrValue: 0
            };

            existing.remaining += remaining;
            existing.lkrValue += lkrValue;
            totals.set(key, existing);
        });

        const rows = Array.from(totals.values())
            .filter((row) => row.remaining > EPSILON)
            .sort((a, b) => a.person.localeCompare(b.person) || a.currency.localeCompare(b.currency))
            .map((row) => {
                const effectiveRate = row.remaining > 0 ? row.lkrValue / row.remaining : 0;
                return `
                    <tr>
                        <td data-label="Person:">${this.escape(row.person)}</td>
                        <td data-label="Currency:">${this.escape(row.currency)}</td>
                        <td data-label="Remaining:">${formatMoney(row.remaining, row.currency)}</td>
                        <td data-label="Rate:">${row.lkrValue > 0 ? `${roundMoney(effectiveRate)} LKR/${this.escape(row.currency)}` : '-'}</td>
                        <td data-label="Value:">${formatMoney(roundMoney(row.lkrValue), BASE_CURRENCY)}</td>
                    </tr>
                `;
            })
            .join('');

        container.innerHTML =
            rows.length === 0
                ? '<p class="empty-message">No holdings yet</p>'
                : `
                    <table class="expense-table">
                        <thead>
                            <tr>
                                <th>Person</th>
                                <th>Currency</th>
                                <th>Remaining</th>
                                <th>Rate</th>
                                <th>Value (LKR)</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                `;
    },

    renderConversionList() {
        const container = this.elements.conversionListContainer;
        if (!container) return;

        if (this.conversions.length === 0) {
            container.innerHTML = '<p class="empty-message">No conversions yet</p>';
            return;
        }

        const used = this.computeConversionUsage();
        const rows = this.conversions
            .slice()
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
            .map((conversion) => {
                const remaining = Math.max(0, (Number(conversion?.to?.amount) || 0) - (used[conversion.id] || 0));
                const rate = this.getConversionLotRate(conversion);
                const toCurrency = normalizeCurrency(conversion?.to?.currency);
                const rateLabel = rate === null ? '-' : `${roundMoney(rate)} LKR/${toCurrency}`;
                const dateLabel = conversion.createdAt ? new Date(conversion.createdAt).toLocaleString() : '-';
                const note = conversion.note ? `<div class="text-muted text-small">${this.escape(conversion.note)}</div>` : '';

                return `
                    <tr>
                        <td data-label="Person:">${this.escape(conversion.person)}<div class="text-muted text-small">${this.escape(dateLabel)}</div></td>
                        <td data-label="From:">${formatMoney(conversion.from.amount, conversion.from.currency)}</td>
                        <td data-label="To:">${formatMoney(conversion.to.amount, conversion.to.currency)}${note}</td>
                        <td data-label="Cost:">${formatMoney(roundMoney(conversion.lkrCost), BASE_CURRENCY)}</td>
                        <td data-label="Rate:">${this.escape(rateLabel)}</td>
                        <td data-label="Remaining:">${formatMoney(remaining, conversion.to.currency)}</td>
                        <td data-label="">
                            <button class="btn-delete btn-conversion-delete" data-conv-id="${this.escape(conversion.id)}" type="button">Delete</button>
                        </td>
                    </tr>
                `;
            })
            .join('');

        container.innerHTML = `
            <table class="expense-table">
                <thead>
                    <tr>
                        <th>Person</th>
                        <th>From</th>
                        <th>To</th>
                        <th>Cost (LKR)</th>
                        <th>Rate</th>
                        <th>Remaining</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    },

    renderExpenseAmountCell(expense) {
        const original = this.getExpenseOriginal(expense);
        const base = Number(expense.amount) || 0;

        if (normalizeCurrency(original.currency) === BASE_CURRENCY) {
            return formatMoney(base, BASE_CURRENCY);
        }

        const method = expense?.fx?.method;
        let rateLabel = '';
        if (method === 'manual' && Number.isFinite(Number(expense?.fx?.rateToBase)) && Number(expense.fx.rateToBase) > 0) {
            rateLabel = `${roundMoney(Number(expense.fx.rateToBase))} LKR/${normalizeCurrency(original.currency)}`;
        } else if (original.amount > 0) {
            rateLabel = `${roundMoney(base / original.amount)} LKR/${normalizeCurrency(original.currency)}`;
        }

        const details = Array.isArray(expense?.fx?.sources) && expense.fx.sources.length > 0 ? this.renderFxSourcesDetails(expense) : '';

        return `
            <div>${formatMoney(base, BASE_CURRENCY)}</div>
            <div class="text-muted text-small">${formatMoney(original.amount, original.currency)} • ${this.escape(rateLabel)}</div>
            ${details}
        `;
    },

    renderFxSourcesDetails(expense) {
        const original = this.getExpenseOriginal(expense);
        const items = (expense?.fx?.sources || [])
            .map((source) => {
                if (!source) return null;
                if (source.kind === 'manual') {
                    const rate = Number(source.rateToBase);
                    if (!Number.isFinite(rate) || rate <= 0) return null;
                    return `<li>${formatMoney(source.amount, original.currency)} at ${roundMoney(rate)} LKR/${this.escape(original.currency)}</li>`;
                }

                if (source.kind === 'conversion') {
                    const conversion = this.getConversionById(source.conversionId);
                    if (!conversion) return `<li>${formatMoney(source.amount, original.currency)} from deleted conversion</li>`;
                    const lotRate = this.getConversionLotRate(conversion);
                    const rateLabel = lotRate === null ? '' : ` @ ${roundMoney(lotRate)} LKR/${this.escape(conversion.to.currency)}`;
                    const label = `${formatMoney(source.amount, conversion.to.currency)} from ${formatMoney(
                        conversion.from.amount,
                        conversion.from.currency
                    )} → ${formatMoney(conversion.to.amount, conversion.to.currency)}${rateLabel}`;
                    return `<li>${this.escape(label)}</li>`;
                }
                return null;
            })
            .filter(Boolean)
            .join('');

        if (!items) return '';
        return `
            <details class="text-small">
                <summary class="text-muted">Conversions</summary>
                <ul class="fx-breakdown">${items}</ul>
            </details>
        `;
    },

    renderExpenseList() {
        if (this.expenses.length === 0) {
            this.elements.expenseListContainer.innerHTML = '<p class="empty-message">No expenses yet</p>';
            return;
        }

        const rows = this.expenses
            .map((expense, index) => {
                const beneficiaries = expense.for.join(', ');
                return `
                    <tr>
                        <td data-label="Payer:">${this.escape(expense.payer)}</td>
                        <td data-label="Amount:">${this.renderExpenseAmountCell(expense)}</td>
                        <td data-label="Description:">${this.escape(expense.description)}</td>
                        <td data-label="For:">${this.escape(beneficiaries)}</td>
                        <td data-label="">
                            <div class="btn-group">
                                <button class="btn-edit" data-idx="${index}" type="button">Edit</button>
                                <button class="btn-delete" data-idx="${index}" type="button">Delete</button>
                            </div>
                        </td>
                    </tr>
                `;
            })
            .join('');

        this.elements.expenseListContainer.innerHTML = `
            <table class="expense-table">
                <thead>
                    <tr>
                        <th>Payer</th>
                        <th>Amount</th>
                        <th>Description</th>
                        <th>Beneficiaries</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    },

    editExpense(index) {
        const expense = this.expenses[index];
        if (!expense) return;

        this.editingIndex = index;
        this.elements.payerSelect.value = expense.payer;

        const original = this.getExpenseOriginal(expense);
        this.elements.expenseCurrencyInput.value = normalizeCurrency(original.currency);
        this.elements.amountInput.value = String(original.amount);
        this.elements.descriptionInput.value = expense.description;

        if (normalizeCurrency(original.currency) !== BASE_CURRENCY) {
            const method = expense?.fx?.method === 'allocations' ? 'allocations' : 'manual';
            this.elements.fxMethodSelect.value = method;
            this.elements.fxRateInput.value =
                method === 'manual' && Number.isFinite(Number(expense?.fx?.rateToBase)) ? String(expense.fx.rateToBase) : '';
            this.fxAllocationsContextKey = null;
        } else {
            this.elements.fxMethodSelect.value = 'manual';
            this.elements.fxRateInput.value = '';
            this.fxAllocationsContextKey = null;
        }

        this.refreshExpenseFxUI();

        document.querySelectorAll('.beneficiary-checkbox').forEach((checkbox) => {
            checkbox.checked = expense.for.includes(checkbox.value);
        });

        this.elements.submitExpenseBtn.textContent = 'Update Expense';
        this.elements.cancelEditBtn.hidden = false;

        showPage('add-expense');
    },

    cancelEdit() {
        this.resetExpenseForm();
    },

    renderBalances() {
        const balances = this.calculateBalances();
        const displayableBalances = Object.entries(balances)
            .filter(([, balance]) => Math.abs(balance) > EPSILON)
            .sort((a, b) => b[1] - a[1]);

        if (displayableBalances.length === 0) {
            this.elements.balancesContainer.innerHTML = '<p class="empty-message">No balances yet</p>';
            return;
        }

        this.elements.balancesContainer.innerHTML = displayableBalances
            .map(([person, balance]) => {
                const status = balance > 0 ? 'owed' : 'owes';
                const cssClass = balance > 0 ? 'balance-positive' : 'balance-negative';
                return `
                    <div class="balance-item ${cssClass}">
                        <span class="balance-person">${this.escape(person)}</span>
                        <span class="balance-amount">${status} ${currencyFormatter.format(Math.abs(balance))}</span>
                    </div>
                `;
            })
            .join('');
    },

    renderSettlements() {
        const container = this.elements.settlementsContainer;
        let settlements = [];

        if (this.smartSettlement) {
            settlements = this.calculateSettlements();
        } else {
            if (!this.collectorPerson) {
                container.innerHTML = '<p class="empty-message">Please select a collector person</p>';
                return;
            }
            settlements = this.calculateSimpleSettlements(this.collectorPerson);
        }

        if (settlements.length === 0) {
            container.innerHTML = '<p class="empty-message">No settlements needed</p>';
            return;
        }

        container.innerHTML = settlements
            .map(
                (settlement) => `
                    <div class="settlement-item">
                        <strong>${this.escape(settlement.from)}</strong> pays
                        <strong>${this.escape(settlement.to)}</strong>:
                        <span class="settlement-amount">${currencyFormatter.format(settlement.amount)}</span>
                    </div>
                `
            )
            .join('');
    },

    escape(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    app.initElements();
    app.initFirebaseAndAuth();
    app.syncSettlementControls();

    document.querySelector('.navbar').addEventListener('click', (event) => {
        const button = event.target.closest('button[data-page]');
        if (!button) return;
        showPage(button.getAttribute('data-page'));
    });

    document.querySelector('.home-buttons').addEventListener('click', (event) => {
        const button = event.target.closest('button[data-target]');
        if (!button) return;
        showPage(button.getAttribute('data-target'));
    });

    document.getElementById('hamburger').addEventListener('click', toggleMenu);

    app.elements.sessionSelect.addEventListener('change', (event) => {
        app.setActiveSession(event.target.value);
    });

    app.elements.createSessionBtn.addEventListener('click', async () => {
        const name = app.elements.newSessionNameInput.value;
        app.elements.newSessionNameInput.value = '';
        try {
            await app.createSession(name);
        } catch (error) {
            console.error('Failed to create session:', error);
            alert('Failed to create session.');
        }
        showPage('sessions');
    });

    app.elements.newSessionNameInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            app.elements.createSessionBtn.click();
        }
    });

    app.elements.renameSessionBtn.addEventListener('click', async () => {
        const name = app.elements.renameSessionNameInput.value;
        app.elements.renameSessionNameInput.value = '';
        try {
            await app.renameActiveSession(name);
        } catch (error) {
            console.error('Failed to rename session:', error);
            alert('Failed to rename session.');
        }
    });

    app.elements.renameSessionNameInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            app.elements.renameSessionBtn.click();
        }
    });

    app.elements.deleteSessionBtn.addEventListener('click', async () => {
        try {
            await app.deleteActiveSession();
        } catch (error) {
            console.error('Failed to delete session:', error);
            alert('Failed to delete session.');
        }
        showPage('sessions');
    });

    app.elements.copyInviteBtn?.addEventListener('click', () => {
        app.copyInviteLink();
    });

    app.elements.loginBtn?.addEventListener('click', async () => {
        try {
            await app.loginWithEmail();
        } catch (error) {
            console.error('Login failed:', error);
            alert(error?.message || 'Login failed');
        }
    });

    app.elements.signupBtn?.addEventListener('click', async () => {
        try {
            await app.signUpWithEmail();
        } catch (error) {
            console.error('Sign up failed:', error);
            alert(error?.message || 'Sign up failed');
        }
    });

    app.elements.googleLoginBtn?.addEventListener('click', async () => {
        try {
            await app.loginWithGoogle();
        } catch (error) {
            console.error('Google sign-in failed:', error);
            alert(error?.message || 'Google sign-in failed');
        }
    });

    app.elements.logoutBtn?.addEventListener('click', async () => {
        try {
            await app.logout();
        } catch (error) {
            console.error('Logout failed:', error);
            alert(error?.message || 'Logout failed');
        }
    });

    app.elements.authPasswordInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            app.elements.loginBtn?.click();
        }
    });

    app.elements.peopleList.addEventListener('click', (event) => {
        const button = event.target.closest('.btn-remove');
        if (!button) return;
        app.removePerson(button.getAttribute('data-person'));
    });

    app.elements.expenseListContainer.addEventListener('click', (event) => {
        const editBtn = event.target.closest('.btn-edit');
        if (editBtn) {
            app.editExpense(Number.parseInt(editBtn.getAttribute('data-idx'), 10));
            return;
        }

        const deleteBtn = event.target.closest('.btn-delete');
        if (!deleteBtn) return;

        const index = Number.parseInt(deleteBtn.getAttribute('data-idx'), 10);
        const expense = app.expenses[index];
        if (!expense) return;

        const original = app.getExpenseOriginal(expense);
        const originalLabel = normalizeCurrency(original.currency) === BASE_CURRENCY ? '' : ` (${formatMoney(original.amount, original.currency)})`;
        if (confirm(`Delete expense: ${expense.payer} - ${formatMoney(expense.amount, BASE_CURRENCY)}${originalLabel}?`)) {
            app.expenses.splice(index, 1);
            app.render();
        }
    });

    app.elements.cancelEditBtn.addEventListener('click', () => app.cancelEdit());

    document.getElementById('addPersonBtn').addEventListener('click', () => {
        const name = app.elements.personInput.value.trim();
        if (!name) return;

        app.addPerson(name);
        app.elements.personInput.value = '';
        app.elements.personInput.focus();
    });

    app.elements.personInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            document.getElementById('addPersonBtn').click();
        }
    });

    document.getElementById('selectAllBtn').addEventListener('click', () => {
        document.querySelectorAll('.beneficiary-checkbox').forEach((checkbox) => {
            checkbox.checked = true;
        });
    });

    document.getElementById('deselectAllBtn').addEventListener('click', () => {
        document.querySelectorAll('.beneficiary-checkbox').forEach((checkbox) => {
            checkbox.checked = false;
        });
    });

    const refreshExpenseFxUI = () => app.refreshExpenseFxUI();
    app.elements.expenseCurrencyInput.addEventListener('input', refreshExpenseFxUI);
    app.elements.payerSelect.addEventListener('change', refreshExpenseFxUI);
    app.elements.amountInput.addEventListener('input', refreshExpenseFxUI);
    app.elements.fxMethodSelect.addEventListener('change', refreshExpenseFxUI);
    app.elements.fxRateInput.addEventListener('input', refreshExpenseFxUI);
    app.elements.fxAllocationsContainer.addEventListener('input', refreshExpenseFxUI);

    app.elements.fxAutoFillBtn.addEventListener('click', () => {
        const payer = app.elements.payerSelect.value;
        const currency = normalizeCurrency(app.elements.expenseCurrencyInput.value);
        const originalAmount = Number.parseFloat(app.elements.amountInput.value);
        const editingExpenseId = app.getEditingExpenseId();
        const lots = payer ? app.getAvailableLots(payer, currency, { excludeExpenseId: editingExpenseId }) : [];

        app.clearAllocations(app.elements.fxAllocationsContainer);
        app.autoFillAllocations(app.elements.fxAllocationsContainer, lots, originalAmount);
        app.refreshExpenseFxUI();
    });

    app.elements.fxClearAllocationsBtn.addEventListener('click', () => {
        app.clearAllocations(app.elements.fxAllocationsContainer);
        app.refreshExpenseFxUI();
    });

    app.elements.expenseForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const payer = app.elements.payerSelect.value;
        const currency = normalizeCurrency(app.elements.expenseCurrencyInput.value);
        const originalAmount = Number.parseFloat(app.elements.amountInput.value);
        const description = app.elements.descriptionInput.value;
        const beneficiaries = Array.from(document.querySelectorAll('.beneficiary-checkbox:checked'), (checkbox) => checkbox.value);

        if (!payer) {
            alert('Please select a payer');
            return;
        }

        if (!Number.isFinite(originalAmount) || originalAmount <= 0) {
            alert('Please enter a valid amount');
            return;
        }

        if (beneficiaries.length === 0) {
            alert('Please select at least one beneficiary');
            return;
        }

        let baseAmount = originalAmount;
        let fx = undefined;

        const existingExpense = app.editingIndex !== null ? app.expenses[app.editingIndex] : null;
        const expenseId = existingExpense?.id || generateId('exp');
        const createdAt = existingExpense?.createdAt || Date.now();

        if (currency !== BASE_CURRENCY) {
            const method = app.elements.fxMethodSelect.value || 'manual';

            if (method === 'manual') {
                const rate = Number.parseFloat(app.elements.fxRateInput.value);
                if (!Number.isFinite(rate) || rate <= 0) {
                    alert('Please enter a valid exchange rate to LKR');
                    return;
                }
                baseAmount = roundMoney(originalAmount * rate);
                fx = { method: 'manual', rateToBase: rate, sources: [{ kind: 'manual', amount: originalAmount, rateToBase: rate }] };
            } else if (method === 'allocations') {
                const sources = app.readAllocationSourcesFromContainer(app.elements.fxAllocationsContainer);
                const sumOriginal = sources.reduce((sum, source) => sum + Number(source.amount || 0), 0);
                if (Math.abs(sumOriginal - originalAmount) >= EPSILON) {
                    alert('Allocations must match the expense amount');
                    return;
                }

                const lots = app.getAvailableLots(payer, currency, { excludeExpenseId: expenseId });
                const lotMap = new Map(lots.map(({ conversion, remaining }) => [conversion.id, remaining]));
                const requested = {};
                for (const source of sources) {
                    const conversion = app.getConversionById(source.conversionId);
                    if (!conversion || conversion.person !== payer || normalizeCurrency(conversion.to.currency) !== currency) {
                        alert('One or more allocations are invalid for this payer/currency');
                        return;
                    }
                    requested[source.conversionId] = (requested[source.conversionId] || 0) + source.amount;
                }

                for (const [conversionId, requestedAmount] of Object.entries(requested)) {
                    const available = lotMap.get(conversionId);
                    if (!Number.isFinite(available) || requestedAmount > available + EPSILON) {
                        alert('One or more allocations exceed remaining converted funds');
                        return;
                    }
                }

                const cost = app.computeSourcesLkrCost(sources);
                if (cost === null) {
                    alert('Failed to compute cost from allocations');
                    return;
                }
                baseAmount = roundMoney(cost);
                fx = { method: 'allocations', sources };
            } else {
                alert('Unsupported FX method');
                return;
            }
        } else {
            baseAmount = roundMoney(originalAmount);
        }

        const payload = {
            id: expenseId,
            payer,
            amount: baseAmount,
            original: { amount: originalAmount, currency },
            fx,
            for: beneficiaries,
            description: description?.trim() || 'No description',
            createdAt
        };

        app.upsertExpense(payload);
        app.resetExpenseForm();
    });

    const refreshConversionFundingUI = () => app.refreshConversionFundingUI();
    app.elements.conversionPersonSelect.addEventListener('change', refreshConversionFundingUI);
    app.elements.conversionFromCurrency.addEventListener('input', refreshConversionFundingUI);
    app.elements.conversionToCurrency.addEventListener('input', refreshConversionFundingUI);
    app.elements.conversionFromAmount.addEventListener('input', refreshConversionFundingUI);
    app.elements.conversionToAmount.addEventListener('input', refreshConversionFundingUI);
    app.elements.conversionFundingMethodSelect.addEventListener('change', refreshConversionFundingUI);
    app.elements.conversionFromRateToLkrInput.addEventListener('input', refreshConversionFundingUI);
    app.elements.conversionAllocationsContainer.addEventListener('input', refreshConversionFundingUI);

    app.elements.conversionAutoFillBtn.addEventListener('click', () => {
        const person = app.elements.conversionPersonSelect.value;
        const fromCurrency = normalizeCurrency(app.elements.conversionFromCurrency.value);
        const fromAmount = Number.parseFloat(app.elements.conversionFromAmount.value);
        const lots = person ? app.getAvailableLots(person, fromCurrency) : [];

        app.clearAllocations(app.elements.conversionAllocationsContainer);
        app.autoFillAllocations(app.elements.conversionAllocationsContainer, lots, fromAmount);
        app.refreshConversionFundingUI();
    });

    app.elements.conversionClearAllocationsBtn.addEventListener('click', () => {
        app.clearAllocations(app.elements.conversionAllocationsContainer);
        app.refreshConversionFundingUI();
    });

    app.elements.conversionForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const person = app.elements.conversionPersonSelect.value;
        const fromCurrency = normalizeCurrency(app.elements.conversionFromCurrency.value);
        const toCurrency = normalizeCurrency(app.elements.conversionToCurrency.value);
        const fromAmount = Number.parseFloat(app.elements.conversionFromAmount.value);
        const toAmount = Number.parseFloat(app.elements.conversionToAmount.value);
        const note = app.elements.conversionNoteInput.value?.trim() || '';

        if (!person) {
            alert('Please select a person');
            return;
        }

        if (!Number.isFinite(fromAmount) || fromAmount <= 0 || !Number.isFinite(toAmount) || toAmount <= 0) {
            alert('Please enter valid conversion amounts');
            return;
        }

        if (fromCurrency === toCurrency) {
            alert('From and to currencies must be different');
            return;
        }

        let lkrCost = 0;
        let funding = undefined;

        if (fromCurrency === BASE_CURRENCY) {
            lkrCost = roundMoney(fromAmount);
            funding = { method: 'base', sources: [{ kind: 'manual', amount: fromAmount, rateToBase: 1 }] };
        } else {
            const method = app.elements.conversionFundingMethodSelect.value || 'allocations';

            if (method === 'manual') {
                const rate = Number.parseFloat(app.elements.conversionFromRateToLkrInput.value);
                if (!Number.isFinite(rate) || rate <= 0) {
                    alert('Please enter a valid LKR rate for the from-currency');
                    return;
                }
                lkrCost = roundMoney(fromAmount * rate);
                funding = { method: 'manual', rateToBase: rate, sources: [{ kind: 'manual', amount: fromAmount, rateToBase: rate }] };
            } else if (method === 'allocations') {
                const sources = app.readAllocationSourcesFromContainer(app.elements.conversionAllocationsContainer);
                const sumFrom = sources.reduce((sum, source) => sum + Number(source.amount || 0), 0);
                if (Math.abs(sumFrom - fromAmount) >= EPSILON) {
                    alert('Allocations must match the from amount');
                    return;
                }

                const lots = app.getAvailableLots(person, fromCurrency);
                const lotMap = new Map(lots.map(({ conversion, remaining }) => [conversion.id, remaining]));
                const requested = {};
                for (const source of sources) {
                    const conversion = app.getConversionById(source.conversionId);
                    if (!conversion || conversion.person !== person || normalizeCurrency(conversion.to.currency) !== fromCurrency) {
                        alert('One or more allocations are invalid for this person/currency');
                        return;
                    }
                    requested[source.conversionId] = (requested[source.conversionId] || 0) + source.amount;
                }

                for (const [conversionId, requestedAmount] of Object.entries(requested)) {
                    const available = lotMap.get(conversionId);
                    if (!Number.isFinite(available) || requestedAmount > available + EPSILON) {
                        alert('One or more allocations exceed remaining holdings');
                        return;
                    }
                }

                const cost = app.computeSourcesLkrCost(sources);
                if (cost === null) {
                    alert('Failed to compute conversion cost from allocations');
                    return;
                }
                lkrCost = roundMoney(cost);
                funding = { method: 'allocations', sources };
            } else {
                alert('Unsupported funding method');
                return;
            }
        }

        const conversion = {
            id: generateId('fx'),
            person,
            from: { amount: fromAmount, currency: fromCurrency },
            to: { amount: toAmount, currency: toCurrency },
            note,
            funding,
            lkrCost,
            createdAt: Date.now()
        };

        app.conversions.push(conversion);
        app.elements.conversionForm.reset();
        app.conversionAllocationsContextKey = null;
        app.refreshConversionFundingUI();
        app.render();
    });

    app.elements.conversionListContainer.addEventListener('click', (event) => {
        const deleteBtn = event.target.closest('.btn-conversion-delete');
        if (!deleteBtn) return;

        const conversionId = deleteBtn.getAttribute('data-conv-id');
        const conversion = app.getConversionById(conversionId);
        if (!conversion) return;

        const used = app.computeConversionUsage();
        if ((used[conversionId] || 0) > EPSILON) {
            alert('This conversion is already used by an expense or another conversion and cannot be deleted.');
            return;
        }

        if (!confirm(`Delete conversion: ${conversion.person} ${formatMoney(conversion.from.amount, conversion.from.currency)} → ${formatMoney(conversion.to.amount, conversion.to.currency)}?`)) {
            return;
        }

        app.conversions = app.conversions.filter((c) => c.id !== conversionId);
        app.pruneMissingConversionReferences();
        app.render();
    });

    app.elements.smartSettlementToggle.addEventListener('change', (event) => {
        app.smartSettlement = event.target.checked;
        app.elements.collectorGroup.hidden = app.smartSettlement;
        app.elements.modeIndicator.textContent = app.smartSettlement ? '(Optimized)' : '(Simple Collection)';

        if (!app.smartSettlement && !app.collectorPerson && app.people.length > 0) {
            app.collectorPerson = app.people[0];
            app.elements.collectorSelect.value = app.collectorPerson;
        }

        app.renderSettlements();
        app.save();
    });

    app.elements.collectorSelect.addEventListener('change', (event) => {
        app.collectorPerson = event.target.value || null;
        app.renderSettlements();
        app.save();
    });

    document.getElementById('clearAllBtn').addEventListener('click', () => {
        app.clearAll();
    });

    document.addEventListener('click', (event) => {
        const nav = document.getElementById('navMenu');
        const hamburger = document.getElementById('hamburger');

        if (!nav.classList.contains('active')) return;
        if (event.target.closest('#navMenu') || event.target.closest('#hamburger')) return;

        nav.classList.remove('active');
        hamburger.classList.remove('active');
        hamburger.setAttribute('aria-expanded', 'false');
    });

    app.render();
    showPage('home');
});
