// app.js - Lógica principal de la aplicación PWA

const DB_NAME = 'SSO_DB';
const DB_VERSION = 2;
const DEFAULT_BRAND = {
    colorCorporativo: '#0f766e',
    colorOscuro: '#115e59',
    colorSuave: '#ccfbf1',
    logoURL: 'assets/logos/sso.svg',
    nombre: 'Sistema SSO'
};

const EMPRESAS_FALLBACK = [
    {
        id: 'constructora-norte',
        nombre: 'Constructora Norte S.A.',
        logoURL: 'assets/logos/constructora-norte.svg',
        colorCorporativo: '#0f766e'
    },
    {
        id: 'metalurgica-delta',
        nombre: 'Metalúrgica Delta',
        logoURL: 'assets/logos/metalurgica-delta.svg',
        colorCorporativo: '#b45309'
    },
    {
        id: 'logistica-sur',
        nombre: 'Logística Sur',
        logoURL: 'assets/logos/logistica-sur.svg',
        colorCorporativo: '#2563eb'
    }
];

const DASHBOARD_DATA = {
    'constructora-norte': {
        inspections: 5,
        documents: 12,
        frequencyIndex: '2.3',
        alerts: [
            { text: 'Inspección semanal de trabajo en altura pendiente', status: 'Vencido', tone: 'rojo' },
            { text: 'Actualizar registro de extintores en depósito', status: 'Próximo', tone: 'amarillo' },
            { text: 'Capacitación de ingreso completada', status: 'Al día', tone: 'verde' }
        ]
    },
    'metalurgica-delta': {
        inspections: 3,
        documents: 8,
        frequencyIndex: '1.8',
        alerts: [
            { text: 'Verificar protecciones de maquinaria en línea 2', status: 'Próximo', tone: 'amarillo' },
            { text: 'Entrega de EPP registrada correctamente', status: 'Al día', tone: 'verde' }
        ]
    },
    'logistica-sur': {
        inspections: 4,
        documents: 10,
        frequencyIndex: '1.1',
        alerts: [
            { text: 'Revisar circulación peatonal en playa de maniobras', status: 'Próximo', tone: 'amarillo' },
            { text: 'Plan de emergencia vigente', status: 'Al día', tone: 'verde' }
        ]
    }
};

let db;
let dbReadyPromise;
let empresas = [];
let activeCompany = null;
let refreshSignaturePad = function() {};

document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

async function initApp() {
    setupNavigation();
    setupSectionNavigation();
    setupInspections();
    setupServiceWorker();
    setDefaultInspectionDate();
    dbReadyPromise = initIndexedDB();
    empresas = await loadEmpresas();
    setupCompanySelector();
    applyCompanyBrand(null);
    loadDashboardData();
}

function setupNavigation() {
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');

    if (!menuToggle || !sidebar) return;

    menuToggle.addEventListener('click', function() {
        sidebar.classList.toggle('active');
    });

    sidebar.querySelectorAll('a').forEach(function(link) {
        link.addEventListener('click', function() {
            if (window.innerWidth <= 767) {
                sidebar.classList.remove('active');
            }
        });
    });
}

function setupSectionNavigation() {
    const navLinks = document.querySelectorAll('nav a');
    const sections = document.querySelectorAll('main section');

    navLinks.forEach(function(link) {
        link.addEventListener('click', function(event) {
            event.preventDefault();
            const targetId = link.getAttribute('href').slice(1);

            sections.forEach(function(section) {
                section.hidden = section.id !== targetId;
            });

            navLinks.forEach(function(navLink) {
                navLink.classList.toggle('active', navLink === link);
            });

            if (targetId === 'inspecciones') {
                requestAnimationFrame(refreshSignaturePad);
            }
        });
    });
}

async function loadEmpresas() {
    try {
        const response = await fetch('empresas.json', { cache: 'no-store' });
        if (!response.ok) {
            throw new Error('No se pudo cargar empresas.json');
        }
        return await response.json();
    } catch (error) {
        console.warn('Usando empresas de respaldo:', error);
        return EMPRESAS_FALLBACK;
    }
}

function setupCompanySelector() {
    const companySelect = document.getElementById('company-select');
    if (!companySelect) return;

    const options = empresas.map(function(empresa) {
        const option = document.createElement('option');
        option.value = empresa.id;
        option.textContent = empresa.nombre;
        return option;
    });

    companySelect.append(...options);
    companySelect.addEventListener('change', function() {
        const selectedCompany = empresas.find(function(empresa) {
            return empresa.id === companySelect.value;
        });

        activeCompany = selectedCompany || null;
        applyCompanyBrand(activeCompany);
        loadCompanyData(activeCompany);
    });
}

