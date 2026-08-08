import { fetchDB, defaultDB, normalizeDB, money, setImageSource, resolveImageUrl, generateId } from './db.js';
import { showCustomAlert } from './ui.js';
let DB = normalizeDB(defaultDB());
const dataReady = fetchDB();

let CART = [];
let FAVORITES = []; // Favorites State
let currentPizza = null;
let currentMonteSeu = null;
let currentDeliveryFee = 0;
let renderedSections = [];
let searchTerm = ''; // Search state

// DOM Elements
const menuRoot = document.getElementById('menuRoot');
const searchInput = document.getElementById('searchInput');
const categoryModal = document.getElementById('categoryModal');
const categoryList = document.getElementById('categoryList');
const infoModal = document.getElementById('infoModal');
const cartModal = document.getElementById('cartModal');
const pizzaModal = document.getElementById('pizzaModal');
const pizzaModalTitle = document.getElementById('pizzaModalTitle');
const pizzaModalImg = document.getElementById('pizzaModalImg');
const pizzaSizes = document.getElementById('pizzaSizes');
const pizzaOptional = document.getElementById('pizzaOptional');
const pizzaOptionalLabel = document.getElementById('pizzaOptionalLabel');
const pizzaOptionalOptions = document.getElementById('pizzaOptionalOptions');
const pizzaHalfWrapper = document.getElementById('pizzaHalfWrapper');
const pizzaHalfToggle = document.getElementById('pizzaHalfToggle');
const pizzaHalfSelector = document.getElementById('pizzaHalfSelector');
const pizzaHalfSelect = document.getElementById('pizzaHalfSelect');
const pizzaPrice = document.getElementById('pizzaPrice');
const pizzaConfirm = document.getElementById('pizzaConfirm');
const monteSeuModal = document.getElementById('monteSeuModal');
const monteSeuModalTitle = document.getElementById('monteSeuModalTitle');
const monteSeuModalSizes = document.getElementById('monteSeuModalSizes');
const monteSeuModalAddons = document.getElementById('monteSeuModalAddons');
const monteSeuModalTotal = document.getElementById('monteSeuModalTotal');
const monteSeuModalConfirm = document.getElementById('monteSeuModalConfirm');



const btnMenu = document.getElementById('btnMenu');
const btnOrder = document.getElementById('btnOrder');
const btnInfo = document.getElementById('btnInfo');
const adminBtn = document.getElementById('adminBtn');
const cartItems = document.getElementById('cartItems');
const cartCount = document.getElementById('cartCount');
const subtotalEl = document.getElementById('subtotal');

const feeEl = document.getElementById('fee');
const totalEl = document.getElementById('total');

// Nossa História
const btnStory = document.getElementById('btnStory');
const storyModal = document.getElementById('storyModal');
const storyImage = document.getElementById('storyImage');
const storyImagePlaceholder = document.getElementById('storyImagePlaceholder');
const storyText = document.getElementById('storyText');
const storyCursor = document.getElementById('storyCursor');
let storyTypingTimer = null;
let CUSTOMER_HISTORY = [];
let HISTORY_DATE = '';
const headerInfo = document.getElementById('headerInfo');
const infoModalStatus = document.getElementById('infoModalStatus');
const infoModalDescription = document.getElementById('infoModalDescription');
const infoModalAddress = document.getElementById('infoModalAddress');
const infoModalWhatsapp = document.getElementById('infoModalWhatsapp');
const infoModalInstagram = document.getElementById('infoModalInstagram');
const deliveryType = document.getElementById('deliveryType');
const fieldAddress = document.getElementById('fieldAddress');
const fieldSitioRef = document.getElementById('fieldSitioRef');
const fieldSitioFee = document.getElementById('fieldSitioFee');
const selectSitioFee = document.getElementById('selectSitioFee');
const inputName = document.getElementById('inputName');
const inputAddress = document.getElementById('inputAddress');
const inputRef = document.getElementById('inputRef');
const inputWhatsapp = document.getElementById('inputWhatsapp'); // New Field
const inputNote = document.getElementById('inputNote');
const socialProofNotification = document.getElementById('socialProofNotification');
let socialProofTimer = null;
let socialProofHideTimer = null;



// Cart Persistence
function loadCart() {
    try {
        const stored = localStorage.getItem('cart');
        if (stored) {
            CART = JSON.parse(stored);
        }
    } catch (e) {
        console.error('Erro ao carregar carrinho:', e);
        CART = [];
    }
}

function saveCart() {
    try {
        localStorage.setItem('cart', JSON.stringify(CART));
    } catch (e) {
        console.error('Erro ao salvar carrinho:', e);
    }
}


function loadFavorites() {
    try {
        const stored = localStorage.getItem('favorites');
        if (stored) {
            FAVORITES = JSON.parse(stored);
        }
    } catch (e) {
        console.error('Erro ao carregar favoritos:', e);
        FAVORITES = [];
    }
}

function saveFavorites() {
    try {
        localStorage.setItem('favorites', JSON.stringify(FAVORITES));
    } catch (e) {
        console.error('Erro ao salvar favoritos:', e);
    }
}

function toggleFavorite(productId) {
    const index = FAVORITES.indexOf(productId);
    if (index === -1) {
        FAVORITES.push(productId);
        showToast('Adicionado aos favoritos', 'success');
    } else {
        FAVORITES.splice(index, 1);
        showToast('Removido dos favoritos', 'info');
    }
    saveFavorites();
    renderMenu();
}

// Logic Functions
function findCategory(catId) {
    return (DB.categories || []).find(cat => cat.id === catId) || null;
}






function loadCustomerHistory() {
    try {
        const stored = localStorage.getItem('customer_history');
        const date = localStorage.getItem('history_date');
        const now = new Date();
        const today = now.toLocaleDateString('pt-BR'); // "14/01/2026"

        // Force reset if date changed (simulating 24h cycle by calendar day)
        // If user wants strict 24h from last order, logic would be different.
        // Assuming "reset daily" logic as typical for restaurants.
        if (date !== today) {
            console.log('Resetting history for new day');
            CUSTOMER_HISTORY = [];
            HISTORY_DATE = today;
            localStorage.setItem('history_date', today);
            localStorage.setItem('customer_history', JSON.stringify([]));
        } else if (stored) {
            CUSTOMER_HISTORY = JSON.parse(stored);
            HISTORY_DATE = date;
        } else {
            // First run today
            CUSTOMER_HISTORY = [];
            HISTORY_DATE = today;
            localStorage.setItem('history_date', today);
            localStorage.setItem('customer_history', JSON.stringify([]));
        }
    } catch (e) {
        console.error('Erro ao carregar histórico:', e);
        // Recover from error
        CUSTOMER_HISTORY = [];
        localStorage.removeItem('customer_history');
    }
}

function addOrderToHistory(order) {
    CUSTOMER_HISTORY.unshift(order); // Newest first
    localStorage.setItem('customer_history', JSON.stringify(CUSTOMER_HISTORY));
}

function renderStoryImage(imageUrl) {
    const value = String(imageUrl || '').trim();
    if (!value) {
        storyImage.classList.add('hidden');
        storyImage.removeAttribute('src');
        storyImagePlaceholder.classList.remove('hidden');
        return;
    }
    storyImagePlaceholder.classList.add('hidden');
    storyImage.classList.remove('hidden');
    storyImage.onerror = () => {
        storyImage.classList.add('hidden');
        storyImagePlaceholder.classList.remove('hidden');
    };
    storyImage.src = resolveImageUrl(value);
}

