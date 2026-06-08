# Technical Standardization & UI/UX Guidelines (Levity Standard)

Questo documento definisce le linee guida architetturali, di design e operative estratte dal progetto "Levity". Deve essere considerato come la "Bibbia" per lo sviluppo della nuova applicazione di reporting, garantendo coerenza di stack, UI/UX e pattern di sviluppo.

---

## 1. Architettura e Stack Tecnologico

Il progetto frontend mantiene un approccio moderno, leggero e performante, limitando l'uso di dipendenze superflue.

**Librerie Core:**
- **Framework & Build Tool:** React 19 (tramite `vite` con `@vitejs/plugin-react`).
- **Styling:** Tailwind CSS v4 (con `postcss` e `autoprefixer`).
- **State Management Globale:** Zustand (con middleware `persist` per il salvataggio in `localStorage`).

**Librerie di Supporto Specifiche:**
- **Routing:** `react-router-dom` (v7) per la gestione nativa delle rotte e i nested layout (`<Outlet />`).
- **Data Fetching:** Sebbene `axios` sia presente nel `package.json`, l'architettura operativa (in `App.jsx` e nello store) predilige l'uso della **Fetch API nativa (`window.fetch`)**, potenziata da un interceptor globale (vedi Sezione 4).
- **Iconografia:** `lucide-react` per icone coerenti, scalabili e dal design minimale (es. `Clock`, `Save`, `Download`, `Sun`, `Moon`).
- **Utility CSS:** `clsx` e `tailwind-merge` per la composizione dinamica e sicura delle classi Tailwind nei componenti React.
- **Tabelle Dati:** `ag-grid-community` e `ag-grid-react` per le viste tabellari complesse ad alte prestazioni.
- **Code Editor:** `@monaco-editor/react` per l'inserimento o la visualizzazione di logiche testuali/codice (usato per l'SQL Developer).

---

## 2. Look & Feel e UI/UX Guidelines

L'interfaccia deve restituire un feeling "premium", pulito ed estremamente funzionale.

**Palette Colori (Tailwind Classes & Hex):**
- **Colore Primario/Accento (Teal):** Il colore principale per le azioni call-to-action (CTA) e l'active state è il Teal (`teal-500`, `teal-600`, `teal-700`). In alcuni hover in dark mode si usa un `teal-500/20` o testo `teal-400`. Il logo usa un gradiente `from-teal-500 to-teal-700`.
- **Backgrounds e Layout:**
  - *Light Mode:* Sfondo principale `bg-gray-50`, elementi card/header in `bg-white`, bordi `border-gray-200`. Testo base `text-gray-800` o `text-gray-900`.
  - *Dark Mode (tramite classe `dark`):* Sfondo principale ultra-scuro (es. `bg-[#09090b]`), sidebar/header in `bg-[#18181b]`, bordi `border-[#27272a]`. Testi primari in `text-gray-200`, secondari in `text-gray-400` o `text-gray-500`.

**Tipografia:**
- Font principale: `Inter` (in fallback su `Roboto` e `sans-serif`).
- Le font class sono gestite nativamente dai default di Tailwind (`text-sm`, `text-xs`, `font-bold`, `font-medium`, `font-semibold`), con ampio uso del text-xs per le UI dense (bottoni azione, log, metadati).
- Disabilitazione dell'antialiasing (tramite `@apply antialiased text-gray-800` in `index.css`).

**Layout Base (MainLayout):**
- **Struttura flex-screen:** Container principale `flex h-screen overflow-hidden font-sans`.
- **Sidebar (Sinistra):** Gestisce il collasso (`w-[240px]` vs `w-[68px]`) con una transizione `duration-300`. Contiene la navigazione categorizzata (con separatori e indicatore visivo `pill` laterale attivo in teal).
- **Topbar (In Alto):** Un header di altezza fissa (`h-14`), con effetto glassmorphism (`backdrop-blur-md` e sfondi con `/80` di opacità).
- **Project Switcher:** Inserito nella porzione sinistra della Topbar, implementato come una `<select>` standard stilizzata, la cui modifica aggiorna il Zustand store e forza un ricaricamento (`window.location.reload()`) per garantire un reset dello stato applicativo al cambio tenant.
- **Content Area:** Div centrale `flex-1 overflow-auto` per contenere le view tramite `<Outlet />`.

