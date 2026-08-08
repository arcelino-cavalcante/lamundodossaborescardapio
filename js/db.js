export const PLACEHOLDER_IMAGE = 'https://placehold.co/600x400?text=Produto';

export function resolveImageUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') {
        return PLACEHOLDER_IMAGE;
    }

    const value = rawUrl.trim();
    if (!value) return PLACEHOLDER_IMAGE;

    if (/^(data|blob):/i.test(value)) {
        return value;
    }

    if (value.startsWith('www.')) {
        return `https://${value}`;
    }

    const driveFileMatch = value.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
    if (driveFileMatch && driveFileMatch[1]) {
        return `https://drive.google.com/uc?export=download&id=${driveFileMatch[1]}`;
    }

    const driveQueryMatch = value.match(/[?&]id=([^&]+)/i);
    if (value.includes('drive.google.com') && driveQueryMatch && driveQueryMatch[1]) {
        return `https://drive.google.com/uc?export=download&id=${driveQueryMatch[1]}`;
    }

    if (value.startsWith('//')) {
        return `https:${value}`;
    }

    if (!/^https?:\/\//i.test(value)) {
        try {
            const current = typeof window !== 'undefined' ? window.location.origin : 'https://';
            const url = new URL(value, current);
            return url.href;
        } catch (error) {
            return `https://${value.replace(/^\/*/, '')}`;
        }
    }

    return value;
}

export function setImageSource(imgEl, rawUrl, options = {}) {
    const { lazy = true } = options;
    const resolved = resolveImageUrl(rawUrl);

    if (lazy && 'loading' in imgEl) {
        imgEl.loading = 'lazy';
        imgEl.decoding = 'async';
    } else {
        imgEl.removeAttribute('loading');
        imgEl.removeAttribute('decoding');
    }

    imgEl.removeAttribute('srcset');

    const handleError = () => {
        if (imgEl.src !== PLACEHOLDER_IMAGE) {
            imgEl.src = PLACEHOLDER_IMAGE;
        }
    };

    imgEl.removeEventListener('error', handleError);
    imgEl.addEventListener('error', handleError, { once: true });

    imgEl.src = resolved;
}

export function generateId(prefix) {
    return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function defaultDB() {
    return {
        categories: [
            { id: 'pizzas', name: 'Pizzas', useSizes: true },
            { id: 'hamburgueres', name: 'Hambúrgueres', useSizes: false },
            { id: 'bebidas', name: 'Bebidas', useSizes: false }
        ],
        products: [],
        fees: {
            base: 5,
            sitios: []
        },
        monteSeu: [],
        optionGroups: [],
        info: {
            description: 'Aberto hoje: 18h–23h',
            address: 'Rua José Bezerra Lins, Garanhuns - PE',
            whatsapp: '(87) 98129-0926',
            instagram: '@lamundodossaboresguns',
            open: true
        },
        sizeLabels: { p: 'Pequena', m: 'Média', g: 'Grande' }
    };
}

export function normalizeDB(raw = {}) {
    const data = {
        categories: Array.isArray(raw.categories) ? raw.categories : [],
        products: Array.isArray(raw.products) ? raw.products.map(item => {
            if (!item || typeof item !== 'object') {
                return { description: '' };
            }
            const product = { ...item };
            product.description = typeof item.description === 'string' ? item.description : '';
            return product;
        }) : [],
        fees: {
            base: raw.fees && typeof raw.fees.base === 'number' ? raw.fees.base : 0,
            sitios: raw.fees && Array.isArray(raw.fees.sitios) ? raw.fees.sitios : []
        },
        monteSeu: Array.isArray(raw.monteSeu) ? raw.monteSeu : [],
        optionGroups: Array.isArray(raw.optionGroups) ? raw.optionGroups : [],
        info: raw.info && typeof raw.info === 'object' ? {
            description: raw.info.description || '',
            address: raw.info.address || '',
            whatsapp: raw.info.whatsapp || '',
            instagram: raw.info.instagram || '',
            open: typeof raw.info.open === 'boolean' ? raw.info.open : true
        } : {
            description: 'Aberto hoje: 18h–23h',
            address: 'Rua José Bezerra Lins, Garanhuns - PE',
            whatsapp: '(87) 98129-0926',
            instagram: '@lamundodossaboresguns',
            open: true
        },
        sizeLabels: raw.sizeLabels && typeof raw.sizeLabels === 'object' ? raw.sizeLabels : { p: 'Pequena', m: 'Média', g: 'Grande' }
    };
    return JSON.parse(JSON.stringify(data));
}

export async function fetchDB() {
    try {
        const response = await fetch('./data.json');
        if (!response.ok) {
            console.warn('data.json não encontrado. Usando banco de dados padrão.');
            return defaultDB();
        }
        const data = await response.json();
        return normalizeDB(data);
    } catch (error) {
        console.error('Erro ao buscar data.json:', error);
        return defaultDB();
    }
}

export function money(value = 0) {
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function escapeAttr(value) {
    return (value ?? '').toString().replace(/"/g, '&quot;');
}