function typeStory(text) {
    clearInterval(storyTypingTimer);
    const content = String(text || 'Nossa história está sendo escrita com muito sabor. Em breve, contaremos tudo por aqui.');
    storyText.textContent = '';
    storyCursor.classList.remove('hidden');

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        storyText.textContent = content;
        storyCursor.classList.add('hidden');
        return;
    }

    const startedAt = Date.now();
    const duration = Math.min(6500, Math.max(1800, content.length * 9));
    storyTypingTimer = setInterval(() => {
        const progress = Math.min(1, (Date.now() - startedAt) / duration);
        const index = Math.min(content.length, Math.ceil(content.length * progress));
        storyText.textContent = content.slice(0, index);
        if (index >= content.length) {
            clearInterval(storyTypingTimer);
            storyTypingTimer = null;
            storyCursor.classList.add('hidden');
        }
    }, 18);
}

function openStory() {
    const history = DB.info?.history || {};
    renderStoryImage(history.imageUrl);
    typeStory(history.bio);
    openModal(storyModal);
    storyModal.scrollTop = 0;
}

function closeStory() {
    clearInterval(storyTypingTimer);
    storyTypingTimer = null;
    closeModal(storyModal);
}
window.closeStory = closeStory;
function minPrice(product, useOffer = false) {
    const map = useOffer ? product.offerPrices : product.prices;
    if (!map) return Infinity;
    const values = Object.values(map).map(Number).filter(v => v > 0);
    return values.length ? Math.min(...values) : Infinity;
}

function hasOffer(product) {
    if (Number(product.offerPrice || 0) > 0 && Number(product.price || 0) > Number(product.offerPrice || 0)) {
        return true;
    }
    if (!product.offerPrices || !product.prices) return false;
    return Object.keys(product.offerPrices).some(key => {
        const offer = Number(product.offerPrices[key] || 0);
        const normal = Number(product.prices[key] || 0);
        return offer > 0 && normal > 0 && offer < normal;
    });
}

function findOptionGroup(groupId) {
    if (!groupId) return null;
    return (DB.optionGroups || []).find(group => group.id === groupId) || null;
}

function getOptionGroupForProduct(product) {
    const category = findCategory(product.categoryId);
    const groupId = product.optionGroupId || category?.optionGroupId;
    return findOptionGroup(groupId);
}

function allowsHalf(product) {
    const category = findCategory(product.categoryId);
    return !!(category && category.useSizes && category.allowHalf);
}

function getProductSizePrice(product, sizeKey) {
    const normal = Number(product.prices?.[sizeKey] || 0);
    const offer = Number(product.offerPrices?.[sizeKey] || 0);
    const price = offer > 0 && offer < normal ? offer : normal;
    return {
        price,
        normal,
        offer,
        hasOffer: offer > 0 && offer < normal
    };
}

function applyInfoToUI() {
    const info = DB.info || {};
    const schedule = info.description || 'Aberto hoje: 18h–23h';
    if (headerInfo) {
        if (info.open === false) {
            const closedText = schedule.replace(/^\s*Aberto/i, match => match.replace(/Aberto/i, 'Fechado'));
            headerInfo.textContent = closedText !== schedule ? closedText : `Fechado — ${schedule}`;
        } else {
            headerInfo.textContent = schedule;
        }
    }
    if (infoModalStatus) infoModalStatus.textContent = info.open === false ? 'Fechado' : 'Aberto';
    if (infoModalDescription) infoModalDescription.textContent = schedule;
    if (infoModalAddress) infoModalAddress.textContent = info.address || '-';
    if (infoModalWhatsapp) infoModalWhatsapp.textContent = info.whatsapp || '-';
    if (infoModalInstagram) infoModalInstagram.textContent = info.instagram || '-';
}

function openModal(modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeModal(modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const el = document.createElement('div');
    el.className = 'transform transition-all duration-300 ease-out translate-y-[-20px] opacity-0 bg-neutral-900 border border-neutral-800 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 pointer-events-auto';
    const icon = type === 'success' ? '<i class="fa-solid fa-check-circle text-green-500"></i>' : '<i class="fa-solid fa-circle-info text-brand-500"></i>';

    el.innerHTML = `${icon}<span class="text-sm font-medium">${message}</span>`;
    container.appendChild(el);

    requestAnimationFrame(() => el.classList.remove('translate-y-[-20px]', 'opacity-0'));

    setTimeout(() => {
        el.classList.add('opacity-0', 'translate-y-[-20px]');
        setTimeout(() => el.remove(), 300);
    }, 3000);
}

function hasOpenCustomerFlow() {
    return [categoryModal, infoModal, cartModal, pizzaModal, monteSeuModal, storyModal]
        .some(modal => modal && !modal.classList.contains('hidden'));
}

function scheduleSocialProof(delay = 30000 + Math.random() * 20000) {
    clearTimeout(socialProofTimer);
    socialProofTimer = setTimeout(showSocialProof, delay);
}

function hideSocialProof() {
    if (!socialProofNotification) return;
    socialProofNotification.classList.add('opacity-0', 'translate-y-3');
    socialProofHideTimer = setTimeout(() => {
        socialProofNotification.classList.add('hidden');
        scheduleSocialProof();
    }, 500);
}

function showSocialProof() {
    if (!socialProofNotification) return;
    if (document.hidden || hasOpenCustomerFlow()) {
        scheduleSocialProof(10000);
        return;
    }
    clearTimeout(socialProofHideTimer);
    socialProofNotification.classList.remove('hidden');
    requestAnimationFrame(() => {
        socialProofNotification.classList.remove('opacity-0', 'translate-y-3');
    });
    socialProofHideTimer = setTimeout(hideSocialProof, 5000);
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        clearTimeout(socialProofTimer);
        clearTimeout(socialProofHideTimer);
        if (socialProofNotification) socialProofNotification.classList.add('hidden', 'opacity-0', 'translate-y-3');
    } else {
        scheduleSocialProof(8000);
    }
});