---

## 3. Catalogo dei Componenti Riutilizzabili

Dal progetto Levity bisogna re-implementare o astrarre i seguenti pattern visuali:

**Componenti Generici (Modali e Drawer):**
L'app fa largo uso di modali in overlay e cassetti (Drawer) a scorrimento laterale per non allontanare l'utente dal contesto:
- *Modali Configurazione:* Es. `PromptConfiguratorModal`, `ExportSettingsModal`, `SaveReportModal`. Spesso contengono form e azioni di conferma con bottoni primari (teal) e secondari.
- *Drawer Laterali:* Es. `PromptDrawer`, `HistoryDrawer`. Utilizzati per configurazioni o consultazione che necessitano di tenere visibile la schermata principale.
- *Bottoni Standard:* Utilizzano sempre `clsx` per gestire le varianti light/dark. Pattern comune: `px-3 py-1.5 rounded flex items-center gap-2 text-xs font-bold transition-all`.

**Griglie e Viste Standardizzate (AG Grid):**
- **Libreria:** `ag-grid-react` caricata con i moduli della community (`AllCommunityModule`).
- **Tema:** Il wrapper React della griglia viene racchiuso in un div che inietta la classe `ag-theme-alpine` o `ag-theme-alpine-dark` a seconda del tema dello store.
- **Configurazioni:** Le griglie di default vengono istanziate con `defaultColDef={{ flex: 1, sortable: true, filter: true, resizable: true }}`.
- **Formatter Custom:** Utilizzo di una utility `getFormatter(format)` per formattare uniformemente le celle (es. `NUMBER_0`, `NUMBER_2`, `PERCENT`, `DATE`, `DATETIME`).

---

## 4. Operational Patterns (Modus Operandi)

**State Management (Zustand):**
Lo stato dell'intera applicazione è governato da un singolo store creato con Zustand (`useAppStore.js`) e salvato in `localStorage` tramite il middleware `persist`.
Gestisce:
- Tema (`theme: 'light' | 'dark'`) e stato di apertura della Sidebar.
- Autenticazione (`accessToken`, `user`) con funzioni built-in per `login` e `logout`.
- Progetto Attivo (`projects`, `activeProjectId` e `fetchProjects()`).
- Helper Funzionali per l'RBAC contestuale (es. `isAdmin()`, `getHighestRole()`, `getProjectRoleNames()`) che validano i ruoli dell'utente in base all'`activeProjectId`.

**Data Fetching e API (Fetch Interceptor):**
Invece di usare gli interceptor di Axios, Levity sovrascrive globalmente la Fetch API (`window.fetch`) all'avvio dell'applicazione (`App.jsx`).
La logica standard garantisce che:
1. Se c'è un token in Zustand, venga iniettato automaticamente l'header `Authorization: Bearer <token>`.
2. Se esiste un `activeProjectId` e la chiamata punta alle API del backend (es. `/api/v1/`) ma non è una rotta di login (`/auth/`), venga iniettato l'header `X-Project-ID`. Questo è il cuore dell'architettura multi-tenant.

**Struttura delle Cartelle (Frontend):**
L'alberatura in `src` deve seguire rigorosamente questo pattern basato su domain-driven/features:
- `/assets`: File statici.
- `/components`: Componenti cross-feature (es. `/Layout/MainLayout.jsx`, `/Navigation/Sidebar.jsx`).
- `/features`: La cartella più importante, suddivisa per domini di business. In Levity contiene `/Admin`, `/Auth`, `/Developer`, `/Viewer`, `/Workspace`.
- `/hooks`: Custom hooks React (es. `useReportExecution.js` per il polling dello status code asincrone).
- `/routes`: Componenti wrapper per la sicurezza (es. `ProtectedRoutes.jsx` con logiche `RoleRoute`).
- `/store`: File per la gestione dello stato globale (es. `useAppStore.js`).
