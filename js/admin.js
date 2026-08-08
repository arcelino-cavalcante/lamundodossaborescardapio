import { showCustomAlert, showCustomConfirm } from './ui.js';
import { fetchDB, normalizeDB, defaultDB, money, escapeAttr, generateId } from './db.js';

let DB = defaultDB();
let editingProductId = null;
let editingCategoryId = null;
let editingSitioId = null;
let editingMonteSeuId = null;
let editingOptionGroupId = null;
let productFilterCategory = '';
let productSearchTerm = '';
let hasInitializedUI = false;
let hasUnsavedChanges = false;
let loadedFileSha = null;
let selectedProductImageFile = null;
const pendingProductImages = new Map();

// DOM Elements - Tabs
const tabProdutos = document.getElementById('tabProdutos');
const tabCategorias = document.getElementById('tabCategorias');
const tabMonteSeu = document.getElementById('tabMonteSeu');
const tabOpcionais = document.getElementById('tabOpcionais');
const tabInfo = document.getElementById('tabInfo');
const tabTaxas = document.getElementById('tabTaxas');

const viewProdutos = document.getElementById('viewProdutos');
const viewCategorias = document.getElementById('viewCategorias');
const viewMonteSeu = document.getElementById('viewMonteSeu');
const viewOpcionais = document.getElementById('viewOpcionais');
const viewInfo = document.getElementById('viewInfo');
const viewTaxas = document.getElementById('viewTaxas');

// DOM Elements - Auth
const authScreen = document.getElementById('authScreen');
const authForm = document.getElementById('authForm');
const authPassword = document.getElementById('authPassword');
const authSubmit = document.getElementById('authSubmit');
const authError = document.getElementById('authError');
const logoutBtn = document.getElementById('logoutBtn');
const saveStatus = document.getElementById('saveStatus');
const GITHUB_REPO = 'arcelino-cavalcante/novo-cardapio-git-cms';
const [GITHUB_OWNER, GITHUB_REPO_NAME] = GITHUB_REPO.split('/');
const GITHUB_FILE = 'data.json';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}`;
const GITHUB_CONTENTS_URL = `https://api.github.com/repos/${GITHUB_REPO}/contents`;
const GITHUB_PAGES_URL = `https://${GITHUB_OWNER}.github.io/${GITHUB_REPO_NAME}`;
const TOKEN_STORAGE_KEY = 'lamundo_gh_token';
let githubToken = sessionStorage.getItem(TOKEN_STORAGE_KEY);

// DOM Elements - Products
const pName = document.getElementById('pName');
const pDescription = document.getElementById('pDescription');
const pCategory = document.getElementById('pCategory');
const pOptionGroup = document.getElementById('pOptionGroup');
const pImage = document.getElementById('pImage');
const pFileInput = document.getElementById('pFileInput');
const pUploadStatus = document.getElementById('pUploadStatus');
const pPrice = document.getElementById('pPrice');
const pOfferPrice = document.getElementById('pOfferPrice');
const pPriceP = document.getElementById('pPriceP');
const pPriceM = document.getElementById('pPriceM');
const pPriceG = document.getElementById('pPriceG');
const pOfferPriceP = document.getElementById('pOfferPriceP');
const pOfferPriceM = document.getElementById('pOfferPriceM');
const pOfferPriceG = document.getElementById('pOfferPriceG');
const pAvailable = document.getElementById('pAvailable');
const btnSaveProduct = document.getElementById('btnSaveProduct');
const gridProducts = document.getElementById('gridProducts');
const boxPricesSimple = document.getElementById('boxPricesSimple');
const boxPricesSimpleOffer = document.getElementById('boxPricesSimpleOffer');
const boxPricesSizes = document.getElementById('boxPricesSizes');
const boxPricesSizesOffer = document.getElementById('boxPricesSizesOffer');
const productFilterButtons = document.getElementById('productFilterButtons');
const productSearch = document.getElementById('productSearch');

// DOM Elements - Categories
const cName = document.getElementById('cName');
const cUseSizes = document.getElementById('cUseSizes');
const cAllowHalfWrapper = document.getElementById('cAllowHalfWrapper');
const cAllowHalf = document.getElementById('cAllowHalf');
const cOptionGroup = document.getElementById('cOptionGroup');
const btnSaveCategory = document.getElementById('btnSaveCategory');
const gridCategories = document.getElementById('gridCategories');

// DOM Elements - Taxas
const tBase = document.getElementById('tBase');
const btnSaveBase = document.getElementById('btnSaveBase');
const sName = document.getElementById('sName');
const sFee = document.getElementById('sFee');
const btnSaveSitio = document.getElementById('btnSaveSitio');
const gridSitios = document.getElementById('gridSitios');

// DOM Elements - Monte Seu
const msName = document.getElementById('msName');
const msType = document.getElementById('msType');
const msBoxBasePrice = document.getElementById('msBoxBasePrice');
const msBasePrice = document.getElementById('msBasePrice');
const msBoxSizes = document.getElementById('msBoxSizes');
const msSizesContainer = document.getElementById('msSizesContainer');
const msBtnAddSize = document.getElementById('msBtnAddSize');
const msAddonsContainer = document.getElementById('msAddonsContainer');
const msBtnAddAddon = document.getElementById('msBtnAddAddon');
const btnSaveMonteSeu = document.getElementById('btnSaveMonteSeu');
const gridMonteSeu = document.getElementById('gridMonteSeu');

// DOM Elements - Opcionais
const ogName = document.getElementById('ogName');
const ogLabel = document.getElementById('ogLabel');
const ogOptionsContainer = document.getElementById('ogOptionsContainer');
const ogBtnAddOption = document.getElementById('ogBtnAddOption');
const btnSaveOptionGroup = document.getElementById('btnSaveOptionGroup');
const gridOptionGroups = document.getElementById('gridOptionGroups');

// DOM Elements - Info
const infoDescription = document.getElementById('infoDescription');
const infoAddress = document.getElementById('infoAddress');
const infoWhatsapp = document.getElementById('infoWhatsapp');
const infoInstagram = document.getElementById('infoInstagram');
const infoOpen = document.getElementById('infoOpen');
const btnSaveInfo = document.getElementById('btnSaveInfo');