function applyCompanyBrand(company) {
    const brand = company || DEFAULT_BRAND;
    const root = document.documentElement;
    const brandColor = normalizeHexColor(brand.colorCorporativo);

    root.style.setProperty('--brand-color', brandColor);
    root.style.setProperty('--brand-color-dark', adjustHexColor(brandColor, -22));
    root.style.setProperty('--brand-color-soft', hexToRgba(brandColor, 0.12));

    const logo = document.getElementById('app-logo');
    const title = document.getElementById('app-title');
    const kicker = document.getElementById('company-kicker');
    const selectedCompanyPill = document.getElementById('selected-company-pill');
    const themeColor = document.querySelector('meta[name="theme-color"]');
    const companyName = company ? company.nombre : 'Sin empresa activa';

    if (logo) {
        logo.src = brand.logoURL;
        logo.alt = company ? 'Logo de ' + company.nombre : 'Logo Sistema SSO';
    }

    if (title) {
        title.textContent = company ? company.nombre : 'Sistema SSO';
    }

    if (kicker) {
        kicker.textContent = company ? 'Empresa activa' : 'Sistema Integral';
    }

    if (selectedCompanyPill) {
        selectedCompanyPill.textContent = companyName;
    }

    document.querySelectorAll('[data-current-company]').forEach(function(element) {
        element.textContent = companyName;
    });

    if (themeColor) {
        themeColor.setAttribute('content', brandColor);
    }

    updateInspectionCompanyFields(company);
}

function updateInspectionCompanyFields(company) {
    const empresaId = document.getElementById('empresa-id');
    const empresaNombre = document.getElementById('empresa-nombre');

    if (empresaId) {
        empresaId.value = company ? company.id : '';
    }

    if (empresaNombre) {
        empresaNombre.value = company ? company.nombre : '';
    }
}

function loadDashboardData() {
    renderDashboardStats(null);
}

function loadCompanyData(company) {
    renderDashboardStats(company);
}

function renderDashboardStats(company) {
    const data = company ? DASHBOARD_DATA[company.id] : null;
    const statInspections = document.getElementById('stat-inspections');
    const statDocuments = document.getElementById('stat-documents');
    const statIf = document.getElementById('stat-if');
    const alertsList = document.getElementById('alerts-list');

    if (statInspections) statInspections.textContent = data ? data.inspections : '0';
    if (statDocuments) statDocuments.textContent = data ? data.documents : '0';
    if (statIf) statIf.textContent = data ? data.frequencyIndex : '0.0';

    if (!alertsList) return;

    alertsList.replaceChildren();

    if (!data) {
        alertsList.append(createAlertCard('Selecciona una empresa para ver sus alertas operativas.', 'Pendiente', 'amarillo'));
        return;
    }

    data.alerts.forEach(function(alert) {
        alertsList.append(createAlertCard(alert.text, alert.status, alert.tone));
    });
}

function createAlertCard(text, status, tone) {
    const card = document.createElement('div');
    const message = document.createElement('p');
    const badge = document.createElement('span');

    card.className = 'alert-card';
    message.textContent = text;
    badge.className = 'status ' + tone;
    badge.textContent = status;

    card.append(message, badge);
    return card;
}

