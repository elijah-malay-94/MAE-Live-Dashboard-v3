// i18n.js — very small EN/IT language switcher
// Stores language in localStorage and updates DOM elements marked with data-i18n attributes.

(function () {
  const STORAGE_KEY = 'mae_dashboard_lang';
  const SUPPORTED = ['en', 'it'];

  const dict = {
    en: {
      'lang.english': 'English',
      'lang.italian': 'Italian',
      'settings.language': 'Language',

      'nav.navigation': 'Navigation',
      'nav.dashboard': 'Dashboard',
      'nav.works': 'Works',
      'nav.alerts': 'Alerts',
      'nav.export': 'Export',
      'nav.settings': 'Settings',
      'nav.devices': 'Devices',

      'page.liveDashboard': 'Live Dashboard',
      'page.works': 'WORKS',
      'works.subtitle': 'Select a work to view measures',

      'works.search.placeholder': 'Search works…',
      'works.filter.all': 'All',
      'works.filter.active': 'Active',
      'works.filter.inactive': 'Inactive',
      'works.summary': 'Summary',
      'works.totalWorks': 'Total works',
      'works.activeWorks': 'Active works',
      'works.inactiveWorks': 'Inactive works',
      'common.devices': 'Devices',
      'works.footerHint': 'Click a work to open measures',
      'works.emptyTitle': 'No works found',
      'works.emptyHint': 'Try changing the filter or search term.',
      'works.place': 'Place',
      'works.devicesLabel': 'Devices',
      'works.active': 'Active',
      'works.inactive': 'Inactive',
      'works.noWorksYet': 'No works yet',
      'works.summarySub': 'Active {active}/{total} · Devices {devices}',
      'works.deviceCountsHint': 'Device counts available for {with}/{total} works · Totals based on these · Others missing',
      'works.deviceCountsMissing': 'Device counts not provided',
      'works.activeHint': '{pct}% active · Devices {devices}',
      'works.inactiveHint': '{pct}% inactive · Devices {devices}',
      'works.avgPerWork': 'Avg {avg}/work',
      'works.workLabel': 'WORK',
      'works.workWord': 'Work',
      'works.placeLabel': 'PLACE',
      'works.devicesLabel2': 'DEVICES',

      'controls.period': 'Period',
      'controls.apply': 'Apply',
      'controls.channel': 'Channel',
      'controls.interval': 'Interval',
      'controls.interval.all': 'All',
      'controls.interval.hour': 'Last hour',
      'controls.interval.day': 'Last 24h',
      'controls.autoRefresh': 'Auto-refresh',

      'dashboard.selectedChannel': 'Selected channel',
      'dashboard.allChannels': 'All Channels',
      'dashboard.deviceInfo': 'Device Info',
      'dashboard.powerSupply': 'Power Supply',
      'dashboard.measurementLog': 'Measurement Log',
      'dashboard.search.placeholder': 'Search...',

      'theme.light': 'Light',
      'theme.dark': 'Dark',
      'theme.lightMode': 'Light mode',
      'theme.darkMode': 'Dark mode',

      'auth.login': 'Login',
      'auth.logout': 'Logout',
      'auth.signIn': 'Sign In',
      'auth.signingIn': 'Signing in…',
      'auth.missingCreds': 'Please enter username and password.',
      'auth.loginFailed': 'Login failed. Check your credentials.',
      'auth.welcomeBack': 'Welcome back',
      'auth.signInToAccess': 'Sign in to access the live dashboard',
      'auth.username': 'Username',
      'auth.password': 'Password',
      'auth.enterUsername': 'Enter username',
      'auth.enterPassword': 'Enter password',

      'common.noData': 'No data',
      'common.records': 'records',
      'common.loading': 'Loading…',
      'common.cancel': 'Cancel',
      'common.close': 'Close',
      'common.go': 'Go',
      'common.updated': 'Updated',
      'error.noDataDevicePeriod': 'No data for this device in the selected period — try a different date range.',
      'error.noDataDevicePeriodOrDevice': 'No data for this device in the selected period — try a different date range or select another device.',
      'error.noDevicesFound': 'No devices found. Check customer ID and API connection.',
      'error.noActiveDeviceYet': 'No active device selected yet. Please wait for devices to load.',
      'error.couldNotLoadData': 'Could not load data: {detail}',
      'error.serverErrorTryDifferentRange': 'Server error. Try a different date range.',
      'error.failedToLoadData': 'Failed to load data.',
      'table.date': 'Date',
      'table.time': 'Time',
      'table.status': 'Status',
      'status.ok': 'OK',
      'status.warn': 'WARN',
      'status.alert': 'ALERT',
      'map.allDevices': 'All Devices',
      'map.status': 'Status',
      'map.online': 'Online',
      'map.offline': 'Offline',
      'map.liveDeviceLocation': 'Live Device Location',
      'map.activeDevice': 'Active Device',
      'map.city': 'City',
      'map.position': 'Position',
      'map.lat': 'Lat',
      'map.lng': 'Lng',
      'map.signal': 'Signal',
      'map.mapStyle': 'Map Style',
      'map.streets': 'Streets',
      'map.satellite': 'Satellite',
      'map.terrain': 'Terrain',
      'map.quickJump': 'Quick Jump',
      'map.searchCityPlaceholder': 'Search city or address…',
      'map.loading': 'Loading map…',
      'map.zoomIn': 'Zoom In',
      'map.zoomOut': 'Zoom Out',
      'map.recenter': 'Re-center',
      'map.openFullMap': 'Open Full Map',
      'map.locationNotFound': 'Location not found.',

      'filetype.all': 'All',
      'filetype.cir': 'Circular',
      'filetype.evt': 'Event',
      'filetype.day': 'Daily',

      'alert.tresholds': 'Alert Thresholds',
      'alert.enable': 'Enable Alerts',
      'alert.saveandapply': 'Save and apply',
      'alert.soundnotifications': 'Sound Notifications',

      'live.live': 'LIVE',
      'live.paused': 'PAUSED',
      'live.pausedLower': 'paused',

      'export.title': 'Export Data',
      'export.subtitle': 'Choose format and range for the current filtered dataset',
      'export.downloadFiles': 'Download files',
      'export.downloadFilesDesc': 'Browse file list and download files',
      'export.printPdf': 'Print / PDF — Current view',
      'export.printPdfDesc': 'Print or save as PDF using the current filtered dataset',
      'export.csv': 'CSV — Comma Separated',
      'export.csvDesc': 'Compatible with Excel, Google Sheets, MATLAB',
      'export.json': 'JSON — Raw data',
      'export.jsonDesc': 'For API integration & backend import',
      'export.exportCsv': 'Export CSV',

      'files.title': 'Download files',
      'files.from': 'From',
      'files.to': 'To',
      'files.type': 'Type',
      'files.loadFiles': 'Load files',
      'files.noQueryYet': 'No file query yet.',
      'files.prev': 'Prev',
      'files.next': 'Next',
      'files.page': 'Page',
      'files.loading': 'Loading files...',
      'files.loadedSummary': 'Loaded {count} / {total} files (offset {offset}, limit {limit}){more}.',
      'files.moreAvailable': ' — more available',
      'files.errorLoading': 'Error loading files: {message}',
      'files.noFilesFound': 'No files found for current filters.',
      'files.col.name': 'Name',
      'files.col.timestamp': 'Timestamp',
      'files.col.type': 'Type',
      'files.col.action': 'Action',
      'files.download': 'Download',
      'files.downloadFailed': 'Download failed: {message}',

      'dashboard.powerSupplyLiveMonitor': 'Power Supply — Live Monitor',
      'dashboard.batteryShort': 'Batt',
      'dashboard.usbShort': 'USB',
      'dashboard.auxShort': 'AUX',

      'chart.min': 'MIN',
      'chart.max': 'MAX',
      'chart.avg': 'AVG',
      'chart.range': 'RANGE',
      'chart.samples': 'SAMPLES',
      'chart.overlay': 'Overlay',

      'threshold.minWarn': 'Min warn',
      'threshold.maxWarn': 'Max warn',
      'threshold.minAlert': 'Min alert',
      'threshold.maxAlert': 'Max alert',
      'alert.criticalExceeded': 'CRITICAL threshold exceeded',
      'alert.warningExceeded': 'Warning threshold exceeded',
      'alert.recordedAt': 'recorded at',

      'deviceInfo.name': 'Name',
      'deviceInfo.serialNo': 'Serial No.',
      'deviceInfo.typology': 'Typology',
      'deviceInfo.lastConnection': 'Last connection',
      'deviceInfo.signal': 'Signal',
      'deviceInfo.memory': 'Memory',
      'deviceInfo.ip': 'IP',
      'deviceInfo.publicIp': 'Public IP',
      'deviceInfo.location': 'Location',
      'deviceInfo.position': 'Position',
      'deviceInfo.coordinates': 'Coordinates',

      'footer.signalFmt': 'Signal {signal}/4',
      'footer.memoryFmt': 'Memory {memory}',
      'footer.platformFmt': '{type} Platform',
      'footer.appTitle': 'Datalogger Live Dashboard',

      'power.title': 'Power Supply — Live Monitor',
      'power.deviceLine': 'DEVICE: {id} · Battery · USB · AUX · Updates with dashboard',
      'power.kpi.battery': 'Battery',
      'power.kpi.usbVoltage': 'USB Voltage',
      'power.kpi.auxVoltage': 'AUX Voltage',
      'power.nominal.battery': 'Nominal: 3.7V – 4.2V',
      'power.nominal.usb': 'Nominal: 5.0V',
      'power.externalSupply': 'External supply',
      'power.combinedView': 'Combined View — All Channels',
      'power.individualHistory': 'Individual Channel History',

      'data.loadedMock': 'loaded (mock)',

      'common.yes': 'yes',
      'common.no': 'no',

      'report.title': 'Device Export Report',
      'report.generated': 'Generated',
      'report.deviceInfo': 'Device Information',
      'report.deviceName': 'Device Name',
      'report.serialNo': 'Serial No.',
      'report.type': 'Type',
      'report.status': 'Status',
      'report.lastConnection': 'Last Connection',
      'report.memoryFree': 'Memory Free',
      'report.battery': 'Battery',
      'report.ipAddress': 'IP Address',
      'report.publicIp': 'Public IP',
      'report.dataRecords': 'Data Records',
      'report.noDataForPeriod': 'No data available for this period',
      'report.dataVisualization': 'Data Visualization',
      'report.combinedOverview': 'Combined Overview',
      'report.noData': 'No data',
      'report.footer': 'MAE DataLogger Dashboard',

      'alarms.title': 'Alerts',
      'alarms.noEvents': 'No events found for this period.',
      'alarms.channel': 'Channel',
      'alarms.event': 'event',
      'alarms.events': 'events',
      'alarms.details': 'Details',
      'alarms.eventDetail': 'Event Detail',
      'alarms.file': 'File',
      'alarms.datetime': 'Date and time',
      'alarms.peakValue': 'Peak value',
      'alarms.max_threshold': 'Max Threshold',
      'alarms.min_threshold': 'Min Threshold',
      'alarms.frequency': 'Frequency',
      'alarms.saturation': 'Saturation',
      'alarms.peak': 'Peak',
      'alarms.value': 'Value',
      'alarms.channelsOverview': 'Channels overview',
    },
    it: {
      'lang.english': 'Inglese',
      'lang.italian': 'Italiano',
      'settings.language': 'Lingua',

      'nav.navigation': 'Navigazione',
      'nav.dashboard': 'Cruscotto',
      'nav.works': 'Lavori',
      'nav.alerts': 'Allarmi',
      'nav.export': 'Esporta',
      'nav.settings': 'Impostazioni',
      'nav.devices': 'Dispositivi',

      'page.liveDashboard': 'Cruscotto Live',
      'page.works': 'Lavori',
      'works.subtitle': 'Seleziona un lavoro per vedere le misure',

      'works.search.placeholder': 'Cerca lavori…',
      'works.filter.all': 'Tutti',
      'works.filter.active': 'Attivi',
      'works.filter.inactive': 'Inattivi',
      'works.summary': 'Riepilogo',
      'works.totalWorks': 'Totale lavori',
      'works.activeWorks': 'Lavori attivi',
      'works.inactiveWorks': 'Lavori inattivi',
      'common.devices': 'Dispositivi',
      'works.footerHint': 'Clicca un lavoro per aprire le misure',
      'works.emptyTitle': 'Nessun lavoro trovato',
      'works.emptyHint': 'Prova a cambiare filtro o termine di ricerca.',
      'works.place': 'Sede',
      'works.devicesLabel': 'Dispositivi',
      'works.active': 'Attivo',
      'works.inactive': 'Inattivo',
      'works.noWorksYet': 'Nessun lavoro',
      'works.summarySub': 'Attivi {active}/{total} · Dispositivi {devices}',
      'works.deviceCountsHint': 'Conteggi disponibili per {with}/{total} lavori · Totali basati su questi · Altri mancanti',
      'works.deviceCountsMissing': 'Conteggio dispositivi non fornito',
      'works.activeHint': '{pct}% attivi · Dispositivi {devices}',
      'works.inactiveHint': '{pct}% inattivi · Dispositivi {devices}',
      'works.avgPerWork': 'Media {avg}/lavoro',
      'works.workLabel': 'LAVORO',
      'works.workWord': 'Lavoro',
      'works.placeLabel': 'SEDE',
      'works.devicesLabel2': 'DISPOSITIVI',

      'controls.period': 'Periodo',
      'controls.apply': 'Applica',
      'controls.channel': 'Canale',
      'controls.interval': 'Intervallo',
      'controls.interval.all': 'Tutti',
      'controls.interval.hour': 'Ultima ora',
      'controls.interval.day': 'Ultime 24h',
      'controls.autoRefresh': 'Auto-aggiornamento',

      'dashboard.selectedChannel': 'Canale selezionato',
      'dashboard.allChannels': 'Tutti i canali',
      'dashboard.deviceInfo': 'Info dispositivo',
      'dashboard.powerSupply': 'Alimentazione',
      'dashboard.measurementLog': 'Registro misure',
      'dashboard.search.placeholder': 'Cerca...',

      'theme.light': 'Chiaro',
      'theme.dark': 'Scuro',
      'theme.lightMode': 'Modalità chiara',
      'theme.darkMode': 'Modalità scura',

      'auth.login': 'Login',
      'auth.logout': 'Logout',
      'auth.signIn': 'Accedi',
      'auth.signingIn': 'Accesso…',
      'auth.missingCreds': 'Inserisci username e password.',
      'auth.loginFailed': 'Accesso fallito. Controlla le credenziali.',
      'auth.welcomeBack': 'Bentornato',
      'auth.signInToAccess': 'Accedi per entrare nel cruscotto live',
      'auth.username': 'Username',
      'auth.password': 'Password',
      'auth.enterUsername': 'Inserisci username',
      'auth.enterPassword': 'Inserisci password',

      'common.noData': 'Nessun dato',
      'common.records': 'record',
      'common.loading': 'Caricamento…',
      'common.cancel': 'Annulla',
      'common.close': 'Chiudi',
      'common.go': 'Vai',
      'common.updated': 'Aggiornato',
      'error.noDataDevicePeriod': 'Nessun dato per questo dispositivo nel periodo selezionato — prova un intervallo diverso.',
      'error.noDataDevicePeriodOrDevice': 'Nessun dato per questo dispositivo nel periodo selezionato — prova un intervallo diverso o seleziona un altro dispositivo.',
      'error.noDevicesFound': 'Nessun dispositivo trovato. Controlla ID cliente e connessione API.',
      'error.noActiveDeviceYet': 'Nessun dispositivo attivo selezionato. Attendi il caricamento dei dispositivi.',
      'error.couldNotLoadData': 'Impossibile caricare i dati: {detail}',
      'error.serverErrorTryDifferentRange': 'Errore server. Prova un intervallo di date diverso.',
      'error.failedToLoadData': 'Caricamento dati non riuscito.',
      'table.date': 'Data',
      'table.time': 'Ora',
      'table.status': 'Stato',
      'status.ok': 'OK',
      'status.warn': 'AVVISO',
      'status.alert': 'ALLARME',
      'map.allDevices': 'Tutti i dispositivi',
      'map.status': 'Stato',
      'map.online': 'Online',
      'map.offline': 'Offline',
      'map.liveDeviceLocation': 'Posizione dispositivo (live)',
      'map.activeDevice': 'Dispositivo attivo',
      'map.city': 'Città',
      'map.position': 'Posizione',
      'map.lat': 'Lat',
      'map.lng': 'Lng',
      'map.signal': 'Segnale',
      'map.mapStyle': 'Stile mappa',
      'map.streets': 'Strade',
      'map.satellite': 'Satellite',
      'map.terrain': 'Terreno',
      'map.quickJump': 'Salto rapido',
      'map.searchCityPlaceholder': 'Cerca città o indirizzo…',
      'map.loading': 'Caricamento mappa…',
      'map.zoomIn': 'Zoom +',
      'map.zoomOut': 'Zoom −',
      'map.recenter': 'Ricentra',
      'map.openFullMap': 'Apri mappa completa',
      'map.locationNotFound': 'Posizione non trovata.',

      'filetype.all': 'Tutti',
      'filetype.cir': 'Circolari',
      'filetype.evt': 'Eventi',
      'filetype.day': 'Giornalieri',

      'alert.tresholds': 'Soglie di allarme',
      'alert.enable': 'Abilita allarmi',
      'alert.saveandapply': 'Salva e applica',
      'alert.soundnotifications': 'Notifiche sonore',

      'live.live': 'LIVE',
      'live.paused': 'IN PAUSA',
      'live.pausedLower': 'in pausa',

      'export.title': 'Esporta dati',
      'export.subtitle': 'Scegli formato e intervallo per il dataset filtrato corrente',
      'export.downloadFiles': 'Scarica file',
      'export.downloadFilesDesc': 'Sfoglia la lista e scarica i file',
      'export.printPdf': 'Stampa / PDF — Vista corrente',
      'export.printPdfDesc': 'Stampa o salva come PDF usando il dataset filtrato corrente',
      'export.csv': 'CSV — Separato da virgole',
      'export.csvDesc': 'Compatibile con Excel, Google Sheets, MATLAB',
      'export.json': 'JSON — Dati grezzi',
      'export.jsonDesc': 'Per integrazione API e import backend',
      'export.exportCsv': 'Esporta CSV',

      'files.title': 'Scarica file',
      'files.from': 'Da',
      'files.to': 'A',
      'files.type': 'Tipo',
      'files.loadFiles': 'Carica file',
      'files.noQueryYet': 'Nessuna ricerca file ancora.',
      'files.prev': 'Prec',
      'files.next': 'Succ',
      'files.page': 'Pagina',
      'files.loading': 'Caricamento file...',
      'files.loadedSummary': 'Caricati {count} / {total} file (offset {offset}, limite {limit}){more}.',
      'files.moreAvailable': ' — altri disponibili',
      'files.errorLoading': 'Errore nel caricamento file: {message}',
      'files.noFilesFound': 'Nessun file trovato con i filtri correnti.',
      'files.col.name': 'Nome',
      'files.col.timestamp': 'Timestamp',
      'files.col.type': 'Tipo',
      'files.col.action': 'Azione',
      'files.download': 'Scarica',
      'files.downloadFailed': 'Download fallito: {message}',

      'dashboard.powerSupplyLiveMonitor': 'Alimentazione — Monitor live',
      'dashboard.batteryShort': 'Batteria',
      'dashboard.usbShort': 'USB',
      'dashboard.auxShort': 'AUX',

      'chart.min': 'MIN',
      'chart.max': 'MAX',
      'chart.avg': 'MEDIA',
      'chart.range': 'RANGE',
      'chart.samples': 'CAMPIONI',
      'chart.overlay': 'Sovrapposto',

      'threshold.minWarn': 'Min avviso',
      'threshold.maxWarn': 'Max avviso',
      'threshold.minAlert': 'Min allarme',
      'threshold.maxAlert': 'Max allarme',
      'alert.criticalExceeded': 'Soglia CRITICA superata',
      'alert.warningExceeded': 'Soglia di avviso superata',
      'alert.recordedAt': 'registrato alle',

      'deviceInfo.name': 'Nome',
      'deviceInfo.serialNo': 'Numero seriale',
      'deviceInfo.typology': 'Tipologia',
      'deviceInfo.lastConnection': 'Ultima connessione',
      'deviceInfo.signal': 'Segnale',
      'deviceInfo.memory': 'Memoria',
      'deviceInfo.ip': 'IP',
      'deviceInfo.publicIp': 'IP pubblico',
      'deviceInfo.location': 'Località',
      'deviceInfo.position': 'Posizione',
      'deviceInfo.coordinates': 'Coordinate',

      'footer.signalFmt': 'Segnale {signal}/4',
      'footer.memoryFmt': 'Memoria {memory}',
      'footer.platformFmt': 'Piattaforma {type}',
      'footer.appTitle': 'Cruscotto Live Datalogger',

      'power.title': 'Alimentazione — Monitor live',
      'power.deviceLine': 'DEVICE: {id} · Batteria · USB · AUX · Aggiornato con il cruscotto',
      'power.kpi.battery': 'Batteria',
      'power.kpi.usbVoltage': 'Tensione USB',
      'power.kpi.auxVoltage': 'Tensione AUX',
      'power.nominal.battery': 'Nominale: 3.7V – 4.2V',
      'power.nominal.usb': 'Nominale: 5.0V',
      'power.externalSupply': 'Alimentazione esterna',
      'power.combinedView': 'Vista combinata — Tutti i canali',
      'power.individualHistory': 'Storico canali individuali',

      'data.loadedMock': 'caricati (mock)',

      'common.yes': 'sì',
      'common.no': 'no',

      'report.title': 'Rapporto Dispositivo',
      'report.generated': 'Generato',
      'report.deviceInfo': 'Informazioni Dispositivo',
      'report.deviceName': 'Nome dispositivo',
      'report.serialNo': 'Numero seriale',
      'report.type': 'Tipo',
      'report.status': 'Stato',
      'report.lastConnection': 'Ultima connessione',
      'report.memoryFree': 'Memoria libera',
      'report.battery': 'Batteria',
      'report.ipAddress': 'Indirizzo IP',
      'report.publicIp': 'IP pubblico',
      'report.dataRecords': 'Dati',
      'report.noDataForPeriod': 'Nessun dato disponibile per questo periodo',
      'report.dataVisualization': 'Visualizzazione dati',
      'report.combinedOverview': 'Vista combinata',
      'report.noData': 'Nessun dato',
      'report.footer': 'Cruscotto MAE DataLogger',

      'alarms.title': 'Allarmi',
      'alarms.noEvents': 'Nessun evento trovato per questo periodo.',
      'alarms.channel': 'Canale',
      'alarms.event': 'evento',
      'alarms.events': 'eventi',
      'alarms.details': 'Dettagli',
      'alarms.eventDetail': 'Dettaglio evento',
      'alarms.file': 'File',
      'alarms.datetime': 'Data e ora',
      'alarms.peakValue': 'Valore di PICCO',
      'alarms.threshold': 'Valore di SOGLIA',
      'alarms.frequency': 'Frequenza',
      'alarms.saturation': 'Saturazione',
      'alarms.peak': 'Picco',
      'alarms.channelsOverview': 'Panoramica canali',
    },
  };

  function format(template, vars) {
    return String(template || '').replace(/\{(\w+)\}/g, (_, k) => (vars && vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
  }

  function getLanguage() {
    try {
      const raw = (localStorage.getItem(STORAGE_KEY) || '').toLowerCase().trim();
      return SUPPORTED.includes(raw) ? raw : 'en';
    } catch (e) {
      return 'en';
    }
  }

  function setLanguage(lang) {
    const next = SUPPORTED.includes(lang) ? lang : 'en';
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (e) { /* ignore */ }
    applyLanguage(next);
  }

  function t(key) {
    const lang = getLanguage();
    return dict?.[lang]?.[key] ?? dict?.en?.[key] ?? key;
  }

  function tf(key, vars) {
    return format(t(key), vars);
  }

  function applyLanguage(lang = getLanguage()) {
    // Keep the html[lang] attribute in sync so browsers don't auto-translate.
    document.documentElement.lang = lang;

    // Update text nodes
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (!key) return;
      el.textContent = dict?.[lang]?.[key] ?? dict?.en?.[key] ?? el.textContent;
    });

    // Update placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (!key) return;
      const txt = dict?.[lang]?.[key] ?? dict?.en?.[key];
      if (txt !== undefined && txt !== null) el.setAttribute('placeholder', String(txt));
    });

    // Update option labels
    document.querySelectorAll('option[data-i18n]').forEach((opt) => {
      const key = opt.getAttribute('data-i18n');
      if (!key) return;
      opt.textContent = dict?.[lang]?.[key] ?? dict?.en?.[key] ?? opt.textContent;
    });

    // Keep auth button label in sync (state/works wire the handler, we just refresh labels)
    if (typeof window.updateDashboardAuthButton === 'function') {
      try { window.updateDashboardAuthButton(); } catch (e) { /* ignore */ }
    }

    // Theme label/title is managed by theme.js; re-apply to refresh translated labels.
    if (window.MAE_THEME?.applyTheme) {
      try { window.MAE_THEME.applyTheme(window.MAE_THEME.getTheme()); } catch (e) { /* ignore */ }
    }

    // Update language button active state
    const enBtn = document.getElementById('langBtnEn');
    const itBtn = document.getElementById('langBtnIt');
    if (enBtn) enBtn.classList.toggle('active', lang === 'en');
    if (itBtn) itBtn.classList.toggle('active', lang === 'it');

    // Some UI is built via JS templates (works cards/overview). Re-render on Works route.
    try {
      if (typeof window.getCurrentPage === 'function' && window.getCurrentPage() === 'works') {
        const subEl = document.getElementById('pageSubtitle');
        if (subEl) subEl.textContent = dict?.[lang]?.['works.subtitle'] ?? dict?.en?.['works.subtitle'] ?? '';
        if (typeof window.renderOverview === 'function') window.renderOverview();
        if (typeof window.renderWorks === 'function') window.renderWorks();
      }
    } catch (e) { /* ignore */ }

    // Dashboard subtitle is generated (WORK/PLACE/DEVICES). Refresh it on language change.
    try {
      if (typeof window.getCurrentPage === 'function' && window.getCurrentPage() === 'dashboard') {
        if (typeof window.updateWorkSubtitle === 'function') window.updateWorkSubtitle();
        // Re-render only the parts that contain translated strings.
        // Do NOT call renderAll() — it calls renderChart() which overwrites the
        // chart title data-i18n element with the raw channel label.
        if (typeof window.renderDeviceInfo === 'function') window.renderDeviceInfo();
        if (typeof window.renderTable === 'function') window.renderTable();
        if (typeof window.renderKPIs === 'function') window.renderKPIs();
        // Refresh the footer records text.
        const footerRec = document.getElementById('footerRecords');
        if (footerRec && typeof window.filteredData !== 'undefined') {
          const recWord = (typeof window.t === 'function') ? window.t('common.records') : 'records';
          footerRec.textContent = `${window.filteredData.length} ${recWord}`;
        }
      }
    } catch (e) { /* ignore */ }
  }

  // Expose API
  window.MAE_I18N = { getLanguage, setLanguage, t, applyLanguage };
  window.t = t;
  window.tf = tf;
  window.setLanguage = setLanguage;

  document.addEventListener('DOMContentLoaded', () => applyLanguage(getLanguage()));
})();