function renderMenu() {
    renderedSections = [];
    menuRoot.innerHTML = '';

    DB.categories.forEach(category => {
        let products = DB.products.filter(product => product.categoryId === category.id);

        if (searchTerm) {
            products = products.filter(p =>
                p.name.toLowerCase().includes(searchTerm) ||
                (p.description || '').toLowerCase().includes(searchTerm)
            );
        }

        if (!products.length) return;

        const section = document.createElement('section');
        section.id = `category-${category.id}`;
        section.className = 'mb-8';

        const title = document.createElement('h2');
        title.className = 'text-xl md:text-2xl font-bold mb-3 pl-3 border-l-4 border-brand-600';
        title.textContent = category.name;
        section.appendChild(title);

        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3';
        section.appendChild(grid);

        products.forEach(product => {
            const disabled = product.available === false;
            const card = document.createElement('div');
            card.className = 'bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden shadow-glow flex flex-col';

            const imageWrapper = document.createElement('div');
            imageWrapper.className = 'relative';

            const img = document.createElement('img');
            img.className = 'w-full h-32 md:h-40 object-cover';
            img.alt = product.name;
            setImageSource(img, product.imageUrl);
            imageWrapper.appendChild(img);

            if (disabled) {
                const overlay = document.createElement('div');
                overlay.className = 'absolute inset-0 bg-black/60 flex items-center justify-center text-xs font-semibold';
                overlay.textContent = 'ESGOTADO';
                imageWrapper.appendChild(overlay);
            }

            if (hasOffer(product)) {
                const badge = document.createElement('div');
                badge.className = 'absolute top-2 right-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-md';
                badge.textContent = 'PROMOÇÃO';
                imageWrapper.appendChild(badge);
            }



            const favBtn = document.createElement('button');
            const isFav = FAVORITES.includes(product.id);
            favBtn.className = `absolute top-2 left-2 w-8 h-8 rounded-full flex items-center justify-center transition-colors shadow-sm ${isFav ? 'bg-red-600 text-white' : 'bg-white/90 text-neutral-400 hover:text-red-500'}`;
            favBtn.innerHTML = isFav ? '<i class="fa-solid fa-heart"></i>' : '<i class="fa-regular fa-heart"></i>';
            favBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleFavorite(product.id);
            });
            imageWrapper.appendChild(favBtn);

            card.appendChild(imageWrapper);

            const body = document.createElement('div');
            body.className = 'p-3 flex-1 flex flex-col';
            card.appendChild(body);

            const nameEl = document.createElement('h3');
            nameEl.className = 'font-semibold';
            nameEl.textContent = product.name;
            body.appendChild(nameEl);

            const descriptionText = (product.description || '').trim();
            if (descriptionText) {
                const descriptionEl = document.createElement('p');
                descriptionEl.className = 'text-xs text-neutral-400 mt-1';
                descriptionEl.textContent = descriptionText;
                body.appendChild(descriptionEl);
            }

            const priceSpan = document.createElement('span');
            priceSpan.className = 'text-sm text-neutral-400 mt-1';

            if (category.useSizes) {
                const min = minPrice(product);
                const offerMin = minPrice(product, true);
                if (offerMin < min) {
                    priceSpan.innerHTML = `<span class="text-red-500 font-bold">${money(offerMin)}</span> <del class="text-neutral-500">${money(min)}</del>`;
                } else if (min !== Infinity) {
                    priceSpan.textContent = `a partir de ${money(min)}`;
                } else {
                    priceSpan.textContent = 'Indisponível';
                }
            } else {
                const price = Number(product.price || 0);
                const offer = Number(product.offerPrice || 0);
                if (offer > 0 && offer < price) {
                    priceSpan.innerHTML = `<span class="text-red-500 font-bold">${money(offer)}</span> <del class="text-neutral-500">${money(price)}</del>`;
                } else if (price > 0) {
                    priceSpan.textContent = money(price);
                } else {
                    priceSpan.textContent = 'Indisponível';
                }
            }
            body.appendChild(priceSpan);

            const buttonsWrapper = document.createElement('div');
            buttonsWrapper.className = 'mt-auto pt-2';
            body.appendChild(buttonsWrapper);

            const actionBtn = document.createElement('button');
            actionBtn.className = `w-full rounded-lg px-3 py-2 text-sm font-semibold ${disabled ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700'}`;
            actionBtn.disabled = disabled;
            actionBtn.textContent = category.useSizes ? 'Escolher tamanho' : 'Adicionar';
            buttonsWrapper.appendChild(actionBtn);

            if (!disabled) {
                if (category.useSizes) {
                    actionBtn.addEventListener('click', () => openPizza(product));
                } else {
                    const price = Number(product.offerPrice || product.price || 0);
                    if (price > 0) {
                        actionBtn.addEventListener('click', () => {
                            const cat = DB.categories.find(c => c.id === product.categoryId);
                            addToCart({
                                id: product.id,
                                name: product.name,
                                price,
                                qty: 1,
                                meta: {
                                    categoryId: product.categoryId,
                                    categoryName: cat ? cat.name : 'Outros'
                                }
                            });
                        });
                    } else {
                        actionBtn.disabled = true;
                        actionBtn.className = 'w-full rounded-lg px-3 py-2 text-sm font-semibold bg-neutral-800 text-neutral-500 cursor-not-allowed';
                    }
                }
            }

            grid.appendChild(card);
        });

        menuRoot.appendChild(section);
        renderedSections.push({ id: section.id, label: category.name, type: 'category' });
    });

    (DB.monteSeu || []).forEach(item => {
        if (searchTerm && !item.name.toLowerCase().includes(searchTerm)) return;

        const section = document.createElement('section');
        section.id = `category-${item.id}`;
        section.className = 'mb-8';

        const title = document.createElement('h2');
        title.className = 'text-xl md:text-2xl font-bold mb-3 pl-3 border-l-4 border-brand-600';
        title.textContent = item.name;
        section.appendChild(title);

        const action = document.createElement('button');
        action.type = 'button';
        action.className = 'w-full bg-neutral-950 border border-neutral-800 rounded-xl shadow-glow p-5 text-left flex flex-col items-start gap-3 hover:border-brand-600 hover:bg-brand-500/10 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-600 focus:ring-offset-2 focus:ring-offset-black';
        action.setAttribute('aria-label', `Montar ${item.name}`);
        action.addEventListener('click', () => openMonteSeuModal(item.id));

        const text = document.createElement('p');
        text.className = 'text-neutral-300 text-sm';
        text.textContent = 'Clique para montar do seu jeito.';
        action.appendChild(text);

        const hint = document.createElement('span');
        hint.className = 'inline-flex items-center gap-2 text-brand-400 text-xs font-semibold uppercase tracking-wide';
        hint.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Montar agora';
        action.appendChild(hint);

        section.appendChild(action);
        menuRoot.appendChild(section);
        renderedSections.push({ id: section.id, label: item.name, type: 'monteSeu', monteSeuId: item.id });
    });

    renderCategoryModal();
}

function renderCategoryModal() {
    categoryList.innerHTML = '';
    renderedSections.forEach(section => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'px-3 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-sm';
        button.dataset.target = section.id;
        button.dataset.kind = section.type || 'category';
        if (section.type === 'monteSeu' && section.monteSeuId) {
            button.dataset.monteSeuId = section.monteSeuId;
        }
        button.textContent = section.label;
        categoryList.appendChild(button);
    });
}

function openCategoryModal() {
    renderCategoryModal();
    openModal(categoryModal);
}

function closeCategoryModal() {
    closeModal(categoryModal);
}
window.closeCategoryModal = closeCategoryModal;