function setupInspections() {
    const form = document.getElementById('inspection-form');
    const captureBtn = document.getElementById('capture-photo');
    const photoInput = document.getElementById('photo-input');
    const photoPreview = document.getElementById('photo-preview');
    const canvas = document.getElementById('signature-canvas');
    const signatureField = document.getElementById('firma-encargado');
    const clearSignatureBtn = document.getElementById('clear-signature');
    const cancelBtn = document.getElementById('cancel-inspection');

    if (!form || !canvas) return;

    const context = canvas.getContext('2d');
    let currentPhoto = null;
    let drawing = false;
    let hasSignature = false;

    refreshSignaturePad = function() {
        resizeSignatureCanvas(canvas, context, hasSignature);
        configureSignatureContext(context);
    };

    configureSignatureContext(context);
    refreshSignaturePad();

    window.addEventListener('resize', refreshSignaturePad);

    canvas.addEventListener('pointerdown', function(event) {
        drawing = true;
        hasSignature = true;
        canvas.setPointerCapture(event.pointerId);
        const point = getCanvasPoint(canvas, event);
        context.beginPath();
        context.moveTo(point.x, point.y);
    });

    canvas.addEventListener('pointermove', function(event) {
        if (!drawing) return;
        const point = getCanvasPoint(canvas, event);
        context.lineTo(point.x, point.y);
        context.stroke();
    });

    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function(eventName) {
        canvas.addEventListener(eventName, function() {
            drawing = false;
        });
    });

    if (captureBtn && photoInput) {
        captureBtn.addEventListener('click', function() {
            photoInput.click();
        });

        photoInput.addEventListener('change', function(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.addEventListener('load', function(readerEvent) {
                currentPhoto = readerEvent.target.result;
                renderPhotoPreview(photoPreview, currentPhoto, file.name);
            });
            reader.readAsDataURL(file);
        });
    }

    if (clearSignatureBtn) {
        clearSignatureBtn.addEventListener('click', function() {
            context.clearRect(0, 0, canvas.width, canvas.height);
            hasSignature = false;
            if (signatureField) signatureField.value = '';
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            if (confirm('¿Cancelar la inspección actual? Se perderán los datos no guardados.')) {
                resetInspectionForm();
            }
        });
    }

    form.addEventListener('submit', async function(event) {
        event.preventDefault();

        if (!activeCompany) {
            alert('Selecciona una empresa en el Dashboard antes de guardar la inspección.');
            document.querySelector('a[href="#dashboard"]').click();
            return;
        }

        if (!hasSignature) {
            alert('Solicita la firma del encargado antes de guardar el registro.');
            return;
        }

        const signatureData = canvas.toDataURL('image/png');
        if (signatureField) {
            signatureField.value = signatureData;
        }

        try {
            await saveInspection(form, currentPhoto, signatureData);
            alert('Inspección guardada exitosamente.');
            resetInspectionForm();
            document.querySelector('a[href="#dashboard"]').click();
        } catch (error) {
            console.error('Error guardando inspección:', error);
            alert('Error al guardar la inspección. Intente nuevamente.');
        }
    });

    function resetInspectionForm() {
        form.reset();
        setDefaultInspectionDate();
        updateInspectionCompanyFields(activeCompany);
        context.clearRect(0, 0, canvas.width, canvas.height);
        hasSignature = false;
        currentPhoto = null;
        if (signatureField) signatureField.value = '';
        if (photoPreview) {
            const emptyState = document.createElement('span');
            emptyState.textContent = 'Sin evidencia cargada';
            photoPreview.replaceChildren(emptyState);
        }
    }
}

function configureSignatureContext(context) {
    context.strokeStyle = '#111827';
    context.lineWidth = 2.4;
    context.lineCap = 'round';
    context.lineJoin = 'round';
}

function resizeSignatureCanvas(canvas, context, hasSignature) {
    const rect = canvas.getBoundingClientRect();
    const width = Math.round(rect.width || 320);
    const height = Math.round(rect.height || 210);
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const snapshot = hasSignature ? canvas.toDataURL('image/png') : null;

    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    configureSignatureContext(context);

    if (snapshot) {
        const image = new Image();
        image.addEventListener('load', function() {
            context.drawImage(image, 0, 0, width, height);
        });
        image.src = snapshot;
    }
}

function getCanvasPoint(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
}

function renderPhotoPreview(container, photoData, fileName) {
    if (!container) return;

    const image = document.createElement('img');
    const caption = document.createElement('span');

    image.src = photoData;
    image.alt = 'Evidencia capturada';
    caption.textContent = fileName || 'Evidencia capturada';
    container.replaceChildren(image, caption);
}

async function saveInspection(form, currentPhoto, signatureData) {
    const formData = new FormData(form);
    const camposRE002 = {
        'Empresa': formData.get('Empresa'),
        'Fecha': formData.get('Fecha'),
        'Obra': formData.get('Obra'),
        'Sector de la Obra': formData.get('Sector de la Obra'),
        'Inspección realizada por': formData.get('Inspección realizada por'),
        'Observación': formData.get('Observación'),
        'Recomendación': formData.get('Recomendación'),
        'Encargado presente en obra': formData.get('Encargado presente en obra'),
        'Evidencia fotográfica': currentPhoto,
        'Firma': signatureData
    };

    const inspectionData = {
        id: Date.now(),
        plantilla: 'RE 002 Registro de inspección de seguridad',
        empresaId: activeCompany.id,
        empresaNombre: activeCompany.nombre,
        camposRE002,
        fecha: camposRE002.Fecha,
        obra: camposRE002.Obra,
        sectorObra: camposRE002['Sector de la Obra'],
        evidenciaFotografica: currentPhoto,
        firma: signatureData,
        creadoEn: new Date().toISOString(),
        sincronizado: false
    };

    return saveToIndexedDB('inspecciones', inspectionData);
}

