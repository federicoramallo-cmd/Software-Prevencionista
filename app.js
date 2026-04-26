// app.js - Lógica principal de la aplicación PWA

// Variables globales
let db;
const DB_NAME = 'SSO_DB';
const DB_VERSION = 1;

// Inicialización de la aplicación
document.addEventListener('DOMContentLoaded', function() {
    initApp();
    setupServiceWorker();
    initIndexedDB();
});

// Inicializar aplicación
function initApp() {
    setupNavigation();
    setupSectionNavigation();
    setupCompanySelector();
    setupInspections();
    loadDashboardData();
}

// Configurar navegación responsiva
function setupNavigation() {
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');

    menuToggle.addEventListener('click', function() {
        sidebar.classList.toggle('active');
    });

    // Cerrar sidebar al hacer clic en un enlace (móvil)
    const navLinks = sidebar.querySelectorAll('a');
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            if (window.innerWidth <= 767) {
                sidebar.classList.remove('active');
            }
        });
    });
}

// Configurar selector de empresa
function setupCompanySelector() {
    const companySelect = document.getElementById('company-select');
    companySelect.addEventListener('change', function() {
        const selectedCompany = this.value;
        if (selectedCompany) {
            loadCompanyData(selectedCompany);
        }
    });
}

// Configurar navegación entre secciones
function setupSectionNavigation() {
    const navLinks = document.querySelectorAll('nav a');
    const sections = document.querySelectorAll('main section');

    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);

            // Ocultar todas las secciones
            sections.forEach(section => {
                section.style.display = 'none';
            });

            // Mostrar sección objetivo
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.style.display = 'block';
            }

            // Actualizar clase activa en nav
            navLinks.forEach(navLink => navLink.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

// Configurar módulo de inspecciones
function setupInspections() {
    const form = document.getElementById('inspection-form');
    const captureBtn = document.getElementById('capture-photo');
    const photoInput = document.getElementById('photo-input');
    const photoPreview = document.getElementById('photo-preview');
    const canvas = document.getElementById('signature-canvas');
    const clearSignatureBtn = document.getElementById('clear-signature');
    const cancelBtn = document.getElementById('cancel-inspection');

    let isDrawing = false;
    let context = canvas.getContext('2d');
    let currentPhoto = null;
    let currentLocation = null;

    // Configurar canvas de firma
    context.strokeStyle = '#000';
    context.lineWidth = 2;
    context.lineCap = 'round';

    // Eventos de dibujo en canvas
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    // Eventos táctiles para móviles
    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchmove', handleTouchMove);
    canvas.addEventListener('touchend', stopDrawing);

    // Captura de foto
    captureBtn.addEventListener('click', function() {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            photoInput.click();
        } else {
            alert('La captura de cámara no está disponible en este dispositivo.');
        }
    });

    photoInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                currentPhoto = e.target.result;
                photoPreview.innerHTML = `<img src="${currentPhoto}" alt="Foto capturada">`;
                getCurrentLocation();
            };
            reader.readAsDataURL(file);
        }
    });

    // Limpiar firma
    clearSignatureBtn.addEventListener('click', function() {
        context.clearRect(0, 0, canvas.width, canvas.height);
    });

    // Cancelar inspección
    cancelBtn.addEventListener('click', function() {
        if (confirm('¿Cancelar la inspección actual? Se perderán los datos no guardados.')) {
            resetInspectionForm();
        }
    });

    // Enviar formulario
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        saveInspection();
    });

    function startDrawing(e) {
        isDrawing = true;
        context.beginPath();
        context.moveTo(e.offsetX, e.offsetY);
    }

    function draw(e) {
        if (!isDrawing) return;
        context.lineTo(e.offsetX, e.offsetY);
        context.stroke();
    }

    function stopDrawing() {
        isDrawing = false;
    }

    function handleTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        startDrawing({ offsetX: x, offsetY: y });
    }

    function handleTouchMove(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        draw({ offsetX: x, offsetY: y });
    }

    function getCurrentLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                function(position) {
                    currentLocation = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        timestamp: new Date().toISOString()
                    };
                    console.log('Ubicación obtenida:', currentLocation);
                },
                function(error) {
                    console.warn('Error obteniendo ubicación:', error);
                    currentLocation = null;
                }
            );
        }
    }

    function saveInspection() {
        const formData = new FormData(form);
        const checklistItems = Array.from(form.querySelectorAll('input[name="checklist"]:checked'))
            .map(item => item.value);

        const inspectionData = {
            id: Date.now(),
            empresa: document.getElementById('company-select').value || 'default',
            tipo: formData.get('inspection-type'),
            checklist: checklistItems,
            observaciones: formData.get('observations'),
            foto: currentPhoto,
            ubicacion: currentLocation,
            firma: canvas.toDataURL(),
            fecha: new Date().toISOString(),
            sincronizado: false
        };

        // Guardar en IndexedDB
        saveToIndexedDB('inspecciones', inspectionData)
            .then(() => {
                alert('Inspección guardada exitosamente.');
                resetInspectionForm();
                // Volver al dashboard
                document.querySelector('a[href="#dashboard"]').click();
            })
            .catch(error => {
                console.error('Error guardando inspección:', error);
                alert('Error al guardar la inspección. Intente nuevamente.');
            });
    }

    function resetInspectionForm() {
        form.reset();
        context.clearRect(0, 0, canvas.width, canvas.height);
        photoPreview.innerHTML = '';
        currentPhoto = null;
        currentLocation = null;
    }
}

// Cargar datos del dashboard
function loadDashboardData() {
    // Simular carga de datos
    console.log('Cargando datos del dashboard...');
    // Aquí iría la lógica para cargar datos desde la API o IndexedDB
}

// Cargar datos de empresa específica
function loadCompanyData(companyId) {
    console.log('Cargando datos de empresa:', companyId);
    // Lógica para cargar datos de la empresa seleccionada
}

// Configurar Service Worker para PWA
function setupServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js')
            .then(function(registration) {
                console.log('Service Worker registrado:', registration);
            })
            .catch(function(error) {
                console.log('Error al registrar Service Worker:', error);
            });
    }
}

// Inicializar IndexedDB para almacenamiento offline
function initIndexedDB() {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = function(event) {
        console.error('Error al abrir IndexedDB:', event.target.error);
    };

    request.onsuccess = function(event) {
        db = event.target.result;
        console.log('IndexedDB inicializada correctamente');
    };

    request.onupgradeneeded = function(event) {
        db = event.target.result;

        // Crear stores para diferentes módulos
        if (!db.objectStoreNames.contains('inspecciones')) {
            const inspeccionesStore = db.createObjectStore('inspecciones', { keyPath: 'id', autoIncrement: true });
            inspeccionesStore.createIndex('empresa', 'empresa', { unique: false });
            inspeccionesStore.createIndex('fecha', 'fecha', { unique: false });
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
}

// Función para guardar datos en IndexedDB (para uso offline)
function saveToIndexedDB(storeName, data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.add(data);

        request.onsuccess = function() {
            resolve(request.result);
        };

        request.onerror = function() {
            reject(request.error);
        };
    });
}

// Función para obtener datos de IndexedDB
function getFromIndexedDB(storeName, key) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
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

// Función para sincronizar datos cuando hay conexión
function syncData() {
    if (navigator.onLine) {
        console.log('Sincronizando datos con el servidor...');
        // Lógica para enviar datos pendientes al servidor
    }
}

// Escuchar cambios en el estado de conexión
window.addEventListener('online', syncData);
window.addEventListener('offline', function() {
    console.log('Modo offline activado');
});