categoryList.addEventListener('click', event => {
    const button = event.target.closest('button[data-target]');
    if (!button) return;
    const targetId = button.dataset.target;
    const kind = button.dataset.kind;
    const monteSeuId = button.dataset.monteSeuId;
    closeCategoryModal();
    setTimeout(() => {
        if (kind === 'monteSeu' && monteSeuId) {
            openMonteSeuModal(monteSeuId);
        } else {
            const el = document.getElementById(targetId);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 120);
});

function openInfo() {
    openModal(infoModal);
}

function closeInfo() {
    closeModal(infoModal);
}
window.closeInfo = closeInfo;

function openCart() {
    renderCart();
    openModal(cartModal);
}

function closeCart() {
    closeModal(cartModal);
}
window.closeCart = closeCart;

function openPizza(product) {
    const category = findCategory(product.categoryId);
    const optionGroup = getOptionGroupForProduct(product);

    currentPizza = {
        product,
        category,
        optionGroup,
        selectedSize: null,
        option: null,
        half: { enabled: false, product: null, key: null },
        total: 0
    };

    pizzaModalTitle.textContent = `Escolha o tamanho — ${product.name}`;
    setImageSource(pizzaModalImg, product.imageUrl, { lazy: false });
    pizzaModalImg.alt = product.name;

    pizzaSizes.innerHTML = '';
    pizzaOptional.classList.add('hidden');
    pizzaOptionalOptions.innerHTML = '';
    pizzaOptionalLabel.textContent = '';
    pizzaHalfWrapper.classList.add('hidden');
    pizzaHalfSelector.classList.add('hidden');
    pizzaHalfToggle.checked = false;
    pizzaHalfSelect.innerHTML = '';

    const prices = product.prices || {};
    const sizePriority = ['p', 'm', 'g'];
    const keys = Object.keys(prices)
        .filter(key => Number(prices[key]) > 0)
        .sort((a, b) => {
            const ai = sizePriority.indexOf(a.toLowerCase());
            const bi = sizePriority.indexOf(b.toLowerCase());
            if (ai === -1 && bi === -1) return a.localeCompare(b);
            if (ai === -1) return 1;
            if (bi === -1) return -1;
            return ai - bi;
        });
    if (!keys.length) {
        showCustomAlert('Este produto está indisponível no momento.');
        return;
    }

    keys.forEach(key => {
        const priceInfo = getProductSizePrice(product, key);
        if (priceInfo.price <= 0) return;
        const sizeDisplay = key.toUpperCase();
        const sizeLabelMap = { p: 'Pequena', m: 'Média', g: 'Grande' };
        const sizeLabelText = sizeLabelMap[key.toLowerCase()] || sizeDisplay;

        const label = document.createElement('label');
        label.className = 'flex flex-col gap-1 bg-neutral-800 rounded-lg px-3 py-3 text-sm border border-transparent cursor-pointer hover:border-brand-600 transition-colors';

        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'pizza-size';
        radio.value = key;
        radio.className = 'sr-only';
        label.appendChild(radio);

        const sizeName = document.createElement('span');
        sizeName.className = 'font-semibold';
        sizeName.textContent = sizeDisplay;
        label.appendChild(sizeName);

        const priceLine = document.createElement('span');
        priceLine.className = 'text-xs text-neutral-400';
        if (priceInfo.hasOffer) {
            priceLine.innerHTML = `<span class="text-red-500 font-semibold">${money(priceInfo.price)}</span> <del>${money(priceInfo.normal)}</del>`;
        } else {
            priceLine.textContent = money(priceInfo.price);
        }
        label.appendChild(priceLine);

        radio.addEventListener('change', () => {
            pizzaSizes.querySelectorAll('label').forEach(lbl => lbl.classList.remove('border-brand-600', 'bg-brand-500/10'));
            label.classList.add('border-brand-600', 'bg-brand-500/10');
            currentPizza.selectedSize = {
                key,
                label: sizeLabelText,
                price: priceInfo.price
            };
            updatePizzaPrice();
        });

        pizzaSizes.appendChild(label);
    });

    if (optionGroup && Array.isArray(optionGroup.options) && optionGroup.options.length) {
        pizzaOptional.classList.remove('hidden');
        pizzaOptionalOptions.innerHTML = '';
        const labelText = optionGroup.label || optionGroup.name || 'Escolha a opção';
        pizzaOptionalLabel.textContent = labelText;

        const optionRows = [];

        const noneLabel = document.createElement('label');
        noneLabel.className = 'flex items-center justify-between bg-neutral-800 rounded-lg px-3 py-2 text-sm border border-transparent cursor-pointer hover:border-brand-600 transition-colors';
        const noneRadio = document.createElement('input');
        noneRadio.type = 'radio';
        noneRadio.name = 'pizza-option';
        noneRadio.value = '';
        noneRadio.className = 'sr-only';
        noneLabel.appendChild(noneRadio);
        const noneText = document.createElement('span');
        const baseLabel = optionGroup.name || 'opção';
        noneText.textContent = `Sem ${baseLabel.toLowerCase()}`;
        noneLabel.appendChild(noneText);
        const nonePrice = document.createElement('span');
        nonePrice.className = 'text-xs text-neutral-400';
        nonePrice.textContent = 'Sem custo';
        noneLabel.appendChild(nonePrice);
        pizzaOptionalOptions.appendChild(noneLabel);
        optionRows.push({ label: noneLabel, radio: noneRadio, option: null });

        optionGroup.options.forEach((opt, idx) => {
            const row = document.createElement('label');
            row.className = 'flex items-center justify-between bg-neutral-800 rounded-lg px-3 py-2 text-sm border border-transparent cursor-pointer hover:border-brand-600 transition-colors';
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'pizza-option';
            radio.value = String(idx);
            radio.className = 'sr-only';
            row.appendChild(radio);
            const textSpan = document.createElement('span');
            textSpan.textContent = opt.name;
            row.appendChild(textSpan);
            const priceSpan = document.createElement('span');
            priceSpan.className = 'text-xs text-neutral-400';
            priceSpan.textContent = Number(opt.price || 0) > 0 ? `+ ${money(Number(opt.price || 0))}` : 'Sem custo';
            row.appendChild(priceSpan);
            pizzaOptionalOptions.appendChild(row);
            optionRows.push({ label: row, radio, option: opt });
        });

        optionRows.forEach(({ label, radio, option }) => {
            radio.addEventListener('change', () => {
                pizzaOptionalOptions.querySelectorAll('label').forEach(lbl => lbl.classList.remove('border-brand-600', 'bg-brand-500/10'));
                label.classList.add('border-brand-600', 'bg-brand-500/10');
                if (option) {
                    currentPizza.option = {
                        name: option.name,
                        price: Number(option.price || 0),
                        label: optionGroup.name || optionGroup.label || 'Opcional'
                    };
                } else {
                    currentPizza.option = null;
                }
                updatePizzaPrice();
            });
        });

        optionRows[0].radio.checked = true;
        optionRows[0].radio.dispatchEvent(new Event('change'));
    } else {
        pizzaOptional.classList.add('hidden');
        pizzaOptionalOptions.innerHTML = '';
        currentPizza.option = null;
    }

    const sameCategoryProducts = DB.products
        .filter(p => p.categoryId === product.categoryId && p.available !== false)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const hasOtherProducts = sameCategoryProducts.some(p => p.id !== product.id);
    if (allowsHalf(product) && hasOtherProducts) {
        pizzaHalfWrapper.classList.remove('hidden');
        pizzaHalfSelector.classList.add('hidden');
        pizzaHalfToggle.checked = false;
        pizzaHalfSelect.innerHTML = '<option value="">Selecione...</option>';
        sameCategoryProducts.forEach(p => {
            if (p.id === product.id) return;
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = p.name;
            pizzaHalfSelect.appendChild(option);
        });
        currentPizza.half = { enabled: false, product: null, key: null };
    } else {
        pizzaHalfWrapper.classList.add('hidden');
        pizzaHalfSelector.classList.add('hidden');
        pizzaHalfToggle.checked = false;
        pizzaHalfSelect.innerHTML = '';
        currentPizza.half = { enabled: false, product: null, key: null };
    }

    updatePizzaPrice();
    openModal(pizzaModal);
}

function closePizzaModal() {
    closeModal(pizzaModal);
    pizzaOptional.classList.add('hidden');
    pizzaOptionalOptions.innerHTML = '';
    pizzaHalfWrapper.classList.add('hidden');
    pizzaHalfSelector.classList.add('hidden');
    pizzaHalfToggle.checked = false;
    pizzaHalfSelect.innerHTML = '';
    currentPizza = null;
}
window.closePizzaModal = closePizzaModal;

function updatePizzaPrice() {
    if (!currentPizza || !currentPizza.selectedSize) {
        pizzaPrice.textContent = money(0);
        return;
    }
    let total = currentPizza.selectedSize.price;
    if (currentPizza.half?.enabled && currentPizza.half.product) {
        const otherPriceInfo = getProductSizePrice(currentPizza.half.product, currentPizza.selectedSize.key);
        if (otherPriceInfo.price > 0) {
            total = Math.max(total, otherPriceInfo.price);
        }
    }
    if (currentPizza.option && Number(currentPizza.option.price || 0) > 0) {
        total += Number(currentPizza.option.price || 0);
    }
    currentPizza.total = total;
    pizzaPrice.textContent = money(total);

    if (currentPizza.half?.enabled) {
        const sizeKey = currentPizza.selectedSize.key;
        const options = Array.from(pizzaHalfSelect.options);
        options.forEach(opt => {
            if (!opt.value) return;
            const product = DB.products.find(p => p.id === opt.value);
            if (!product) return;
            const info = getProductSizePrice(product, sizeKey);
            const label = `${product.name} — ${info.price > 0 ? money(info.price) : 'Indisponível'}`;
            opt.textContent = label;
            opt.disabled = info.price <= 0;
        });
    }
}

pizzaHalfToggle.addEventListener('change', () => {
    if (!currentPizza) return;
    currentPizza.half.enabled = pizzaHalfToggle.checked;
    if (currentPizza.half.enabled) {
        pizzaHalfSelector.classList.remove('hidden');
    } else {
        pizzaHalfSelector.classList.add('hidden');
        pizzaHalfSelect.value = '';
        currentPizza.half.product = null;
        currentPizza.half.key = null;
    }
    updatePizzaPrice();
});

pizzaHalfSelect.addEventListener('change', () => {
    if (!currentPizza) return;
    const selected = pizzaHalfSelect.value;
    const other = DB.products.find(p => p.id === selected);
    currentPizza.half.product = other || null;
    if (other) {
        const pair = [currentPizza.product.id, other.id].sort();
        currentPizza.half.key = pair.join('-');
    } else {
        currentPizza.half.key = null;
    }
    updatePizzaPrice();
});

pizzaConfirm.addEventListener('click', () => {
    if (!currentPizza || !currentPizza.selectedSize) {
        showCustomAlert('Selecione um tamanho.');
        return;
    }

    if (currentPizza.half?.enabled) {
        if (!currentPizza.half.product) {
            showCustomAlert('Selecione a outra metade.');
            return;
        }
        const otherPriceInfo = getProductSizePrice(currentPizza.half.product, currentPizza.selectedSize.key);
        if (otherPriceInfo.price <= 0) {
            showCustomAlert('A outra metade selecionada não possui preço para este tamanho.');
            return;
        }
    }

    updatePizzaPrice();

    const product = currentPizza.product;
    const size = currentPizza.selectedSize;
    const option = currentPizza.option;
    const other = currentPizza.half?.enabled ? currentPizza.half.product : null;

    const baseNames = other ? [product.name, other.name] : [product.name];
    const displayName = other ? `${baseNames[0]} / ${baseNames[1]}` : baseNames[0];
    const sortedIds = other ? [product.id, other.id].sort() : [product.id];
    const itemId = sortedIds.join('-');

    const meta = {
        size: size.key,
        sizeLabel: size.label,
        categoryId: product.categoryId
    };

    if (option) {
        meta.option = { ...option };
    }

    if (other) {
        meta.half = {
            enabled: true,
            secondProductId: other.id,
            secondProductName: other.name,
            key: currentPizza.half.key
        };
    }

    const cat = DB.categories.find(c => c.id === product.categoryId);
    meta.categoryName = cat ? cat.name : 'Pizza';

    addToCart({
        id: itemId,
        name: displayName,
        price: currentPizza.total,
        qty: 1,
        meta
    });
    closePizzaModal();
});

function openMonteSeuModal(id) {
    const item = DB.monteSeu.find(ms => ms.id === id);
    if (!item) return;

    currentMonteSeu = { item, selectedSize: null, selectedAddons: [], total: 0 };
    monteSeuModalTitle.textContent = item.name;
    monteSeuModalSizes.innerHTML = '';
    monteSeuModalAddons.innerHTML = '';

    if (item.type === 'sizes' && Array.isArray(item.sizes) && item.sizes.length) {
        const heading = document.createElement('h4');
        heading.className = 'font-semibold mb-2';
        heading.textContent = 'Escolha o tamanho:';
        monteSeuModalSizes.appendChild(heading);

        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-2 md:grid-cols-3 gap-2';
        item.sizes.forEach((size, index) => {
            const label = document.createElement('label');
            label.className = 'flex flex-col gap-1 bg-neutral-800 rounded-lg px-3 py-3 text-sm border border-transparent cursor-pointer hover:border-brand-600 transition-colors';

            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'monteseu-size';
            radio.value = index;
            radio.className = 'sr-only';
            label.appendChild(radio);

            const sizeName = document.createElement('span');
            sizeName.className = 'font-semibold';
            sizeName.textContent = size.name;
            label.appendChild(sizeName);

            const priceLine = document.createElement('span');
            priceLine.className = 'text-xs text-neutral-400';
            priceLine.textContent = money(size.price);
            label.appendChild(priceLine);

            radio.addEventListener('change', () => {
                grid.querySelectorAll('label').forEach(lbl => lbl.classList.remove('border-brand-600', 'bg-brand-500/10'));
                label.classList.add('border-brand-600', 'bg-brand-500/10');
                currentMonteSeu.selectedSize = size;
                updateMonteSeuTotal();
            });

            grid.appendChild(label);
        });
        monteSeuModalSizes.appendChild(grid);
    } else if (item.type === 'base') {
        const info = document.createElement('div');
        info.className = 'text-sm text-neutral-300 mb-4';
        info.textContent = `Preço base: ${money(item.basePrice)}`;
        monteSeuModalSizes.appendChild(info);
    }

    if (item.addons && item.addons.length) {
        const heading = document.createElement('h4');
        heading.className = 'font-semibold mt-4 mb-2';
        heading.textContent = 'Adicionais:';
        monteSeuModalAddons.appendChild(heading);

        item.addons.forEach((addon, index) => {
            const label = document.createElement('label');
            label.className = 'flex items-center gap-3 p-3 bg-neutral-800 rounded-lg text-sm cursor-pointer border border-transparent hover:border-brand-600 transition-colors';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = index;
            checkbox.className = 'accent-brand-600 scale-125';
            label.appendChild(checkbox);

            const info = document.createElement('div');
            const name = document.createElement('span');
            name.textContent = addon.name;
            info.appendChild(name);

            if (Number(addon.price || 0) > 0) {
                const price = document.createElement('span');
                price.className = 'text-xs text-neutral-400 ml-2';
                price.textContent = `+ ${money(addon.price)}`;
                info.appendChild(price);
            }

            label.appendChild(info);

            checkbox.addEventListener('change', () => {
                label.classList.toggle('border-brand-600', checkbox.checked);
                updateMonteSeuTotal();
            });

            monteSeuModalAddons.appendChild(label);
        });
    }

    updateMonteSeuTotal();
    openModal(monteSeuModal);
}
window.openMonteSeuModal = openMonteSeuModal;

function closeMonteSeuModal() {
    closeModal(monteSeuModal);
    currentMonteSeu = null;
}
window.closeMonteSeuModal = closeMonteSeuModal;

function updateMonteSeuTotal() {
    if (!currentMonteSeu) return;
    const { item } = currentMonteSeu;
    let total = 0;

    if (item.type === 'base') {
        total += Number(item.basePrice || 0);
    } else if (item.type === 'sizes') {
        const selected = monteSeuModalSizes.querySelector('input[name="monteseu-size"]:checked');
        if (selected) {
            const size = item.sizes[Number(selected.value)];
            if (size) {
                currentMonteSeu.selectedSize = size;
                total += Number(size.price || 0);
            }
        } else {
            currentMonteSeu.selectedSize = null;
        }
    }

    currentMonteSeu.selectedAddons = [];
    if (item.addons && item.addons.length) {
        monteSeuModalAddons.querySelectorAll('input[type="checkbox"]').forEach(input => {
            if (input.checked) {
                const addon = item.addons[Number(input.value)];
                if (addon) {
                    currentMonteSeu.selectedAddons.push(addon);
                    total += Number(addon.price || 0);
                }
            }
        });
    }

    currentMonteSeu.total = total;
    monteSeuModalTotal.textContent = money(total);
}

monteSeuModalConfirm.addEventListener('click', () => {
    if (!currentMonteSeu) return;
    const { item, selectedSize, selectedAddons, total } = currentMonteSeu;
    if (item.type === 'sizes' && !selectedSize) {
        showCustomAlert('Escolha um tamanho para continuar.');
        return;
    }
    if (total <= 0) {
        showCustomAlert('Não foi possível calcular o valor. Tente novamente.');
        return;
    }

    let name = item.name;
    if (selectedSize) {
        name += ` ${selectedSize.name}`;
    }
    if (selectedAddons.length) {
        name += ` (${selectedAddons.map(addon => addon.name).join(', ')})`;
    }

    addToCart({
        id: `${item.id}-${Date.now()}`,
        name,
        price: total,
        qty: 1,
        meta: {
            monteSeu: true,
            baseId: item.id,
            categoryName: 'Monte Seu'
        }
    });
    closeMonteSeuModal();
});

function buildCartKey(item) {
    if (item.meta && item.meta.monteSeu) {
        return item.id;
    }
    let key = item.id;
    if (item.meta && item.meta.size) {
        key += `-${item.meta.size}`;
    }
    if (item.meta && item.meta.half && item.meta.half.enabled) {
        const halfKey = item.meta.half.key || item.meta.half.secondProductId || 'half';
        key += `-half:${halfKey}`;
    }
    if (item.meta && item.meta.option && item.meta.option.name) {
        key += `-opt:${item.meta.option.name}`;
    }
    return key;
}

function addToCart(item) {
    if (!item || Number(item.price || 0) <= 0) {
        showCustomAlert('Produto indisponível no momento.');
        return;
    }
    const qty = Number(item.qty || 1);
    const key = buildCartKey(item);

    if (item.meta && item.meta.monteSeu) {
        CART.push({ ...item, qty, key });
    } else {
        const existing = CART.find(cartItem => cartItem.key === key);
        if (existing) {
            existing.qty += qty;
        } else {
            CART.push({ ...item, qty, key });
        }
    }

    saveCart();
    showToast('Item adicionado ao carrinho!');
    renderCart();
}

function incrementCartItem(key) {
    const item = CART.find(cartItem => cartItem.key === key);
    if (!item) return;
    item.qty += 1;
    saveCart();
    renderCart();
}

function decrementCartItem(key) {
    const item = CART.find(cartItem => cartItem.key === key);
    if (!item) return;
    if (item.qty > 1) {
        item.qty -= 1;
    } else {
        CART = CART.filter(cartItem => cartItem.key !== key);
    }
    saveCart();
    renderCart();
}

function removeCartItem(key) {
    CART = CART.filter(cartItem => cartItem.key !== key);
    saveCart();
    renderCart();
}

function calculateSubtotal() {
    return CART.reduce((total, item) => total + (item.price * item.qty), 0);
}

function updateCartCount() {
    const totalQty = CART.reduce((total, item) => total + item.qty, 0);
    cartCount.textContent = totalQty;
}

function updateTotals() {
    const subtotal = calculateSubtotal();
    const total = subtotal + currentDeliveryFee;
    subtotalEl.textContent = money(subtotal);
    feeEl.textContent = money(currentDeliveryFee);
    totalEl.textContent = money(total);
}

function updateCartUI() {
    renderCart();
    updateCartCount();
    updateTotals();
}

function renderCart() {
    cartItems.innerHTML = '';

    if (!CART.length) {
        cartItems.innerHTML = '<p class="text-neutral-400 text-sm">Seu carrinho está vazio.</p>';
    } else {
        CART.forEach(item => {
            const wrapper = document.createElement('div');
            wrapper.className = 'bg-neutral-800 rounded-lg p-3 flex flex-wrap gap-3 items-start';

            const info = document.createElement('div');
            info.className = 'flex-1';
            const name = document.createElement('div');
            name.className = 'font-semibold';

            // Category Badge
            let categoryHtml = '';
            if (item.meta && item.meta.categoryName) {
                categoryHtml = `<span class="text-[10px] bg-neutral-700 text-neutral-400 px-1 rounded ml-1 uppercase tracking-wide border border-neutral-600">${item.meta.categoryName}</span>`;
            }

            name.innerHTML = `${item.name} ${categoryHtml}`;
            info.appendChild(name);
            const unit = document.createElement('div');
            unit.className = 'text-xs text-neutral-400 mt-1';
            unit.textContent = `${money(item.price)} cada`;
            info.appendChild(unit);
            if (item.meta?.half?.enabled && item.meta?.half?.secondProductName) {
                const halfLine = document.createElement('div');
                halfLine.className = 'text-xs text-neutral-400';
                halfLine.textContent = `Meia: ${item.meta.half.secondProductName}`;
                info.appendChild(halfLine);
            }
            if (item.meta?.option?.name) {
                const optionLine = document.createElement('div');
                optionLine.className = 'text-xs text-neutral-400';
                optionLine.textContent = `${item.meta.option.label || 'Opcional'}: ${item.meta.option.name}`;
                info.appendChild(optionLine);
            }
            wrapper.appendChild(info);

            const controls = document.createElement('div');
            controls.className = 'flex items-center gap-2';
            const decBtn = document.createElement('button');
            decBtn.className = 'w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-700 hover:bg-neutral-600';
            decBtn.textContent = '−';
            const qtyLabel = document.createElement('span');
            qtyLabel.className = 'w-6 text-center';
            qtyLabel.textContent = item.qty;
            const incBtn = document.createElement('button');
            incBtn.className = 'w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-700 hover:bg-neutral-600';
            incBtn.textContent = '+';
            controls.appendChild(decBtn);
            controls.appendChild(qtyLabel);
            controls.appendChild(incBtn);
            wrapper.appendChild(controls);

            const totalDiv = document.createElement('div');
            totalDiv.className = 'text-right ml-auto';
            const totalLabel = document.createElement('div');
            totalLabel.className = 'font-semibold';
            totalLabel.textContent = money(item.price * item.qty);
            totalDiv.appendChild(totalLabel);
            const removeBtn = document.createElement('button');
            removeBtn.className = 'text-xs text-red-400 hover:text-red-300 mt-2';
            removeBtn.textContent = 'Remover';
            totalDiv.appendChild(removeBtn);
            wrapper.appendChild(totalDiv);

            const noteWrapper = document.createElement('label');
            noteWrapper.className = 'basis-full w-full border-t border-neutral-700 pt-3';
            const noteLabel = document.createElement('span');
            noteLabel.className = 'block text-xs font-semibold text-neutral-300 mb-1';
            noteLabel.textContent = 'Observação deste item';
            const noteInput = document.createElement('textarea');
            noteInput.rows = 2;
            noteInput.maxLength = 300;
            noteInput.className = 'w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500';
            noteInput.placeholder = 'Ex.: sem cebola, molho separado...';
            noteInput.value = item.observation || '';
            noteInput.setAttribute('aria-label', `Observação para ${item.name}`);
            noteWrapper.appendChild(noteLabel);
            noteWrapper.appendChild(noteInput);
            wrapper.appendChild(noteWrapper);

            decBtn.addEventListener('click', () => decrementCartItem(item.key));
            incBtn.addEventListener('click', () => incrementCartItem(item.key));
            removeBtn.addEventListener('click', () => removeCartItem(item.key));
            noteInput.addEventListener('input', () => {
                item.observation = noteInput.value;
                saveCart();
            });

            cartItems.appendChild(wrapper);
        });
    }



    updateCartCount();
    updateTotals();
}

function populateSitioSelect() {
    selectSitioFee.innerHTML = '';
    if (!DB.fees.sitios.length) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Nenhum sítio cadastrado';
        selectSitioFee.appendChild(option);
        selectSitioFee.disabled = true;
    } else {
        selectSitioFee.disabled = false;
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = '— Escolha um sítio —';
        placeholder.disabled = true;
        placeholder.selected = true;
        selectSitioFee.appendChild(placeholder);

        DB.fees.sitios.forEach(site => {
            const option = document.createElement('option');
            option.value = site.id;
            option.textContent = `${site.name} — ${money(site.fee)}`;
            selectSitioFee.appendChild(option);
        });
    }
}


function handleDeliveryChange() {
    const type = deliveryType.value;

    // Visibility Logic
    const hasSitios = DB.fees && DB.fees.sitios && DB.fees.sitios.length > 0;

    if (type === 'local') {
        fieldAddress.classList.add('hidden');
        fieldSitioRef.classList.add('hidden');
        fieldSitioFee.classList.add('hidden');
        currentDeliveryFee = 0;
    }
    else if (type === 'vilaneves' || type === 'jucati') {
        fieldAddress.classList.remove('hidden');
        fieldSitioRef.classList.add('hidden');
        fieldSitioFee.classList.add('hidden');
        currentDeliveryFee = type === 'jucati'
            ? Number(DB.fees.jucati || 0)
            : Number(DB.fees.base || 0);
    }
    else if (type === 'sitio') {
        fieldAddress.classList.add('hidden');
        fieldSitioRef.classList.remove('hidden');
        fieldSitioFee.classList.remove('hidden');

        if (!hasSitios) {
            currentDeliveryFee = 0;
            selectSitioFee.value = '';
        } else {
            const site = DB.fees.sitios.find(s => s.id === selectSitioFee.value);
            currentDeliveryFee = site ? Number(site.fee || 0) : 0;
        }
    }
    updateTotals();
}

selectSitioFee.addEventListener('change', () => {
    if (deliveryType.value === 'sitio') {
        const site = DB.fees.sitios.find(s => s.id === selectSitioFee.value);
        currentDeliveryFee = site ? Number(site.fee || 0) : 0;
        updateTotals();
    }
});

deliveryType.addEventListener('change', handleDeliveryChange);

function handleDataUpdate(data) {
    DB = normalizeDB(data);
    renderMenu();
    populateSitioSelect();
    handleDeliveryChange();
    applyInfoToUI();
}

// Forma de pagamento informada no WhatsApp
const viewPmCard = document.getElementById('viewPmCard');
const viewPmCash = document.getElementById('viewPmCash');
const viewPmPix = document.getElementById('viewPmPix');
const inputChange = document.getElementById('inputChange');
const toggleChange = document.getElementById('toggleChange');
const boxChange = document.getElementById('boxChange');
const changeResult = document.getElementById('changeResult');

function resetPaymentSelection() {
    [viewPmPix, viewPmCard, viewPmCash].forEach(view => {
        if (view) view.classList.add('hidden');
    });
}

function selectPaymentMethod(method) {
    resetPaymentSelection();

    // Show selected
    let viewId = '';
    if (method === 'pix') viewId = 'viewPmPix';
    if (method === 'card') viewId = 'viewPmCard';
    if (method === 'cash') viewId = 'viewPmCash';

    const view = document.getElementById(viewId);
    if (view) view.classList.remove('hidden');
}

const paymentRadios = document.getElementsByName('paymentMethod');
paymentRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        selectPaymentMethod(e.target.value);
    });
});
// Change Calculation Logic
if (toggleChange) {
    toggleChange.addEventListener('change', () => {
        if (toggleChange.checked) {
            boxChange.classList.remove('hidden');
            changeResult.classList.remove('hidden');
            calculateChange();
        } else {
            boxChange.classList.add('hidden');
            changeResult.classList.add('hidden');
            inputChange.value = '';
        }
    });
}