function setDefaultInspectionDate() {
    const fecha = document.getElementById('fecha');
    if (!fecha || fecha.value) return;

    fecha.value = new Date().toISOString().slice(0, 10);
}

function setupServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('service-worker.js')
        .then(function(registration) {
            console.log('Service Worker registrado:', registration);
        })
        .catch(function(error) {
            console.log('Error al registrar Service Worker:', error);
        });
}

function initIndexedDB() {
    return new Promise(function(resolve, reject) {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = function(event) {
            console.error('Error al abrir IndexedDB:', event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = function(event) {
            db = event.target.result;
            console.log('IndexedDB inicializada correctamente');
            resolve(db);
        };

        request.onupgradeneeded = function(event) {
            db = event.target.result;

            let inspeccionesStore;

            if (!db.objectStoreNames.contains('inspecciones')) {
                inspeccionesStore = db.createObjectStore('inspecciones', { keyPath: 'id' });
            } else {
                inspeccionesStore = event.target.transaction.objectStore('inspecciones');
            }

            if (!inspeccionesStore.indexNames.contains('empresaId')) {
                inspeccionesStore.createIndex('empresaId', 'empresaId', { unique: false });
            }

            if (!inspeccionesStore.indexNames.contains('fecha')) {
                inspeccionesStore.createIndex('fecha', 'fecha', { unique: false });
            }

            if (!inspeccionesStore.indexNames.contains('sectorObra')) {
                inspeccionesStore.createIndex('sectorObra', 'sectorObra', { unique: false });
            }

            if (!db.objectStoreNames.contains('documentos')) {
                db.createObjectStore('documentos', { keyPath: 'id', autoIncrement: true });
            }

            if (!db.objectStoreNames.contains('planificacion')) {
                db.createObjectStore('planificacion', { keyPath: 'id', autoIncrement: true });
            }

            if (!db.objectStoreNames.contains('incidentes')) {
                db.createObjectStore('incidentes', { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

async function saveToIndexedDB(storeName, data) {
    const database = db || await dbReadyPromise;

    return new Promise(function(resolve, reject) {
        const transaction = database.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(data);

        request.onsuccess = function() {
            resolve(request.result);
        };

        request.onerror = function() {
            reject(request.error);
        };
    });
}

async function getFromIndexedDB(storeName, key) {
    const database = db || await dbReadyPromise;

    return new Promise(function(resolve, reject) {
        const transaction = database.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);

        request.onsuccess = function() {
            resolve(request.result);
        };

        request.onerror = function() {
            reject(request.error);
        };
    });
}

function syncData() {
    if (navigator.onLine) {
        console.log('Sincronizando datos con el servidor...');
    }
}

function normalizeHexColor(hexColor) {
    if (/^#[0-9a-f]{6}$/i.test(hexColor)) {
        return hexColor;
    }

    return DEFAULT_BRAND.colorCorporativo;
}

function adjustHexColor(hexColor, amount) {
    const color = normalizeHexColor(hexColor).slice(1);
    const number = Number.parseInt(color, 16);
    const red = clampColor((number >> 16) + amount);
    const green = clampColor(((number >> 8) & 0x00ff) + amount);
    const blue = clampColor((number & 0x0000ff) + amount);

    return '#' + [red, green, blue].map(function(value) {
        return value.toString(16).padStart(2, '0');
    }).join('');
}

function hexToRgba(hexColor, alpha) {
    const color = normalizeHexColor(hexColor).slice(1);
    const number = Number.parseInt(color, 16);
    const red = number >> 16;
    const green = (number >> 8) & 0x00ff;
    const blue = number & 0x0000ff;

    return 'rgba(' + red + ', ' + green + ', ' + blue + ', ' + alpha + ')';
}

function clampColor(value) {
    return Math.max(0, Math.min(255, value));
}

window.addEventListener('online', syncData);
window.addEventListener('offline', function() {
    console.log('Modo offline activado');
});
