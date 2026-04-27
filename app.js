// app.js - Logica principal de la aplicacion PWA

const DB_NAME = 'SSO_DB';
const DB_VERSION = 5;
const PLANIFICACION_INITIAL_URL = 'planificacion-inicial.json';
const ACCIDENTES_INITIAL_URL = 'accidentes-inicial.json';
const APP_LOGO_URL = 'assets/logos/frc-logo.png';

const DEFAULT_BRAND = {
    colorCorporativo: '#0f766e',
    colorOscuro: '#115e59',
    colorSuave: '#ccfbf1',
    logoURL: APP_LOGO_URL,
    nombre: 'Sistema SSO'
};

const EMPRESAS_FALLBACK = [
    { id: 'aplomo', nombre: 'APLOMO', logoURL: 'assets/logos/Logo Aplomo.jpeg', colorCorporativo: '#0f766e' },
    { id: 'eson', nombre: 'ESON', logoURL: 'assets/logos/Logo ESON.jpeg', colorCorporativo: '#b45309' },
    { id: 'fewell', nombre: 'FEWELL', logoURL: 'assets/logos/sso.svg', colorCorporativo: '#4f46e5' },
    { id: 'movil-uno', nombre: 'MOVIL UNO', logoURL: 'assets/logos/Logo MovilUno.jpg', colorCorporativo: '#2563eb' },
    { id: 'oceanus', nombre: 'OCEANUS', logoURL: 'assets/logos/sso.svg', colorCorporativo: '#0891b2' },
    { id: 'rabuffer', nombre: 'RABUFFER', logoURL: 'assets/logos/Logo Rabufer.jpg', colorCorporativo: '#0f172a' }
];

const ACTIVITY_STATUSES = ['PROGRAMADO', 'HECHO', 'VENCIDO', 'CANCELADO', 'PENDIENTE'];

const DOWNLOADABLE_DOCUMENTS = [
    {
        id: 'planificacion-syso-2026',
        title: 'Gestion Gral de SYSO 2026',
        description: 'Planificacion anual, vista mensual, vista semanal y seguimiento de accidentes.',
        href: 'Gestión Gral de SYSO 2026 (Actividades, accidentes, etc.).xlsx',
        extension: 'xlsx',
        typeLabel: 'Excel'
    },
    {
        id: 're-002-inspeccion',
        title: 'RE 002 Registro de inspeccion de seguridad',
        description: 'Plantilla Word para registro de inspeccion de seguridad.',
        href: 'RE 002 Registro de inspección de seguridad.doc',
        extension: 'doc',
        typeLabel: 'Word'
    }
];