if (inputChange) {
    inputChange.addEventListener('input', calculateChange);
}

function calculateChange() {
    const total = CART.reduce((acc, item) => acc + (item.price * item.qty), 0) + currentDeliveryFee;
    const paidAmount = parseFloat(inputChange.value) || 0;

    if (paidAmount > total) {
        const diff = paidAmount - total;
        changeResult.textContent = `Troco: ${money(diff)}`;
        changeResult.classList.remove('text-red-500');
        changeResult.classList.add('text-brand-500');
    } else {
        changeResult.textContent = 'Valor insuficiente';
        changeResult.classList.remove('text-brand-500');
        changeResult.classList.add('text-red-500');
    }
}

async function finishOrder() {
    const name = inputName.value.trim();
    if (!name) { showCustomAlert('Informe seu nome.'); return; }

    const methodInput = document.querySelector('input[name="paymentMethod"]:checked');
    if (!methodInput) { showCustomAlert('Selecione uma forma de pagamento.'); return; }
    const method = methodInput.value;

    let changeFor = 0;
    // Total
    const subtotal = CART.reduce((acc, item) => acc + (item.price * item.qty), 0);
    const total = subtotal + currentDeliveryFee;

    if (method === 'cash') {
       if (toggleChange && toggleChange.checked) {
           changeFor = parseFloat(inputChange.value.replace(',', '.')) || 0;
           if (changeFor === 0) { showCustomAlert('Informe o valor para troco.'); return; }
           if (changeFor < total) { showCustomAlert(`O valor do troco deve ser maior que o total (R$ ${total.toFixed(2)})`); return; }
       }
    }

    // Validate Fields
    const whatsapp = inputWhatsapp.value.trim();
    if (!whatsapp) { showCustomAlert('Informe seu WhatsApp.'); return; }
    const selectedDeliveryType = deliveryType.value;
    const requiresStreetAddress = selectedDeliveryType === 'vilaneves' || selectedDeliveryType === 'jucati';
    if (requiresStreetAddress && !inputAddress.value.trim()) {
        showCustomAlert('Informe o endereço de entrega.');
        return;
    }
    if (selectedDeliveryType === 'sitio') {
        if (!selectSitioFee.value) { showCustomAlert('Selecione o sítio da entrega.'); return; }
        if (!inputRef.value.trim()) { showCustomAlert('Informe um ponto de referência.'); return; }
    }

    // Get Sitio Name if applicable
    let sitioName = '';
    if (selectedDeliveryType === 'sitio') {
        const option = selectSitioFee.options[selectSitioFee.selectedIndex];
        if (option) sitioName = option.text.split('—')[0].trim();
    }

    try {
        const btnFinishOrder = document.getElementById('btnFinishOrder');
        btnFinishOrder.disabled = true;
        btnFinishOrder.textContent = 'Enviando...';

        const orderId = generateId('order');

        const orderData = {
            id: orderId,
            date: new Date().toISOString(),
            method: method, 
            change: changeFor > 0 ? changeFor : null,
            changeValue: changeFor > 0 ? (changeFor - total) : 0,
            total: total,
            deliveryFee: currentDeliveryFee,
            customer: {
                name: name,
                whatsapp: whatsapp,
                deliveryType: selectedDeliveryType,
                address: requiresStreetAddress ? inputAddress.value.trim() : '',
                reference: selectedDeliveryType === 'sitio' ? inputRef.value.trim() : '',
                sitioName: sitioName,
                observation: inputNote.value.trim()
            },
            items: [...CART]
        };

        btnFinishOrder.disabled = false;
        btnFinishOrder.textContent = 'Finalizar Pedido';

        // Clear Cart Immediately
        CART = [];
        saveCart();
        updateCartUI();
        closeCart();

        addOrderToHistory({
            id: orderId,
            total: total,
            items: [...orderData.items],
            date: new Date().toISOString(),
            method: method,
            change: changeFor
        });

        const msg = formatOrderForWhatsApp(orderData);
        // DB.info.whatsapp possesses the formatting e.g. "(87) 98129-0926"
        const pizzaPhone = (DB.info?.whatsapp || '').replace(/\D/g, '');
        const waUrl = `https://wa.me/55${pizzaPhone}?text=${encodeURIComponent(msg)}`;

        showCustomAlert('Pedido salvo com sucesso! Você será redirecionado para o WhatsApp da pizzaria.');
        window.open(waUrl, '_blank');
        
    } catch (e) {
        console.error(e);
        showCustomAlert('Erro ao enviar pedido.');
        const btnFinishOrder = document.getElementById('btnFinishOrder');
        if(btnFinishOrder) {
            btnFinishOrder.disabled = false;
            btnFinishOrder.textContent = 'Finalizar Pedido';
        }
    }
}