// --- Helpers ---
function sanitizeSizePrices(values) {
    const result = {};
    Object.entries(values).forEach(([key, rawValue]) => {
        const numeric = Number(rawValue || 0);
        if (numeric > 0) result[key] = numeric;
    });
    return Object.keys(result).length ? result : undefined;
}

async function persistDB() {
    hasUnsavedChanges = true;
    if (btnPublishGitHub) btnPublishGitHub.disabled = false;
    if (saveStatus) {
        const imageCount = pendingProductImages.size;
        saveStatus.textContent = imageCount
            ? `Alterações pendentes (${imageCount} ${imageCount === 1 ? 'imagem' : 'imagens'})`
            : 'Alterações pendentes de publicação';
        saveStatus.className = 'text-xs font-medium text-amber-600';
    }
}

function githubHeaders() {
    return {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
    };
}

function encodeBase64Utf8(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary);
}

function decodeBase64Utf8(value) {
    const binary = atob(value.replace(/\s/g, ''));
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}

async function githubErrorMessage(response, fallback) {
    const body = await response.json().catch(() => ({}));
    if (response.status === 401) return 'Token inválido ou expirado.';
    if (response.status === 403) return 'O token não possui acesso de escrita ao conteúdo deste repositório.';
    if (response.status === 404) return 'Repositório ou data.json não encontrado para este token.';
    if (response.status === 409) return 'O cardápio foi alterado em outro lugar. Recarregue o painel antes de publicar novamente.';
    return body.message || fallback;
}

function productImagePath(productId, productName, file) {
    const extensionByType = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif'
    };
    const extension = extensionByType[file.type];
    const slug = productName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'produto';
    const safeId = productId.replace(/[^a-zA-Z0-9-]/g, '');
    return `images/products/${slug}-${safeId}-${Date.now()}.${extension}`;
}

function githubPathUrl(pathValue) {
    return `${GITHUB_PAGES_URL}/${pathValue.split('/').map(encodeURIComponent).join('/')}`;
}

async function fileToBase64(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const chunkSize = 0x8000;
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
}