let db;
let dbReadyPromise;
let empresas = [];
let activeCompany = null;
let activities = [];
let accidents = [];
let initialActivities = [];
let initialAccidents = [];
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
    setupPlanningControls();
    setupAccidentControls();
    setupDocuments();
    applyCompanyBrand(null);

    try {
        await loadInitialOperationalData();
        renderDashboard();
        renderPlanning();
        renderAccidents();
    } catch (error) {
        console.warn('No se pudieron cargar los JSON iniciales:', error);
    }

    try {
        await dbReadyPromise;
        await seedInitialData();
        await refreshOperationalData();
    } catch (error) {
        console.error('Error inicializando datos operativos:', error);
        if (!activities.length && !accidents.length) {
            renderDataError();
        }
    }
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

    function activateSection(targetId) {
        sections.forEach(function(section) {
            section.hidden = section.id !== targetId;
        });

        navLinks.forEach(function(navLink) {
            navLink.classList.toggle('active', navLink.getAttribute('href') === '#' + targetId);
        });

        if (targetId === 'inspecciones') {
            requestAnimationFrame(refreshSignaturePad);
        }
    }

    navLinks.forEach(function(link) {
        link.addEventListener('click', function(event) {
            event.preventDefault();
            activateSection(link.getAttribute('href').slice(1));
        });
    });

    document.querySelectorAll('[data-go-section]').forEach(function(button) {
        button.addEventListener('click', function() {
            activateSection(button.dataset.goSection);
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

    fillCompanySelect(companySelect, {
        includeAll: true,
        allLabel: 'Todas las empresas'
    });

    companySelect.addEventListener('change', function() {
        const selectedCompany = empresas.find(function(empresa) {
            return empresa.id === companySelect.value;
        });

        activeCompany = selectedCompany || null;
        applyCompanyBrand(activeCompany);
        renderDashboard();
    });
}

function fillCompanySelect(select, options) {
    const settings = Object.assign({
        includeAll: false,
        allLabel: 'Todas',
        selectedValue: ''
    }, options || {});

    select.replaceChildren();

    if (settings.includeAll) {
        const allOption = document.createElement('option');
        allOption.value = '';
        allOption.textContent = settings.allLabel;
        select.append(allOption);
    }

    empresas.forEach(function(empresa) {
        const option = document.createElement('option');
        option.value = empresa.id;
        option.textContent = empresa.nombre;
        select.append(option);
    });

    select.value = settings.selectedValue || '';
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
    const companyName = company ? company.nombre : 'Todas las empresas';

    if (logo) {
        logo.src = APP_LOGO_URL;
        logo.alt = 'Logo FRC Safety and Marine Solutions';
    }

    if (title) {
        title.textContent = 'Sistema SSO';
    }

    if (kicker) {
        kicker.textContent = 'Sistema Integral';
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

async function seedInitialData() {
    await seedStoreFromRows('planificacion', initialActivities, PLANIFICACION_INITIAL_URL);
    await seedStoreFromRows('accidentes', initialAccidents, ACCIDENTES_INITIAL_URL);
}

async function loadInitialOperationalData() {
    const responses = await Promise.all([
        fetch(PLANIFICACION_INITIAL_URL, { cache: 'no-store' }),
        fetch(ACCIDENTES_INITIAL_URL, { cache: 'no-store' })
    ]);

    responses.forEach(function(response) {
        if (!response.ok) {
            throw new Error('No se pudo cargar ' + response.url);
        }
    });

    initialActivities = await responses[0].json();
    initialAccidents = await responses[1].json();
    activities = initialActivities.slice();
    accidents = initialAccidents.slice();
}

async function seedStoreFromRows(storeName, rows, fallbackUrl) {
    let seedRows = Array.isArray(rows) ? rows : [];

    if (seedRows.length === 0 && fallbackUrl) {
        const response = await fetch(fallbackUrl, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error('No se pudo cargar ' + fallbackUrl);
        }
        seedRows = await response.json();
    }

    if (seedRows.length === 0) return;

    const currentRows = await getAllFromIndexedDB(storeName);
    const currentIds = new Set(currentRows.map(function(row) {
        return row && row.id;
    }));
    const missingRows = seedRows.filter(function(row) {
        return row && row.id && !currentIds.has(row.id);
    });

    if (missingRows.length > 0) {
        await putManyInIndexedDB(storeName, missingRows);
    }
}

async function refreshOperationalData() {
    const storedActivities = await getAllFromIndexedDB('planificacion');
    const storedAccidents = await getAllFromIndexedDB('accidentes');
    activities = reconcileRows(initialActivities, storedActivities);
    accidents = reconcileRows(initialAccidents, storedAccidents);
    renderDashboard();
    renderPlanning();
    renderAccidents();
}

function reconcileRows(initialRows, storedRows) {
    const rowMap = new Map();

    (Array.isArray(initialRows) ? initialRows : []).forEach(function(row) {
        if (row && row.id) {
            rowMap.set(row.id, row);
        }
    });

    (Array.isArray(storedRows) ? storedRows : []).forEach(function(row) {
        if (row && row.id) {
            rowMap.set(row.id, row);
        }
    });

    return Array.from(rowMap.values());
}

function renderDashboard() {
    const scopedActivities = getCompanyScopedActivities();
    const scopedAccidents = getCompanyScopedAccidents();
    const today = getTodayISO();
    const currentWeek = getExcelWeek(today);
    const weeklyActivities = scopedActivities
        .filter(function(activity) {
            return Number(activity.semana) === currentWeek;
        })
        .sort(compareActivitiesByDate);
    const overdueActivities = scopedActivities
        .filter(function(activity) {
            return isActivityOverdue(activity, today);
        })
        .sort(compareActivitiesByDate);
    const pendingInvestigations = scopedAccidents.filter(function(accident) {
        return normalizeText(accident.investigacion) !== 'si';
    });

    setText('stat-week-activities', String(weeklyActivities.length));
    setText('stat-overdue', String(overdueActivities.length));
    setText('stat-accidents', String(scopedAccidents.length));

    renderDashboardAlerts(overdueActivities, pendingInvestigations);
    renderWeeklyActivities(weeklyActivities, currentWeek);
}

function renderDashboardAlerts(overdueActivities, pendingInvestigations) {
    const alertsList = document.getElementById('alerts-list');
    if (!alertsList) return;

    alertsList.replaceChildren();

    const alerts = [];

    overdueActivities.slice(0, 4).forEach(function(activity) {
        alerts.push({
            text: activity.empresa + ' - ' + activity.actividad + ' vencida el ' + formatDate(activity.fechaProgramada),
            status: 'VENCIDO',
            tone: 'rojo'
        });
    });

    pendingInvestigations.slice(0, 3).forEach(function(accident) {
        alerts.push({
            text: accident.empresa + ' - Investigacion pendiente: ' + accident.accidentado,
            status: 'Pendiente',
            tone: 'amarillo'
        });
    });

    if (alerts.length === 0) {
        alerts.push({
            text: activeCompany ? 'Sin alertas pendientes para ' + activeCompany.nombre + '.' : 'Sin alertas pendientes para las empresas cargadas.',
            status: 'Al dia',
            tone: 'verde'
        });
    }

    alerts.forEach(function(alert) {
        alertsList.append(createAlertCard(alert.text, alert.status, alert.tone));
    });
}

function renderWeeklyActivities(weeklyActivities, weekNumber) {
    const container = document.getElementById('weekly-activities-list');
    const title = document.getElementById('weekly-title');
    if (!container) return;

    const weekRange = getWeekRangeLabel(weekNumber);
    if (title) {
        title.textContent = 'Semana ' + weekNumber + ' · ' + weekRange;
    }

    container.replaceChildren();

    if (weeklyActivities.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.textContent = 'No hay actividades programadas para esta semana con el filtro actual.';
        container.append(emptyState);
        return;
    }

    weeklyActivities.forEach(function(activity) {
        container.append(createWeeklyActivityCard(activity));
    });
}

function createWeeklyActivityCard(activity) {
    const card = document.createElement('article');
    const meta = document.createElement('div');
    const title = document.createElement('h4');
    const footer = document.createElement('div');
    const date = document.createElement('span');
    const status = createStatusSelect(activity);

    card.className = 'activity-card';
    meta.className = 'activity-meta';
    footer.className = 'activity-card-footer';

    meta.textContent = activity.empresa + ' · ' + formatDate(activity.fechaProgramada);
    title.textContent = activity.actividad || 'Actividad sin titulo';
    date.textContent = activity.observaciones || 'Sin observaciones';
    date.className = 'muted-text';

    footer.append(date, status);
    card.append(meta, title, footer);
    return card;
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

function setupPlanningControls() {
    fillCompanySelect(document.getElementById('planning-company-filter'), {
        includeAll: true,
        allLabel: 'Todas'
    });
    fillCompanySelect(document.getElementById('activity-company'), {
        includeAll: false
    });
    fillStatusSelect(document.getElementById('planning-status-filter'), true);
    fillStatusSelect(document.getElementById('activity-status'), false);

    const toggleFormButton = document.getElementById('toggle-activity-form');
    const cancelButton = document.getElementById('cancel-activity-edit');
    const form = document.getElementById('activity-form');
    const exportButton = document.getElementById('export-planning');

    if (toggleFormButton && form) {
        toggleFormButton.addEventListener('click', function() {
            prepareActivityForm();
            form.hidden = false;
        });
    }

    if (cancelButton) {
        cancelButton.addEventListener('click', function() {
            resetActivityForm();
        });
    }

    if (form) {
        form.addEventListener('submit', saveActivityFromForm);
    }

    if (exportButton) {
        exportButton.addEventListener('click', exportPlanningToExcel);
    }

    ['planning-company-filter', 'planning-status-filter', 'planning-week-filter', 'planning-search'].forEach(function(id) {
        const element = document.getElementById(id);
        if (!element) return;
        element.addEventListener('input', renderPlanning);
        element.addEventListener('change', renderPlanning);
    });

    const tableBody = document.getElementById('planning-table-body');
    if (tableBody) {
        tableBody.addEventListener('click', function(event) {
            const editButton = event.target.closest('[data-edit-activity]');
            if (!editButton) return;
            const activity = activities.find(function(item) {
                return item.id === editButton.dataset.editActivity;
            });
            if (activity) {
                prepareActivityForm(activity);
            }
        });
    }

    document.addEventListener('change', function(event) {
        if (event.target.matches('[data-activity-status]')) {
            updateActivityStatus(event.target.dataset.activityStatus, event.target.value);
        }
    });
}

function fillStatusSelect(select, includeAll) {
    if (!select) return;

    select.replaceChildren();

    if (includeAll) {
        const allOption = document.createElement('option');
        allOption.value = '';
        allOption.textContent = 'Todos';
        select.append(allOption);
    }

    ACTIVITY_STATUSES.forEach(function(status) {
        const option = document.createElement('option');
        option.value = status;
        option.textContent = status;
        select.append(option);
    });

    if (!includeAll) {
        select.value = 'PROGRAMADO';
    }
}

function renderPlanning() {
    const tableBody = document.getElementById('planning-table-body');
    if (!tableBody) return;

    const filteredActivities = getFilteredPlanningActivities();
    tableBody.replaceChildren();

    if (filteredActivities.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 9;
        cell.className = 'empty-table-cell';
        cell.textContent = 'No hay actividades que coincidan con los filtros.';
        row.append(cell);
        tableBody.append(row);
        return;
    }

    filteredActivities.forEach(function(activity) {
        tableBody.append(createPlanningRow(activity));
    });
}

function getFilteredPlanningActivities() {
    const companyFilter = getValue('planning-company-filter');
    const statusFilter = getValue('planning-status-filter');
    const weekFilter = getValue('planning-week-filter');
    const search = normalizeText(getValue('planning-search'));

    return activities
        .filter(function(activity) {
            if (companyFilter && activity.empresaId !== companyFilter) return false;
            if (statusFilter && activity.estado !== statusFilter && getDisplayedStatus(activity) !== statusFilter) return false;
            if (weekFilter && Number(activity.semana) !== Number(weekFilter)) return false;

            if (search) {
                const haystack = normalizeText([
                    activity.empresa,
                    activity.actividad,
                    activity.estado,
                    activity.observaciones
                ].join(' '));
                if (!haystack.includes(search)) return false;
            }

            return true;
        })
        .sort(compareActivitiesByDate);
}

function createPlanningRow(activity) {
    const row = document.createElement('tr');
    const displayedStatus = getDisplayedStatus(activity);

    appendTextCell(row, activity.semana);
    appendTextCell(row, activity.mes);
    appendTextCell(row, activity.empresa);
    appendTextCell(row, activity.actividad, 'wrap-cell strong-cell');
    appendTextCell(row, formatDate(activity.fechaProgramada));
    appendTextCell(row, activity.fechaRealizada ? formatDate(activity.fechaRealizada) : '');

    const statusCell = document.createElement('td');
    const statusSelect = createStatusSelect(activity);
    if (displayedStatus === 'VENCIDO' && activity.estado !== 'VENCIDO') {
        statusSelect.classList.add('is-overdue');
        statusSelect.title = 'Actividad vencida por fecha programada';
    }
    statusCell.append(statusSelect);
    row.append(statusCell);

    appendTextCell(row, activity.observaciones, 'wrap-cell');

    const actionsCell = document.createElement('td');
    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'btn-text table-action';
    editButton.dataset.editActivity = activity.id;
    editButton.textContent = 'Editar';
    actionsCell.append(editButton);
    row.append(actionsCell);

    return row;
}

function createStatusSelect(activity) {
    const select = document.createElement('select');
    select.className = 'status-select ' + getStatusTone(activity.estado);
    select.dataset.activityStatus = activity.id;
    select.setAttribute('aria-label', 'Estado de ' + (activity.actividad || 'actividad'));

    ACTIVITY_STATUSES.forEach(function(status) {
        const option = document.createElement('option');
        option.value = status;
        option.textContent = status;
        select.append(option);
    });

    select.value = ACTIVITY_STATUSES.includes(activity.estado) ? activity.estado : 'PROGRAMADO';
    return select;
}

function appendTextCell(row, value, className) {
    const cell = document.createElement('td');
    cell.textContent = value == null ? '' : String(value);
    if (className) {
        cell.className = className;
    }
    row.append(cell);
}

function prepareActivityForm(activity) {
    const form = document.getElementById('activity-form');
    const idField = document.getElementById('activity-id');
    const companyField = document.getElementById('activity-company');
    const dateField = document.getElementById('activity-date');
    const statusField = document.getElementById('activity-status');
    const doneDateField = document.getElementById('activity-done-date');
    const nameField = document.getElementById('activity-name');
    const notesField = document.getElementById('activity-notes');

    if (!form) return;

    if (activity) {
        idField.value = activity.id;
        companyField.value = activity.empresaId;
        dateField.value = activity.fechaProgramada || '';
        statusField.value = activity.estado || 'PROGRAMADO';
        doneDateField.value = activity.fechaRealizada || '';
        nameField.value = activity.actividad || '';
        notesField.value = activity.observaciones || '';
    } else {
        idField.value = '';
        companyField.value = activeCompany ? activeCompany.id : (empresas[0] ? empresas[0].id : '');
        dateField.value = getTodayISO();
        statusField.value = 'PROGRAMADO';
        doneDateField.value = '';
        nameField.value = '';
        notesField.value = '';
    }

    form.hidden = false;
    nameField.focus();
}

function resetActivityForm() {
    const form = document.getElementById('activity-form');
    if (!form) return;
    form.reset();
    setValue('activity-id', '');
    form.hidden = true;
}

async function saveActivityFromForm(event) {
    event.preventDefault();

    const id = getValue('activity-id');
    const companyId = getValue('activity-company');
    const company = empresas.find(function(empresa) {
        return empresa.id === companyId;
    });
    const date = getValue('activity-date');
    const existing = activities.find(function(activity) {
        return activity.id === id;
    });
    const now = new Date().toISOString();

    const activity = Object.assign({}, existing || {}, {
        id: id || 'app-' + Date.now(),
        origen: existing ? existing.origen : 'App',
        empresaId: companyId,
        empresa: company ? company.nombre : companyId,
        actividad: getValue('activity-name'),
        fechaProgramada: date,
        fechaRealizada: getValue('activity-done-date'),
        estado: getValue('activity-status') || 'PROGRAMADO',
        observaciones: getValue('activity-notes'),
        semana: getExcelWeek(date),
        mes: getMonthName(date),
        actualizadoEn: now,
        creadoEn: existing && existing.creadoEn ? existing.creadoEn : now
    });

    if (activity.estado === 'HECHO' && !activity.fechaRealizada) {
        activity.fechaRealizada = getTodayISO();
    }

    await saveToIndexedDB('planificacion', activity);
    await refreshOperationalData();
    resetActivityForm();
}

async function updateActivityStatus(activityId, status) {
    const activity = activities.find(function(item) {
        return item.id === activityId;
    });
    if (!activity) return;

    const updatedActivity = Object.assign({}, activity, {
        estado: status,
        actualizadoEn: new Date().toISOString()
    });

    if (status === 'HECHO' && !updatedActivity.fechaRealizada) {
        updatedActivity.fechaRealizada = getTodayISO();
    }

    await saveToIndexedDB('planificacion', updatedActivity);
    await refreshOperationalData();
}

function setupAccidentControls() {
    fillCompanySelect(document.getElementById('accident-company-filter'), {
        includeAll: true,
        allLabel: 'Todas'
    });

    ['accident-company-filter', 'accident-investigation-filter'].forEach(function(id) {
        const element = document.getElementById(id);
        if (!element) return;
        element.addEventListener('change', renderAccidents);
    });

    const tableBody = document.getElementById('accidents-table-body');
    if (tableBody) {
        tableBody.addEventListener('change', function(event) {
            if (event.target.matches('[data-accident-investigation]')) {
                updateAccidentInvestigation(event.target.dataset.accidentInvestigation, event.target.value);
            }
        });
    }
}

function renderAccidents() {
    const tableBody = document.getElementById('accidents-table-body');
    const countPill = document.getElementById('accident-count-pill');
    if (!tableBody) return;

    const companyFilter = getValue('accident-company-filter');
    const investigationFilter = getValue('accident-investigation-filter');
    const filteredAccidents = accidents
        .filter(function(accident) {
            if (companyFilter && accident.empresaId !== companyFilter) return false;
            if (investigationFilter && normalizeText(accident.investigacion) !== investigationFilter.toLowerCase()) return false;
            return true;
        })
        .sort(function(a, b) {
            return String(a.fecha || '').localeCompare(String(b.fecha || ''));
        });

    if (countPill) {
        countPill.textContent = filteredAccidents.length + ' registros';
    }

    tableBody.replaceChildren();

    if (filteredAccidents.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 9;
        cell.className = 'empty-table-cell';
        cell.textContent = 'No hay accidentes que coincidan con los filtros.';
        row.append(cell);
        tableBody.append(row);
        return;
    }

    filteredAccidents.forEach(function(accident) {
        const row = document.createElement('tr');
        appendTextCell(row, accident.item);
        appendTextCell(row, formatDate(accident.fecha));
        appendTextCell(row, accident.empresa);
        appendTextCell(row, accident.accidentado, 'wrap-cell strong-cell');
        appendTextCell(row, accident.descripcion, 'wrap-cell');
        appendTextCell(row, accident.denunciaBse);
        appendTextCell(row, formatDate(accident.fechaAltaBse));
        appendTextCell(row, accident.diasPerdidos);

        const investigationCell = document.createElement('td');
        const select = document.createElement('select');
        select.className = 'status-select ' + (normalizeText(accident.investigacion) === 'si' ? 'verde' : 'rojo');
        select.dataset.accidentInvestigation = accident.id;

        ['SI', 'NO'].forEach(function(value) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            select.append(option);
        });

        select.value = normalizeText(accident.investigacion) === 'si' ? 'SI' : 'NO';
        investigationCell.append(select);
        row.append(investigationCell);
        tableBody.append(row);
    });
}

async function updateAccidentInvestigation(accidentId, investigation) {
    const accident = accidents.find(function(item) {
        return item.id === accidentId;
    });
    if (!accident) return;

    const updatedAccident = Object.assign({}, accident, {
        investigacion: investigation,
        actualizadoEn: new Date().toISOString()
    });

    await saveToIndexedDB('accidentes', updatedAccident);
    await refreshOperationalData();
}

function setupDocuments() {
    renderDocuments();
}

function renderDocuments() {
    const container = document.getElementById('documents-list');
    if (!container) return;

    container.replaceChildren();

    DOWNLOADABLE_DOCUMENTS.forEach(function(documentInfo) {
        const card = document.createElement('article');
        const icon = document.createElement('div');
        const content = document.createElement('div');
        const title = document.createElement('h3');
        const description = document.createElement('p');
        const action = document.createElement('a');

        card.className = 'document-card';
        icon.className = 'document-type ' + documentInfo.extension;
        icon.textContent = documentInfo.extension.toUpperCase();
        title.textContent = documentInfo.title;
        description.textContent = documentInfo.description;
        action.href = documentInfo.href;
        action.download = documentInfo.href;
        action.className = 'btn-primary compact-button document-download';
        action.textContent = 'Descargar ' + documentInfo.typeLabel;

        content.append(title, description, action);
        card.append(icon, content);
        container.append(card);
    });
}

function exportPlanningToExcel() {
    if (!activities.length) {
        alert('No hay actividades para exportar.');
        return;
    }

    const rows = activities.slice().sort(compareActivitiesByDate);
    const htmlRows = rows.map(function(activity) {
        return '<tr>' +
            '<td>' + escapeHtml(activity.semana) + '</td>' +
            '<td>' + escapeHtml(activity.mes) + '</td>' +
            '<td>' + escapeHtml(activity.empresa) + '</td>' +
            '<td>' + escapeHtml(activity.actividad) + '</td>' +
            '<td>' + escapeHtml(activity.fechaProgramada) + '</td>' +
            '<td>' + escapeHtml(activity.fechaRealizada) + '</td>' +
            '<td>' + escapeHtml(activity.estado) + '</td>' +
            '<td>' + escapeHtml(activity.observaciones) + '</td>' +
        '</tr>';
    }).join('');
    const html = [
        '<html><head><meta charset="UTF-8">',
        '<style>',
        'table{border-collapse:collapse;font-family:Segoe UI,Arial,sans-serif;font-size:12px;}',
        'th{background:#0f766e;color:#fff;font-weight:700;}',
        'td,th{border:1px solid #9ca3af;padding:8px;vertical-align:top;}',
        '.wide{width:360px;}',
        '</style></head><body>',
        '<table>',
        '<thead><tr>',
        '<th>SEMANA</th><th>MES</th><th>EMPRESA</th><th class="wide">ACTIVIDAD</th><th>FECHA PROGRAMADA</th><th>FECHA REALIZADA</th><th>ESTADO</th><th class="wide">OBSERVACIONES</th>',
        '</tr></thead><tbody>',
        htmlRows,
        '</tbody></table></body></html>'
    ].join('');
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'planificacion-syso-' + getTodayISO() + '.xls';
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
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

    fecha.value = getTodayISO();
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

            const inspeccionesStore = ensureObjectStore(event, 'inspecciones', { keyPath: 'id' });
            ensureIndex(inspeccionesStore, 'empresaId', 'empresaId');
            ensureIndex(inspeccionesStore, 'fecha', 'fecha');
            ensureIndex(inspeccionesStore, 'sectorObra', 'sectorObra');

            ensureObjectStore(event, 'documentos', { keyPath: 'id', autoIncrement: true });

            const planificacionStore = ensureObjectStore(event, 'planificacion', { keyPath: 'id', autoIncrement: true });
            ensureIndex(planificacionStore, 'empresaId', 'empresaId');
            ensureIndex(planificacionStore, 'semana', 'semana');
            ensureIndex(planificacionStore, 'fechaProgramada', 'fechaProgramada');
            ensureIndex(planificacionStore, 'estado', 'estado');

            ensureObjectStore(event, 'incidentes', { keyPath: 'id', autoIncrement: true });

            const accidentesStore = ensureObjectStore(event, 'accidentes', { keyPath: 'id', autoIncrement: true });
            ensureIndex(accidentesStore, 'empresaId', 'empresaId');
            ensureIndex(accidentesStore, 'investigacion', 'investigacion');
        };
    });
}

function ensureObjectStore(event, storeName, options) {
    if (db.objectStoreNames.contains(storeName)) {
        return event.target.transaction.objectStore(storeName);
    }

    return db.createObjectStore(storeName, options);
}

function ensureIndex(store, indexName, keyPath) {
    if (!store.indexNames.contains(indexName)) {
        store.createIndex(indexName, keyPath, { unique: false });
    }
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

async function putManyInIndexedDB(storeName, rows) {
    const database = db || await dbReadyPromise;

    return new Promise(function(resolve, reject) {
        const transaction = database.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);

        rows.forEach(function(row) {
            store.put(row);
        });

        transaction.oncomplete = function() {
            resolve();
        };

        transaction.onerror = function() {
            reject(transaction.error);
        };
    });
}

async function getAllFromIndexedDB(storeName) {
    const database = db || await dbReadyPromise;

    return new Promise(function(resolve, reject) {
        const transaction = database.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = function() {
            resolve(request.result || []);
        };

        request.onerror = function() {
            reject(request.error);
        };
    });
}

async function countFromIndexedDB(storeName) {
    const database = db || await dbReadyPromise;

    return new Promise(function(resolve, reject) {
        const transaction = database.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.count();

        request.onsuccess = function() {
            resolve(request.result || 0);
        };

        request.onerror = function() {
            reject(request.error);
        };
    });
}

function renderDataError() {
    const weeklyContainer = document.getElementById('weekly-activities-list');
    const planningBody = document.getElementById('planning-table-body');
    if (weeklyContainer) {
        const message = document.createElement('div');
        message.className = 'empty-state';
        message.textContent = 'No se pudieron cargar los datos iniciales. Abrir la app desde un servidor local o Vercel permite leer los archivos JSON.';
        weeklyContainer.replaceChildren(message);
    }

    if (planningBody) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 9;
        cell.className = 'empty-table-cell';
        cell.textContent = 'No se pudieron cargar los datos iniciales de planificación.';
        row.append(cell);
        planningBody.replaceChildren(row);
    }
}

function getCompanyScopedActivities() {
    if (!activeCompany) return activities.slice();
    return activities.filter(function(activity) {
        return activity.empresaId === activeCompany.id;
    });
}

function getCompanyScopedAccidents() {
    if (!activeCompany) return accidents.slice();
    return accidents.filter(function(accident) {
        return accident.empresaId === activeCompany.id;
    });
}

function compareActivitiesByDate(a, b) {
    const dateCompare = String(a.fechaProgramada || '').localeCompare(String(b.fechaProgramada || ''));
    if (dateCompare !== 0) return dateCompare;
    return String(a.empresa || '').localeCompare(String(b.empresa || ''));
}

function getDisplayedStatus(activity) {
    if (isActivityOverdue(activity, getTodayISO())) {
        return 'VENCIDO';
    }
    return activity.estado || 'PROGRAMADO';
}

function isActivityOverdue(activity, today) {
    if (!activity || !activity.fechaProgramada) return false;
    if (['HECHO', 'CANCELADO'].includes(activity.estado)) return false;
    return activity.fechaProgramada < today || activity.estado === 'VENCIDO';
}

function getStatusTone(status) {
    const normalizedStatus = normalizeText(status).toUpperCase();
    if (normalizedStatus === 'HECHO') return 'verde';
    if (normalizedStatus === 'VENCIDO' || normalizedStatus === 'CANCELADO') return 'rojo';
    if (normalizedStatus === 'PENDIENTE') return 'amarillo';
    return 'amarillo';
}

function getTodayISO() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
}

function parseDate(dateString) {
    if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return null;
    const parts = dateString.split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
}

function getExcelWeek(dateString) {
    const date = parseDate(dateString);
    if (!date) return '';

    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((date - startOfYear) / 86400000) + 1;
    const janFirstDay = startOfYear.getDay() === 0 ? 7 : startOfYear.getDay();
    return Math.floor((dayOfYear + janFirstDay - 2) / 7) + 1;
}

function getWeekRangeLabel(weekNumber) {
    const year = new Date().getFullYear();
    const start = new Date(year, 0, -2 + (Number(weekNumber) - 1) * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return formatShortDate(start) + ' al ' + formatShortDate(end);
}

function getMonthName(dateString) {
    const date = parseDate(dateString);
    if (!date) return '';
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return months[date.getMonth()];
}

function formatDate(dateString) {
    const date = parseDate(dateString);
    if (!date) return dateString || '';
    return formatShortDate(date);
}

function formatShortDate(date) {
    return String(date.getDate()).padStart(2, '0') + '/' + String(date.getMonth() + 1).padStart(2, '0') + '/' + date.getFullYear();
}

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getValue(id) {
    const element = document.getElementById(id);
    return element ? element.value.trim() : '';
}

function setValue(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.value = value;
    }
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
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