function formatOrderForWhatsApp(order) {
    let msg = `*Olá, gostaria de fazer o seguinte pedido:*\n\n`;
    msg += `*Nome do Cliente:* ${order.customer.name}\n`;
    msg += `*WhatsApp:* ${order.customer.whatsapp}\n`;

    const refStr = order.customer.reference || '';

    if (order.customer.deliveryType === 'local') {
        msg += `*Endereço:* Retirada no Local\n`;
        if (refStr) msg += `*Local/Ponto de Referência:* ${refStr}\n`;
    } else if (order.customer.deliveryType === 'sitio') {
        msg += `*Sítio:* ${order.customer.sitioName || ''}\n`;
        if (refStr) msg += `*Local/Ponto de Referência:* ${refStr}\n`;
    } else {
        msg += `*Endereço:* ${order.customer.address || ''}\n`;
        if (order.customer.deliveryType === 'vilaneves') msg += `*Localidade:* Neves\n`;
        if (order.customer.deliveryType === 'jucati') msg += `*Localidade:* Jucati\n`;
        if (refStr) msg += `*Local/Ponto de Referência:* ${refStr}\n`;
    }
    if (order.customer.observation) {
        const generalObservation = String(order.customer.observation).replace(/\s+/g, ' ').trim();
        if (generalObservation) msg += `*Observação geral:* ${generalObservation}\n`;
    }

    msg += `\n*Itens do pedido:*\n`;
    order.items.forEach((item, idx) => {
        const catLabel = item.meta?.categoryName ? ` [${item.meta.categoryName.toUpperCase()}]` : '';
        msg += `(${item.qty}) ${item.name}${catLabel} - ${money(item.price * item.qty)}\n`;
        msg += `Quantidade: ${item.qty}\n`;
        msg += `Total: ${money(item.price * item.qty)}\n`;

        let borda = null;
        let obsParts = [];

        if (item.meta) {
            if (item.meta.sizeLabel) obsParts.push(`Tamanho: ${item.meta.sizeLabel}`);
            
            if (item.meta.option) {
                if (item.meta.option.label && item.meta.option.label.toLowerCase() === 'borda') {
                    borda = item.meta.option.name;
                } else {
                    obsParts.push(`${item.meta.option.label || 'Opção'}: ${item.meta.option.name}`);
                }
            }
            if (item.meta.half?.enabled) obsParts.push(`Meia: ${item.meta.half.secondProductName}`);
        }

        if (borda) msg += `Borda: ${borda}\n`;
        if (obsParts.length > 0) msg += `Detalhes: ${obsParts.join(', ')}\n`;
        const itemObservation = String(item.observation || '').replace(/\s+/g, ' ').trim();
        if (itemObservation) msg += `Observação do item: ${itemObservation}\n`;
    });

    // Taxa
    const subtotal = order.total - order.deliveryFee;
    msg += `\n*Subtotal:* ${money(subtotal)}\n`;
    msg += `*Taxa de Entrega:* ${money(order.deliveryFee)}\n`;
    msg += `*VALOR TOTAL:* ${money(order.total)}\n`;

    const methodMap = {
        'pix': 'Pix',
        'cash': 'Dinheiro',
        'card': 'Cartão (Maquineta)'
    };
    msg += `\n*Forma de Pagamento:* ${methodMap[order.method] || 'Não informada'}\n`;

    if (order.method === 'cash' && order.change > 0) {
        msg += `*Troco para:* ${money(order.change)}\n`;
    }

    return msg;
}

// Attach Event Listeners
const btnFinishOrder = document.getElementById('btnFinishOrder');
if (btnFinishOrder) {
    btnFinishOrder.addEventListener('click', finishOrder);
}

if (btnMenu) btnMenu.addEventListener('click', openCategoryModal);
if (btnStory) btnStory.addEventListener('click', openStory);
if (btnOrder) btnOrder.addEventListener('click', openCart);
if (btnInfo) btnInfo.addEventListener('click', openInfo);
if (adminBtn) adminBtn.addEventListener('click', () => { window.location.href = 'admin.html'; });

// Initialization
loadCart();
loadFavorites();
loadCustomerHistory();
renderCart();
scheduleSocialProof(10000);

(async () => {
    try {
        const initialData = await dataReady;
        handleDataUpdate(initialData);
    } catch (error) {
        console.error('Erro ao carregar o cardápio:', error);
        showCustomAlert('Não foi possível carregar os dados do cardápio. Exibindo versão padrão.');
        handleDataUpdate(DB);
    }
})();



if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        searchTerm = e.target.value.toLowerCase();
        renderMenu();
    });
}