async function uploadPendingProductImages() {
    const pending = Array.from(pendingProductImages.values());
    for (let index = 0; index < pending.length; index += 1) {
        const image = pending[index];
        if (image.uploaded) continue;

        if (saveStatus) {
            saveStatus.textContent = `Enviando imagem ${index + 1} de ${pending.length}...`;
            saveStatus.className = 'text-xs font-medium text-blue-700';
        }

        const encodedPath = image.path.split('/').map(encodeURIComponent).join('/');
        const response = await fetch(`${GITHUB_CONTENTS_URL}/${encodedPath}`, {
            method: 'PUT',
            headers: {
                ...githubHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Adiciona imagem de ${image.productName}`,
                content: await fileToBase64(image.file)
            })
        });

        if (!response.ok) {
            throw new Error(await githubErrorMessage(response, `Erro ao enviar a imagem de ${image.productName}.`));
        }
        image.uploaded = true;
    }
}

const btnPublishGitHub = document.getElementById('btnPublishGitHub');
if (btnPublishGitHub) {
    btnPublishGitHub.addEventListener('click', async () => {
        if (!githubToken) {
            showCustomAlert('Você precisa estar logado com seu Token do GitHub.');
            return;
        }

        btnPublishGitHub.disabled = true;
        const originalText = btnPublishGitHub.innerHTML;
        btnPublishGitHub.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Publicando...';
        
        try {
            if (!loadedFileSha) throw new Error('Recarregue o painel para sincronizar o data.json antes de publicar.');

            await uploadPendingProductImages();

            if (saveStatus) {
                saveStatus.textContent = 'Publicando dados do cardápio...';
                saveStatus.className = 'text-xs font-medium text-blue-700';
            }

            const plain = normalizeDB(DB);
            const newContent = encodeBase64Utf8(`${JSON.stringify(plain, null, 2)}\n`);

            const putRes = await fetch(GITHUB_API_URL, {
                method: 'PUT',
                headers: {
                    ...githubHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: 'Atualização do cardápio via Admin',
                    content: newContent,
                    sha: loadedFileSha
                })
            });

            if (putRes.ok) {
                const result = await putRes.json();
                loadedFileSha = result.content?.sha || loadedFileSha;
                hasUnsavedChanges = false;
                pendingProductImages.clear();
                btnPublishGitHub.disabled = true;
                if (saveStatus) {
                    saveStatus.textContent = 'Cardápio publicado no GitHub';
                    saveStatus.className = 'text-xs font-medium text-green-700';
                }
                showCustomAlert('Alterações publicadas no GitHub com sucesso. O site será atualizado após a próxima publicação automática.');
            } else {
                throw new Error(await githubErrorMessage(putRes, 'Erro ao publicar o data.json.'));
            }
        } catch (error) {
            console.error('Erro ao publicar:', error);
            showCustomAlert('Erro ao publicar: ' + error.message);
        } finally {
            btnPublishGitHub.disabled = !hasUnsavedChanges;
            btnPublishGitHub.innerHTML = originalText;
        }
    });
}

// --- Tabs Logic ---
function switchTab(tab) {
    // Hide all views
    [viewProdutos, viewCategorias, viewMonteSeu, viewOpcionais, viewInfo, viewTaxas].forEach(v => {
        if (v) v.classList.add('hidden');
    });

    // Reset tabs
    [tabProdutos, tabCategorias, tabMonteSeu, tabOpcionais, tabInfo, tabTaxas].forEach(t => {
        if (t) t.className = 'px-4 py-2 rounded-lg bg-white border';
    });

    if (tab === 'Produtos') {
        if (viewProdutos) viewProdutos.classList.remove('hidden');
        if (tabProdutos) tabProdutos.className = 'px-4 py-2 rounded-lg bg-brand-600 text-white';
    } else if (tab === 'Categorias') {
        if (viewCategorias) viewCategorias.classList.remove('hidden');
        if (tabCategorias) tabCategorias.className = 'px-4 py-2 rounded-lg bg-brand-600 text-white';
    } else if (tab === 'MonteSeu') {
        if (viewMonteSeu) viewMonteSeu.classList.remove('hidden');
        if (tabMonteSeu) tabMonteSeu.className = 'px-4 py-2 rounded-lg bg-brand-600 text-white';
    } else if (tab === 'Opcionais') {
        if (viewOpcionais) viewOpcionais.classList.remove('hidden');
        if (tabOpcionais) tabOpcionais.className = 'px-4 py-2 rounded-lg bg-brand-600 text-white';
    } else if (tab === 'Info') {
        if (viewInfo) viewInfo.classList.remove('hidden');
        if (tabInfo) tabInfo.className = 'px-4 py-2 rounded-lg bg-brand-600 text-white';
    } else if (tab === 'Taxas') {
        if (viewTaxas) viewTaxas.classList.remove('hidden');
        if (tabTaxas) {
            tabTaxas.classList.remove('text-neutral-400');
            tabTaxas.classList.add('bg-neutral-800', 'text-white');
        }
    }
}

tabProdutos.addEventListener('click', () => switchTab('Produtos'));
tabCategorias.addEventListener('click', () => switchTab('Categorias'));
tabMonteSeu.addEventListener('click', () => switchTab('MonteSeu'));
tabOpcionais.addEventListener('click', () => switchTab('Opcionais'));
tabInfo.addEventListener('click', () => switchTab('Info'));
tabTaxas.addEventListener('click', () => switchTab('Taxas'));

// --- Products Logic ---
function formatProductPrice(product, category) {
    if (category && category.useSizes) {
        const labels = { p: 'P', m: 'M', g: 'G' };
        const parts = [];
        Object.entries(labels).forEach(([key, label]) => {
            const normal = product.prices ? Number(product.prices[key] || 0) : 0;
            if (normal <= 0) return;
            const offer = product.offerPrices ? Number(product.offerPrices[key] || 0) : 0;
            if (offer > 0 && offer < normal) {
                parts.push(`${label}: <span class="text-red-600">${money(offer)}</span> <del class="text-neutral-500">${money(normal)}</del>`);
            } else {
                parts.push(`${label}: ${money(normal)}`);
            }
        });
        return parts.length ? parts.join('<br>') : '-';
    }

    const normalPrice = Number(product.price || 0);
    const offerPriceValue = Number(product.offerPrice || 0);
    if (offerPriceValue > 0 && offerPriceValue < normalPrice) {
        return `<span class="text-red-600">${money(offerPriceValue)}</span> <del class="text-neutral-500">${money(normalPrice)}</del>`;
    }
    return normalPrice > 0 ? money(normalPrice) : '-';
}

function renderProductFilters() {
    if (!productFilterButtons) return;
    const categories = Array.isArray(DB.categories) ? DB.categories : [];
    const validIds = new Set(categories.map(cat => cat.id));
    if (productFilterCategory && !validIds.has(productFilterCategory)) {
        productFilterCategory = '';
    }

    productFilterButtons.innerHTML = '';

    const createButton = (label, value) => {
        const button = document.createElement('button');
        button.type = 'button';
        const isActive = productFilterCategory === value;
        const baseClass = 'px-3 py-1 rounded-lg text-sm transition-colors border';
        button.className = `${baseClass} ${isActive ? 'bg-brand-600 border-brand-600 text-white shadow-sm' : 'bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-100'}`;
        button.textContent = label;
        button.addEventListener('click', () => {
            if (productFilterCategory === value) return;
            productFilterCategory = value;
            renderProductFilters();
            renderProducts();
        });
        return button;
    };

    productFilterButtons.appendChild(createButton('Todos', ''));
    categories.forEach(cat => {
        productFilterButtons.appendChild(createButton(cat.name, cat.id));
    });
}

function handleCategoryChange() {
    const category = DB.categories.find(cat => cat.id === pCategory.value);
    const useSizes = category ? !!category.useSizes : false;
    boxPricesSimple.classList.toggle('hidden', useSizes);
    boxPricesSimpleOffer.classList.toggle('hidden', useSizes);
    boxPricesSizes.classList.toggle('hidden', !useSizes);
    boxPricesSizesOffer.classList.toggle('hidden', !useSizes);

    if (pOptionGroup) {
        const product = editingProductId ? DB.products.find(p => p.id === editingProductId) : null;
        const preferred = product?.optionGroupId ?? (category?.optionGroupId ?? '');
        const availableValues = Array.from(pOptionGroup.options).map(opt => opt.value);
        pOptionGroup.value = availableValues.includes(preferred) ? preferred : '';
    }
}

pCategory.addEventListener('change', handleCategoryChange);


if (productSearch) {
    productSearch.addEventListener('input', event => {
        productSearchTerm = event.target.value;
        renderProducts();
    });
}

if (pFileInput) {
    pFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        selectedProductImageFile = null;
        if (!file) return;

        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            showCustomAlert('Formato não aceito. Use JPG, PNG, WebP ou GIF.');
            pFileInput.value = '';
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            showCustomAlert('A imagem é muito grande. Escolha uma imagem com até 2 MB.');
            pFileInput.value = '';
            return;
        }

        selectedProductImageFile = file;
        if (pUploadStatus) {
            pUploadStatus.textContent = `${file.name} pronta para enviar ao GitHub`;
            pUploadStatus.className = 'mt-1 text-xs text-green-700 font-semibold min-h-4';
        }
    });
}

function populateCategorySelect() {
    const current = pCategory.value;
    pCategory.innerHTML = '<option value="">Selecione...</option>';
    DB.categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        pCategory.appendChild(option);
    });
    if (current && DB.categories.some(cat => cat.id === current)) {
        pCategory.value = current;
    }
    handleCategoryChange();
}

function clearProductForm() {
    editingProductId = null;
    selectedProductImageFile = null;
    pName.value = '';
    pDescription.value = '';
    pCategory.value = '';
    if (pOptionGroup) pOptionGroup.value = '';
    pImage.value = '';
    pPrice.value = '';
    pOfferPrice.value = '';
    pPriceP.value = '';
    pPriceM.value = '';
    pPriceG.value = '';
    pOfferPriceP.value = '';
    pOfferPriceM.value = '';
    pOfferPriceG.value = '';
    pAvailable.checked = true;
    if (pFileInput) pFileInput.value = '';
    if (pUploadStatus) pUploadStatus.textContent = '';
    btnSaveProduct.textContent = 'Adicionar';
    handleCategoryChange();
}

async function saveProduct(event) {
    event.preventDefault();
    const name = pName.value.trim();
    const categoryId = pCategory.value;
    if (!name) {
        showCustomAlert('Informe o nome do produto.');
        return;
    }
    if (!categoryId) {
        showCustomAlert('Selecione a categoria.');
        return;
    }
    const category = DB.categories.find(cat => cat.id === categoryId);
    if (!category) {
        showCustomAlert('Categoria inválida.');
        return;
    }

    const productId = editingProductId || generateId('prod');
    let imageUrl = pImage.value.trim();
    if (selectedProductImageFile) {
        const path = productImagePath(productId, name, selectedProductImageFile);
        imageUrl = githubPathUrl(path);
        pendingProductImages.set(productId, {
            file: selectedProductImageFile,
            path,
            url: imageUrl,
            productId,
            productName: name,
            uploaded: false
        });
    } else {
        const pendingImage = pendingProductImages.get(productId);
        if (pendingImage && pendingImage.url !== imageUrl) {
            pendingProductImages.delete(productId);
        }
    }

    const payload = {
        id: productId,
        name,
        description: pDescription.value.trim(),
        categoryId,
        imageUrl,
        available: pAvailable.checked,
        optionGroupId: pOptionGroup.value || null
    };

    if (category.useSizes) {
        const prices = sanitizeSizePrices({
            p: pPriceP.value,
            m: pPriceM.value,
            g: pPriceG.value
        });
        const offerPrices = sanitizeSizePrices({
            p: pOfferPriceP.value,
            m: pOfferPriceM.value,
            g: pOfferPriceG.value
        });
        if (!prices) {
            showCustomAlert('Informe ao menos um preço de tamanho.');
            return;
        }
        payload.prices = prices;
        payload.offerPrices = offerPrices;
        payload.price = undefined;
        payload.offerPrice = undefined;
    } else {
        const price = Number(pPrice.value || 0);
        if (price <= 0) {
            showCustomAlert('Informe o preço do produto.');
            return;
        }
        const offerPrice = Number(pOfferPrice.value || 0);
        payload.price = price;
        payload.offerPrice = offerPrice > 0 && offerPrice < price ? offerPrice : undefined;
        payload.prices = undefined;
        payload.offerPrices = undefined;
    }

    try {
        if (editingProductId) {
            const index = DB.products.findIndex(product => product.id === editingProductId);
            if (index > -1) {
                DB.products[index] = { ...DB.products[index], ...payload };
            }
        } else {
            DB.products.push(payload);
        }

        await persistDB();
        renderProducts();
        clearProductForm();
    } catch (error) {
        // persistDB already displayed alert
    }
}

btnSaveProduct.addEventListener('click', saveProduct);

window.productActions = {
    editProduct: function (id) {
        const product = DB.products.find(p => p.id === id);
        if (!product) return;

        editingProductId = id;
        selectedProductImageFile = null;
        if (pFileInput) pFileInput.value = '';
        if (pUploadStatus) pUploadStatus.textContent = '';
        pName.value = product.name;
        pDescription.value = product.description || '';
        pCategory.value = product.categoryId;
        pImage.value = product.imageUrl || '';
        pAvailable.checked = product.available !== false;
        handleCategoryChange();

        if (pOptionGroup) {
            const values = Array.from(pOptionGroup.options).map(opt => opt.value);
            const desired = product.optionGroupId || '';
            pOptionGroup.value = values.includes(desired) ? desired : '';
        }

        const category = DB.categories.find(cat => cat.id === product.categoryId);
        if (category && category.useSizes) {
            pPriceP.value = product.prices?.p ?? '';
            pPriceM.value = product.prices?.m ?? '';
            pPriceG.value = product.prices?.g ?? '';
            pOfferPriceP.value = product.offerPrices?.p ?? '';
            pOfferPriceM.value = product.offerPrices?.m ?? '';
            pOfferPriceG.value = product.offerPrices?.g ?? '';
            pPrice.value = '';
            pOfferPrice.value = '';
        } else {
            pPrice.value = product.price ?? '';
            pOfferPrice.value = product.offerPrice ?? '';
            pPriceP.value = '';
            pPriceM.value = '';
            pPriceG.value = '';
            pOfferPriceP.value = '';
        }

        btnSaveProduct.textContent = 'Salvar alterações';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    deleteProduct: async function (id) {
        const product = DB.products.find(p => p.id === id);
        if (!product) return;
        if (!await showCustomConfirm('Excluir este produto?')) return;
        DB.products = DB.products.filter(p => p.id !== id);
        pendingProductImages.delete(id);
        if (editingProductId === id) {
            clearProductForm();
        }
        try {
            await persistDB();
            renderProducts();
        } catch (error) {
            // error handled
        }
    }
};

function renderProducts() {
    if (!gridProducts) return;
    gridProducts.innerHTML = '';

    const normalizedSearch = productSearchTerm.trim().toLowerCase();
    const filteredProducts = (Array.isArray(DB.products) ? DB.products : []).filter(product => {
        if (productFilterCategory && product.categoryId !== productFilterCategory) {
            return false;
        }
        if (normalizedSearch) {
            const name = (product.name || '').toLowerCase();
            const description = (product.description || '').toLowerCase();
            return name.includes(normalizedSearch) || description.includes(normalizedSearch);
        }
        return true;
    });

    if (!filteredProducts.length) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `<td class="p-4 text-center text-neutral-500" colspan="7">Nenhum produto encontrado.</td>`;
        gridProducts.appendChild(emptyRow);
        return;
    }

    filteredProducts.forEach(product => {
        const category = DB.categories.find(cat => cat.id === product.categoryId);
        const description = (product.description || '').trim();
        const tr = document.createElement('tr');
        tr.className = 'border-t';
        tr.innerHTML = `
            <td class="p-3">${product.name}</td>
            <td class="p-3 text-neutral-500 text-xs">${description || '-'}</td>
            <td class="p-3">${category ? category.name : '-'}</td>
            <td class="p-3">${product.imageUrl ? `<a href="${escapeAttr(product.imageUrl)}" class="text-brand-600 underline" target="_blank">Abrir</a>` : '-'}</td>
            <td class="p-3">${formatProductPrice(product, category)}</td>
            <td class="p-3">${product.available === false ? 'Sim' : 'Não'}</td>
            <td class="p-3 text-right space-x-2">
                <button class="px-3 py-1 rounded-lg border hover:bg-neutral-100" data-edit="${product.id}">Editar</button>
                <button class="px-3 py-1 rounded-lg border hover:bg-red-100 text-red-600" data-delete="${product.id}">Excluir</button>
            </td>
        `;
        gridProducts.appendChild(tr);
    });

    gridProducts.querySelectorAll('[data-edit]').forEach(btn => {
        btn.addEventListener('click', () => window.productActions.editProduct(btn.getAttribute('data-edit')));
    });
    gridProducts.querySelectorAll('[data-delete]').forEach(btn => {
        btn.addEventListener('click', () => window.productActions.deleteProduct(btn.getAttribute('data-delete')));
    });
}

// --- Categories Logic ---
function handleCategorySizeToggle() {
    const usesSizes = cUseSizes.checked;
    cAllowHalfWrapper.classList.toggle('hidden', !usesSizes);
    if (!usesSizes) {
        cAllowHalf.checked = false;
    }
}

cUseSizes.addEventListener('change', handleCategorySizeToggle);

function clearCategoryForm() {
    editingCategoryId = null;
    cName.value = '';
    cUseSizes.checked = false;
    cAllowHalf.checked = false;
    cOptionGroup.value = '';
    btnSaveCategory.textContent = 'Adicionar';
    handleCategorySizeToggle();
}

async function saveCategory(event) {
    event.preventDefault();
    const name = cName.value.trim();
    if (!name) {
        showCustomAlert('Informe o nome da categoria.');
        return;
    }
    const useSizes = cUseSizes.checked;
    const payload = {
        id: editingCategoryId || generateId('cat'),
        name,
        useSizes,
        optionGroupId: cOptionGroup.value || null,
        allowHalf: useSizes ? cAllowHalf.checked : false
    };

    try {
        if (editingCategoryId) {
            const index = DB.categories.findIndex(cat => cat.id === editingCategoryId);
            if (index > -1) {
                DB.categories[index] = { ...DB.categories[index], ...payload };
            }
        } else {
            DB.categories.push(payload);
        }

        await persistDB();
        renderCategories();
        populateOptionGroupSelects();
        populateCategorySelect();
        renderProductFilters();
        renderProducts();
        clearCategoryForm();
    } catch (error) {
        // handled
    }
}

btnSaveCategory.addEventListener('click', saveCategory);

window.categoryActions = {
    editCategory: function (id) {
        const category = DB.categories.find(cat => cat.id === id);
        if (!category) return;
        editingCategoryId = id;
        cName.value = category.name;
        cUseSizes.checked = !!category.useSizes;
        cOptionGroup.value = category.optionGroupId || '';
        cAllowHalf.checked = !!category.allowHalf;
        handleCategorySizeToggle();
        btnSaveCategory.textContent = 'Salvar alterações';
        switchTab('categorias');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    deleteCategory: async function (id) {
        const category = DB.categories.find(cat => cat.id === id);
        if (!category) return;
        let confirmationMessage = 'Excluir esta categoria?';
        const hasProducts = DB.products.some(product => product.categoryId === id);
        if (hasProducts) {
            confirmationMessage = 'Esta categoria possui produtos cadastrados. Excluir categoria e remover os produtos relacionados?';
        }
        if (!await showCustomConfirm(confirmationMessage)) return;
        DB.categories = DB.categories.filter(cat => cat.id !== id);
        if (hasProducts) {
            DB.products = DB.products.filter(product => product.categoryId !== id);
        }
        if (editingCategoryId === id) {
            clearCategoryForm();
        }
        try {
            await persistDB();
            renderCategories();
            populateOptionGroupSelects();
            populateCategorySelect();
            renderProductFilters();
            renderProducts();
        } catch (error) {
            // handled
        }
    }
};

function renderCategories() {
    gridCategories.innerHTML = '';
    DB.categories.forEach(cat => {
        const optionGroup = DB.optionGroups.find(group => group.id === cat.optionGroupId);
        const tr = document.createElement('tr');
        tr.className = 'border-t';
        tr.innerHTML = `
            <td class="p-3">${cat.name}</td>
            <td class="p-3">${cat.useSizes ? 'Sim' : 'Não'}</td>
            <td class="p-3">${optionGroup ? optionGroup.name : '-'}</td>
            <td class="p-3">${cat.useSizes && cat.allowHalf ? 'Sim' : 'Não'}</td>
            <td class="p-3 text-right space-x-2">
                <button class="px-3 py-1 rounded-lg border hover:bg-neutral-100" data-edit-cat="${cat.id}">Editar</button>
                <button class="px-3 py-1 rounded-lg border hover:bg-red-100 text-red-600" data-del-cat="${cat.id}">Excluir</button>
            </td>
        `;
        gridCategories.appendChild(tr);
    });

    gridCategories.querySelectorAll('[data-edit-cat]').forEach(btn => {
        btn.addEventListener('click', () => window.categoryActions.editCategory(btn.getAttribute('data-edit-cat')));
    });
    gridCategories.querySelectorAll('[data-del-cat]').forEach(btn => {
        btn.addEventListener('click', () => window.categoryActions.deleteCategory(btn.getAttribute('data-del-cat')));
    });
}

// --- Fees Logic ---
function renderBaseFee() {
    tBase.value = DB.fees.base ?? 0;
}

btnSaveBase.addEventListener('click', async event => {
    event.preventDefault();
    DB.fees.base = Number(tBase.value || 0);
    try {
        await persistDB();
        showCustomAlert('Taxa base atualizada!');
    } catch (error) {
        // handled
    }
});

function clearSitioForm() {
    editingSitioId = null;
    sName.value = '';
    sFee.value = '';
    btnSaveSitio.textContent = 'Adicionar Sítio';
}

async function saveSitio(event) {
    event.preventDefault();
    const name = sName.value.trim();
    const fee = Number(sFee.value || 0);
    if (!name) {
        showCustomAlert('Informe o nome do sítio.');
        return;
    }
    if (fee <= 0) {
        showCustomAlert('Informe a taxa do sítio.');
        return;
    }

    try {
        if (editingSitioId) {
            const index = DB.fees.sitios.findIndex(site => site.id === editingSitioId);
            if (index > -1) {
                DB.fees.sitios[index] = { ...DB.fees.sitios[index], name, fee };
            }
        } else {
            DB.fees.sitios.push({ id: generateId('sitio'), name, fee });
        }

        await persistDB();
        renderSitios();
        clearSitioForm();
    } catch (error) {
        // handled
    }
}

btnSaveSitio.addEventListener('click', saveSitio);

window.sitioActions = {
    editSitio: function (id) {
        const site = DB.fees.sitios.find(s => s.id === id);
        if (!site) return;
        editingSitioId = id;
        sName.value = site.name;
        sFee.value = site.fee;
        btnSaveSitio.textContent = 'Salvar alterações';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    deleteSitio: async function (id) {
        if (!await showCustomConfirm('Excluir este sítio?')) return;
        DB.fees.sitios = DB.fees.sitios.filter(site => site.id !== id);
        if (editingSitioId === id) {
            clearSitioForm();
        }
        try {
            await persistDB();
            renderSitios();
        } catch (error) {
            // handled
        }
    }
};

function renderSitios() {
    gridSitios.innerHTML = '';
    DB.fees.sitios.forEach(site => {
        const tr = document.createElement('tr');
        tr.className = 'border-t';
        tr.innerHTML = `
            <td class="p-3">${site.name}</td>
            <td class="p-3">${money(site.fee)}</td>
            <td class="p-3 text-right space-x-2">
                <button class="px-3 py-1 rounded-lg border hover:bg-neutral-100" data-edit-site="${site.id}">Editar</button>
                <button class="px-3 py-1 rounded-lg border hover:bg-red-100 text-red-600" data-del-site="${site.id}">Excluir</button>
            </td>
        `;
        gridSitios.appendChild(tr);
    });

    gridSitios.querySelectorAll('[data-edit-site]').forEach(btn => {
        btn.addEventListener('click', () => window.sitioActions.editSitio(btn.getAttribute('data-edit-site')));
    });
    gridSitios.querySelectorAll('[data-del-site]').forEach(btn => {
        btn.addEventListener('click', () => window.sitioActions.deleteSitio(btn.getAttribute('data-del-site')));
    });
}

// --- Monte Seu Logic ---
msType.addEventListener('change', () => {
    const isBase = msType.value === 'base';
    msBoxBasePrice.classList.toggle('hidden', !isBase);
    msBoxSizes.classList.toggle('hidden', isBase);
});

function addSizeInput(name = '', price = '') {
    const div = document.createElement('div');
    div.className = 'flex items-center gap-2 ms-size-row';
    div.innerHTML = `
        <input type="text" class="w-full border rounded-lg px-3 py-2 ms-size-name" placeholder="Nome (Ex: 500ml)" value="${escapeAttr(name)}">
        <input type="number" step="0.01" class="w-48 border rounded-lg px-3 py-2 ms-size-price" placeholder="Preço" value="${escapeAttr(price)}">
        <button type="button" class="px-3 py-1 text-red-600 hover:bg-red-100 rounded-lg">X</button>
    `;
    div.querySelector('button').addEventListener('click', () => div.remove());
    msSizesContainer.appendChild(div);
}

msBtnAddSize.addEventListener('click', event => {
    event.preventDefault();
    addSizeInput();
});

function addAddonInput(name = '', price = '') {
    const div = document.createElement('div');
    div.className = 'flex items-center gap-2 ms-addon-row';
    div.innerHTML = `
        <input type="text" class="w-full border rounded-lg px-3 py-2 ms-addon-name" placeholder="Nome (Ex: Bacon)" value="${escapeAttr(name)}">
        <input type="number" step="0.01" class="w-48 border rounded-lg px-3 py-2 ms-addon-price" placeholder="Preço" value="${escapeAttr(price)}">
        <button type="button" class="px-3 py-1 text-red-600 hover:bg-red-100 rounded-lg">X</button>
    `;
    div.querySelector('button').addEventListener('click', () => div.remove());
    msAddonsContainer.appendChild(div);
}

msBtnAddAddon.addEventListener('click', event => {
    event.preventDefault();
    addAddonInput();
});

function clearMonteSeuForm() {
    editingMonteSeuId = null;
    msName.value = '';
    msType.value = 'base';
    msBasePrice.value = '';
    msSizesContainer.innerHTML = '';
    msAddonsContainer.innerHTML = '';
    btnSaveMonteSeu.textContent = 'Adicionar';
    msType.dispatchEvent(new Event('change'));
}

async function saveMonteSeu(event) {
    event.preventDefault();
    const name = msName.value.trim();
    if (!name) {
        showCustomAlert('Informe o nome da categoria.');
        return;
    }
    const type = msType.value;

    const data = { name, type, addons: [] };
    if (type === 'base') {
        const basePrice = Number(msBasePrice.value || 0);
        if (basePrice <= 0) {
            showCustomAlert('Informe o preço base.');
            return;
        }
        data.basePrice = basePrice;
        data.sizes = undefined;
    } else {
        const sizes = [];
        msSizesContainer.querySelectorAll('.ms-size-row').forEach(row => {
            const sizeName = row.querySelector('.ms-size-name').value.trim();
            const sizePrice = Number(row.querySelector('.ms-size-price').value || 0);
            if (sizeName && sizePrice > 0) {
                sizes.push({ name: sizeName, price: sizePrice });
            }
        });
        if (!sizes.length) {
            showCustomAlert('Adicione ao menos um tamanho.');
            return;
        }
        data.sizes = sizes;
        data.basePrice = undefined;
    }

    const addons = [];
    msAddonsContainer.querySelectorAll('.ms-addon-row').forEach(row => {
        const addonName = row.querySelector('.ms-addon-name').value.trim();
        const addonPrice = Number(row.querySelector('.ms-addon-price').value || 0);
        if (addonName) {
            addons.push({ name: addonName, price: addonPrice > 0 ? addonPrice : 0 });
        }
    });
    data.addons = addons;

    try {
        if (editingMonteSeuId) {
            const index = DB.monteSeu.findIndex(item => item.id === editingMonteSeuId);
            if (index > -1) {
                DB.monteSeu[index] = { ...DB.monteSeu[index], ...data };
            }
        } else {
            data.id = generateId('ms');
            DB.monteSeu.push(data);
        }

        await persistDB();
        renderMonteSeu();
        clearMonteSeuForm();
    } catch (error) {
        // handled
    }
}

btnSaveMonteSeu.addEventListener('click', saveMonteSeu);

window.monteSeuActions = {
    editMonteSeu: function (id) {
        const item = DB.monteSeu.find(ms => ms.id === id);
        if (!item) return;
        clearMonteSeuForm();
        editingMonteSeuId = id;
        msName.value = item.name;
        msType.value = item.type;
        msBasePrice.value = item.basePrice ?? '';
        (item.sizes || []).forEach(size => addSizeInput(size.name, size.price));
        (item.addons || []).forEach(addon => addAddonInput(addon.name, addon.price));
        btnSaveMonteSeu.textContent = 'Salvar alterações';
        msType.dispatchEvent(new Event('change'));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    deleteMonteSeu: async function (id) {
        if (!await showCustomConfirm('Excluir esta categoria Monte o Seu?')) return;
        DB.monteSeu = DB.monteSeu.filter(item => item.id !== id);
        if (editingMonteSeuId === id) {
            clearMonteSeuForm();
        }
        try {
            await persistDB();
            renderMonteSeu();
        } catch (error) {
            // handled
        }
    }
};

function renderMonteSeu() {
    gridMonteSeu.innerHTML = '';
    DB.monteSeu.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = 'border-t';
        tr.innerHTML = `
            <td class="p-3">${item.name}</td>
            <td class="p-3">${item.type === 'base' ? 'Preço base' : 'Tamanhos'}</td>
            <td class="p-3 text-right space-x-2">
                <button class="px-3 py-1 rounded-lg border hover:bg-neutral-100" data-edit-ms="${item.id}">Editar</button>
                <button class="px-3 py-1 rounded-lg border hover:bg-red-100 text-red-600" data-del-ms="${item.id}">Excluir</button>
            </td>
        `;
        gridMonteSeu.appendChild(tr);
    });

    gridMonteSeu.querySelectorAll('[data-edit-ms]').forEach(btn => {
        btn.addEventListener('click', () => window.monteSeuActions.editMonteSeu(btn.getAttribute('data-edit-ms')));
    });
    gridMonteSeu.querySelectorAll('[data-del-ms]').forEach(btn => {
        btn.addEventListener('click', () => window.monteSeuActions.deleteMonteSeu(btn.getAttribute('data-del-ms')));
    });
}

// --- Option Group Logic ---
function addOptionGroupInput(name = '', price = '') {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2 og-option-row';
    row.innerHTML = `
        <input type="text" class="w-full border rounded-lg px-3 py-2 og-option-name" placeholder="Nome (Ex: Cheddar)" value="${escapeAttr(name)}">
        <input type="number" step="0.01" class="w-40 border rounded-lg px-3 py-2 og-option-price" placeholder="Preço" value="${escapeAttr(price)}">
        <button type="button" class="px-3 py-1 text-red-600 hover:bg-red-100 rounded-lg">X</button>
    `;
    row.querySelector('button').addEventListener('click', () => row.remove());
    ogOptionsContainer.appendChild(row);
}

ogBtnAddOption.addEventListener('click', event => {
    event.preventDefault();
    addOptionGroupInput();
});

function clearOptionGroupForm() {
    editingOptionGroupId = null;
    ogName.value = '';
    ogLabel.value = '';
    ogOptionsContainer.innerHTML = '';
    btnSaveOptionGroup.textContent = 'Adicionar';
    addOptionGroupInput();
}

function serializeOptionGroupForm() {
    const name = ogName.value.trim();
    if (!name) {
        showCustomAlert('Informe o nome do grupo.');
        return null;
    }
    const label = ogLabel.value.trim();
    const options = [];
    ogOptionsContainer.querySelectorAll('.og-option-row').forEach(row => {
        const optionName = row.querySelector('.og-option-name').value.trim();
        const optionPrice = Number(row.querySelector('.og-option-price').value || 0);
        if (optionName) {
            options.push({ name: optionName, price: optionPrice });
        }
    });
    if (!options.length) {
        showCustomAlert('Adicione ao menos uma opção.');
        return null;
    }
    return { name, label, options };
}

btnSaveOptionGroup.addEventListener('click', async event => {
    event.preventDefault();
    const data = serializeOptionGroupForm();
    if (!data) return;

    try {
        if (editingOptionGroupId) {
            const index = DB.optionGroups.findIndex(group => group.id === editingOptionGroupId);
            if (index > -1) {
                DB.optionGroups[index] = { ...DB.optionGroups[index], ...data };
            }
        } else {
            DB.optionGroups.push({ id: generateId('opt'), ...data });
        }

        await persistDB();
        renderOptionGroups();
        populateOptionGroupSelects();
        renderCategories();
        renderProductFilters();
        renderProducts();
        clearOptionGroupForm();
    } catch (error) {
        // handled
    }
});

window.optionGroupActions = {
    editOptionGroup: function (id) {
        const group = DB.optionGroups.find(g => g.id === id);
        if (!group) return;
        editingOptionGroupId = id;
        ogName.value = group.name;
        ogLabel.value = group.label || '';
        ogOptionsContainer.innerHTML = '';
        (group.options || []).forEach(opt => addOptionGroupInput(opt.name, opt.price));
        if (!ogOptionsContainer.children.length) addOptionGroupInput();
        btnSaveOptionGroup.textContent = 'Salvar alterações';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    deleteOptionGroup: async function (id) {
        if (!await showCustomConfirm('Excluir este grupo de opcionais?')) return;
        DB.optionGroups = DB.optionGroups.filter(group => group.id !== id);
        DB.categories.forEach(cat => {
            if (cat.optionGroupId === id) cat.optionGroupId = null;
        });
        DB.products.forEach(prod => {
            if (prod.optionGroupId === id) prod.optionGroupId = null;
        });
        if (editingOptionGroupId === id) {
            clearOptionGroupForm();
        }
        try {
            await persistDB();
            renderOptionGroups();
            populateOptionGroupSelects();
            renderCategories();
            renderProductFilters();
            renderProducts();
        } catch (error) {
            // handled
        }
    }
};

function renderOptionGroups() {
    gridOptionGroups.innerHTML = '';
    if (!DB.optionGroups.length) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="p-3 text-center text-neutral-500" colspan="4">Nenhum grupo cadastrado.</td>`;
        gridOptionGroups.appendChild(tr);
        return;
    }
    DB.optionGroups.forEach(group => {
        const tr = document.createElement('tr');
        tr.className = 'border-t';
        const resumo = (group.options || []).map(opt => `${escapeAttr(opt.name)} (${money(Number(opt.price || 0))})`).join(', ');
        tr.innerHTML = `
            <td class="p-3">${escapeAttr(group.name)}</td>
            <td class="p-3">${group.label ? escapeAttr(group.label) : '-'}</td>
            <td class="p-3">${resumo || '-'}</td>
            <td class="p-3 text-right space-x-2">
                <button class="px-3 py-1 rounded-lg border hover:bg-neutral-100" data-edit-opt="${group.id}">Editar</button>
                <button class="px-3 py-1 rounded-lg border hover:bg-red-100 text-red-600" data-del-opt="${group.id}">Excluir</button>
            </td>
        `;
        gridOptionGroups.appendChild(tr);
    });

    gridOptionGroups.querySelectorAll('[data-edit-opt]').forEach(btn => {
        btn.addEventListener('click', () => window.optionGroupActions.editOptionGroup(btn.getAttribute('data-edit-opt')));
    });
    gridOptionGroups.querySelectorAll('[data-del-opt]').forEach(btn => {
        btn.addEventListener('click', () => window.optionGroupActions.deleteOptionGroup(btn.getAttribute('data-del-opt')));
    });
}

function populateOptionGroupSelects() {
    const optionsHtml = ['<option value="">Nenhum</option>'];
    DB.optionGroups.forEach(group => {
        optionsHtml.push(`<option value="${escapeAttr(group.id)}">${escapeAttr(group.name)}</option>`);
    });
    [pOptionGroup, cOptionGroup].forEach(select => {
        if (!select) return;
        const current = select.value;
        select.innerHTML = optionsHtml.join('');
        const availableValues = Array.from(select.options).map(opt => opt.value);
        if (availableValues.includes(current)) {
            select.value = current;
        }
    });
}

// --- Info Logic ---
btnSaveInfo.addEventListener('click', async event => {
    event.preventDefault();
    DB.info = {
        description: infoDescription.value.trim(),
        address: infoAddress.value.trim(),
        whatsapp: infoWhatsapp.value.trim(),
        instagram: infoInstagram.value.trim(),
        open: infoOpen.checked
    };
    try {
        await persistDB();
        showCustomAlert('Informações atualizadas com sucesso!');
    } catch (error) {
        // handled
    }
});

// --- General Render Logic ---
function renderAll({ resetForms = false } = {}) {
    if (resetForms) {
        productFilterCategory = '';
        productSearchTerm = '';
    }
    if (productSearch) {
        productSearch.value = productSearchTerm;
    }

    populateOptionGroupSelects();
    populateCategorySelect();
    renderCategories();
    renderProductFilters();
    renderProducts();
    renderBaseFee();
    renderSitios();
    renderMonteSeu();
    renderOptionGroups();
    if (DB.info) {
        infoDescription.value = DB.info.description || '';
        infoAddress.value = DB.info.address || '';
        infoWhatsapp.value = DB.info.whatsapp || '';
        infoInstagram.value = DB.info.instagram || '';
        infoOpen.checked = !!DB.info.open;
    }
    if (resetForms) {
        clearProductForm();
        clearCategoryForm();
        clearSitioForm();
        clearMonteSeuForm();
        clearOptionGroupForm();
    }
    handleCategorySizeToggle();
    if (!hasInitializedUI) {
        switchTab('Produtos');
        hasInitializedUI = true;
    }
}

async function bootstrapAdmin() {
    if (authSubmit) authSubmit.disabled = true;
    try {
        const response = await fetch(GITHUB_API_URL, { headers: githubHeaders(), cache: 'no-store' });
        
        if (response.ok) {
            const data = await response.json();
            const content = decodeBase64Utf8(data.content);
            DB = normalizeDB(JSON.parse(content));
            loadedFileSha = data.sha;
            
            if (authScreen) authScreen.classList.add('hidden');
            if (logoutBtn) logoutBtn.classList.remove('hidden');
            hasUnsavedChanges = false;
            if (btnPublishGitHub) btnPublishGitHub.disabled = true;
            if (saveStatus) {
                saveStatus.textContent = 'Cardápio sincronizado com o GitHub';
                saveStatus.className = 'text-xs text-neutral-500';
            }
            hasInitializedUI = true;
            renderAll({ resetForms: true });
        } else {
            throw new Error(await githubErrorMessage(response, 'Token inválido ou sem acesso.'));
        }
    } catch (e) {
        console.error(e);
        sessionStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        githubToken = null;
        if (authScreen) authScreen.classList.remove('hidden');
        if (logoutBtn) logoutBtn.classList.add('hidden');
        if (authError) {
            authError.textContent = e.message || 'Token inválido ou sem permissão.';
            authError.classList.remove('hidden');
        }
    } finally {
        if (authSubmit) authSubmit.disabled = false;
    }
}

if (authForm) {
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (authError) authError.classList.add('hidden');
        githubToken = authPassword.value.trim();
        sessionStorage.setItem(TOKEN_STORAGE_KEY, githubToken);
        if (authSubmit) authSubmit.textContent = 'Verificando...';
        await bootstrapAdmin();
        if (authSubmit) authSubmit.textContent = 'Acessar Painel';
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        location.reload();
    });
}

// Initial check
if (githubToken) {
    bootstrapAdmin();
} else {
    if (authScreen) authScreen.classList.remove('hidden');
    fetchDB().then(data => { DB = data; });
}

window.addEventListener('beforeunload', event => {
    if (!hasUnsavedChanges) return;
    event.preventDefault();
    event.returnValue = '';
});
