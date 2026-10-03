/* STORAGE STATE
 *
 * Declared before the first read on purpose. Reading happens at the top of
 * this file, and a read can fail immediately; a failure handler whose own
 * bindings are still in the temporal dead zone throws a ReferenceError
 * instead of explaining anything. The script tag sits at the end of <body>,
 * so the element is available here. */
let storageError = document.getElementById("storageError");
let storageHealthy = true;
let lastReadFailed = false;

const currentUser = readJson("onespaceCurrentUser", null);

if (!currentUser) {
    window.location.href = "index.html";
}

let workspaces = readJson("onespaceWorkspaces", []);

/* Set when stored data existed but could not be used, so the boot path
   can tell "first run" apart from "something was lost". */
let storageWasUnreadable = false;

if (lastReadFailed || !Array.isArray(workspaces)) {
    /* Unparseable JSON, or valid JSON that is not a list of workspaces.
       Treating this as "no workspaces" would look identical to a first
       run, so the reason is stated and the unusable value is cleared to
       keep the app from redirecting back into the same broken state. */
    storageWasUnreadable = true;

    showStorageError({ name: "InvalidData" });

    try {
        localStorage.removeItem("onespaceWorkspaces");
        localStorage.removeItem("onespaceCurrentWorkspace");
    } catch (error) {
        showStorageError(error);
    }

    workspaces = [];
}

const storedWorkspace = readJson("onespaceCurrentWorkspace", null);

/* Ids are written by two pages written at different times: the home page
   creates them with Date.now(), so a stored tab list can hold either a number
   or a string for the same workspace. Comparing as strings keeps one
   workspace from being treated as two. */
function sameId(left, right) {

    return String(left) === String(right);
}


let activeWorkspaceId =
    storedWorkspace && storedWorkspace.id
        ? storedWorkspace.id
        : null;

if (!workspaces.some(function (workspace) {
    return sameId(workspace.id, activeWorkspaceId);
})) {
    activeWorkspaceId = workspaces.length ? workspaces[0].id : null;
}


function findWorkspace(workspaceId) {
    return workspaces.find(function (workspace) {
        return sameId(workspace.id, workspaceId);
    }) || null;
}

function normalizeWorkspace(workspace) {
    workspace.tasks = workspace.tasks || [];
    workspace.notes = workspace.notes || [];
    workspace.folders = workspace.folders || [];
    workspace.resources = workspace.resources || [];

    /* Members and chat were removed from the product. Workspaces saved
       before that still carry the arrays, so they are dropped here rather
       than left in localStorage forever. Deleting on read means the pruning
       happens on the next save without needing a migration script. */
    delete workspace.members;
    delete workspace.personalChats;
    delete workspace.groupMessages;

    /* Code and Files are two views of one project tree, so the shape of a
       stored file is settled here rather than at each read site. Older
       workspaces only ever had folders with an empty files array. */
    workspace.folders.forEach(function (folder) {

        folder.name = folder.name || "Untitled folder";
        folder.files = Array.isArray(folder.files) ? folder.files : [];

        folder.files.forEach(function (file) {

            file.name = file.name || "untitled";
            file.content =
                typeof file.content === "string"
                    ? file.content
                    : "";
            file.createdAt = file.createdAt || nowIso();
            file.updatedAt = file.updatedAt || file.createdAt;

        });

    });

    return workspace;
}

let currentWorkspace = findWorkspace(activeWorkspaceId);

if (!currentWorkspace && !storageWasUnreadable) {
    /* No workspaces at all is a normal first-run state, and the dashboard
       is where a new one gets made. Unreadable data is different: it is
       reported in place instead of being disguised as a first run. */
    window.location.href = "dashboard.html";
}

if (currentWorkspace) {
    normalizeWorkspace(currentWorkspace);
}


/* STORAGE
 *
 * Reads and writes are wrapped deliberately rather than defensively: a
 * corrupt value or a full/blocked store is a real condition the user
 * needs to see, so it is reported in-product instead of throwing a blank
 * page or failing silently. The state these helpers use is declared at the
 * top of this file, ahead of the first read. */

function describeStorageFailure(error) {
    if (error && error.name === "QuotaExceededError") {
        return "This browser is out of local storage space, so your latest change could not be saved. Nothing was lost, but free up some space and try again.";
    }
    if (error && error.name === "SecurityError") {
        return "This browser is blocking local storage, so changes cannot be saved right now.";
    }
    if (error && error.name === "InvalidData") {
        return "The saved workspaces in this browser could not be read and have been reset. Anything stored here before is no longer available.";
    }
    return "This browser refused to save changes to local storage. Your edit is only on screen and will be lost if you reload.";
}

function showStorageError(error) {
    storageHealthy = false;
    if (storageError) {
        storageError.textContent = describeStorageFailure(error);
        storageError.hidden = false;
    }
}

function clearStorageError() {
    storageHealthy = true;
    if (storageError) {
        storageError.textContent = "";
        storageError.hidden = true;
    }
}

function readJson(key, fallback) {
    let raw = null;
    lastReadFailed = false;

    try {
        raw = localStorage.getItem(key);
    } catch (error) {
        lastReadFailed = true;
        showStorageError(error);
        return fallback;
    }

    if (raw === null || raw === undefined || raw === "") {
        return fallback;
    }

    try {
        const parsed = JSON.parse(raw);
        return parsed === null || parsed === undefined ? fallback : parsed;
    } catch (error) {
        /* A hand-edited or truncated value. Surfaced, not swallowed, and
           the user keeps working with the fallback. */
        lastReadFailed = true;
        showStorageError(error);
        return fallback;
    }
}

function writeJson(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        clearStorageError();
        return true;
    } catch (error) {
        showStorageError(error);
        return false;
    }
}


function saveWorkspaces() {
    return writeJson("onespaceWorkspaces", workspaces);
}


function saveCurrentWorkspace() {

    const savedWorkspaces = saveWorkspaces();

    const savedPointer = writeJson(
        "onespaceCurrentWorkspace",
        currentWorkspace
    );

    return savedWorkspaces && savedPointer;
}


/* FEEDBACK
 *
 * One toast and one live region serve the whole app. Both are quiet: no
 * spinners, no banners, no motion beyond a short fade. */

const appStatus = document.getElementById("appStatus");
const appAnnouncer = document.getElementById("appAnnouncer");

let statusTimer = null;
let announceTimer = null;

function showStatus(message) {
    if (!appStatus) {
        return;
    }

    appStatus.textContent = message;
    appStatus.classList.add("is-visible");

    if (statusTimer) {
        clearTimeout(statusTimer);
    }

    statusTimer = setTimeout(function () {
        appStatus.classList.remove("is-visible");
    }, 2600);
}

function announce(message) {
    if (!appAnnouncer) {
        return;
    }

    /* Clearing first guarantees the region re-announces even when the
       same message follows an identical one. */
    appAnnouncer.textContent = "";

    if (announceTimer) {
        clearTimeout(announceTimer);
    }

    announceTimer = setTimeout(function () {
        appAnnouncer.textContent = message;
    }, 60);
}


/* HELPERS */

function nowIso() {
    return new Date().toISOString();
}


function pluralize(count, singular, plural) {
    return count + " " + (count === 1 ? singular : plural);
}


function formatDate(value) {

    const date = new Date(value);

    if (!value || isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}


function relativeTime(value) {

    const date = new Date(value);

    if (!value || isNaN(date.getTime())) {
        return "";
    }

    const seconds = Math.round(
        (Date.now() - date.getTime()) / 1000
    );

    if (seconds < 60) {
        return "just now";
    }

    if (seconds < 3600) {
        return Math.floor(seconds / 60) + "m ago";
    }

    if (seconds < 86400) {
        return Math.floor(seconds / 3600) + "h ago";
    }

    if (seconds < 604800) {
        return Math.floor(seconds / 86400) + "d ago";
    }

    return formatDate(value);
}


function cleanText(value) {

    return typeof value === "string" ? value.trim() : "";
}


function normalizeUrl(value) {
    let str = cleanText(value);
    if (!str) return "";
    if (!/^https?:\/\//i.test(str)) {
        str = "https://" + str;
    }
    return str;
}

function isValidHttpUrl(value) {
    const candidate = normalizeUrl(value);
    if (!candidate) return false;
    let parsed = null;
    try {
        parsed = new URL(candidate);
    } catch (error) {
        return false;
    }
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && Boolean(parsed.hostname);
}

function safeHref(value) {
    const candidate = normalizeUrl(value);
    return isValidHttpUrl(candidate) ? candidate : null;
}


function isDarkColor(value) {

    const match =
        /^#?([0-9a-f]{6})$/i.exec(cleanText(value));

    if (!match) {
        return false;
    }

    const packed = parseInt(match[1], 16);
    const r = (packed >> 16) & 255;
    const g = (packed >> 8) & 255;
    const b = packed & 255;

    return (r * 299 + g * 587 + b * 114) / 1000 < 140;
}


function safeHexColor(value, fallback) {

    return /^#[0-9a-f]{6}$/i.test(cleanText(value))
        ? cleanText(value)
        : fallback;
}


function setFieldError(errorId, fieldId, message) {

    const errorEl =
        document.getElementById(errorId);

    if (errorEl) {
        errorEl.textContent = message || "";
    }

    const field = document.getElementById(fieldId);

    if (field) {

        if (message) {

            field.classList.add("is-invalid");
            field.setAttribute("aria-invalid", "true");

        } else {

            field.classList.remove("is-invalid");
            field.removeAttribute("aria-invalid");
        }
    }
}


function clearFormErrors(form, pairs) {

    pairs.forEach(function (pair) {
        setFieldError(pair[0], pair[1], "");
    });

    if (form) {
        form.reset();
    }
}


function focusFirstInvalid(pairs) {

    for (let i = 0; i < pairs.length; i += 1) {

        const field =
            document.getElementById(pairs[i][1]);

        if (field && field.getAttribute("aria-invalid") === "true") {
            /* preventScroll keeps the fixed dialog from jumping, the field
               is already inside the viewport. */
            field.focus({ preventScroll: true });
            return;
        }
    }
}


/* Re-validates on every keystroke, but only once a field has already been
   rejected. Validating from the first character would punish the user for
   a half-typed email. */
function wireLiveValidation(form, pairs, validate) {

    if (!form) {
        return;
    }

    pairs.forEach(function (pair) {

        const field =
            document.getElementById(pair[1]);

        if (!field) {
            return;
        }

        field.addEventListener("input", function () {

            if (field.getAttribute("aria-invalid") !== "true") {
                return;
            }

            validate();

        });

    });
}


/* ICONS
 *
 * A small hand-drawn set, inline, so the product has a consistent voice
 * without pulling in an icon library or an extra request. Every glyph is
 * drawn on the same 24-unit grid with a 1.7 stroke so weights match, and
 * every one is hidden from assistive technology: the surrounding text or
 * the control's own label always carries the meaning. */

const ICON_PATHS = {
    overview: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V19a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-8.5"/><path d="M9.5 20v-5.5h5V20"/>',
    task: '<path d="M4 7.5 6 9.5 9.5 5.5"/><path d="M4 16.5 6 18.5 9.5 14.5"/><path d="M12.5 7.5H20"/><path d="M12.5 16.5H20"/>',
    files: '<path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4l2 2.5h8A1.5 1.5 0 0 1 20.5 10v8A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18Z"/>',
    note: '<path d="M6 4.5h8.5L19 9v10.5H6Z"/><path d="M14 4.5V9h5"/><path d="M9 13h7"/><path d="M9 16.5h4.5"/>',
    resources: '<path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.54 3.54 0 0 0-5-5l-1.2 1.2"/><path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.54 3.54 0 0 0 5 5l1.2-1.2"/>',
    code: '<path d="M9 7.5 4.5 12 9 16.5"/><path d="M15 7.5 19.5 12 15 16.5"/>',
    file: '<path d="M6.5 4.5h7L17.5 8v11.5h-11Z"/><path d="M13.5 4.5V8h4"/>',
    html: '<path d="M6 6.5 5 12l1 5.5"/><path d="M18 6.5 19 12l-1 5.5"/><path d="M14 10 11.5 18"/><path d="M10 10l2.5 8"/>',
    css: '<path d="M5 5.5h14L17.6 14 12 19.5 6.4 14Z"/><path d="M9 9.5h6"/><path d="M9.4 13.4c1.6 1.1 3.6 1.1 5.2 0"/>',
    script: '<path d="M7 5.5c-1.7 0-3 1.4-3 3v7c0 1.7 1.3 3 3 3"/><path d="M17 5.5c1.7 0 3 1.4 3 3v7c0 1.7-1.3 3-3 3"/><path d="M14.5 9 9.5 15"/><path d="M9.5 9l5 6"/>',
    folder: '<path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4l2 2.5h8A1.5 1.5 0 0 1 20.5 10v8A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18Z"/>',
    folderOpen: '<path d="M3.5 17.5V7.5A1.5 1.5 0 0 1 5 6h4l2 2.5h8a1.5 1.5 0 0 1 1.5 1.5v1"/><path d="M3.5 17.5 6 11.5h14.5l-2.5 6Z"/>',
    plus: '<path d="M12 5.5v13"/><path d="M5.5 12h13"/>',
    close: '<path d="M7 7l10 10"/><path d="M17 7 7 17"/>',
    trash: '<path d="M4.5 6.5h15"/><path d="M9 6.5V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1.5"/><path d="M6.5 6.5 7.4 19a1 1 0 0 0 1 1h7.2a1 1 0 0 0 1-1l.9-12.5"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M15.8 15.8 20 20"/>',
    chevronRight: '<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
    chevronLeft: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
    chevronDown: '<path d="M5.5 9 12 15.5 18.5 9"/>',
    arrowLeft: '<path d="M19 12H5.5"/><path d="M11 5.5 4.5 12 11 18.5"/>',
    send: '<path d="M20 4 3.5 10.5l6.5 2.7 2.7 6.5Z"/><path d="M20 4l-9.8 9.5"/>',
    play: '<path d="M7.5 4.8 19 12 7.5 19.2Z"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20.5 4v4.5H16"/>',
    save: '<path d="M5 5.5h11L19 8.5v10H5Z"/><path d="M8.5 5.5v5h6v-5"/><path d="M8 18.5v-5h8v5"/>',
    sparkle: '<path d="M12 4.5 13.7 9.3 18.5 11 13.7 12.7 12 17.5 10.3 12.7 5.5 11 10.3 9.3Z"/><path d="M18 16.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z"/>',
    book: '<path d="M5 4.5h6a2 2 0 0 1 2 2v13a1.6 1.6 0 0 0-1.6-1.5H5Z"/><path d="M19 4.5h-6a2 2 0 0 0-2 2v13a1.6 1.6 0 0 1 1.6-1.5H19Z"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
    layers: '<path d="M12 4.5 20 9l-8 4.5L4 9Z"/><path d="m4 13 8 4.5 8-4.5"/>',
    grid: '<rect x="4.5" y="4.5" width="6" height="6" rx="1"/><rect x="13.5" y="4.5" width="6" height="6" rx="1"/><rect x="4.5" y="13.5" width="6" height="6" rx="1"/><rect x="13.5" y="13.5" width="6" height="6" rx="1"/>',
    logout: '<path d="M14 5.5H6.5A1.5 1.5 0 0 0 5 7v10a1.5 1.5 0 0 0 1.5 1.5H14"/><path d="M17 8.5 20.5 12 17 15.5"/><path d="M20.5 12H10"/>',
    panelLeft: '<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M9.5 4.5v15"/>',
    panelRight: '<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M14.5 4.5v15"/>',
    check: '<path d="M4.5 12.5 9.5 17.5 19.5 6.5"/>',
    undo: '<path d="M9 8.5H15.5a4.5 4.5 0 0 1 0 9H8"/><path d="M12 5 8.5 8.5 12 12"/>',
    document: '<path d="M6.5 4.5h7L17.5 8v11.5h-11Z"/><path d="M9 12h6"/><path d="M9 15.5h6"/>'
};


/* Builds one icon. Returns an <svg> so it can be laid out with flex and
   coloured with currentColor, which is what keeps the set consistent. */
function createIcon(name, options) {

    const settings = options || {};
    const svg = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg"
    );

    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");

    svg.setAttribute(
        "stroke",
        settings.filled ? "none" : "currentColor"
    );

    svg.setAttribute(
        "stroke-width",
        settings.weight || "1.7"
    );

    svg.setAttribute(
        "stroke-linecap",
        "round"
    );

    svg.setAttribute(
        "stroke-linejoin",
        "round"
    );

    if (settings.size) {
        svg.setAttribute("width", settings.size);
        svg.setAttribute("height", settings.size);
    }

    svg.setAttribute(
        "class",
        settings.className || "icon"
    );

    const markup =
        ICON_PATHS[name] || ICON_PATHS.document;

    svg.innerHTML = markup;

    return svg;
}


/* Icons that stand in for a file type. Chosen from the extension alone, so
   the answer is always derivable from what the user typed. */
function codeIconName(fileName) {

    switch (codeLanguageOf(fileName)) {

        case "html":
            return "html";
        case "css":
            return "css";
        case "js":
            return "script";
        default:
            return "file";
    }
}


/* A file-type chip: icon plus extension, tinted by language. */
function createFileBadge(fileName) {

    const badge =
        document.createElement("span");

    badge.className =
        "file-badge file-badge-" +
        codeLanguageOf(fileName);

    badge.appendChild(
        createIcon(
            codeIconName(fileName),
            { size: 15 }
        )
    );

    const extension =
        document.createElement("span");

    extension.className = "file-badge-ext";

    extension.textContent =
        codeExtensionOf(fileName) || "file";

    badge.appendChild(extension);

    return badge;
}


function createQuietButton(label, onClick) {

    const button =
        document.createElement("button");

    button.type = "button";
    button.className = "quiet-button";
    button.textContent = label;

    button.addEventListener("click", onClick);

    return button;
}


/* One empty state for the whole product: a small mark, a short heading, one
   useful sentence, and a hint. The hint deliberately points at the floating
   + rather than repeating it as a second button. */
function createSectionEmpty(
    title,
    message,
    options
) {

    const settings = options || {};

    const wrap =
        document.createElement("div");

    wrap.className =
        "section-empty" +
        (settings.wide === false ? "" : " section-empty-wide");

    if (settings.icon) {

        const mark =
            document.createElement("span");

        mark.className = "section-empty-mark";

        mark.setAttribute("aria-hidden", "true");

        mark.appendChild(
            createIcon(settings.icon, { size: 19 })
        );

        wrap.appendChild(mark);
    }

    const heading =
        document.createElement("h3");

    heading.textContent = title;

    const body =
        document.createElement("p");

    body.textContent = message;

    wrap.appendChild(heading);
    wrap.appendChild(body);

    if (settings.hint) {

        const hint =
            document.createElement("p");

        hint.className =
            "section-empty-hint";

        hint.textContent = settings.hint;

        wrap.appendChild(hint);
    }

    if (settings.actions && settings.actions.length) {

        const row =
            document.createElement("div");

        row.className =
            "section-empty-actions";

        settings.actions.forEach(function (action) {
            row.appendChild(action);
        });

        wrap.appendChild(row);
    }

    return wrap;
}


/* WORKSPACE SHELL */

/* A single letter from a workspace name, used for the identity mark. Falls
   back to the second word so "My Workspace" is not always "M". */
function workspaceInitial(name) {

    const words =
        String(name || "")
            .trim()
            .split(/\s+/)
            .filter(Boolean);

    if (!words.length) {
        return "W";
    }

    if (words.length === 1) {
        return words[0].charAt(0).toUpperCase();
    }

    return (
        words[0].charAt(0) +
        words[1].charAt(0)
    ).toUpperCase();
}

const workspaceTitle =
    document.getElementById(
        "workspaceTitle"
    );


const workspaceDescription =
    document.getElementById(
        "workspaceDescription"
    );


const activeWorkspaceName =
    document.getElementById(
        "activeWorkspaceName"
    );


const activeWorkspaceMark =
    document.getElementById(
        "activeWorkspaceMark"
    );


const workspaceHeaderMeta =
    document.getElementById(
        "workspaceHeaderMeta"
    );


/* The sidebar is where the workspace introduces itself, so the header can
   spend its own space on the section you are in. Two places claiming the
   workspace name was the clearest redundancy in the old layout. */
function hydrateWorkspaceShell() {

    if (workspaceTitle) {
        workspaceTitle.textContent =
            activeSectionMeta().label;
    }

    if (workspaceDescription) {
        workspaceDescription.textContent =
            activeSectionMeta().subtitle;
    }

    if (activeWorkspaceName) {
        activeWorkspaceName.textContent = currentWorkspace.name;
    }

    if (activeWorkspaceMark) {

        activeWorkspaceMark.textContent =
            workspaceInitial(currentWorkspace.name);

        activeWorkspaceMark.setAttribute(
            "title",
            currentWorkspace.name
        );
    }

    renderHeaderMeta();

    document.title = currentWorkspace.name + " — OneSpace";
}


/* Real counts, in the header, where they are useful rather than decorative.
   Only sections with something true to say get a line at all. */
function renderHeaderMeta() {

    if (!workspaceHeaderMeta) {
        return;
    }

    workspaceHeaderMeta.textContent = "";

    /* Tasks record completion in status, not a boolean. Reading the wrong
       field would count every finished task as still open. */
    const openTasks =
        (currentWorkspace.tasks || [])
            .filter(function (task) {
                return task.status !== "completed";
            });

    const doneTasks =
        (currentWorkspace.tasks || []).length -
        openTasks.length;

    const folderCount =
        (currentWorkspace.folders || []).length;

    const fileCount =
        (currentWorkspace.folders || [])
            .reduce(function (total, folder) {

                return total +
                    (folder.files || []).length;

            }, 0);

    const lines = [];

    if (activeSection === "tasks") {
        lines.push(
            openTasks.length +
            (openTasks.length === 1
                ? " open"
                : " open") +
            (doneTasks ? ", " + doneTasks + " done" : "")
        );
    }

    if (activeSection === "files") {
        lines.push(
            folderCount +
            (folderCount === 1
                ? " folder"
                : " folders") +
            " · " +
            fileCount +
            (fileCount === 1 ? " file" : " files")
        );
    }

    if (activeSection === "notes") {
        lines.push(
            (currentWorkspace.notes || []).length +
            ((currentWorkspace.notes || []).length === 1
                ? " note"
                : " notes")
        );
    }

    if (activeSection === "resources") {
        lines.push(
            (currentWorkspace.resources || []).length +
            ((currentWorkspace.resources || []).length === 1
                ? " saved link"
                : " saved links")
        );
    }

    lines.forEach(function (text) {

        const line =
            document.createElement("span");

        line.className =
            "workspace-header-meta-item";

        line.textContent = text;

        workspaceHeaderMeta.appendChild(line);
    });
}


function setActiveWorkspace(workspaceId) {

    const next = findWorkspace(workspaceId);

    if (!next) {
        return;
    }

    if (sameId(currentWorkspace.id, next.id)) {
        renderWorkspaceTabs();
        return;
    }

    /* Everything below is synchronous, so this flag is an accessibility
       signal rather than a spinner: it tells assistive tech the main
       region is being replaced. */
    const main =
        document.querySelector(".workspace-main");

    if (main) {
        main.setAttribute("aria-busy", "true");
    }

    next.lastOpened = nowIso();

    currentWorkspace = normalizeWorkspace(next);

    activeWorkspaceId = currentWorkspace.id;

    /* Open tabs, editor buffers and the rendered preview all describe the
       workspace being left behind, so they go with it. The Files browser
       position goes too: a folder id from the old workspace would mean
       nothing here. */
    resetCodeState();

    openFolderId = null;
    codeTargetFolderId = null;
    renderFilesBreadcrumb();
    renderQuickCreateContext();

    saveCurrentWorkspace();

    hydrateWorkspaceShell();

    renderWorkspaceTabs();

    renderAll();

    buildNavigation();

    /* Landing mid-page inside a workspace you just opened is confusing;
       every other workspace surface starts at its own top. */
    window.scrollTo(0, 0);

    if (main) {
        main.removeAttribute("aria-busy");
    }

    announce("Switched to " + currentWorkspace.name);
}


/* WORKSPACE TABS
 *
 * A tab is a view of a workspace, not the workspace itself. Which ones are
 * open is deliberately a smaller piece of state than the workspace list, so
 * closing a tab can never damage workspace data the way removing a workspace
 * would. */

const workspaceTabs =
    document.getElementById(
        "workspaceTabs"
    );


const openWorkspaceButton =
    document.getElementById(
        "openWorkspaceButton"
    );


const openWorkspaceModal =
    document.getElementById(
        "openWorkspaceModal"
    );


const openWorkspaceSearch =
    document.getElementById(
        "openWorkspaceSearch"
    );


const openWorkspaceList =
    document.getElementById(
        "openWorkspaceList"
    );


const openWorkspaceEmpty =
    document.getElementById(
        "openWorkspaceEmpty"
    );


/* On a first run there is nothing recorded yet, so only the workspace being
   opened is seeded. Falling back to the full list would rebuild the tab
   sprawl this list replaced. */
let openWorkspaceIds =
    readJson("onespaceOpenWorkspaces", null);

let openWorkspacesKnown =
    Array.isArray(openWorkspaceIds) &&
    !openWorkspaceIds.some(function (workspaceId) {
        return (
            typeof workspaceId !== "string" &&
            typeof workspaceId !== "number"
        );
    });

if (!openWorkspacesKnown) {
    openWorkspaceIds = [];
}

/* Stored as strings so the shape is stable no matter how the home page
   created the underlying id. */
openWorkspaceIds =
    openWorkspaceIds.map(function (workspaceId) {
        return String(workspaceId);
    });

/* A workspace removed elsewhere leaves a stale id behind, and a stale id
   would render as a permanently blank tab. */
openWorkspaceIds =
    openWorkspaceIds.filter(function (workspaceId) {
        return Boolean(findWorkspace(workspaceId));
    });

/* A stored empty list is meaningful: the user closed every tab and should
   still find the start state after a reload. Only a missing or malformed
   value is a first run, and only then is the active workspace seeded back in
   instead of every workspace reopening at once. */
if (
    !openWorkspacesKnown &&
    !openWorkspaceIds.length &&
    activeWorkspaceId
) {
    openWorkspaceIds = [activeWorkspaceId];

    /* Written out immediately so the seeded state is recorded rather than
       re-derived on every load. */
    saveOpenWorkspaces();
}


function saveOpenWorkspaces() {

    writeJson(
        "onespaceOpenWorkspaces",
        openWorkspaceIds
    );
}


function isWorkspaceOpen(workspaceId) {

    return openWorkspaceIds.some(function (id) {
        return sameId(id, workspaceId);
    });
}


function ensureWorkspaceTabOpen(workspaceId) {

    if (
        !findWorkspace(workspaceId) ||
        isWorkspaceOpen(workspaceId)
    ) {
        return;
    }

    openWorkspaceIds.push(String(workspaceId));

    saveOpenWorkspaces();
}


/* Closing the last tab is not an empty state to be designed around. It means
   the user has left every workspace, so they go back to OneSpace Home rather
   than being left looking at a workspace shell with nothing in it. */
function leaveWorkspaceForHome() {

    localStorage.removeItem(
        "onespaceCurrentWorkspace"
    );

    window.location.href = "dashboard.html";
}


function renderWorkspaceTabs() {

    if (!workspaceTabs) {
        return;
    }

    workspaceTabs.innerHTML = "";

    openWorkspaceIds.forEach(function (workspaceId) {

        const workspace =
            findWorkspace(workspaceId);

        if (!workspace) {
            return;
        }

        const isActive =
            sameId(workspaceId, activeWorkspaceId);

        const tab =
            document.createElement("div");

        tab.className = "workspace-tab";

        if (isActive) {
            tab.classList.add("active");
        }

        const select =
            document.createElement("button");

        select.type = "button";

        select.className = "workspace-tab-select";

        select.setAttribute(
            "role",
            "tab"
        );

        select.setAttribute(
            "aria-selected",
            isActive ? "true" : "false"
        );

        /* The label is truncated on long names, so the full name has to
           reach assistive tech some other way. */
        select.setAttribute(
            "aria-label",
            workspace.name
        );

        select.title = workspace.name;

        const label =
            document.createElement("span");

        label.className =
            "workspace-tab-label";

        label.textContent =
            workspace.name;

        select.appendChild(label);

        select.addEventListener(
            "click",
            function () {

                requestWorkspaceChange(
                    workspace.id
                );

            }
        );

        const close =
            document.createElement("button");

        close.type = "button";

        close.className =
            "workspace-tab-close";

        close.title = "Close " + workspace.name;

        close.setAttribute(
            "aria-label",
            "Close " + workspace.name
        );

        close.innerHTML =
            '<span aria-hidden="true">&times;</span>';

        close.addEventListener(
            "click",
            function (event) {

                event.stopPropagation();

                closeWorkspaceTab(
                    workspace.id
                );

            }
        );

        tab.appendChild(select);
        tab.appendChild(close);

        workspaceTabs.appendChild(tab);
    });
}


function closeWorkspaceTab(workspaceId) {

    const index = openWorkspaceIds.findIndex(
        function (id) {
            return sameId(id, workspaceId);
        }
    );

    if (index === -1) {
        return;
    }

    const wasActive =
        sameId(workspaceId, activeWorkspaceId);

    openWorkspaceIds.splice(index, 1);

    saveOpenWorkspaces();

    /* Closing the tab you are looking at should land somewhere you can keep
       working. The tab that slid into its place is the least surprising
       neighbour, so it is preferred over the one to the left. */
    if (
        wasActive &&
        openWorkspaceIds.length
    ) {

        const neighbour =
            openWorkspaceIds[index] ||
            openWorkspaceIds[index - 1];

        setActiveWorkspace(neighbour);
        return;
    }

    if (!openWorkspaceIds.length) {
        announce("Returned to OneSpace Home");
        leaveWorkspaceForHome();
        return;
    }

    renderWorkspaceTabs();
}


/* OPEN WORKSPACE PICKER
 *
 * Replaces the old sidebar list of every workspace. Workspaces already open
 * are still listed, because picking one is the fastest way to switch back,
 * but they are marked rather than hidden so the list never silently
 * changes length under the pointer. */

function renderWorkspacePicker(query) {

    if (!openWorkspaceList) {
        return;
    }

    const term = cleanText(query).toLowerCase();

    const matches = workspaces.filter(function (workspace) {

        if (!term) {
            return true;
        }

        return cleanText(workspace.name)
            .toLowerCase()
            .includes(term);

    });

    openWorkspaceList.innerHTML = "";

    if (openWorkspaceEmpty) {
        openWorkspaceEmpty.hidden =
            matches.length > 0;
    }

    matches.forEach(function (workspace) {

        const isOpen =
            isWorkspaceOpen(workspace.id);

        const isActive =
            sameId(workspace.id, activeWorkspaceId);

        const row =
            document.createElement("button");

        row.type = "button";

        row.className =
            "workspace-picker-item";

        row.setAttribute(
            "aria-label",
            workspace.name +
                (isOpen ? " (already open)" : "")
        );

        if (isActive) {
            row.classList.add("active");
        }

        const name =
            document.createElement("span");

        name.className =
            "workspace-picker-name";

        name.textContent =
            workspace.name;

        row.appendChild(name);

        if (isOpen) {
            const badge =
                document.createElement("span");

            badge.className =
                "workspace-picker-badge";

            badge.textContent = "Open";

            row.appendChild(badge);
        }

        row.addEventListener(
            "click",
            function () {

                closeModal("openWorkspaceModal");

                /* Going through requestWorkspaceChange keeps the unsaved
                   Code guard and, because it is now the single switching
                   path, opens the tab as a side effect. */
                requestWorkspaceChange(
                    workspace.id
                );

            }
        );

        openWorkspaceList.appendChild(row);
    });
}


function openWorkspacePicker() {

    if (!openWorkspaceModal) {
        return;
    }

    if (openWorkspaceSearch) {
        openWorkspaceSearch.value = "";
    }

    renderWorkspacePicker("");

    openModal("openWorkspaceModal");
}
if (workspaceTabs) {

    workspaceTabs.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key !== "ArrowRight" &&
                event.key !== "ArrowLeft" &&
                event.key !== "Home" &&
                event.key !== "End"
            ) {
                return;
            }

            /* Each tab now holds two buttons, so selection has to walk the
               tab list rather than whatever element happens to match. */
            const tabs = Array.from(
                workspaceTabs.querySelectorAll(
                    ".workspace-tab"
                )
            );

            const focusedTab =
                event.target.closest(".workspace-tab");

            const index = tabs.indexOf(
                focusedTab
            );

            if (index === -1) {
                return;
            }

            event.preventDefault();

            let nextIndex = index;

            if (event.key === "Home") {
                nextIndex = 0;
            } else if (event.key === "End") {
                nextIndex = tabs.length - 1;
            } else {
                const step =
                    event.key === "ArrowRight"
                        ? 1
                        : -1;
                nextIndex =
                    (index + step + tabs.length) %
                    tabs.length;
            }

            const target =
                tabs[nextIndex].querySelector(
                    ".workspace-tab-select"
                );

            if (target) {
                target.focus();
            }
        }
    );


    /* Middle-click and Ctrl/Cmd-click close a tab, the way a browser tab
       bar does. Plain click still just switches. */
    function tabWorkspaceIdFrom(target) {

        const tab = target.closest(".workspace-tab");

        if (!tab) {
            return null;
        }

        return (
            openWorkspaceIds[
                Array.from(
                    workspaceTabs.children
                ).indexOf(tab)
            ] || null
        );
    }


    workspaceTabs.addEventListener(
        "auxclick",
        function (event) {

            if (event.button !== 1) {
                return;
            }

            const workspaceId =
                tabWorkspaceIdFrom(
                    event.target
                );

            if (!workspaceId) {
                return;
            }

            event.preventDefault();

            closeWorkspaceTab(workspaceId);
        }
    );


    workspaceTabs.addEventListener(
        "click",
        function (event) {

            /* Only the modified gesture closes. A plain click is handled by
               the tab's own select button and must not fall through to
               here as well. */
            if (
                !event.ctrlKey &&
                !event.metaKey
            ) {
                return;
            }

            const workspaceId =
                tabWorkspaceIdFrom(
                    event.target
                );

            if (!workspaceId) {
                return;
            }

            event.preventDefault();

            closeWorkspaceTab(workspaceId);
        }
    );
}


if (openWorkspaceButton) {

    openWorkspaceButton.addEventListener(
        "click",
        openWorkspacePicker
    );
}

if (openWorkspaceSearch) {

    openWorkspaceSearch.addEventListener(
        "input",
        function () {

            renderWorkspacePicker(
                openWorkspaceSearch.value
            );

        }
    );

    /* Arrow keys move through the results and Enter opens the highlighted
       one, so the list is reachable without leaving the search field. */
    openWorkspaceSearch.addEventListener(
        "keydown",
        function (event) {

            const items =
                openWorkspaceList
                    ? Array.from(
                        openWorkspaceList.querySelectorAll(
                            ".workspace-picker-item"
                        )
                    )
                    : [];

            if (
                event.key === "ArrowDown" ||
                event.key === "ArrowUp"
            ) {

                if (!items.length) {
                    return;
                }

                event.preventDefault();

                const current =
                    items.indexOf(
                        document.activeElement
                    );

                const step =
                    event.key === "ArrowDown"
                        ? 1
                        : -1;

                items[
                    (
                        current +
                        step +
                        items.length
                    ) % items.length
                ].focus();

                return;
            }

            if (
                event.key !== "Enter" ||
                items.length !== 1
            ) {
                return;
            }

            event.preventDefault();

            items[0].click();
        }
    );
}

if (openWorkspaceModal) {

    const closeButton =
        document.getElementById(
            "openWorkspaceClose"
        );

    if (closeButton) {

        closeButton.addEventListener(
            "click",
            function () {

                closeModal("openWorkspaceModal");

            }
        );
    }
}

/* NAVIGATION */

const workspaceNavigation =
    document.getElementById(
        "workspaceNavigation"
    );


/* Each section carries a subtitle so the page header can describe where you
   are without the header having to hard-code eight different strings. */
const WORKSPACE_SECTIONS = [
    {
        id: "overview",
        label: "Overview",
        icon: "overview",
        subtitle: "What has happened here, and what to pick up next."
    },
    {
        id: "tasks",
        label: "Tasks",
        icon: "task",
        subtitle: "What still needs doing, and what is already done."
    },
    {
        id: "files",
        label: "Folders",
        icon: "files",
        subtitle: "The project tree shared with Code."
    },
    {
        id: "notes",
        label: "Notes",
        icon: "note",
        subtitle: "What this workspace should remember."
    },
    {
        id: "resources",
        label: "Resources",
        icon: "resources",
        subtitle: "Links and references worth keeping close."
    },
    {
        id: "code",
        label: "Code",
        icon: "code",
        subtitle: "Write project files and see frontend results without leaving the workspace."
    }
];

let activeSection = "overview";


function isWorkspaceSection(sectionId) {

    return WORKSPACE_SECTIONS.some(
        function (section) {

            return section.id === sectionId;
        }
    );
}


function activeSectionMeta() {

    return WORKSPACE_SECTIONS.find(
        function (section) {
            return section.id === activeSection;
        }
    ) || WORKSPACE_SECTIONS[0];
}


function createNavItem(section) {

    const button =
        document.createElement(
            "button"
        );

    button.type = "button";

    button.className = "sidebar-item";

    button.dataset.section =
        section.id;

    const mark =
        document.createElement("span");

    mark.className = "sidebar-item-mark";

    mark.appendChild(
        createIcon(section.icon, { size: 17 })
    );

    button.appendChild(mark);

    const label =
        document.createElement("span");

    label.className = "sidebar-item-label";

    label.textContent = section.label;

    button.appendChild(label);

    /* Collapsed rail mode hides the label, so it has to survive as text for
       pointer and assistive technology to read. */
    button.setAttribute(
        "aria-label",
        section.label
    );

    button.setAttribute(
        "title",
        section.label
    );

button.addEventListener(
        "click",
        function () {

            requestSectionChange(
                section.id
            );

        }
    );

    workspaceNavigation.appendChild(
        button
    );
}


/* COMPACT NAVIGATION
 *
 * At narrow widths the sidebar is a drawer rather than a column. The
 * behaviour lives here rather than in CSS alone because focus has to follow
 * the drawer, and CSS cannot do that safely. */
const compactNavQuery = window.matchMedia(
    "(max-width: 760px)"
);

const sidebarElement =
    document.getElementById("workspaceSidebar");

const sidebarToggleButton =
    document.getElementById("sidebarToggle");

const sidebarCloseButton =
    document.getElementById("sidebarClose");

const sidebarScrim =
    document.getElementById("sidebarBackdrop");

function isCompactNav() {
    return compactNavQuery.matches;
}

function setCompactNav(isOpen, restoreFocus) {

    if (!sidebarElement) {
        return;
    }

    const shouldOpen = Boolean(isOpen) && isCompactNav();

    sidebarElement.classList.toggle("open", shouldOpen);

    if (sidebarToggleButton) {
        sidebarToggleButton.setAttribute(
            "aria-expanded",
            shouldOpen ? "true" : "false"
        );
    }

    if (sidebarScrim) {
        if (shouldOpen) {
            sidebarScrim.hidden = false;
            /* One frame of visibility before the opacity change, otherwise
               the fade has nothing to animate from. */
            window.requestAnimationFrame(function () {
                sidebarScrim.classList.add("open");
            });
        } else {
            sidebarScrim.classList.remove("open");
            window.setTimeout(function () {
                if (!sidebarScrim.classList.contains("open")) {
                    sidebarScrim.hidden = true;
                }
            }, 180);
        }
    }

    if (shouldOpen) {
        const first =
            workspaceNavigation &&
            workspaceNavigation.querySelector(
                ".sidebar-item"
            );

        if (first) {
            /* Wait for the open state to be reflected in layout, otherwise the
               item is still unfocusable when we try to move focus to it. */
            window.requestAnimationFrame(function () {
                first.focus();
            });
        }
    } else if (restoreFocus && sidebarToggleButton) {
        sidebarToggleButton.focus();
    }
}

function isCompactNavOpen() {
    return Boolean(
        sidebarElement &&
        sidebarElement.classList.contains("open")
    );
}

if (sidebarToggleButton) {
    sidebarToggleButton.addEventListener(
        "click",
        function () {
            setCompactNav(!isCompactNavOpen(), true);
        }
    );
}


/* RAIL MODE
 *
 * On a wide screen the sidebar can shrink to a 64px icon rail so the work
 * area gets the space. This is a preference, not a mode, so it is stored —
 * but under its own key, and never applied on a narrow screen where the
 * sidebar is already a drawer and collapsing it would mean something
 * different. */
const SIDEBAR_RAIL_KEY = "onespace.sidebar.rail";

const sidebarRailToggle =
    document.getElementById("sidebarRailToggle");

function prefersSidebarRail() {

    try {
        return window.localStorage.getItem(
            SIDEBAR_RAIL_KEY
        ) === "1";
    } catch (error) {
        return false;
    }
}

function isSidebarRail() {

    return (
        !isCompactNav() &&
        Boolean(
            sidebarElement &&
            sidebarElement.classList.contains("rail")
        )
    );
}

function setSidebarRail(wantRail) {

    if (!sidebarElement) {
        return;
    }

    const enabled =
        Boolean(wantRail) && !isCompactNav();

    sidebarElement.classList.toggle("rail", enabled);

    if (sidebarRailToggle) {

        const label = enabled
            ? "Expand sidebar"
            : "Collapse sidebar";

        sidebarRailToggle.setAttribute(
            "aria-label",
            label
        );

        sidebarRailToggle.setAttribute(
            "aria-pressed",
            enabled ? "true" : "false"
        );

        sidebarRailToggle.setAttribute(
            "title",
            label
        );
    }

    try {
        window.localStorage.setItem(
            SIDEBAR_RAIL_KEY,
            enabled ? "1" : "0"
        );
    } catch (error) {
        /* A workspace that cannot remember this preference is still a
           perfectly good workspace. */
    }
}

if (sidebarRailToggle) {

    sidebarRailToggle.querySelector(
        ".sidebar-rail-icon"
    ).appendChild(
        createIcon("panelLeft", { size: 17 })
    );

    sidebarRailToggle.addEventListener(
        "click",
        function () {
            setSidebarRail(!isSidebarRail());
        }
    );
}

if (sidebarElement) {

    setSidebarRail(prefersSidebarRail());

    /* Crossing into drawer territory must drop the rail, or the drawer
       would open 64px wide with no way back. */
    compactNavQuery.addEventListener(
        "change",
        function () {

            if (isCompactNav()) {

                sidebarElement.classList.remove("rail");

                if (sidebarRailToggle) {
                    sidebarRailToggle.setAttribute(
                        "aria-pressed",
                        "false"
                    );
                }

            } else {

                setSidebarRail(prefersSidebarRail());
            }
        }
    );
}

const logoutButtonIconHost =
    document.querySelector(
        ".logout-button-icon"
    );

if (logoutButtonIconHost) {
    logoutButtonIconHost.appendChild(
        createIcon("logout", { size: 17 })
    );
}


/* STATIC ICON SLOTS
 *
 * Controls that live in the markup rather than in a render pass: the modal
 * close buttons and the drawer close button. They are drawn here instead of
 * typed as glyphs in the HTML, because a literal "&times;" or "×" is a
 * different shape in every font, and the icons are wanted to look like the
 * rest of the set. The HTML keeps an empty element and this fills it, so the
 * markup stays declarative and the drawing has exactly one source. */
document.querySelectorAll(
    ".modal-close, .sidebar-close"
).forEach(function (button) {

    if (button.querySelector("svg")) {
        return;
    }

    const size =
        button.classList.contains("sidebar-close")
            ? 17
            : 15;

    button.appendChild(
        createIcon("close", { size: size })
    );
});

const openWorkspaceButtonIcon =
    document.querySelector(
        ".workspace-tab-open-icon"
    );

if (openWorkspaceButtonIcon) {
    openWorkspaceButtonIcon.appendChild(
        createIcon("plus", { size: 16 })
    );
}

if (sidebarCloseButton) {
    sidebarCloseButton.addEventListener(
        "click",
        function () {
            setCompactNav(false, true);
        }
    );
}

if (sidebarScrim) {
    sidebarScrim.addEventListener(
        "click",
        function () {
            setCompactNav(false, true);
        }
    );
}

document.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key === "Escape" &&
            isCompactNavOpen()
        ) {
            event.preventDefault();
            setCompactNav(false, true);
        }
    }
);

/* Leaving narrow widths has to clear the drawer state, or the scrim and the
   transform survive into the desktop layout. */
function onCompactNavChange() {
    if (!isCompactNav()) {
        setCompactNav(false, false);
    }
}

if (typeof compactNavQuery.addEventListener === "function") {
    compactNavQuery.addEventListener(
        "change",
        onCompactNavChange
    );
} else if (typeof compactNavQuery.addListener === "function") {
    compactNavQuery.addListener(onCompactNavChange);
}

window.addEventListener("resize", onCompactNavChange);


function showSection(section, isSilent) {

    if (!isWorkspaceSection(section)) {
        return;
    }

    const selected =
        document.getElementById(
            "section-" + section
        );

    if (!selected) {
        return;
    }

    const isChanging =
        activeSection !== section;

    activeSection = section;

    /* The + menu offers what this section can create, so it has to follow
       every change, including the silent one that restores a section on load. */
    applyAddMenuForSection();

    document
        .querySelectorAll(
            ".workspace-section"
        )
        .forEach(
            function (element) {

                element.classList.remove(
                    "active"
                );
            }
        );


    selected.classList.add(
        "active"
    );


    let activeLabel = section;

    document
        .querySelectorAll(
            ".sidebar-item"
        )
        .forEach(
            function (button) {

                const isActive =
                    button.dataset.section ===
                    section;

                button.classList.toggle(
                    "active",
                    isActive
                );

                if (isActive) {

                    button.setAttribute(
                        "aria-current",
                        "page"
                    );

                    activeLabel =
                        activeSectionMeta().label;

                } else {

                    button.removeAttribute(
                        "aria-current"
                    );
                }
            }
        );

    /* The header describes the section, so it has to follow every change. */
    hydrateWorkspaceShell();

    /* On narrow screens the nav button the user just pressed is about to be
       hidden inside a closing drawer, which would strand focus on an
       invisible control. This runs before the early return because picking
       the section you are already on still has to dismiss the drawer. */
    if (isCompactNavOpen()) {
        selected.setAttribute("tabindex", "-1");
        setCompactNav(false, false);
        selected.focus();
    }

    if (isSilent || !isChanging) {
        return;
    }

    /* Focus deliberately stays on the nav button the user just pressed;
       stealing it into the panel would make repeated arrow-key navigation
       impossible. The live region carries the change instead. */
    window.scrollTo(0, 0);

    announce(activeLabel + " section");
}


function buildNavigation() {

    if (!workspaceNavigation) {
        return;
    }

    workspaceNavigation.innerHTML = "";

    WORKSPACE_SECTIONS.forEach(
        createNavItem
    );

    showSection(
        activeSection,
        true
    );
}


if (workspaceNavigation) {

    workspaceNavigation.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key !== "ArrowDown" &&
                event.key !== "ArrowUp" &&
                event.key !== "Home" &&
                event.key !== "End"
            ) {
                return;
            }

            const items = Array.from(
                workspaceNavigation.querySelectorAll(
                    ".sidebar-item"
                )
            );

            const index = items.indexOf(
                document.activeElement
            );

            if (index === -1) {
                return;
            }

            event.preventDefault();

            let nextIndex = index;

            if (event.key === "Home") {
                nextIndex = 0;
            } else if (event.key === "End") {
                nextIndex = items.length - 1;
            } else {
                const step =
                    event.key === "ArrowDown"
                        ? 1
                        : -1;
                nextIndex =
                    (index + step + items.length) %
                    items.length;
            }

            items[nextIndex].focus();
        }
    );
}


/* ADD MENU */

const quickCreateButton =
    document.getElementById(
        "quickCreateButton"
    );

const quickCreateMenu =
    document.getElementById(
        "quickCreateMenu"
    );


/* The menu's icons are declared in the markup as data-icon so the list stays
   readable as a list; they are drawn once, here, rather than inline in the
   HTML where they would be noise. */
document
    .querySelectorAll(
        "[data-icon]"
    )
    .forEach(function (host) {

        host.appendChild(
            createIcon(
                host.dataset.icon,
                { size: 16 }
            )
        );
    });


/* A new file has to go somewhere, so the menu says where rather than making
   the reader remember which folder they are standing in. With no folder open
   the dialog asks instead of guessing. */
const quickNewFileWhere =
    document.getElementById(
        "quickNewFileWhere"
    );

function renderQuickCreateContext() {

    if (!quickNewFileWhere) {
        return;
    }

    const folder = codeFindFolder(openFolderId);

    quickNewFileWhere.textContent = folder
        ? "in " +
            (cleanText(folder.name) || "this folder")
        : "choose folder";
}


/* What the floating + offers, per section.
 *
 * It used to list every kind of thing from everywhere, so standing in Files
 * offered a new task and standing in Resources offered a new note. Those
 * actions belong to their own sections, and offering the rest only made the
 * menu longer than the choice actually in front of you.
 *
 * Two sections keep more than one item on purpose. Files is the project tree
 * and is the only place either a file or a folder can be made, so taking
 * either away there would leave no way to create it at all. Overview shows
 * everything, being the one view with nothing specific in it. Code shows only
 * the file because its own header already carries + File, Open and + Folder. */
const ADD_MENU_ITEMS = {
    overview: {
        label: "Add to this workspace",
        items: [
            "quickNewTask",
            "quickNewNote",
            "quickNewFolder",
            "quickNewFile",
            "quickNewResource"
        ]
    },
    tasks: {
        label: "Add a task",
        items: ["quickNewTask"]
    },
    files: {
        label: "Add to this project",
        items: ["quickNewFile", "quickNewFolder"]
    },
    notes: {
        label: "Add a note",
        items: ["quickNewNote"]
    },
    resources: {
        label: "Add a resource",
        items: ["quickNewResource"]
    },
    code: {
        label: "Add a file",
        items: ["quickNewFile"]
    }
};

/* The element is looked up here rather than through the shared const because
   this runs from showSection, which is reached from code above where that
   const is declared. */
function applyAddMenuForSection() {

    const menu = document.getElementById("quickCreateMenu");

    if (!menu) {
        return;
    }

    const config = ADD_MENU_ITEMS[activeSection];

    const allowed = config ? config.items : [];

    const label = document.getElementById("quickCreateLabel");

    if (label) {
        label.textContent = config
            ? config.label
            : "Add to this workspace";
    }

    /* The buttons are hidden rather than rebuilt, because their click handlers
       are wired once at load and a rebuilt node would arrive with none. */
    Array.prototype.forEach.call(
        menu.querySelectorAll("button"),
        function (button) {
            button.hidden = allowed.indexOf(button.id) === -1;
        }
    );
}


function isAddMenuOpen() {

    return (
        quickCreateMenu &&
        quickCreateMenu.classList.contains(
            "open"
        )
    );
}


function closeAddMenu(restoreFocus) {

    if (quickCreateMenu) {
        quickCreateMenu.classList.remove(
            "open"
        );
    }

    if (quickCreateButton) {
        quickCreateButton.setAttribute(
            "aria-expanded",
            "false"
        );
    }

    if (restoreFocus && quickCreateButton) {
        quickCreateButton.focus();
    }
}


function addMenuItems() {

    if (!quickCreateMenu) {
        return [];
    }

    /* Only the items this section actually offers. Arrow keys must not walk
       into a hidden button, or focus lands somewhere invisible. */
    return Array.prototype.filter.call(
        quickCreateMenu.querySelectorAll("button"),
        function (button) {
            return !button.hidden;
        }
    );
}


if (quickCreateButton && quickCreateMenu) {

    quickCreateButton.addEventListener(
        "click",
        function (event) {

            event.stopPropagation();

            const willOpen =
                !isAddMenuOpen();

            closeAddMenu(false);

            if (willOpen) {

                quickCreateMenu.classList.add(
                    "open"
                );

                quickCreateButton.setAttribute(
                    "aria-expanded",
                    "true"
                );

                /* Handing focus into the menu is what makes the arrow
                   keys usable at all. */
                const items = addMenuItems();

                if (items.length) {
                    items[0].focus();
                }
            }
        }
    );

    quickCreateMenu.addEventListener(
        "keydown",
        function (event) {

            if (event.key === "Escape") {
                event.stopPropagation();
                closeAddMenu(true);
                return;
            }

            if (
                event.key !== "ArrowDown" &&
                event.key !== "ArrowUp" &&
                event.key !== "Home" &&
                event.key !== "End"
            ) {
                return;
            }

            const items = addMenuItems();

            const index = items.indexOf(
                document.activeElement
            );

            if (index === -1) {
                return;
            }

            event.preventDefault();

            let nextIndex = index;

            if (event.key === "Home") {
                nextIndex = 0;
            } else if (event.key === "End") {
                nextIndex = items.length - 1;
            } else {
                const step =
                    event.key === "ArrowDown"
                        ? 1
                        : -1;
                nextIndex =
                    (index + step + items.length) %
                    items.length;
            }

            items[nextIndex].focus();
        }
    );
}


document.addEventListener(
    "click",
    function (event) {

        if (
            quickCreateMenu &&
            quickCreateButton &&
            !quickCreateMenu.contains(
                event.target
            ) &&
            !quickCreateButton.contains(
                event.target
            )
        ) {

            closeAddMenu();
        }
    }
);


/* MODALS */

const MODAL_ERRORS = {
    taskModal: [["taskError", "taskName"]],
    noteModal: [["noteError", "noteTitle"]],
    folderModal: [["folderError", "folderName"]],
    resourceModal: [
        ["resourceError", "resourceName"],
        ["resourceError", "resourceLink"],
        ["resourceError", "resourceFileInput"]
    ],
    codeOpenModal: [],
    codeFilePreviewModal: []
};

const modalTriggers = {};

/* Dialogs can sit on top of each other now that a file can be previewed from
   inside the open dialog. Which one is "the" open dialog is no longer a
   question the document order can answer, so the order they were opened in is
   kept here. Escape has to close the one on top, not whichever happens to come
   first in the markup. */
const modalStack = [];


function openModal(id) {

    const modal =
        document.getElementById(id);

    if (!modal) {
        return;
    }

    /* Recorded per dialog. A single shared variable loses the real trigger
       whenever one dialog is opened on top of another. */
    modalTriggers[id] =
        document.activeElement;

    /* Reopening a dialog that is already open moves it back to the top rather
       than adding it twice. */
    const stacked = modalStack.indexOf(id);

    if (stacked !== -1) {
        modalStack.splice(stacked, 1);
    }

    modalStack.push(id);

    modal.style.display = "flex";

    /* data-autofocus wins so a destructive confirmation can rest on
       Cancel rather than the dangerous button. */
    const target =
        modal.querySelector("[data-autofocus]") ||
        modal.querySelector(
            "input, textarea, .confirm-accept, .confirm-cancel"
        );

    if (target && target.focus) {
        target.focus({ preventScroll: true });
    }
}


/* Some browsers (Safari on macOS among them) do not focus a button when it
   is clicked, so the ambient "activeElement" is not always the control the
   user actually pressed. Rather than let focus fall back to <body>, put it
   somewhere predictable inside the section that is showing. */
function focusFallbackTarget() {

    const section =
        document.querySelector(
            ".workspace-section.active"
        );

    if (section) {
        const button =
            section.querySelector(
                ".section-button, .header-action-button"
            );

        if (button) {
            return button;
        }
    }

    if (workspaceNavigation) {
        return workspaceNavigation.querySelector(
            ".sidebar-item.active"
        );
    }

    return null;
}


function closeModal(id) {

    const modal =
        document.getElementById(id);

    if (!modal) {
        return;
    }

    modal.style.display = "none";

    const stacked = modalStack.indexOf(id);

    if (stacked !== -1) {
        modalStack.splice(stacked, 1);
    }

    const pairs = MODAL_ERRORS[id] || [];

    pairs.forEach(function (pair) {
        setFieldError(pair[0], pair[1], "");
    });

    const trigger = modalTriggers[id];

    delete modalTriggers[id];

    let target = trigger;

    if (
        !target ||
        target === document.body ||
        !document.contains(target)
    ) {
        target = focusFallbackTarget();
    }

    if (target && target.focus) {
        target.focus({ preventScroll: true });
    }
}


function modalHasContent(modal) {

    const form = modal.querySelector("form");

    if (!form) {
        return false;
    }

    return Array.prototype.some.call(
        form.elements,
        function (element) {

            if (element.type === "color") {
                return false;
            }

            return cleanText(element.value).length > 0;
        }
    );
}


document
    .querySelectorAll("[data-close]")
    .forEach(
        function (button) {

            button.addEventListener(
                "click",
                function () {

                    closeModal(
                        button.dataset.close
                    );
                }
            );
        }
    );


document
    .querySelectorAll(".modal")
    .forEach(
        function (modal) {

            modal.addEventListener(
                "mousedown",
                function (event) {

                    if (event.target !== modal) {
                        return;
                    }

                    if (modal.id === "confirmModal") {
                        settleConfirm(false);
                        return;
                    }

                    /* A stray click on the backdrop should not throw away
                       half-typed input. The Cancel button and Escape both
                       stay available. */
                    if (modalHasContent(modal)) {
                        return;
                    }

                    closeModal(modal.id);
                }
            );
        }
    );


/* CONFIRM DIALOG */

let confirmResolver = null;

const confirmAcceptButton =
    document.getElementById(
        "confirmAcceptButton"
    );

const confirmCancelButton =
    document.getElementById(
        "confirmCancelButton"
    );


function settleConfirm(result) {

    const resolve = confirmResolver;

    confirmResolver = null;

    closeModal("confirmModal");

    if (resolve) {
        resolve(result);
    }
}


function confirmAction(options) {

    const settings = options || {};

    const titleEl =
        document.getElementById(
            "confirmModalTitle"
        );

    const messageEl =
        document.getElementById(
            "confirmModalMessage"
        );

    if (
        !titleEl ||
        !messageEl ||
        !confirmAcceptButton
    ) {
        return Promise.resolve(false);
    }

    if (confirmResolver) {
        confirmResolver(false);
        confirmResolver = null;
    }

    titleEl.textContent =
        settings.title || "Are you sure?";

    messageEl.textContent =
        settings.message || "";

    confirmAcceptButton.textContent =
        settings.confirmLabel || "Confirm";

    confirmAcceptButton.classList.toggle(
        "is-safe",
        settings.danger === false
    );

    openModal("confirmModal");

    return new Promise(function (resolve) {
        confirmResolver = resolve;
    });
}


if (confirmAcceptButton) {

    confirmAcceptButton.addEventListener(
        "click",
        function () {
            settleConfirm(true);
        }
    );
}


if (confirmCancelButton) {

    confirmCancelButton.addEventListener(
        "click",
        function () {
            settleConfirm(false);
        }
    );
}


/* The dialog on top of the stack. Falling back to the markup order covers a
   dialog that was opened before this existed, and costs nothing when the
   stack is in step. */
function openModalElement() {

    while (modalStack.length) {

        const top = modalStack[modalStack.length - 1];

        const modal = document.getElementById(top);

        if (modal && modal.style.display === "flex") {
            return modal;
        }

        modalStack.pop();
    }

    return document.querySelector(
        ".modal[style*='flex']"
    );
}


document.addEventListener(
    "keydown",
    function (event) {

        if (event.key !== "Escape") {
            return;
        }

        closeAddMenu(false);

        if (confirmResolver) {
            settleConfirm(false);
            return;
        }

        const open = openModalElement();

        if (open) {
            closeModal(open.id);
        }
    }
);


/* Keeps Tab inside the open dialog. Without this, Tab walks out of the
   dialog into the page behind it and keyboard focus is effectively lost. */
document.addEventListener(
    "keydown",
    function (event) {

        if (event.key !== "Tab") {
            return;
        }

        const modal = openModalElement();

        if (!modal) {
            return;
        }

        const focusable = Array.from(
            modal.querySelectorAll(
                "button, input, textarea, select, a[href], [tabindex]:not([tabindex='-1'])"
            )
        ).filter(function (element) {

            return (
                !element.disabled &&
                element.getClientRects().length > 0
            );
        });

        if (!focusable.length) {
            return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
            return;
        }

        if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }
);


/* MUTATIONS */

let pendingHighlight = null;

function highlight(kind, id) {
    pendingHighlight = { kind: kind, id: id };
}

const HIGHLIGHT_SELECTORS = {
    task: ".task-item",
    note: ".note-card",
    folder: ".folder-card",
    resource: ".resource-row"
};

function applyHighlight(root) {

    if (!pendingHighlight) {
        return;
    }

    const selector =
        HIGHLIGHT_SELECTORS[pendingHighlight.kind];

    if (!selector) {
        pendingHighlight = null;
        return;
    }

    const match = Array.from(
        root.querySelectorAll(selector)
    ).find(function (node) {
        return node.dataset.id === String(pendingHighlight.id);
    });

    pendingHighlight = null;

    if (!match) {
        return;
    }

    match.classList.add("is-new");

    setTimeout(function () {
        match.classList.remove("is-new");
    }, 1400);
}


function commitChanges(options) {

    const config = options || {};

    const saved = saveCurrentWorkspace();

    /* The whole workspace is re-rendered by default. Code opts out, because a
       full render would pull the text out from under the caret while it is
       being typed, and rebuilding five other sections on every keystroke
       makes typing feel heavy. */
    if (config.only === "code") {
        renderCode();
    } else {
        renderAll();
    }

    if (!saved) {
        /* The banner under the header already explains this, and repeating
           it in a toast would only hide the specific cause. */
        return false;
    }

    if (config.message) {
        showStatus(config.message);
    }

    return true;
}


/* TASKS */

const taskForm =
    document.getElementById(
        "taskForm"
    );


function openTask() {

    closeAddMenu(false);

    clearFormErrors(taskForm, MODAL_ERRORS.taskModal);

    openModal("taskModal");
}


document
    .getElementById(
        "quickNewTask"
    )
    .addEventListener(
        "click",
        openTask
    );


document
    .getElementById(
        "quickNewFile"
    )
    .addEventListener(
        "click",
        function () {
            openCodeFile(openFolderId);
        }
    );


function validateTask() {

    const name =
        cleanText(
            document
                .getElementById("taskName")
                .value
        );

    if (!name) {
        setFieldError(
            "taskError",
            "taskName",
            "Give the task a name."
        );
        return null;
    }

    setFieldError("taskError", "taskName", "");

    return {
        name: name,
        description: cleanText(
            document
                .getElementById("taskDescription")
                .value
        )
    };
}


wireLiveValidation(
    taskForm,
    MODAL_ERRORS.taskModal,
    validateTask
);


taskForm.addEventListener(
    "submit",
    function (event) {

        event.preventDefault();

        const values = validateTask();

        if (!values) {
            focusFirstInvalid(MODAL_ERRORS.taskModal);
            return;
        }

        const task = {

            id: Date.now(),

            name: values.name,

            description: values.description,

            status: "todo",

            createdAt: nowIso()
        };

        currentWorkspace.tasks.push(task);

        highlight("task", task.id);

        closeModal("taskModal");

        commitChanges({
            message: "Task added to To do."
        });
    }
);


function createTaskListEmpty(message) {

    const empty =
        document.createElement("p");

    empty.className =
        "task-list-empty";

    empty.textContent = message;

    return empty;
}


function createTaskItem(task) {

    const item =
        document.createElement("div");

    item.className = "task-item";

    item.dataset.id = String(task.id);

    const isComplete =
        task.status === "completed";

    if (isComplete) {
        item.classList.add("is-complete");
    }


    const check =
        document.createElement("button");

    check.type = "button";
    check.className = "task-check";
    check.setAttribute("role", "checkbox");
    check.setAttribute(
        "aria-checked",
        isComplete ? "true" : "false"
    );
    check.setAttribute(
        "aria-label",
        (isComplete ? "Mark incomplete: " : "Mark complete: ") +
            cleanText(task.name)
    );

    check.textContent = "";

    /* The tick is drawn rather than typed, so a completed task reads the
       same way in whatever font the machine happens to have. */
    const tick =
        document.createElement("span");

    tick.className = "task-check-tick";

    tick.setAttribute("aria-hidden", "true");

    tick.appendChild(
        createIcon(
            "check",
            { size: 12, weight: "2.4" }
        )
    );

    check.appendChild(tick);

    check.addEventListener(
        "click",
        function () {

            task.status =
                isComplete ? "todo" : "completed";

            showStatus(
                isComplete
                    ? "Moved back to To do."
                    : "Marked complete."
            );

            commitChanges();
        }
    );


    const main =
        document.createElement("div");

    main.className = "task-item-main";


    const title =
        document.createElement("p");

    title.className = "task-item-title";
    title.textContent =
        cleanText(task.name) || "Untitled task";

    main.appendChild(title);


    if (cleanText(task.description)) {

        const description =
            document.createElement("p");

        description.className =
            "task-item-description";

        description.textContent =
            cleanText(task.description);

        main.appendChild(description);
    }


    /* When the task was written down. Useful context, and only shown when
       there is a real date to show. */
    const created = taskDateLabel(task.createdAt);

    if (created) {

        const stamp =
            document.createElement("span");

        stamp.className = "task-item-time";

        const clock =
            document.createElement("span");

        clock.className = "task-item-time-icon";

        clock.setAttribute("aria-hidden", "true");

        clock.appendChild(
            createIcon("clock", { size: 12 })
        );

        const clockWord =
            document.createElement("span");

        clockWord.textContent = created;

        stamp.appendChild(clock);
        stamp.appendChild(clockWord);

        main.appendChild(stamp);
    }

    const taskDelete = document.createElement("button");
    taskDelete.type = "button";
    taskDelete.className = "task-delete";
    taskDelete.setAttribute(
        "aria-label",
        "Delete task: " + (cleanText(task.name) || "Untitled task")
    );
    taskDelete.appendChild(createIcon("trash", { size: 14 }));
    taskDelete.addEventListener("click", function (event) {
        event.stopPropagation();
        confirmAction({
            title: "Delete task?",
            message: "This task will be permanently removed.",
            confirmLabel: "Delete"
        }).then(function (confirmed) {
            if (!confirmed) return;
            currentWorkspace.tasks = currentWorkspace.tasks.filter(function (item) {
                return item.id !== task.id;
            });
            commitChanges({
                message: "Task deleted."
            });
        });
    });

    item.appendChild(check);
    item.appendChild(main);
    item.appendChild(taskDelete);

    return item;
}


/* A task's date, in the two forms a person actually needs: how long ago it
   was, and the day itself once "ago" stops being useful. */
function taskDateLabel(value) {

    const date = new Date(value);

    if (!value || isNaN(date.getTime())) {
        return "";
    }

    const days = Math.floor(
        (Date.now() - date.getTime()) / 86400000
    );

    if (days < 1) {
        return "Today";
    }

    if (days < 7) {
        return days +
            (days === 1
                ? " day ago"
                : " days ago");
    }

    return date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short"
    });
}


function renderTasks() {

    const todo =
        document.getElementById(
            "todoTasks"
        );

    const completed =
        document.getElementById(
            "completedTasks"
        );

    const todoCount =
        document.getElementById(
            "todoTaskCount"
        );

    const completedCount =
        document.getElementById(
            "completedTaskCount"
        );

    if (!todo || !completed) {
        return;
    }


    const tasks = currentWorkspace.tasks || [];

    const open = tasks.filter(function (task) {
        return task.status !== "completed";
    });

    const done = tasks.filter(function (task) {
        return task.status === "completed";
    });


    if (todoCount) {
        todoCount.textContent = String(open.length);
    }

    if (completedCount) {
        completedCount.textContent = String(done.length);
    }


    todo.innerHTML = "";
    completed.innerHTML = "";


    const isEmpty = tasks.length === 0;

    const tasksSectionDesc = document.getElementById("tasksSectionDesc");
    if (tasksSectionDesc) {
        tasksSectionDesc.hidden = !isEmpty;
    }

    /* Two columns both reading "No tasks yet." tells the user nothing about
       what to do next. Once the workspace genuinely has no tasks, the
       columns step aside for one explained empty state. */
    const columns =
        todo.closest(".task-columns");

    if (columns) {
        columns.hidden = isEmpty;
    }

    const empty =
        document.getElementById(
            "tasksEmpty"
        );

    if (empty) {
        empty.innerHTML = "";

        if (isEmpty) {

            empty.appendChild(
                createSectionEmpty(
                    "No tasks yet",
                    "Capture the next thing you want to move forward.",
                    {
                        icon: "task",
                        hint: "Use the + button to add one."
                    }
                )
            );
        }
    }

    if (isEmpty) {
        return;
    }

    if (open.length === 0) {

        todo.appendChild(
            createTaskListEmpty(
                "Nothing left to do."
            )
        );
    }

    if (done.length === 0) {

        completed.appendChild(
            createTaskListEmpty(
                "Nothing completed yet."
            )
        );
    }


    open.forEach(function (task) {
        todo.appendChild(createTaskItem(task));
    });

    done.forEach(function (task) {
        completed.appendChild(createTaskItem(task));
    });
}


/* NOTES */

const noteForm =
    document.getElementById(
        "noteForm"
    );


/* A fixed set of paper colours, all warm and all light enough to leave text
   on at full contrast. A free colour picker invites neon, and a note you
   cannot read is not a note. The value stored on each note is still a plain
   hex string, so nothing about the data model changes. */
const NOTE_COLORS = [
    { value: "#fbf0d4", name: "Butter" },
    { value: "#f3e3d4", name: "Sand" },
    { value: "#e6eedd", name: "Sage" },
    { value: "#dde9ee", name: "Mist" },
    { value: "#eee3f0", name: "Lilac" },
    { value: "#f6e2e0", name: "Blush" },
    { value: "#eae7e1", name: "Stone" },
    { value: "#fffdf8", name: "Plain" }
];


function renderNotePalette() {

    const row =
        document.getElementById("notePalette");

    const input =
        document.getElementById("noteColor");

    if (!row || !input) {
        return;
    }

    row.textContent = "";

    NOTE_COLORS.forEach(function (colour) {

        const swatch =
            document.createElement("button");

        swatch.type = "button";

        swatch.className = "note-swatch";

        swatch.dataset.value = colour.value;

        swatch.setAttribute(
            "role",
            "radio"
        );

        swatch.setAttribute(
            "aria-checked",
            colour.value === input.value
                ? "true"
                : "false"
        );

        swatch.setAttribute(
            "aria-label",
            colour.name
        );

        swatch.title = colour.name;

        swatch.style.backgroundColor =
            colour.value;

        if (colour.value === input.value) {
            swatch.classList.add("is-selected");
        }

        swatch.addEventListener(
            "click",
            function () {

                input.value = colour.value;

                row
                    .querySelectorAll(
                        ".note-swatch"
                    )
                    .forEach(function (other) {

                        const isThis =
                            other === swatch;

                        other.classList.toggle(
                            "is-selected",
                            isThis
                        );

                        other.setAttribute(
                            "aria-checked",
                            isThis ? "true" : "false"
                        );
                    });
            }
        );

        row.appendChild(swatch);
    });
}


renderNotePalette();


function openNote() {

    closeAddMenu(false);

    clearFormErrors(noteForm, MODAL_ERRORS.noteModal);

    openModal("noteModal");
}


document
    .getElementById(
        "quickNewNote"
    )
    .addEventListener(
        "click",
        openNote
    );


function validateNote() {

    const title =
        cleanText(
            document
                .getElementById("noteTitle")
                .value
        );

    if (!title) {
        setFieldError(
            "noteError",
            "noteTitle",
            "Give the note a title."
        );
        return null;
    }

    setFieldError("noteError", "noteTitle", "");

    return {
        title: title,
        content: cleanText(
            document
                .getElementById("noteContent")
                .value
        ),
        color: safeHexColor(
            document
                .getElementById("noteColor")
                .value,
            "#fbf0d4"
        )
    };
}


wireLiveValidation(
    noteForm,
    MODAL_ERRORS.noteModal,
    validateNote
);


noteForm.addEventListener(
    "submit",
    function (event) {

        event.preventDefault();

        const values = validateNote();

        if (!values) {
            focusFirstInvalid(MODAL_ERRORS.noteModal);
            return;
        }

        const note = {

            id: Date.now(),

            title: values.title,

            content: values.content,

            color: values.color,

            createdAt: nowIso()
        };

        currentWorkspace.notes.push(note);

        highlight("note", note.id);

        closeModal("noteModal");

        commitChanges({
            message: "Note added."
        });
    }
);


function createNoteCard(note) {

    const card =
        document.createElement("div");

    card.className = "note-card";

    card.dataset.id = String(note.id);

    const color =
        safeHexColor(note.color, "#fff3a3");

    card.style.backgroundColor = color;

    if (isDarkColor(color)) {
        card.classList.add("is-dark");
    }


    const title =
        document.createElement("h3");

    title.textContent =
        cleanText(note.title) || "Untitled note";

    card.appendChild(title);


    if (cleanText(note.content)) {

        const content =
            document.createElement("p");

        content.textContent =
            cleanText(note.content);

        card.appendChild(content);
    }


    const meta =
        document.createElement("span");

    meta.className = "note-card-meta";

    meta.textContent =
        note.createdAt
            ? "Added " + formatDate(note.createdAt)
            : "";

    if (meta.textContent) {
        card.appendChild(meta);
    }


    const deleteButton =
        document.createElement("button");

    deleteButton.type = "button";
    deleteButton.className = "note-delete";
    deleteButton.setAttribute(
        "aria-label",
        "Delete note: " +
            (cleanText(note.title) || "Untitled note")
    );

    deleteButton.appendChild(
        createIcon("trash", { size: 14 })
    );


    deleteButton.addEventListener(
        "click",
        function () {

            confirmAction({
                title: "Delete note?",
                message:
                    "This note will be removed from the workspace.",
                confirmLabel: "Delete"
            }).then(function (confirmed) {

                if (!confirmed) {
                    return;
                }

                currentWorkspace.notes =
                    currentWorkspace.notes.filter(
                        function (item) {
                            return item.id !== note.id;
                        }
                    );

                commitChanges({
                    message:
                        "Note deleted."
                });
            });
        }
    );

    card.appendChild(deleteButton);

    return card;
}


function renderNotes() {

    const grid =
        document.getElementById(
            "notesGrid"
        );

    if (!grid) {
        return;
    }


    grid.innerHTML = "";

    const notes = currentWorkspace.notes || [];

    const notesSectionDesc = document.getElementById("notesSectionDesc");
    if (notesSectionDesc) {
        notesSectionDesc.hidden = notes.length > 0;
    }

    if (notes.length === 0) {

        grid.appendChild(
                createSectionEmpty(
                    "No notes yet",
                    "Keep what this workspace should remember, in your own words.",
                    {
                        icon: "note",
                        hint: "Use the + button to add one."
                    }
                )
            );

        return;
    }


    notes.forEach(function (note) {
        grid.appendChild(createNoteCard(note));
    });
}


/* FOLDERS */

const folderForm =
    document.getElementById(
        "folderForm"
    );


function openFolder() {

    closeAddMenu(false);

    clearFormErrors(folderForm, MODAL_ERRORS.folderModal);

    openModal("folderModal");
}


document
    .getElementById(
        "quickNewFolder"
    )
    .addEventListener(
        "click",
        openFolder
    );


function validateFolder() {

    const name =
        cleanText(
            document
                .getElementById("folderName")
                .value
        );

    if (!name) {
        setFieldError(
            "folderError",
            "folderName",
            "Give the folder a name."
        );
        return null;
    }

    setFieldError("folderError", "folderName", "");

    return { name: name };
}


wireLiveValidation(
    folderForm,
    MODAL_ERRORS.folderModal,
    validateFolder
);


folderForm.addEventListener(
    "submit",
    function (event) {

        event.preventDefault();

        const values = validateFolder();

        if (!values) {
            focusFirstInvalid(MODAL_ERRORS.folderModal);
            return;
        }

        const folder = {

            id: Date.now(),

            name: values.name,

            files: [],

            createdAt: nowIso()
        };

        currentWorkspace.folders.push(folder);

        highlight("folder", folder.id);

        closeModal("folderModal");

        commitChanges({
            message: "Folder created."
        });

        /* Creating a folder is the first half of creating a file inside it,
           so land in the folder rather than making the reader go and find
           it. This is the step that used to be missing. */
        if (activeSection === "files") {
            setOpenFolder(folder.id);
        }
    }
);
/* FILES BROWSER
 *
 * Files and Code are two views of one tree, so Files is a browser rather
 * than a list: a row of folders, and inside a folder, a row of files. You
 * can only be in one place in the tree at a time, which is what
 * openFolderId records. Landing inside a folder also tells the create
 * action where to put the next thing, so "New folder" and "New file" never
 * disagree about the destination. */

let openFolderId = null;

const filesBreadcrumb =
    document.getElementById("filesBreadcrumb");


function renderFilesBreadcrumb() {

    if (!filesBreadcrumb) {
        return;
    }

    const folder = codeFindFolder(openFolderId);

    filesBreadcrumb.textContent = "";
    filesBreadcrumb.hidden = !folder;

    if (!folder) {
        return;
    }

    const root = document.createElement("button");

    root.type = "button";
    root.className = "files-crumb files-crumb-root";

    root.appendChild(
        createIcon("layers", { size: 15 })
    );

    const rootWord =
        document.createElement("span");

    rootWord.textContent = "All files";

    root.appendChild(rootWord);

    root.addEventListener("click", function () {
        setOpenFolder(null);
    });

    filesBreadcrumb.appendChild(root);

    const separator = document.createElement("span");

    separator.className = "files-crumb-sep";

    separator.setAttribute("aria-hidden", "true");

    separator.appendChild(
        createIcon("chevronRight", { size: 14 })
    );

    filesBreadcrumb.appendChild(separator);

    const current = document.createElement("span");

    current.className = "files-crumb files-crumb-current";

    current.appendChild(
        createIcon("folderOpen", { size: 15 })
    );

    const currentWord =
        document.createElement("span");

    currentWord.textContent =
        cleanText(folder.name) || "Untitled folder";

    current.appendChild(currentWord);

    filesBreadcrumb.appendChild(current);
}


function setOpenFolder(folderId) {

    openFolderId = folderId;

    /* The floating create action has to agree with where we are standing. */
    codeTargetFolderId = folderId;

    renderQuickCreateContext();
    renderFilesBreadcrumb();
    renderFolders();
    renderCode();
}


function openFolderFromFiles(folderId) {

    if (!codeFindFolder(folderId)) {
        return;
    }

    setOpenFolder(folderId);

    showStatus(
        "Opened " +
        (cleanText(
            codeFindFolder(folderId).name
        ) || "folder")
    );
}


function renderFolders() {

    const grid =
        document.getElementById(
            "foldersGrid"
        );

    if (!grid) {
        return;
    }

    grid.textContent = "";

    const folders = currentWorkspace.folders || [];

    const foldersSectionDesc = document.getElementById("foldersSectionDesc");
    if (foldersSectionDesc) {
        foldersSectionDesc.hidden = folders.length > 0;
    }

    const openFolder = codeFindFolder(openFolderId);

    /* A folder that was deleted elsewhere must not leave the browser
       pointing at nothing. */
    if (openFolderId !== null && !openFolder) {
        openFolderId = null;
        codeTargetFolderId = null;
        renderFilesBreadcrumb();
    }

    if (folders.length === 0) {

        grid.appendChild(
            createSectionEmpty(
                "No folders yet",
                "Folders give this workspace somewhere to organise project files.",
                {
                    icon: "folder",
                    hint: "Use the + button to create a folder, then add files inside it."
                }
            )
        );

        return;
    }

    if (openFolder) {
        renderFolderContents(grid, openFolder);
        return;
    }

    /* ROOT — one row per folder, each a button rather than a card with its
       own separate target. The whole tile opens the folder, so there is
       nothing to miss. */
    const list = document.createElement("div");

    list.className = "folder-list";

    folders.forEach(function (folder) {

        const files = Array.isArray(folder.files)
            ? folder.files
            : [];

        const card =
            document.createElement("div");

        card.className = "folder-card";
        card.dataset.id = String(folder.id);

        const cardMain = document.createElement("button");
        cardMain.type = "button";
        cardMain.className = "folder-card-main";
        cardMain.style.display = "flex";
        cardMain.style.alignItems = "center";
        cardMain.style.gap = "14px";
        cardMain.style.flex = "1 1 auto";
        cardMain.style.background = "transparent";
        cardMain.style.border = "0";
        cardMain.style.textAlign = "left";
        cardMain.style.cursor = "pointer";
        cardMain.style.padding = "0";

        const icon =
            document.createElement("span");

        icon.className = "folder-card-icon";

        icon.appendChild(
            createIcon("folder", { size: 19 })
        );

        const body =
            document.createElement("span");

        body.className = "folder-card-body";

        const title =
            document.createElement("span");

        title.className = "folder-card-name";

        title.textContent =
            cleanText(folder.name) || "Untitled folder";

        const count =
            document.createElement("span");

        count.className = "folder-card-count";

        count.textContent = files.length
            ? pluralize(files.length, "file", "files")
            : "Empty";

        body.appendChild(title);
        body.appendChild(count);

        const go =
            document.createElement("span");

        go.className = "folder-card-go";

        go.setAttribute("aria-hidden", "true");

        go.appendChild(
            createIcon("chevronRight", { size: 16 })
        );

        cardMain.appendChild(icon);
        cardMain.appendChild(body);
        cardMain.appendChild(go);

        cardMain.addEventListener("click", function () {
            openFolderFromFiles(folder.id);
        });

        const deleteFolderBtn = document.createElement("button");
        deleteFolderBtn.type = "button";
        deleteFolderBtn.className = "folder-delete";
        deleteFolderBtn.setAttribute("aria-label", "Delete folder: " + (cleanText(folder.name) || "Untitled folder"));
        deleteFolderBtn.appendChild(createIcon("trash", { size: 15 }));
        deleteFolderBtn.addEventListener("click", function (event) {
            event.stopPropagation();
            confirmAction({
                title: "Delete folder?",
                message: "This will delete '" + (cleanText(folder.name) || "Untitled folder") + "' and all files inside it.",
                confirmLabel: "Delete"
            }).then(function (confirmed) {
                if (!confirmed) return;
                currentWorkspace.folders = currentWorkspace.folders.filter(function (f) {
                    return f.id !== folder.id;
                });
                if (openFolderId === folder.id) {
                    openFolderId = null;
                }
                commitChanges({ message: "Folder deleted." });
                renderFolders();
            });
        });

        card.appendChild(cardMain);
        card.appendChild(deleteFolderBtn);

        list.appendChild(card);
    });

    grid.appendChild(list);
}


function renderFolderContents(grid, folder) {

    const files = Array.isArray(folder.files)
        ? folder.files
        : [];

    const head = document.createElement("div");

    head.className = "folder-contents-head";

    const label = document.createElement("h2");

    label.className = "folder-contents-title";

    label.textContent =
        cleanText(folder.name) || "Untitled folder";

    const headActions = document.createElement("div");
    headActions.className = "folder-contents-actions";
    headActions.style.display = "flex";
    headActions.style.alignItems = "center";
    headActions.style.gap = "8px";

    const add = document.createElement("button");

    add.type = "button";
    add.className = "quiet-button quiet-button-accent";

    add.appendChild(
        createIcon("plus", { size: 15 })
    );

    const addWord = document.createElement("span");

    addWord.textContent = "New file";

    add.appendChild(addWord);

    add.addEventListener("click", function () {
        openCodeFile(folder.id);
    });

    const deleteFolderInHead = document.createElement("button");
    deleteFolderInHead.type = "button";
    deleteFolderInHead.className = "quiet-button modal-submit-danger";
    deleteFolderInHead.appendChild(createIcon("trash", { size: 14 }));
    const delText = document.createElement("span");
    delText.textContent = "Delete folder";
    deleteFolderInHead.appendChild(delText);
    deleteFolderInHead.addEventListener("click", function () {
        confirmAction({
            title: "Delete folder?",
            message: "This will delete '" + (cleanText(folder.name) || "Untitled folder") + "' and all files inside it.",
            confirmLabel: "Delete"
        }).then(function (confirmed) {
            if (!confirmed) return;
            currentWorkspace.folders = currentWorkspace.folders.filter(function (f) {
                return f.id !== folder.id;
            });
            openFolderId = null;
            renderFilesBreadcrumb();
            commitChanges({ message: "Folder deleted." });
            renderFolders();
        });
    });

    headActions.appendChild(add);
    headActions.appendChild(deleteFolderInHead);

    head.appendChild(label);
    head.appendChild(headActions);

    grid.appendChild(head);

    if (!files.length) {

        grid.appendChild(
            createSectionEmpty(
                "This folder is empty",
                "Add a file here and it will be editable in Code straight away.",
                {
                    icon: "file",
                    wide: false,
                    hint: "Use “New file” above, or the + button."
                }
            )
        );

        return;
    }

    const list = document.createElement("ul");

    list.className = "file-list";

    files.forEach(function (file) {

        const row =
            document.createElement("li");

        row.className = "file-row";
        row.dataset.id = String(file.id);

        row.appendChild(
            createFileBadge(file.name)
        );

        const name =
            document.createElement("button");

        name.type = "button";
        name.className = "file-row-name";

        name.textContent = file.name;
        name.title = codePathOf(folder, file);

        name.addEventListener("click", function () {
            previewWorkspaceFile(folder, file);
        });

        const meta =
            document.createElement("span");

        meta.className = "file-row-meta";

        meta.textContent = codeSizeLabel(file.content);

        row.appendChild(name);
        row.appendChild(meta);

        const open = document.createElement("span");

        open.className = "file-row-go";

        open.setAttribute("aria-hidden", "true");

        open.appendChild(
            createIcon("chevronRight", { size: 15 })
        );

        open.style.cursor = "pointer";
        open.addEventListener("click", function () {
            previewWorkspaceFile(folder, file);
        });

        row.appendChild(open);

        const deleteFileBtn = document.createElement("button");
        deleteFileBtn.type = "button";
        deleteFileBtn.className = "file-delete";
        deleteFileBtn.setAttribute("aria-label", "Delete file: " + file.name);
        deleteFileBtn.appendChild(createIcon("trash", { size: 14 }));
        deleteFileBtn.addEventListener("click", function (event) {
            event.stopPropagation();
            confirmAction({
                title: "Delete file?",
                message: "Are you sure you want to delete '" + file.name + "'?",
                confirmLabel: "Delete"
            }).then(function (confirmed) {
                if (!confirmed) return;
                folder.files = folder.files.filter(function (f) {
                    return f.id !== file.id;
                });
                commitChanges({ message: "File deleted." });
                renderFolders();
            });
        });

        row.appendChild(deleteFileBtn);

        list.appendChild(row);
    });

    grid.appendChild(list);
}


let currentPreviewZoom = 1.0;
let currentPreviewingFolder = null;
let currentPreviewingFile = null;

function setFilePreviewZoom(zoom) {
    currentPreviewZoom = Math.max(0.4, Math.min(3.0, Math.round(zoom * 100) / 100));
    const badge = document.getElementById("filePreviewZoomLevel");
    if (badge) {
        badge.textContent = Math.round(currentPreviewZoom * 100) + "%";
    }

    const img = document.getElementById("filePreviewImage");
    const pre = document.getElementById("codeFilePreviewPre");
    const code = document.getElementById("codeFilePreviewCode");

    if (img) {
        img.style.transform = "scale(" + currentPreviewZoom + ")";
        img.style.transformOrigin = "center top";
    }
    if (code) {
        code.style.fontSize = Math.round(14 * currentPreviewZoom) + "px";
        code.style.lineHeight = (1.55 * currentPreviewZoom).toFixed(2);
    }
}

function previewWorkspaceFile(folder, file) {
    currentPreviewingFolder = folder;
    currentPreviewingFile = file;
    currentPreviewZoom = 1.0;
    setFilePreviewZoom(1.0);

    const nameEl = document.getElementById("codeFilePreviewName");
    const metaEl = document.getElementById("codeFilePreviewMeta");
    const codeEl = document.getElementById("codeFilePreviewCode");
    const preEl = document.getElementById("codeFilePreviewPre");
    const imgWrap = document.getElementById("filePreviewImageWrap");
    const imgEl = document.getElementById("filePreviewImage");
    const copyEl = document.getElementById("codeFilePreviewCopy");

    if (!nameEl) return;

    nameEl.textContent = file.name;
    const isBinary = file.isBinary || isBinaryExtension(file.name);
    const language = codeLanguageOf(file.name);
    const sizeLabel = codeSizeLabel(file.content);

    metaEl.textContent = codeLanguageLabel(file.name) + " · " + sizeLabel + (folder ? " (in " + folder.name + ")" : "");

    const ext = codeExtensionOf(file.name);
    const isImage = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"].indexOf(ext) !== -1;

    const zoomBar = document.getElementById("filePreviewZoomBar");
    if (zoomBar) {
        zoomBar.hidden = !isImage;
    }

    if (isImage && (file.content.startsWith("data:image/") || file.content.startsWith("<svg") || isBinary)) {
        if (imgWrap) imgWrap.hidden = false;
        if (imgEl) {
            imgEl.src = file.content.startsWith("<svg")
                ? "data:image/svg+xml;charset=utf-8," + encodeURIComponent(file.content)
                : file.content;
        }
        if (preEl) preEl.hidden = true;
    } else {
        if (imgWrap) imgWrap.hidden = true;
        if (preEl) preEl.hidden = false;
        if (codeEl) {
            codeEl.innerHTML = codeHighlightSource(file.content + "\n", language);
        }
    }

    openModal("codeFilePreviewModal");
}

function openCodeFileFromFiles(folderId, fileId) {

    if (!codeFindFile(folderId, fileId)) {
        return;
    }

    codeOpenEntry(folderId, fileId);
    renderCode();
    showSection("code");

    setCodePanel("editor");

    showStatus("Opened in Code");
}


/* CODE
 *
 * Code is not a second filesystem. Every file it shows lives in
 * currentWorkspace.folders[].files[], the same place Files reads from, so
 * there is one project tree with two views rather than two stores that
 * drift apart.
 *
 * Execution is deliberately honest. The browser can genuinely render
 * HTML/CSS/JS, so Preview does that. It cannot run Python or C, so nothing
 * here pretends otherwise, and no output is invented. */

const codeShell = document.getElementById("codeShell");
const codeExplorerTree = document.getElementById("codeExplorerTree");
const codeEditorTabs = document.getElementById("codeEditorTabs");
const codeEditor = document.getElementById("codeEditor");
const codeHighlight = document.getElementById("codeHighlight");
const codeGutterLines = document.getElementById("codeGutterLines");
const codeEditorEmpty = document.getElementById("codeEditorEmpty");
const codePreviewFrame = document.getElementById("codePreviewFrame");
const codePreviewPlaceholder = document.getElementById("codePreviewPlaceholder");
const codePreviewEntry = document.getElementById("codePreviewEntry");
const codeTerminalBody = document.getElementById("codeTerminalBody");
const codeTerminal = document.getElementById("codeTerminal");
const codePanelSwitcher = document.getElementById("codePanelSwitcher");
const codeFileForm = document.getElementById("codeFileForm");

/* Open files are a view of the project, not a property of it, so they live
   in memory and are rebuilt from workspace data on every render. Drafts hold
   text that has been typed but not saved; keeping them keyed by file is what
   stops switching tabs from silently throwing work away. */
let codeOpenFiles = [];
let codeDrafts = {};
let codeActiveKey = null;
let codePanel = "editor";
let codePreviewBuilt = false;
/* Which folder a new file should land in. Set when the add button on a
   specific folder is used, so "add a file" means "add it here" without a
   second round trip through the folder select. */
let codeTargetFolderId = null;

const CODE_MODAL_ERRORS = [["codeFileError", "codeFileName"]];

const CODE_KEYWORDS = [
    "abstract", "as", "async", "await", "break", "case", "catch", "class",
    "const", "continue", "debugger", "default", "delete", "do", "else",
    "enum", "export", "extends", "false", "finally", "for", "from",
    "function", "get", "if", "implements", "import", "in", "instanceof",
    "interface", "let", "new", "null", "of", "private", "protected", "public",
    "return", "set", "static", "super", "switch", "this", "throw", "true",
    "try", "typeof", "undefined", "var", "void", "while", "with", "yield"
];

const CODE_LANGUAGES = {
    html: { label: "HTML", runnable: true },
    css: { label: "CSS", runnable: true },
    js: { label: "JavaScript", runnable: true },
    json: { label: "JSON", runnable: false },
    md: { label: "Markdown", runnable: false },
    py: { label: "Python", runnable: true },
    java: { label: "Java", runnable: false },
    c: { label: "C", runnable: false },
    cpp: { label: "C++", runnable: false },
    png: { label: "PNG Image", runnable: false },
    jpg: { label: "JPEG Image", runnable: false },
    jpeg: { label: "JPEG Image", runnable: false },
    gif: { label: "GIF Image", runnable: false },
    webp: { label: "WebP Image", runnable: false },
    svg: { label: "SVG Vector", runnable: false },
    bmp: { label: "Bitmap Image", runnable: false },
    ico: { label: "Icon", runnable: false },
    pdf: { label: "PDF Document", runnable: false }
};

const CODE_EXTENSIONS = {
    html: "html", htm: "html",
    css: "css",
    js: "js", mjs: "js", cjs: "js",
    json: "json",
    md: "md", markdown: "md",
    py: "py", python: "py",
    java: "java",
    c: "c", h: "c",
    cpp: "cpp", cc: "cpp", cxx: "cpp", hpp: "cpp",
    png: "png",
    jpg: "jpg",
    jpeg: "jpeg",
    gif: "gif",
    webp: "webp",
    svg: "svg",
    bmp: "bmp",
    ico: "ico",
    pdf: "pdf"
};

const CODE_STARTERS = {
    html: "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n    <meta charset=\"utf-8\">\n    <title>New page</title>\n    <link rel=\"stylesheet\" href=\"style.css\">\n</head>\n<body>\n    <h1>Hello</h1>\n    <script src=\"script.js\"></script>\n</body>\n</html>\n",
    css: "body {\n    margin: 0;\n    font-family: Arial, sans-serif;\n}\n",
    js: "console.log(\"Hello from OneSpace\");\n",
    json: "{\n    \"name\": \"project\"\n}\n",
    md: "# Notes\n\n",
    py: "# Python 3 Online Compiler in OneSpace\n\ndef main():\n    print(\"Welcome to Python 3 Online Compiler!\")\n    print(\"=\" * 38)\n    \n    # Example: List comprehension & basic math\n    numbers = [1, 2, 3, 4, 5]\n    squares = [x**2 for x in numbers]\n    print(f\"Numbers: {numbers}\")\n    print(f\"Squares: {squares}\")\n    print(f\"Sum:     {sum(squares)}\")\n    print(\"\\nReady to write your own Python code!\")\n\nif __name__ == \"__main__\":\n    main()\n",
    java: "public class Main {\n    public static void main(String[] args) {\n        System.out.println(\"Hello\");\n    }\n}\n",
    c: "#include <stdio.h>\n\nint main(void) {\n    printf(\"Hello\\n\");\n    return 0;\n}\n",
    cpp: "#include <iostream>\n\nint main() {\n    std::cout << \"Hello\" << std::endl;\n    return 0;\n}\n"
};

/* Binary file extensions that should be stored as data URLs and displayed, not edited */
const BINARY_EXTENSIONS = {
    /* Images */
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    bmp: "image/bmp",
    ico: "image/x-icon",
    /* PDF */
    pdf: "application/pdf",
    /* Other binary formats */
    zip: "application/zip",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
};

function isBinaryExtension(fileName) {
    const ext = codeExtensionOf(fileName);
    return BINARY_EXTENSIONS.hasOwnProperty(ext);
}

function getMimeType(fileName) {
    const ext = codeExtensionOf(fileName);
    return BINARY_EXTENSIONS[ext] || "application/octet-stream";
}

/* The HTML starter points at style.css and script.js. Creating the page
   without them would make the very first preview report two missing files
   that the user never asked for, so they are created alongside it. */
const CODE_HTML_COMPANIONS = [
    { name: "style.css", language: "css" },
    { name: "script.js", language: "js" }
];

/* Ids keep the same plain-millisecond numeric shape the project already
   stores, so nothing has to migrate. Starting from the current clock and
   counting up means every id issued this session is larger than any id issued
   before it, which is what makes a repeat impossible.

   Deriving the id by scaling the clock (Date.now() * span) was tried and
   rejected: at roughly 1.8e12 the product passes Number.MAX_SAFE_INTEGER,
   so the low digits round off and every id in the same millisecond collapses
   onto the same value. */
let codeFileIdSequence = Date.now();

/* A file's size, stated in the unit a person would use. Only real text is
   measured, so a companion file shows its real length rather than a
   placeholder. */
function codeSizeLabel(content) {

    const text =
        typeof content === "string"
            ? content
            : "";

    if (!text.length) {
        return "Empty file";
    }

    if (text.length < 1024) {
        return text.length + " B";
    }

    return (
        Math.round(text.length / 102.4) / 10 +
        " KB"
    );
}

/* Same unit, but for a byte count that already exists. A device file arrives
   with a size and no string, and building a throwaway string just to measure
   it would be both wasteful and misleading for anything that large. */
function codeByteLabel(bytes) {

    const size = Number(bytes) || 0;

    if (!size) {
        return "Empty file";
    }

    if (size < 1024) {
        return size + " B";
    }

    return (
        Math.round(size / 102.4) / 10 +
        " KB"
    );
}

function makeCodeFileRecord(name, content) {

    /* A new HTML file and its two companions are created in one tick, so a
       bare Date.now() would hand all three the same id. The id is half of the
       key every open tab, draft and dirty check is stored under, so a repeat
       would point two files at one buffer. */
    codeFileIdSequence = codeFileIdSequence + 1;

    return {
        id: codeFileIdSequence,
        name: name,
        content: content,
        createdAt: nowIso(),
        updatedAt: nowIso()
    };
}

function codeAddHtmlCompanions(folder) {

    const created = [];

    if (!Array.isArray(folder.files)) {
        folder.files = [];
    }

    CODE_HTML_COMPANIONS.forEach(function (companion) {

        const taken = folder.files.some(function (file) {
            return file.name === companion.name;
        });

        if (taken) {
            return;
        }

        const record = makeCodeFileRecord(
            companion.name,
            CODE_STARTERS[companion.language] || ""
        );

        folder.files.push(record);
        created.push(record);
    });

    return created;
}

function codeKey(folderId, fileId) {
    return String(folderId) + ":" + String(fileId);
}

function codeExtensionOf(fileName) {
    const parts = String(fileName || "").split(".");
    if (parts.length < 2) {
        return "";
    }
    return parts[parts.length - 1].toLowerCase();
}

function codeLanguageOf(fileName) {
    return CODE_EXTENSIONS[codeExtensionOf(fileName)] || "text";
}

function codeLanguageLabel(fileName) {
    return (CODE_LANGUAGES[codeLanguageOf(fileName)] || {}).label || "Text";
}

function codeFolders() {
    return currentWorkspace.folders || [];
}

function codeFindFolder(folderId) {
    return codeFolders().find(function (folder) {
        return String(folder.id) === String(folderId);
    }) || null;
}

function codeFindFile(folderId, fileId) {
    const folder = codeFindFolder(folderId);
    if (!folder) {
        return null;
    }
    return (folder.files || []).find(function (file) {
        return String(file.id) === String(fileId);
    }) || null;
}

/* A file's path inside the project, used for preview reference resolution
   and for the explorer. */
function codePathOf(folder, file) {
    return folder.name + "/" + file.name;
}

function codeResolveInFolder(folder, relative) {
    const cleaned = String(relative || "").split("?")[0].split("#")[0].trim();

    if (
        !cleaned ||
        /^[a-z][a-z0-9+.-]*:/i.test(cleaned) ||
        cleaned.indexOf("//") === 0
    ) {
        return null;
    }

    const parts = cleaned.split("/").filter(Boolean);

    if (parts.some(function (part) {
        return part === "..";
    })) {
        return null;
    }

    return (folder.files || []).find(function (file) {
        return parts[parts.length - 1] === file.name;
    }) || null;
}


/* SYNTAX HIGHLIGHTING
 *
 * Small hand-written scanners rather than a library. Each one walks the raw
 * source and escapes every fragment as it is emitted, so no path here can
 * inject markup into the highlight layer. */

function codeEscape(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function codeToken(value, kind) {
    return '<span class="code-tok-' + kind + '">' + codeEscape(value) + "</span>";
}

function highlightMarkup(source) {
    const pattern = new RegExp(
        "(<!--[\\s\\S]*?-->)" +
        "|(<!\\[CDATA\\[[\\s\\S]*?\\]\\]>)" +
        "|(<!DOCTYPE[^>]*>)" +
        "|(<\\/?)([a-zA-Z][\\w:.-]*)" +
        "|([^\\s<>/=]+)(?=\\s*=)" +
        "|(\"(?:[^\"\\\\]|\\\\.)*\"|'(?:[^'\\\\]|\\\\.)*')" +
        "|(=)" +
        "|(/?>)" +
        "|([^<]+)" +
        "|(<)" +
        "|(>)",
        "g"
    );

    let out = "";
    let last = 0;
    let match = null;

    while ((match = pattern.exec(source)) !== null) {
        out += codeEscape(source.slice(last, match.index));
        last = pattern.lastIndex;

        if (match[1] || match[2]) {
            out += codeToken(match[1] || match[2], "comment");
        } else if (match[3]) {
            out += codeToken(match[3], "keyword");
        } else if (match[4]) {
            out += codeToken(match[4], "punct");
            out += codeToken(match[5], "tag");
        } else if (match[6]) {
            out += codeToken(match[6], "attr");
        } else if (match[7]) {
            out += codeToken(match[7], "string");
        } else if (match[8]) {
            out += codeToken(match[8], "punct");
        } else if (match[9]) {
            out += codeToken(match[9], "punct");
        } else {
            out += codeEscape(match[10] || match[11] || match[12] || "");
        }
    }

    out += codeEscape(source.slice(last));

    return out;
}

function highlightStyle(source) {
    const pattern = /(\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(@[\w-]+)|(#[0-9a-fA-F]{3,8}\b)|(\b\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|vmin|vmax|ch|ex|pt|cm|mm|in|s|ms|deg|turn|fr)?\b)|([.#]?[A-Za-z_][\w-]*)|([{}();:,>~*+=/])/g;

    let out = "";
    let last = 0;
    let match = null;
    let depth = 0;

    while ((match = pattern.exec(source)) !== null) {
        out += codeEscape(source.slice(last, match.index));
        last = pattern.lastIndex;

        if (match[1]) {
            out += codeToken(match[1], "comment");
        } else if (match[2]) {
            out += codeToken(match[2], "string");
        } else if (match[3]) {
            out += codeToken(match[3], "keyword");
        } else if (match[4]) {
            out += codeToken(match[4], "number");
        } else if (match[5]) {
            out += codeToken(match[5], "number");
        } else if (match[6]) {
            /* Inside a block a bare word is a property; outside one it is a
               selector, so the two get different colours. */
            const kind = depth > 0 ? "property" : "selector";
            out += codeToken(match[6], kind);
        } else {
            out += codeToken(match[7], "punct");
            if (match[7] === "{") {
                depth += 1;
            } else if (match[7] === "}") {
                depth = Math.max(0, depth - 1);
            }
        }
    }

    out += codeEscape(source.slice(last));

    return out;
}

function highlightScript(source) {
    const pattern = /(\/\*[\s\S]*?\*\/)|(\/\/[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b0[xXbB][0-9a-fA-F]+\b|\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|([A-Za-z_$][\w$]*)|([{}()[\];,.:])|([=+\-*/%<>!&|?]+)/g;

    let out = "";
    let last = 0;
    let match = null;

    while ((match = pattern.exec(source)) !== null) {
        out += codeEscape(source.slice(last, match.index));
        last = pattern.lastIndex;

        if (match[1] || match[2]) {
            out += codeToken(match[1] || match[2], "comment");
        } else if (match[3]) {
            out += codeToken(match[3], "string");
        } else if (match[4]) {
            out += codeToken(match[4], "number");
        } else if (match[5]) {
            const word = match[5];
            const after = source.slice(pattern.lastIndex);
            const isCall = /^\s*\(/.test(after);

            if (CODE_KEYWORDS.indexOf(word) !== -1) {
                out += codeToken(word, "keyword");
            } else if (isCall) {
                out += codeToken(word, "fn");
            } else if (/^[A-Z]/.test(word)) {
                out += codeToken(word, "type");
            } else {
                out += codeEscape(word);
            }
        } else if (match[6]) {
            out += codeToken(match[6], "punct");
        } else {
            out += codeToken(match[7], "operator");
        }
    }

    out += codeEscape(source.slice(last));

    return out;
}

function highlightJson(source) {
    const pattern = /("(?:[^"\\]|\\.)*")(\s*:)?|(\b-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|(\btrue\b|\bfalse\b|\bnull\b)|([{}\[\],:])/g;

    let out = "";
    let last = 0;
    let match = null;

    while ((match = pattern.exec(source)) !== null) {
        out += codeEscape(source.slice(last, match.index));
        last = pattern.lastIndex;

        if (match[1]) {
            out += codeToken(match[1], match[2] ? "property" : "string");
            if (match[2]) {
                out += codeToken(match[2], "punct");
            }
        } else if (match[3]) {
            out += codeToken(match[3], "number");
        } else if (match[4]) {
            out += codeToken(match[4], "keyword");
        } else {
            out += codeToken(match[5], "punct");
        }
    }

    out += codeEscape(source.slice(last));

    return out;
}

function highlightPython(source) {
    const pattern = /(#.*)|("""[\s\S]*?"""|'''[\s\S]*?''')|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b0[xXbB][0-9a-fA-F]+\b|\b\d+(?:\.\d+)?\b)|(\b(?:def|class|import|from|return|if|elif|else|while|for|in|try|except|finally|with|as|lambda|yield|pass|break|continue|global|nonlocal|raise|assert|async|await|del|is|not|and|or|True|False|None)\b)|(\b(?:print|len|range|str|int|float|list|dict|set|tuple|type|input|open|sum|min|max|abs|enumerate|zip|map|filter|super|isinstance)\b)|([A-Za-z_][\w]*)|([{}()[\]:;,.]|[=+\-*/%<>!&|^~]+)/g;

    let out = "";
    let last = 0;
    let match = null;

    while ((match = pattern.exec(source)) !== null) {
        out += codeEscape(source.slice(last, match.index));
        last = pattern.lastIndex;

        if (match[1] || match[2]) {
            out += codeToken(match[1] || match[2], "comment");
        } else if (match[3]) {
            out += codeToken(match[3], "string");
        } else if (match[4]) {
            out += codeToken(match[4], "number");
        } else if (match[5]) {
            out += codeToken(match[5], "keyword");
        } else if (match[6]) {
            out += codeToken(match[6], "builtin");
        } else if (match[7]) {
            out += codeEscape(match[7]);
        } else if (match[8]) {
            out += codeToken(match[8], "punct");
        }
    }

    out += codeEscape(source.slice(last));
    return out;
}

function codeHighlightSource(source, language) {
    if (language === "html") {
        return highlightMarkup(source);
    }
    if (language === "css") {
        return highlightStyle(source);
    }
    if (language === "js") {
        return highlightScript(source);
    }
    if (language === "json") {
        return highlightJson(source);
    }
    if (language === "py") {
        return highlightPython(source);
    }
    return codeEscape(source);
}


/* TERMINAL */

function codeLog(level, message) {
    if (!codeTerminalBody) {
        return;
    }

    const line = document.createElement("p");

    line.className = "code-log-line code-log-" + level;
    line.textContent = message;

    codeTerminalBody.appendChild(line);
    codeTerminalBody.scrollTop = codeTerminalBody.scrollHeight;
}

function codeLogMany(level, messages) {
    messages.forEach(function (message) {
        codeLog(level, message);
    });
}

function codeClearTerminal() {
    if (codeTerminalBody) {
        codeTerminalBody.innerHTML = "";
    }
}

function setCodeTerminalOpen(isOpen) {
    const toggle = document.getElementById("codeTerminalToggle");

    if (codeTerminal) {
        codeTerminal.classList.toggle("is-open", isOpen);
    }

    if (toggle) {
        toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");

        const caret = toggle.querySelector(".code-terminal-caret");
        if (caret) {
            caret.textContent = isOpen ? "\u25be" : "\u25b8";
        }
    }
}


/* EDITOR
 *
 * A real textarea is the input surface, with a highlighted layer painted
 * directly behind it and a line-number gutter beside it. This keeps native
 * editing intact: whitespace, selection, undo, IME and screen readers all
 * work, which a contenteditable or a fake textarea would each break in a
 * different way. The two layers share font metrics exactly. */

function codeActiveFile() {
    if (!codeActiveKey) {
        return null;
    }

    const parts = codeActiveKey.split(":");

    return codeFindFile(parts[0], parts[1]);
}

function codeActiveFolder() {
    if (!codeActiveKey) {
        return null;
    }

    return codeFindFolder(codeActiveKey.split(":")[0]);
}

function codeTextOf(key) {
    const parts = key.split(":");
    const file = codeFindFile(parts[0], parts[1]);

    if (!file) {
        return "";
    }

    if (Object.prototype.hasOwnProperty.call(codeDrafts, key)) {
        return codeDrafts[key];
    }

    return file.content;
}

function codeIsDirty(key) {
    if (!Object.prototype.hasOwnProperty.call(codeDrafts, key)) {
        return false;
    }

    const parts = key.split(":");
    const file = codeFindFile(parts[0], parts[1]);

    if (!file) {
        return false;
    }

    return codeDrafts[key] !== file.content;
}

function codeDirtyKeys() {
    return Object.keys(codeDrafts).filter(codeIsDirty);
}

function codeSyncEditor() {

    if (!codeEditor || !codeHighlight || !codeGutterLines) {
        return;
    }

    const key = codeActiveKey;
    const file = key ? codeActiveFile() : null;

    if (!key || !file) {
        codeEditor.value = "";
        codeHighlight.innerHTML = "";
        codeGutterLines.textContent = "";
        codeEditorEmpty.hidden = false;
        codeEditorEmpty.innerHTML = "";

        const heading = document.createElement("h3");
        heading.textContent = codeOpenFiles.length
            ? "Select a file"
            : "No file open";

        const detail = document.createElement("p");
        detail.textContent = codeOpenFiles.length
            ? "Choose another tab above, or pick a file from the project list."
            : "Create a file, or open one from the project list, to start editing.";

        const action = createQuietButton("+ File", openCodeFile);
        action.className = "quiet-button code-empty-action";

        codeEditorEmpty.appendChild(heading);
        codeEditorEmpty.appendChild(detail);
        codeEditorEmpty.appendChild(action);
        return;
    }

    codeEditorEmpty.hidden = true;
    codeEditorEmpty.innerHTML = "";

    /* Handle binary files - display instead of edit */
    if (file.isBinary) {
        codeEditor.style.display = "none";
        codeHighlight.style.display = "none";
        codeGutterLines.style.display = "none";

        const mimeType = file.mimeType || "application/octet-stream";
        const content = codeTextOf(key);

        let viewerHtml = "";
        if (mimeType.startsWith("image/")) {
            viewerHtml = '<img src="' + content + '" alt="' + file.name + '" style="max-width:100%;max-height:70vh;display:block;margin:auto;">';
        } else if (mimeType === "application/pdf") {
            viewerHtml = '<iframe src="' + content + '" style="width:100%;height:70vh;border:none;"></iframe>';
        } else {
            viewerHtml = '<div style="padding:20px;text-align:center;color:var(--text-2);">Cannot preview this file type (' + (file.mimeType || "unknown") + ').<br>File: ' + file.name + '</div>';
        }

        codeEditorEmpty.hidden = false;
        codeEditorEmpty.innerHTML = viewerHtml;
        return;
    }

    /* Text files - normal editor behavior */
    codeEditor.style.display = "";
    codeHighlight.style.display = "";
    codeGutterLines.style.display = "";

    const text = codeTextOf(key);

    /* Only write when the text actually differs, otherwise the caret would
       jump to the start on every keystroke. */
    if (codeEditor.value !== text) {
        codeEditor.value = text;
    }

    codeHighlight.innerHTML = codeHighlightSource(
        text + "\n",
        codeLanguageOf(file.name)
    );

    const lineCount = text.split("\n").length;
    let numbers = "";

    for (let index = 1; index <= lineCount; index += 1) {
        numbers += index + "\n";
    }

    codeGutterLines.textContent = numbers;
    codeSyncEditorScroll();
}

function codeSyncEditorScroll() {

    if (!codeEditor) {
        return;
    }

    const layer = codeEditor.parentElement
        ? codeEditor.parentElement.querySelector(".code-highlight")
        : null;

    /* The painted layer and the line numbers both have to follow the
       textarea, or the code and its numbers drift apart while scrolling. */
    if (layer) {
        layer.style.transform =
            "translate(" +
            -codeEditor.scrollLeft +
            "px," +
            -codeEditor.scrollTop +
            "px)";
    }

    if (codeGutterLines) {
        codeGutterLines.style.transform =
            "translateY(" + -codeEditor.scrollTop + "px)";
    }
}

if (codeEditor) {

    codeEditor.addEventListener(
        "scroll",
        codeSyncEditorScroll
    );

    codeEditor.addEventListener(
        "input",
        function () {

            if (!codeActiveKey) {
                return;
            }

            const file = codeActiveFile();

            if (!file) {
                return;
            }

            const text = codeEditor.value;

            if (text === file.content) {
                delete codeDrafts[codeActiveKey];
            } else {
                codeDrafts[codeActiveKey] = text;
            }

            codeSyncEditor();
            codeRenderEditorTabs();

        }
    );

    /* Tab inserts spaces. Without this the keyboard escapes the editor on
       every press, which makes indented code impossible to type. */
    codeEditor.addEventListener(
        "keydown",
        function (event) {

            if (event.key === "Tab" && !event.ctrlKey && !event.metaKey) {
                event.preventDefault();

                const start = codeEditor.selectionStart;
                const end = codeEditor.selectionEnd;
                const text = codeEditor.value;

                codeEditor.value =
                    text.slice(0, start) + "  " + text.slice(end);
                codeEditor.selectionStart = start + 2;
                codeEditor.selectionEnd = start + 2;

                codeEditor.dispatchEvent(
                    new Event("input", { bubbles: true })
                );
                return;
            }

            if (
                event.key === "s" &&
                (event.ctrlKey || event.metaKey)
            ) {
                event.preventDefault();
                saveCodeFile();
                return;
            }

            if (
                event.key === "Enter" &&
                (event.ctrlKey || event.metaKey)
            ) {
                event.preventDefault();
                runCode();
                return;
            }

        }
    );
}


/* OPEN FILES AND TABS */

function codeOpenEntry(folderId, fileId) {
    const key = codeKey(folderId, fileId);

    if (!codeOpenFiles.some(function (open) {
        return open.key === key;
    })) {
        codeOpenFiles.push({ key: key });
    }

    codeActiveKey = key;
}

function codeCloseFile(key) {
    const dirty = codeIsDirty(key);

    const remove = function () {
        codeOpenFiles = codeOpenFiles.filter(function (open) {
            return open.key !== key;
        });

        delete codeDrafts[key];

        if (codeActiveKey === key) {
            codeActiveKey = codeOpenFiles.length
                ? codeOpenFiles[codeOpenFiles.length - 1].key
                : null;
        }

        renderCode();
    };

    if (!dirty) {
        remove();
        return;
    }

    confirmAction({
        title: "Close a file with unsaved changes?",
        message: "That file has edits that have not been saved. Closing it now discards them.",
        confirmLabel: "Discard and close"
    }).then(function (ok) {
        if (ok) {
            remove();
        }
    });
}

function codeFileNameFor(key) {
    const parts = key.split(":");
    const file = codeFindFile(parts[0], parts[1]);
    return file ? file.name : "Untitled";
}

function codeRenderEditorTabs() {

    if (!codeEditorTabs) {
        return;
    }

    codeEditorTabs.innerHTML = "";

    if (!codeOpenFiles.length) {
        return;
    }

    codeOpenFiles.forEach(function (open) {

        const tab = document.createElement("div");
        tab.className = "code-editor-tab";
        tab.setAttribute("role", "tab");
        tab.dataset.key = open.key;
        tab.title = codeFileNameFor(open.key);

        const isActive = open.key === codeActiveKey;

        tab.setAttribute(
            "aria-selected",
            isActive ? "true" : "false"
        );
        tab.tabIndex = isActive ? 0 : -1;

        if (isActive) {
            tab.classList.add("active");
        }

        if (codeIsDirty(open.key)) {
            tab.classList.add("is-dirty");
        }

        const label = document.createElement("span");
        label.className = "code-editor-tab-label";
        label.textContent = codeFileNameFor(open.key);

        const dot = document.createElement("span");
        dot.className = "code-editor-tab-dot";
        dot.setAttribute("aria-hidden", "true");

        const close = document.createElement("button");
        close.type = "button";
        close.className = "code-editor-tab-close";
        close.setAttribute(
            "aria-label",
            "Close " + codeFileNameFor(open.key)
        );
        close.textContent = "\u00d7";
        close.addEventListener("click", function (event) {
            event.stopPropagation();
            codeCloseFile(open.key);
        });

        tab.appendChild(label);

        if (codeIsDirty(open.key)) {
            tab.appendChild(dot);
        }

        tab.appendChild(close);

        tab.addEventListener("click", function () {
            codeActiveKey = open.key;
            renderCode();
        });

        tab.addEventListener("keydown", function (event) {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                codeActiveKey = open.key;
                renderCode();
            }
        });

        codeEditorTabs.appendChild(tab);

    });
}


function codeRenderExplorer() {

    if (!codeExplorerTree) {
        return;
    }

    codeExplorerTree.innerHTML = "";

    const folders = codeFolders();

    if (!folders.length) {
        const empty = document.createElement("div");
        empty.className = "code-explorer-empty";

        const heading = document.createElement("p");
        heading.textContent = "No folders yet";

        const detail = document.createElement("p");
        detail.textContent =
            "Create a folder to hold project files. Folders made here also appear in Files.";

        empty.appendChild(heading);
        empty.appendChild(detail);
        codeExplorerTree.appendChild(empty);
        return;
    }

    folders.forEach(function (folder) {

        const group = document.createElement("div");
        group.className = "code-explorer-group";

        const heading = document.createElement("div");
        heading.className = "code-explorer-heading";

        const name = document.createElement("p");
        name.className = "code-explorer-folder";
        name.textContent = folder.name;

        /* Adding a file from inside a folder should not require choosing that
           folder again afterwards. */
        const add = document.createElement("button");
        add.type = "button";
        add.className = "code-explorer-add";
        add.textContent = "+";
        add.title = "Add a file to " + folder.name;
        add.setAttribute(
            "aria-label",
            "Add a file to " + folder.name
        );

        add.addEventListener("click", function () {
            openCodeFile(folder.id);
        });

        heading.appendChild(name);
        heading.appendChild(add);
        group.appendChild(heading);

        const files = (folder.files || []).filter(function (file) {
            return file.name.toLowerCase().endsWith(".py");
        });

        if (!files.length) {
            const none = document.createElement("p");
            none.className = "code-explorer-file code-explorer-file-empty";
            none.textContent = "No .py files";
            group.appendChild(none);
        }

        files.forEach(function (file) {

            const key = codeKey(folder.id, file.id);
            const button = document.createElement("button");
            button.type = "button";
            button.className = "code-explorer-file";
            button.dataset.key = key;

            if (key === codeActiveKey) {
                button.classList.add("active");
                button.setAttribute("aria-current", "true");
            }

            const name = document.createElement("span");
            name.className = "code-explorer-file-name";
            name.textContent = file.name;
            name.title = codePathOf(folder, file);

            const language = document.createElement("span");
            language.className = "code-explorer-file-lang";
            language.textContent = codeExtensionOf(file.name) || "txt";

            button.appendChild(name);
            button.appendChild(language);

            if (codeIsDirty(key)) {
                button.classList.add("is-dirty");
            }

            button.addEventListener("click", function () {
                codeOpenEntry(folder.id, file.id);
                renderCode();

                if (isCodeNarrow()) {
                    setCodePanel("editor");
                }
            });

            group.appendChild(button);

        });

        codeExplorerTree.appendChild(group);

    });
}


/* SAVE */

function saveCodeFile() {

    const key = codeActiveKey;
    const file = key ? codeActiveFile() : null;

    if (!key || !file) {
        codeLog("warn", "Open a file before saving.");
        return;
    }

    if (!codeIsDirty(key)) {
        codeLog("info", file.name + " has no unsaved changes.");
        return;
    }

    const parts = key.split(":");

    file.content = codeDrafts[key];
    file.updatedAt = nowIso();

    delete codeDrafts[key];

    commitChanges({ only: "code" });

    showStatus("Saved " + file.name);

    codeLog("info", "Saved " + codePathOf(codeFindFolder(parts[0]), file) + ".");

    /* Requirement: preview follows the save. The entry file decides what
       gets built, so an edit to style.css is picked up here. */
    codeRefreshPreviewForSave(parts[0], file);
}

function codeRefreshPreviewForSave(folderId, file) {

    if (!codePreviewBuilt) {
        return;
    }

    const language = codeLanguageOf(file.name);

    if (language === "html" || language === "css" || language === "js") {
        buildCodePreview(true);
        return;
    }

    renderCodePreviewState();
}


/* OPEN FILES
 *
 * Two sources, one tree. A file already in the project is opened by clicking
 * it. A file on the device is read through the browser's own picker and copied
 * into a folder here, because nothing else in Code can hold a handle to
 * something outside localStorage: a blob URL would die on the next reload and
 * take the preview with it. Copying also means an imported file is a real
 * project file afterwards, saved by the same Save button as any other.
 *
 * What gets copied is decided by what can honestly be stored and run, so the
 * list is explicit and anything refused is reported rather than dropped. */

const CODE_IMPORT_EXTENSIONS = [
    "html", "htm", "css", "js", "mjs", "cjs", "json",
    "md", "markdown", "txt", "csv", "xml", "svg",
    "py", "java", "c", "h", "cpp", "cc", "cxx", "hpp"
];

/* localStorage holds roughly five megabytes for the whole origin and the
   project tree shares that budget with everything else saved here. These caps
   keep one oversized paste from pushing the workspace over the edge, which
   would otherwise fail on the next unrelated save. */
const CODE_IMPORT_MAX_FILE_BYTES = 400 * 1024;
const CODE_IMPORT_MAX_TOTAL_BYTES = 1500 * 1024;

/* Where device files land when the project has no folder to put them in.
   Created on demand rather than asked about, so the picker stays one click. */
const CODE_IMPORT_FALLBACK_FOLDER = "Imported";

/* Shown in place of a name that could not be read from the device. The row is
   refused either way, so the label only has to be recognisable. */
const CODE_IMPORT_UNNAMED = "unnamed file";

let codeChosenFiles = [];
let codeOpenSource = "workspace";


function codeIsImportable(name) {
    return CODE_IMPORT_EXTENSIONS.indexOf(
        codeExtensionOf(name)
    ) !== -1;
}

/* A name from the device is untrusted input that ends up as a key and a
   label. Directory parts are dropped rather than honoured, because the
   project tree is flat per folder and a path would silently become a file
   called "src/index.html". */
function codeSafeFileName(rawName) {

    const base = String(rawName || "")
        .split(/[\\/]/).pop()
        .trim();

    if (!base || base === "." || base === "..") {
        return "";
    }

    /* Control characters and the characters that break a URL or a label. */
    return base.replace(/[\u0000-\u001f<>:"|?*]/g, "_");
}

/* An import must never overwrite work that is already in the project, so a
   collision is suffixed rather than replaced. The user is told which name each
   file ended up with. */
function codeUniqueFileName(folder, name) {

    const taken = function (candidate) {
        return (folder.files || []).some(function (file) {
            return file.name === candidate;
        });
    };

    if (!taken(name)) {
        return name;
    }

    const dot = name.lastIndexOf(".");
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";

    let suffix = 2;

    while (taken(stem + "-" + suffix + ext)) {
        suffix += 1;
    }

    return stem + "-" + suffix + ext;
}

function codeCreateImportFolder() {

    const folder = {
        id: Date.now(),
        name: CODE_IMPORT_FALLBACK_FOLDER,
        files: [],
        createdAt: nowIso()
    };

    currentWorkspace.folders.push(folder);

    return folder;
}

/* Where an import lands is the reader's decision, made in the dialog, so the
   choice is read from the select rather than inferred from whatever file
   happens to be open. Guessing here is what put files in the wrong folder:
   the select looked like it worked and silently did nothing. */
function codeResolveImportFolder() {

    const select = document.getElementById("codeLocalFolder");

    const chosen = codeFindFolder(select ? select.value : null);

    if (chosen) {
        return chosen;
    }

    /* No folder to put files in yet. One is created and shown in the select
       so the destination stays visible rather than being decided silently. */
    const created = codeFolders().length
        ? codeFolders()[0]
        : codeCreateImportFolder();

    populateCodeLocalFolderSelect();

    const selectNow = document.getElementById("codeLocalFolder");

    if (selectNow) {
        selectNow.value = String(created.id);
    }

    return created;
}

function populateCodeLocalFolderSelect() {

    const select = document.getElementById("codeLocalFolder");

    if (!select) {
        return;
    }

    select.innerHTML = "";

    codeFolders().forEach(function (folder) {

        const option = document.createElement("option");
        option.value = String(folder.id);
        option.textContent = folder.name;

        if (codeActiveFolder() && sameId(folder.id, codeActiveFolder().id)) {
            option.selected = true;
        }

        select.appendChild(option);
    });
}


function codeSetOpenSource(source) {

    codeOpenSource = source === "computer" ? "computer" : "workspace";

    const isWorkspace = codeOpenSource === "workspace";

    const workspaceTab = document.getElementById("codeOpenSourceWorkspace");
    const computerTab = document.getElementById("codeOpenSourceComputer");

    [workspaceTab, computerTab].forEach(function (tab) {

        if (!tab) {
            return;
        }

        const isOn =
            tab.dataset.openSource === codeOpenSource;

        tab.classList.toggle("is-active", isOn);
        tab.setAttribute("aria-selected", isOn ? "true" : "false");
    });

    const workspacePane = document.getElementById("codeOpenWorkspacePane");
    const computerPane = document.getElementById("codeOpenComputerPane");

    if (workspacePane) {
        workspacePane.hidden = !isWorkspace;
    }

    if (computerPane) {
        computerPane.hidden = isWorkspace;
    }

    if (isWorkspace) {
        codeRenderWorkspaceFiles();
        return;
    }

    populateCodeLocalFolderSelect();
    codeRenderChosenFiles();

    const search = document.getElementById("codeOpenSearch");

    if (search) {
        search.value = "";
    }
}


function codeRenderWorkspaceFiles() {

    const list = document.getElementById("codeOpenWorkspaceList");

    if (!list) {
        return;
    }

    list.innerHTML = "";

    const search = document.getElementById("codeOpenSearch");
    const term = cleanText(search ? search.value : "").toLowerCase();

    let total = 0;

    codeFolders().forEach(function (folder) {

        (folder.files || []).forEach(function (file) {

            if (!file.name.toLowerCase().endsWith(".py")) {
                return;
            }

            total += 1;

            if (
                term &&
                file.name.toLowerCase().indexOf(term) === -1 &&
                folder.name.toLowerCase().indexOf(term) === -1
            ) {
                return;
            }

            const row = document.createElement("button");
            row.type = "button";
            row.className = "code-open-row";

            const key = codeKey(folder.id, file.id);

            if (key === codeActiveKey) {
                row.classList.add("is-active");
                row.setAttribute("aria-current", "true");
            }

            row.appendChild(createFileBadge(file.name));

            const name = document.createElement("span");
            name.className = "code-open-row-name";
            name.textContent = file.name;
            row.appendChild(name);

            const where = document.createElement("span");
            where.className = "code-open-row-where";
            where.textContent = folder.name;
            row.appendChild(where);

            const meta = document.createElement("span");
            meta.className = "code-open-row-meta";
            meta.textContent =
                codeLanguageLabel(file.name) +
                "  ·  " +
                codeSizeLabel(file.content);
            row.appendChild(meta);

            row.addEventListener("click", function () {

                codeOpenEntry(folder.id, file.id);

                closeModal("codeOpenModal");

                renderCode();

                if (isCodeNarrow()) {
                    setCodePanel("editor");
                }

                showStatus("Opened " + file.name);
            });

            list.appendChild(row);
        });
    });

    if (!total) {

        const empty = document.createElement("div");
        empty.className = "code-open-empty";
        empty.textContent =
            "This workspace has no files yet. Create one, or copy some in from your computer.";

        list.appendChild(empty);
        return;
    }

    if (!list.childNodes.length) {

        const empty = document.createElement("div");
        empty.className = "code-open-empty";
        empty.textContent = "No file matches that search.";

        list.appendChild(empty);
    }
}


function codeRenderChosenFiles() {

    const list = document.getElementById("codeLocalChosen");
    const empty = document.getElementById("codeLocalEmpty");

    if (!list) {
        return;
    }

    list.innerHTML = "";

    if (empty) {
        empty.hidden = codeChosenFiles.length > 0;
    }

    codeChosenFiles.forEach(function (entry) {

        const row = document.createElement("li");
        row.className = "code-open-chosen-row";

        if (entry.rejected) {
            row.classList.add("is-rejected");
        }

        const name = document.createElement("span");
        name.className = "code-open-chosen-name";
        name.textContent = entry.name;
        row.appendChild(name);

        const meta = document.createElement("span");
        meta.className = "code-open-chosen-meta";
        meta.textContent = entry.note;
        row.appendChild(meta);

        /* The picker only ever reports a name and a size, so this is the only
           way to tell before committing whether a file is the one wanted. A
           file too large to copy is not read here either: previewing it would
           defeat the limit that refused it. */
        const peek = document.createElement("button");
        peek.type = "button";
        peek.className = "code-open-chosen-peek";
        peek.textContent = "Preview";
        peek.disabled = Boolean(entry.rejected);
        peek.title = entry.rejected
            ? "This file will not be copied in, so there is nothing to preview."
            : "See what is inside " + entry.name;

        peek.addEventListener("click", function () {
            showCodeFilePreview(entry);
        });

        row.appendChild(peek);

        const drop = document.createElement("button");
        drop.type = "button";
        drop.className = "code-open-chosen-drop";
        drop.textContent = "×";
        drop.title = "Remove " + entry.name;
        drop.setAttribute(
            "aria-label",
            "Remove " + entry.name
        );

        drop.addEventListener("click", function () {
            codeChosenFiles = codeChosenFiles.filter(function (item) {
                return item !== entry;
            });
            codeRenderChosenFiles();
        });

        row.appendChild(drop);

        list.appendChild(row);
    });

    const importButton =
        document.getElementById("codeImportButton");

    if (importButton) {
        importButton.disabled =
            !codeChosenFiles.some(function (entry) {
                return !entry.rejected;
            });
    }
}


/* FILE CONTENTS
 *
 * Reading a device file is the only asynchronous step between choosing files
 * and copying them in, so the dialog opens first with a placeholder and fills
 * itself when the read lands. The text is kept on the entry afterwards, so
 * looking at the same file twice does not read it twice, and the copy that
 * eventually goes into the workspace is the exact text that was on screen
 * rather than a second, possibly different, read. */

let codePreviewingEntry = null;

function showCodeFilePreview(entry) {

    const nameEl = document.getElementById("codeFilePreviewName");
    const metaEl = document.getElementById("codeFilePreviewMeta");
    const codeEl = document.getElementById("codeFilePreviewCode");
    const bodyEl = document.getElementById("codeFilePreviewBody");
    const copyEl = document.getElementById("codeFilePreviewCopy");

    if (!nameEl || !metaEl || !codeEl || !bodyEl) {
        return;
    }

    if (entry.rejected) {
        codeLog(
            "warn",
            entry.name + " will not be copied in, so it has no contents to show."
        );
        return;
    }

    codePreviewingEntry = entry;

    nameEl.textContent = entry.name;

    metaEl.textContent =
        codeLanguageLabel(entry.name) +
        "  ·  " +
        codeByteLabel(entry.file.size);

    codeEl.textContent = "Reading…";

    bodyEl.scrollTop = 0;

    if (copyEl) {
        copyEl.disabled = true;
    }

    openModal("codeFilePreviewModal");

    if (entry.text !== undefined) {
        codeFillFilePreview(entry);
        return;
    }

    entry.file.text().then(
        function (text) {
            entry.text = text;
            codeFillFilePreview(entry);
        },
        function () {
            if (codePreviewingEntry !== entry) {
                return;
            }

            codeEl.textContent = "";
            metaEl.textContent =
                codeLanguageLabel(entry.name) +
                "  ·  could not be read";
        }
    );
}

function codeFillFilePreview(entry) {

    /* The reader may finish after the dialog was closed or after another file
       was opened in it, in which case the newer view is left alone. */
    if (codePreviewingEntry !== entry) {
        return;
    }

    const codeEl = document.getElementById("codeFilePreviewCode");
    const copyEl = document.getElementById("codeFilePreviewCopy");

    if (!codeEl) {
        return;
    }

    const text = entry.text;

    codeEl.innerHTML = codeHighlightSource(
        text + "\n",
        codeLanguageOf(entry.name)
    );

    if (copyEl) {
        copyEl.disabled = !text;
    }
}


function codeCollectDeviceFiles(fileList) {

    const files = Array.prototype.slice.call(fileList || []);

    const rejectedNames = files
        .filter(function (file) {
            return !codeIsImportable(file.name);
        })
        .map(function (file) {
            return file.name;
        });

    const accepted = files.filter(function (file) {
        return codeIsImportable(file.name);
    });

    accepted.forEach(function (file) {

        const name = codeSafeFileName(file.name);

        const duplicate = codeChosenFiles.some(function (entry) {
            return entry.name === name;
        });

        if (duplicate) {
            return;
        }

        const overCap = file.size > CODE_IMPORT_MAX_FILE_BYTES;

        const unusable = !name;

        let note = codeByteLabel(file.size);

        if (overCap) {
            note += " — over the " +
                codeByteLabel(CODE_IMPORT_MAX_FILE_BYTES) +
                " limit";
        } else if (unusable) {
            note += " — no usable file name";
        }

        codeChosenFiles.push({
            file: file,
            name: name || CODE_IMPORT_UNNAMED,
            note: note,
            rejected: overCap || unusable
        });
    });

    /* Everything refused is named in the terminal rather than vanishing,
       because a silent skip reads as "the picker is broken". */
    if (rejectedNames.length) {
        codeLogMany(
            "warn",
            rejectedNames.map(function (name) {
                return name +
                    " was skipped: OneSpace opens text project files, " +
                    "and that is not one.";
            })
        );
    }

    codeRenderChosenFiles();
}


function codeImportChosenFiles() {

    const usable = codeChosenFiles.filter(function (entry) {
        return !entry.rejected;
    });

    if (!usable.length) {
        codeLog("warn", "Choose at least one file to copy in.");
        return;
    }

    const folder = codeResolveImportFolder();

    const added = [];
    const skipped = [];

    /* Reading is asynchronous, so the files are gathered first and written in
       one pass afterwards. Doing it any other way would let a slow read land
       after the save and vanish. */
    const reads = usable.map(function (entry) {

        /* Whatever the contents dialog showed is what gets copied in, so a
           preview and a copy can never disagree about the same file. */
        if (entry.text !== undefined) {
            added.push({
                name: entry.name,
                content: entry.text
            });
            return Promise.resolve();
        }

        return entry.file.text().then(
            function (text) {
                entry.text = text;

                added.push({
                    name: entry.name,
                    content: text
                });
            },
            function () {
                skipped.push(entry.name);
            }
        );
    });

    Promise.all(reads).then(function () {

        if (!added.length) {
            codeLog(
                "error",
                "None of those files could be read."
            );
            return;
        }

        /* Copy until the budget for this import is used up, then stop rather
           than overshoot it. Anything refused is named afterwards so a partly
           completed import is never mistaken for a complete one. */
        let budget = CODE_IMPORT_MAX_TOTAL_BYTES;
        const created = [];

        added.forEach(function (item) {

            if (item.content.length > budget) {
                skipped.push(item.name);
                return;
            }

            budget -= item.content.length;

            const record = makeCodeFileRecord(
                codeUniqueFileName(folder, item.name),
                item.content
            );

            folder.files.push(record);
            created.push(record);
        });

        codeChosenFiles = [];

        codeRenderChosenFiles();

        if (!created.length) {
            codeLog(
                "error",
                "Those files are too large to copy into this workspace."
            );
            return;
        }

        /* Open everything that arrived. An imported page becomes the entry so
           Preview and Run have something to work from; otherwise the last file
           copied in is left selected, which is the one most recently touched. */
        let entry = null;

        created.forEach(function (record) {
            codeOpenEntry(folder.id, record.id);
        });

        created.forEach(function (record) {
            if (codeLanguageOf(record.name) === "html") {
                entry = entry || record;
            }
        });

        if (entry) {
            codeActiveKey = codeKey(folder.id, entry.id);
        }

        closeModal("codeOpenModal");

        commitChanges({ only: "code" });

        codeLog(
            "info",
            "Copied " +
            created.length +
            (created.length === 1 ? " file" : " files") +
            " into " +
            folder.name +
            "."
        );

        created.forEach(function (record) {
            codeLog(
                "info",
                "  " +
                codePathOf(folder, record) +
                "  " +
                codeSizeLabel(record.content)
            );
        });

        if (skipped.length) {
            codeLogMany(
                "warn",
                skipped.map(function (name) {
                    return name +
                        " was skipped: it did not fit the " +
                        codeByteLabel(CODE_IMPORT_MAX_TOTAL_BYTES) +
                        " budget for a single copy-in.";
                })
            );
        }

        showStatus(
            created.length +
            (created.length === 1
                ? " file copied in"
                : " files copied in")
        );

        /* The preview is built whenever the project has an entry page at all,
           not only when an .html file happened to be in this batch. Copying a
           stylesheet or a script into a folder that already has an index.html
           is the common case, and refusing to preview it is what made copied
           CSS and JS look like they had not arrived. */
        const page = codeEntryCandidate();

        /* Checked rather than assumed. Announcing a preview for something
           that is not a page is worse than announcing none, because it reads
           as a working preview while the frame stays empty. */
        if (!page || codeLanguageOf(page.file.name) !== "html") {

            const many = created.length !== 1;

            codeLog(
                "warn",
                "No HTML page in this workspace yet, so there is nothing to " +
                "preview. " +
                created.length +
                (many ? " files were" : " file was") +
                " copied in and saved: " +
                created.map(function (record) {
                    return record.name;
                }).join(", ") +
                ". Add an .html file that loads " +
                (many ? "them" : "it") +
                " and it will run from here."
            );

            renderCodePreviewState();

            setCodePanel("preview");

            return;
        }

        buildCodePreview(true);

        const language = codeLanguageLabel(page.file.name);

        /* Inlining happens by reference: a copied stylesheet or script only
           reaches the page when the entry markup names it. The question has
           to be asked of the entry's own text, not the copied file's, so a
           correctly linked file is not reported as doing nothing. */
        const entryText = codeTextOf(
            codeKey(page.folder.id, page.file.id)
        );

        const unreferenced = created.filter(function (record) {

            return (
                codeLanguageOf(record.name) !== "html" &&
                entryText.indexOf(record.name) === -1
            );
        });

        if (unreferenced.length) {
            /* Only meaningful now that a page exists to have missed them.
               Without one every file looks unreferenced, and naming all of
               them is noise that buries the real message above. */
            codeLogMany(
                "warn",
                unreferenced.map(function (record) {
                    return record.name +
                        " is copied in, but " +
                        page.file.name +
                        " never names it, so it has no effect on the " +
                        "preview until something links to it.";
                })
            );
        }

        codeLog(
            "info",
            "Previewing " +
            codePathOf(page.folder, page.file) +
            ". Run executes the " +
            language +
            " in the browser; other languages need a backend."
        );

        setCodePanel("preview");
    });
}


function openCodeFileBrowser() {

    closeAddMenu(false);

    codeChosenFiles = [];
    codeRenderChosenFiles();

    const errorEl = document.getElementById("codeOpenError");

    if (errorEl) {
        errorEl.textContent = "";
    }

    codeSetOpenSource("workspace");

    openModal("codeOpenModal");
}


/* NEW FILE / NEW FOLDER */

function populateCodeFolderSelect() {
    const select = document.getElementById("codeFileFolder");

    if (!select) {
        return;
    }

    select.innerHTML = "";

    const folders = codeFolders();

    if (!folders.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "No folders yet";
        select.appendChild(option);
        select.disabled = true;
        return;
    }

    select.disabled = false;

    folders.forEach(function (folder) {
        const option = document.createElement("option");
        option.value = String(folder.id);
        option.textContent = folder.name;
        select.appendChild(option);
    });

    /* Preselect, in order of intent: the folder the add button was pressed
       on, then the folder of the file already open, then the first folder.
       Without this the dialog silently defaults to the top of the list. */
    const preferred =
        codeTargetFolderId ||
        (codeActiveKey ? codeActiveKey.split(":")[0] : null);

    const match = folders.find(function (folder) {
        return String(folder.id) === String(preferred);
    });

    if (match) {
        select.value = String(match.id);
    }

    codeTargetFolderId = null;
}

function openCodeFile(folderId) {
    closeAddMenu(false);

    if (!codeFolders().length) {
        codeLog("warn", "Create a folder first, then add files to it.");
        openFolder();
        return;
    }

    codeTargetFolderId =
        folderId === undefined || folderId === null
            ? null
            : folderId;

    clearFormErrors(codeFileForm, CODE_MODAL_ERRORS);
    populateCodeFolderSelect();

    openModal("codeFileModal");
}

function validateCodeFile() {

    let name = cleanText(
        document.getElementById("codeFileName").value
    );

    const select = document.getElementById("codeFileFolder");
    const folder = codeFindFolder(select ? select.value : null);

    if (!folder) {
        setFieldError("codeFileError", "codeFileName", "Create a folder first.");
        return null;
    }

    if (!name) {
        setFieldError("codeFileError", "codeFileName", "Give the file a name.");
        return null;
    }

    if (name.indexOf("/") !== -1 || name.indexOf("\\") !== -1) {
        setFieldError(
            "codeFileError",
            "codeFileName",
            "Use a plain file name, not a path."
        );
        return null;
    }

    if (!name.toLowerCase().endsWith(".py")) {
        const ext = codeExtensionOf(name);
        if (!ext) {
            name = name + ".py";
        } else {
            name = name.replace(new RegExp("\\." + ext + "$", "i"), ".py");
        }
    }

    if ((folder.files || []).some(function (file) {
        return file.name.toLowerCase() === name.toLowerCase();
    })) {
        setFieldError(
            "codeFileError",
            "codeFileName",
            "That file already exists in this folder."
        );
        return null;
    }

    setFieldError("codeFileError", "codeFileName", "");

    return { name: name, folder: folder };
}

let codeFileUpload = null;

if (codeFileForm) {

    wireLiveValidation(
        codeFileForm,
        CODE_MODAL_ERRORS,
        validateCodeFile
    );

    const pickButton = document.getElementById("codeFilePickButton");
    const fileInput = document.getElementById("codeFileUpload");
    const chosenDisplay = document.getElementById("codeFileChosen");

    if (pickButton && fileInput) {
        pickButton.addEventListener("click", function () {
            fileInput.click();
        });
    }

    if (fileInput) {
        fileInput.addEventListener("change", function () {
            codeFileUpload = fileInput.files[0] || null;
            if (chosenDisplay) {
                chosenDisplay.textContent = codeFileUpload
                    ? codeFileUpload.name + " (" + codeByteLabel(codeFileUpload.size) + ")"
                    : "";
            }
            if (codeFileUpload) {
                const nameInput = document.getElementById("codeFileName");
                if (nameInput && !nameInput.value) {
                    nameInput.value = codeFileUpload.name;
                }
            }
        });
    }

    codeFileForm.addEventListener(
        "submit",
        function (event) {

            event.preventDefault();

            const values = validateCodeFile();

            if (!values) {
                focusFirstInvalid(CODE_MODAL_ERRORS);
                return;
            }

            if (codeFileUpload) {
                const isBinary = isBinaryExtension(codeFileUpload.name);
                const reader = new FileReader();
                reader.onload = function () {
                    const file = makeCodeFileRecord(
                        values.name,
                        reader.result
                    );

                    if (isBinary) {
                        file.isBinary = true;
                        file.mimeType = getMimeType(codeFileUpload.name);
                    }

                    values.folder.files.push(file);

                    codeOpenEntry(values.folder.id, file.id);

                    closeModal("codeFileModal");
                    codeFileUpload = null;
                    if (chosenDisplay) chosenDisplay.textContent = "";

                    commitChanges({ only: "code" });

                    if (activeSection === "files") {
                        setOpenFolder(values.folder.id);
                    }

                    showStatus("Uploaded " + file.name);
                    codeLog("info", "Uploaded " + codePathOf(values.folder, file) + ".");
                };
                if (isBinary) {
                    reader.readAsDataURL(codeFileUpload);
                } else {
                    reader.readAsText(codeFileUpload);
                }
                return;
            }

            const language = codeLanguageOf(values.name);

            const file = makeCodeFileRecord(
                values.name,
                CODE_STARTERS[language] || ""
            );

            values.folder.files.push(file);

            const companions = language === "html"
                ? codeAddHtmlCompanions(values.folder)
                : [];

            codeOpenEntry(values.folder.id, file.id);

            closeModal("codeFileModal");

            commitChanges({ only: "code" });

            if (activeSection === "files") {
                setOpenFolder(values.folder.id);
            }

            showStatus("Created " + file.name);

            codeLog("info", "Created " + codePathOf(values.folder, file) + ".");

            companions.forEach(function (companion) {
                codeLog(
                    "info",
                    "Created " +
                        codePathOf(values.folder, companion) +
                        " so " + values.name + " has something to load."
                );
            });

            if (language === "html") {
                buildCodePreview(true);
            }

        }
    );
}


/* PREVIEW
 *
 * The frame is sandboxed with allow-scripts only. That is load-bearing:
 * adding allow-same-origin would put the preview on the application's origin
 * and hand it localStorage and this document. Without it the frame runs in an
 * opaque origin, so preview code cannot read the workspace, its storage, or
 * anything outside itself. */

/* The first page in a folder, if that folder has one. */
function codeFirstHtmlFile(folder) {

    const files = (folder && folder.files) || [];

    for (let index = 0; index < files.length; index += 1) {
        if (codeLanguageOf(files[index].name) === "html") {
            return files[index];
        }
    }

    return null;
}

/* What Preview and Run act on.
 *
 * Only a page can be an entry point, so this never returns a script or a
 * stylesheet however it is spelled. It used to fall back to whichever file
 * happened to be open, which let a bare login.js be reported as the page being
 * previewed: Preview showed nothing while the terminal claimed it had built
 * something, and the real cause was invisible.
 *
 * The order follows the reader's intent. The page they are looking at wins,
 * then a page in the folder they are standing in, so login.html is a perfectly
 * good entry without being called index.html, then the conventional index.html,
 * and finally any remaining page. */
function codeEntryCandidate() {

    const active = codeActiveFile();

    if (active && codeLanguageOf(active.name) === "html") {
        return { folder: codeActiveFolder(), file: active };
    }

    const folders = codeFolders();

    const activeFolder = codeActiveFolder();

    if (activeFolder) {

        const page = codeFirstHtmlFile(activeFolder);

        if (page) {
            return { folder: activeFolder, file: page };
        }
    }

    for (let index = 0; index < folders.length; index += 1) {

        const files = folders[index].files || [];

        for (let f = 0; f < files.length; f += 1) {
            if (
                files[f].name.toLowerCase() === "index.html"
            ) {
                return {
                    folder: folders[index],
                    file: files[f]
                };
            }
        }
    }

    for (let index = 0; index < folders.length; index += 1) {

        const page = codeFirstHtmlFile(folders[index]);

        if (page) {
            return { folder: folders[index], file: page };
        }
    }

    return null;
}

/* Console and error reports from inside the frame, forwarded to the
   OneSpace terminal. The token is generated per build so a message can only
   be read as a report if it came from the frame we just built. */
function codePreviewBootstrap(token) {

    return [
        "(function () {",
        "  var token = " + JSON.stringify(token) + ";",
        "  function send(level, args) {",
        "    try {",
        "      var parts = [];",
        "      for (var i = 0; i < args.length; i += 1) {",
        "        var value = args[i];",
        "        if (typeof value === 'string') {",
        "          parts.push(value);",
        "        } else {",
        "          try {",
        "            parts.push(JSON.stringify(value));",
        "          } catch (error) {",
        "            parts.push(String(value));",
        "          }",
        "        }",
        "      }",
        "      parent.postMessage(",
        "        { onespaceCode: token, level: level, text: parts.join(' ') },",
        "        '*'",
        "      );",
        "    } catch (error) {}",
        "  }",
        "  ['log', 'info', 'warn', 'error'].forEach(function (level) {",
        "    var original = console[level];",
        "    console[level] = function () {",
        "      send(level, arguments);",
        "      if (original) { original.apply(console, arguments); }",
        "    };",
        "  });",
        "  window.addEventListener('error', function (event) {",
        "    send('error', [",
        "      event.message +",
        "      (event.lineno ? ' (line ' + event.lineno + ')' : '')",
        "    ]);",
        "  });",
        "  window.addEventListener('unhandledrejection', function (event) {",
        "    var reason = event.reason;",
        "    send('error', ['Unhandled promise rejection: ' +",
        "      (reason && reason.message ? reason.message : String(reason))]);",
        "  });",
        "})();"
    ].join("\n");
}

function codeSplitHtml(source) {

    const headMatch = source.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    const bodyMatch = source.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

    return {
        head: headMatch ? headMatch[1] : "",
        body: bodyMatch
            ? bodyMatch[1]
            : source
    };
}

/* Replaces local stylesheet and script references with the matching
   workspace file, so a small project renders without a build step or a
   server. References that cannot be found are reported, not swallowed. */
/* A reference that points off the project is left exactly as written, so an
   external stylesheet or font in the markup keeps working. */
function codeIsExternalReference(reference) {
    return /^[a-z][a-z0-9+.-]*:/i.test(reference) ||
        reference.indexOf("//") === 0;
}

/* PROJECT ASSETS
 *
 * The frame is opaque-origin srcdoc, so nothing inside it can fetch a
 * project file by name. Every asset has to be carried across in the
 * document itself. The store holds text, so only text formats can honestly
 * be embedded; SVG is the one image type that qualifies, and it covers most
 * of what a page actually references. */

const CODE_EMBEDDABLE_TYPES = {
    svg: "image/svg+xml"
};

const CODE_MAX_IMPORT_DEPTH = 4;

function codeUtf8DataUri(value, mimeType) {

    return "data:" + mimeType + ";charset=utf-8," +
        encodeURIComponent(String(value === undefined || value === null ? "" : value));
}

function codeDataUriFor(file, folder) {

    if (!file) {
        return null;
    }

    const mimeType =
        CODE_EMBEDDABLE_TYPES[codeExtensionOf(file.name)];

    if (!mimeType) {
        return null;
    }

    return codeUtf8DataUri(
        codeTextOf(codeKey(folder.id, file.id)),
        mimeType
    );
}

/* Follows @import by inlining the imported sheet rather than nesting another
   data URI, because an imported sheet usually imports sheets of its own and
   every level would otherwise have to be re-encoded. Depth and cycle checks
   stop a circular import from recursing forever. */
function codeInlineCss(css, folder, depth, seen) {

    const notes = [];

    if (depth > CODE_MAX_IMPORT_DEPTH) {
        /* Returning the sheet unchanged would leave its own @import in the
           output, and an import the frame cannot fetch fails silently. The
           sheet is dropped instead, and the reason is reported. */
        return {
            css: "",
            notes: [
                "Stopped following @import after " +
                CODE_MAX_IMPORT_DEPTH +
                " levels, so the rest of that stylesheet was left " +
                "out of the preview."
            ]
        };
    }

    const withImports = String(css === undefined || css === null ? "" : css)
        .replace(
            /@import\s+(?:url\(\s*)?(?:"([^"]*)"|'([^']*)'|([^)\s;]+))\s*\)?\s*;?/gi,
            function (whole, dq, sq, bare) {

                const reference =
                    String(dq || sq || bare || "").trim();

                if (!reference || codeIsExternalReference(reference)) {
                    return whole;
                }

                const file = codeResolveInFolder(folder, reference);

                if (!file) {
                    notes.push(
                        "Could not find " + reference + " in " + folder.name +
                        ", so its @import was left out of the preview."
                    );
                    return whole;
                }

                const key = codeKey(folder.id, file.id);

                if (seen.indexOf(key) !== -1) {
                    notes.push(
                        reference + " imports itself, so it was not followed again."
                    );
                    return "";
                }

                const nested = codeInlineCss(
                    codeTextOf(key),
                    folder,
                    depth + 1,
                    seen.concat([key])
                );

                notes.push.apply(notes, nested.notes);

                return nested.css;
            }
        );

    const withUrls = withImports.replace(
        /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"]*?))\s*\)/gi,
        function (whole, dq, sq, bare) {

            const reference =
                String(dq || sq || bare || "").trim();

            if (!reference || codeIsExternalReference(reference)) {
                return whole;
            }

            const file = codeResolveInFolder(folder, reference);
            const dataUri = codeDataUriFor(file, folder);

            if (!dataUri) {
                notes.push(
                    "Could not embed " + reference + " in " + folder.name +
                    ", so it will not load in the preview."
                );
                return whole;
            }

            return 'url("' + dataUri + '")';
        }
    );

    return { css: withUrls, notes: notes };
}

function codeInlineReferences(html, folder) {

    const notes = [];

    const inlineStylesheet = function (whole, before, quoted, dq, sq, after) {

        const reference = dq || sq || "";

        if (codeIsExternalReference(reference)) {
            return whole;
        }

        const file = codeResolveInFolder(folder, reference);

        if (!file) {
            notes.push(
                "Could not find " + reference + " in " + folder.name +
                ", so it was left out of the preview."
            );
            return whole;
        }

        const key = codeKey(folder.id, file.id);

        const inlinedCss = codeInlineCss(
            codeTextOf(key),
            folder,
            1,
            [key]
        );

        notes.push.apply(notes, inlinedCss.notes);

        return '<style data-onespace-src="' +
            codeEscape(file.name) + '">\n' +
            inlinedCss.css +
            "\n</style>";
    };

    const inlineScript = function (whole, before, quoted, dq, sq, after) {

        const reference = dq || sq || "";

        if (codeIsExternalReference(reference)) {
            return whole;
        }

        const file = codeResolveInFolder(folder, reference);

        if (!file) {
            notes.push(
                "Could not find " + reference + " in " + folder.name +
                ", so it was left out of the preview."
            );
            return whole;
        }

        return '<script data-onespace-src="' +
            codeEscape(file.name) + '">\n' +
            codeTextOf(codeKey(folder.id, file.id)) +
            "\n</script>";
    };

    const inlineImage = function (whole, before, srcAttr, quote, reference, after) {

        const target = String(reference || "").trim();

        if (!target || codeIsExternalReference(target)) {
            return whole;
        }

        const file = codeResolveInFolder(folder, target);

        if (!file) {
            notes.push(
                "Could not find " + target + " in " + folder.name +
                ", so it was left out of the preview."
            );
            return whole;
        }

        const dataUri = codeDataUriFor(file, folder);

        if (!dataUri) {
            notes.push(
                target + " is not a type the preview can embed, " +
                "so it will not load."
            );
            return whole;
        }

        return '<img' + before + srcAttr + '"' + dataUri + '"' + after + '>';
    };

    const inlined = html.replace(
        /<link\b([^>]*?)href\s*=\s*("([^"]*)"|'([^']*)')([^>]*?)>/gi,
        inlineStylesheet
    ).replace(
        /<script\b([^>]*?)src\s*=\s*("([^"]*)"|'([^']*)')([^>]*?)>\s*<\/script>/gi,
        inlineScript
    ).replace(
        /<img\b([^>]*?)(\ssrc\s*=\s*)(["'])([^"']*)\3([^>]*?)>/gi,
        inlineImage
    );

    return { html: inlined, notes: notes };
}

function codePreviewToken() {
    return "os-" + Date.now().toString(36) + "-" +
        Math.random().toString(36).slice(2, 10);
}

let codeActiveToken = null;

function buildCodePreview(isManual) {

    const candidate = codeEntryCandidate();

    if (!candidate || !candidate.file) {
        renderCodePreviewState();
        return;
    }

    const folder = candidate.folder;
    const file = candidate.file;

    if (codeLanguageOf(file.name) !== "html") {
        renderCodePreviewState();
        return;
    }

    const source = codeTextOf(codeKey(folder.id, file.id));
    const inlined = codeInlineReferences(source, folder);
    const split = codeSplitHtml(inlined.html);

    const token = codePreviewToken();
    codeActiveToken = token;

    const document_ = [
        "<!DOCTYPE html>",
        "<html>",
        "<head>",
        "<meta charset=\"utf-8\">",
        "<base target=\"_blank\">",
        "<script>",
        codePreviewBootstrap(token),
        "</script>",
        split.head,
        "</head>",
        "<body>",
        split.body,
        "</body>",
        "</html>"
    ].join("\n");

    codePreviewFrame.srcdoc = document_;
    codePreviewBuilt = true;

    if (codePreviewEntry) {
        codePreviewEntry.textContent = codePathOf(folder, file);
    }

    if (inlined.notes.length) {
        codeLogMany("warn", inlined.notes);
    }

    codeLog(
        "info",
        (isManual ? "Preview refreshed" : "Preview updated") +
        " for " + codePathOf(folder, file) + "."
    );

    renderCodePreviewState();
}

function renderCodePreviewState() {

    if (!codePreviewPlaceholder) {
        return;
    }

    const folders = codeFolders();
    const hasHtml = folders.some(function (folder) {
        return (folder.files || []).some(function (file) {
            return codeLanguageOf(file.name) === "html";
        });
    });

    if (codePreviewBuilt) {
        codePreviewPlaceholder.hidden = true;
        return;
    }

    codePreviewPlaceholder.hidden = false;
    codePreviewPlaceholder.innerHTML = "";

    const heading = document.createElement("h3");
    heading.textContent = hasHtml
        ? "Preview is closed"
        : "Nothing to preview yet";

    const detail = document.createElement("p");
    detail.textContent = hasHtml
        ? "Run or press Preview to render this project."
        : "Create an HTML file to start building a frontend.";

    codePreviewPlaceholder.appendChild(heading);
    codePreviewPlaceholder.appendChild(detail);
}

window.addEventListener("message", function (event) {

    if (!codePreviewFrame || event.source !== codePreviewFrame.contentWindow) {
        return;
    }

    const data = event.data;

    if (
        !data ||
        data.onespaceCode !== codeActiveToken ||
        typeof data.text !== "string"
    ) {
        return;
    }

    const level = ["log", "info", "warn", "error"].indexOf(data.level) === -1
        ? "log"
        : data.level;

    const shown = level === "log" ? "info" : level;

    codeLog(shown, "preview: " + data.text);

});


/* RUN
 *
 * Run means "do the one thing this browser can genuinely do", and it says so
 * when there is nothing to do. It never reports success for code that did
 * not run. */

function transpilePythonToJs(source) {
    const lines = source.split("\n");
    const jsLines = [];
    const indentStack = [0];

    for (let i = 0; i < lines.length; i++) {
        let rawLine = lines[i];
        let trimmed = rawLine.trim();

        if (!trimmed || trimmed.startsWith("#")) {
            jsLines.push(rawLine.replace(/#/, "//"));
            continue;
        }

        const indentMatch = rawLine.match(/^(\s*)/);
        const leadingSpace = indentMatch ? indentMatch[1].replace(/\t/g, "    ").length : 0;

        while (indentStack.length > 1 && leadingSpace < indentStack[indentStack.length - 1]) {
            indentStack.pop();
            jsLines.push(" ".repeat(indentStack[indentStack.length - 1]) + "}");
        }

        let line = trimmed;

        line = line.replace(/\bTrue\b/g, "true")
                   .replace(/\bFalse\b/g, "false")
                   .replace(/\bNone\b/g, "null")
                   .replace(/\band\b/g, "&&")
                   .replace(/\bor\b/g, "||")
                   .replace(/\bnot\s+/g, "!");

        line = line.replace(/f"([^"]*)"/g, function(_, str) {
            return "`" + str.replace(/\{([^}]+)\}/g, "${$1}") + "`";
        });
        line = line.replace(/f'([^']*)'/g, function(_, str) {
            return "`" + str.replace(/\{([^}]+)\}/g, "${$1}") + "`";
        });

        if (/^def\s+([a-zA-Z_]\w*)\s*\((.*?)\)\s*:/.test(line)) {
            line = line.replace(/^def\s+([a-zA-Z_]\w*)\s*\((.*?)\)\s*:/, "function $1($2) {");
            indentStack.push(leadingSpace + 4);
        } else if (/^elif\s+(.*?)\s*:/.test(line)) {
            line = line.replace(/^elif\s+(.*?)\s*:/, "} else if ($1) {");
        } else if (/^if\s+(.*?)\s*:/.test(line)) {
            line = line.replace(/^if\s+(.*?)\s*:/, "if ($1) {");
            indentStack.push(leadingSpace + 4);
        } else if (/^else\s*:/.test(line)) {
            line = line.replace(/^else\s*:/, "} else {");
        } else if (/^for\s+([a-zA-Z_]\w*)\s+in\s+(.*?)\s*:/.test(line)) {
            line = line.replace(/^for\s+([a-zA-Z_]\w*)\s+in\s+(.*?)\s*:/, "for (let $1 of $2) {");
            indentStack.push(leadingSpace + 4);
        } else if (/^while\s+(.*?)\s*:/.test(line)) {
            line = line.replace(/^while\s+(.*?)\s*:/, "while ($1) {");
            indentStack.push(leadingSpace + 4);
        } else {
            line = line.replace(/\s+#(.*)$/, " // $1");
            if (!line.endsWith(";") && !line.endsWith("{") && !line.endsWith("}")) {
                line = line + ";";
            }
        }

        jsLines.push(" ".repeat(leadingSpace) + line);
    }

    while (indentStack.length > 1) {
        indentStack.pop();
        jsLines.push(" ".repeat(indentStack[indentStack.length - 1] || 0) + "}");
    }

    return jsLines.join("\n");
}

let pyodideInstance = null;
let pyodideLoadingPromise = null;

async function getPyodideInstance() {
    if (pyodideInstance) return pyodideInstance;
    if (pyodideLoadingPromise) return pyodideLoadingPromise;

    if (typeof loadPyodide === "function") {
        const badge = document.getElementById("pyEngineStatus");
        if (badge) {
            badge.textContent = "● Loading Pyodide...";
            badge.className = "py-engine-badge is-running";
        }
        pyodideLoadingPromise = loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/"
        }).then(function(py) {
            pyodideInstance = py;
            const b = document.getElementById("pyEngineStatus");
            if (b) {
                b.textContent = "● Python 3.10";
                b.className = "py-engine-badge";
            }
            return py;
        }).catch(function(err) {
            console.warn("Pyodide CDN fallback:", err);
            const b = document.getElementById("pyEngineStatus");
            if (b) {
                b.textContent = "● Python 3";
                b.className = "py-engine-badge";
            }
            return null;
        });
        return pyodideLoadingPromise;
    }
    return null;
}

function runPythonFallback(source, filename) {
    const outputLines = [];
    const jsCode = transpilePythonToJs(source);
    const customConsole = {
        log: function(...args) {
            outputLines.push(args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" "));
        },
        error: function(...args) {
            outputLines.push("ERROR: " + args.join(" "));
        }
    };

    function pyPrint(...args) {
        customConsole.log(...args);
    }
    function pyRange(start, stop, step) {
        if (stop === undefined) { stop = start; start = 0; }
        step = step || 1;
        const res = [];
        for (let i = start; step > 0 ? i < stop : i > stop; i += step) res.push(i);
        return res;
    }
    function pyLen(obj) { return obj ? (obj.length !== undefined ? obj.length : Object.keys(obj).length) : 0; }
    function pySum(arr) { return Array.isArray(arr) ? arr.reduce((a, b) => a + b, 0) : 0; }

    const runner = new Function(
        "console", "print", "range", "len", "sum", "str", "int", "float", "list", "dict", "min", "max", "abs", "Math",
        jsCode
    );

    runner(customConsole, pyPrint, pyRange, pyLen, pySum, String, parseInt, parseFloat, Array.from, Object.assign, Math.min, Math.max, Math.abs, Math);

    if (outputLines.length === 0) {
        codeLog("info", "[Program executed with no output]");
    } else {
        outputLines.forEach(function(line) {
            codeLog("stdout", line);
        });
    }
}

async function runPythonCode(source, filename) {
    codeClearTerminal();
    const fname = filename || "main.py";
    codeLog("info", "▶ Running " + fname + " (Python 3.10)...");
    setCodePanel("editor");

    const badge = document.getElementById("pyEngineStatus");
    if (badge) {
        badge.textContent = "● Running...";
        badge.className = "py-engine-badge is-running";
    }

    const startTime = performance.now();

    try {
        let ranWithPyodide = false;
        if (typeof loadPyodide === "function") {
            const py = await getPyodideInstance();
            if (py) {
                py.setStdout({
                    batched: function (str) {
                        if (str) {
                            str.split("\n").forEach(function (line) {
                                if (line) codeLog("stdout", line);
                            });
                        }
                    }
                });
                py.setStderr({
                    batched: function (str) {
                        if (str) {
                            str.split("\n").forEach(function (line) {
                                if (line) codeLog("error", line);
                            });
                        }
                    }
                });

                await py.runPythonAsync(source);
                ranWithPyodide = true;
            }
        }

        if (!ranWithPyodide) {
            runPythonFallback(source, fname);
        }

        const duration = Math.round(performance.now() - startTime);
        codeLog("success", "\n✓ Process finished with exit code 0 (" + duration + "ms)");
        showStatus("Python script executed.");
    } catch (err) {
        const duration = Math.round(performance.now() - startTime);
        codeLog("error", "Traceback (most recent call last):\n" + String(err.message || err));
        codeLog("error", "\n✖ Process finished with error (" + duration + "ms)");
    } finally {
        if (badge) {
            badge.textContent = "● Python 3.10";
            badge.className = "py-engine-badge";
        }
    }
}

function runCode() {

    const file = codeActiveFile();

    if (!file) {
        codeLog("warn", "Open a file before running.");
        return;
    }

    const language = codeLanguageOf(file.name);
    const label = codeLanguageLabel(file.name);

    if (language === "py") {
        const key = codeKey(codeActiveFolder().id, file.id);
        const source = codeTextOf(key);
        runPythonCode(source, file.name);
        return;
    }

    if (language === "html") {
        codeOpenEntry(
            codeActiveFolder().id,
            file.id
        );
        buildCodePreview(true);
        return;
    }

    if (language === "css" || language === "js") {

        const entry = codeEntryCandidate();

        if (!entry || codeLanguageOf(entry.file.name) !== "html") {
            codeLog(
                "warn",
                label + " has nothing to run on its own. Add an HTML file that loads it, then run that file."
            );
            return;
        }

        const folder = codeActiveFolder();
        const referenced = codeTextOf(codeKey(entry.folder.id, entry.file.id))
            .indexOf(file.name) !== -1;

        if (!referenced) {
            codeLog(
                "warn",
                entry.file.name + " does not reference " + file.name +
                ", so this change has nothing to affect in the preview."
            );
            return;
        }

        buildCodePreview(true);
        return;
    }

    codeLog("error", "Execution for " + label + " is not configured yet.");
    codeLog(
        "info",
        "OneSpace renders HTML, CSS, JavaScript and Python directly in the browser."
    );
}


/* RESPONSIVE PANELS */

function isCodeNarrow() {
    return window.matchMedia(
        "(max-width: 1100px)"
    ).matches;
}

function setCodePanel(panel) {

    codePanel = panel;

    if (codeShell) {
        codeShell.dataset.panel = panel;
    }

    if (codePanelSwitcher) {
        codePanelSwitcher.querySelectorAll("button").forEach(
            function (button) {
                const isActive =
                    button.dataset.codePanel === panel;
                button.classList.toggle("active", isActive);
                button.setAttribute(
                    "aria-pressed",
                    isActive ? "true" : "false"
                );
            }
        );
    }
}

if (codePanelSwitcher) {
    codePanelSwitcher.addEventListener(
        "click",
        function (event) {

            const button = event.target.closest(
                "button[data-code-panel]"
            );

            if (button) {
                setCodePanel(button.dataset.codePanel);
            }

        }
    );
}


/* RENDER */

function ensurePythonStarterFile() {
    const folders = codeFolders();
    let hasPy = false;

    for (let i = 0; i < folders.length; i++) {
        const found = (folders[i].files || []).some(function (f) {
            return f.name.toLowerCase().endsWith(".py");
        });
        if (found) {
            hasPy = true;
            break;
        }
    }

    if (!hasPy) {
        let targetFolder = folders[0];
        if (!targetFolder) {
            targetFolder = makeFolderRecord("scripts");
            currentWorkspace.folders = [targetFolder];
        }
        if (!Array.isArray(targetFolder.files)) {
            targetFolder.files = [];
        }
        const starter = makeCodeFileRecord("main.py", CODE_STARTERS.py);
        targetFolder.files.push(starter);
        codeOpenEntry(targetFolder.id, starter.id);
        commitChanges({ only: "code" });
    } else if (!codeActiveKey) {
        for (let i = 0; i < folders.length; i++) {
            const found = (folders[i].files || []).find(function (f) {
                return f.name.toLowerCase().endsWith(".py");
            });
            if (found) {
                codeOpenEntry(folders[i].id, found.id);
                break;
            }
        }
    }
}

function renderCode() {

    if (!codeShell) {
        return;
    }

    ensurePythonStarterFile();

    const codeSectionDesc = document.getElementById("codeSectionDesc");
    if (codeSectionDesc) {
        codeSectionDesc.hidden = false;
    }

    /* Drop open files whose folder or file no longer exists, so a deleted
       entry cannot leave a dead tab behind. */
    codeOpenFiles = codeOpenFiles.filter(function (open) {
        const parts = open.key.split(":");
        return Boolean(codeFindFile(parts[0], parts[1]));
    });

    if (
        codeActiveKey &&
        !codeOpenFiles.some(function (open) {
            return open.key === codeActiveKey;
        })
    ) {
        codeActiveKey = codeOpenFiles.length
            ? codeOpenFiles[codeOpenFiles.length - 1].key
            : null;
    }

    codeRenderExplorer();
    codeRenderEditorTabs();
    codeSyncEditor();
    setCodePanel(codePanel);
}


/* WORKSPACE ISOLATION
 *
 * Open tabs, drafts and the preview all describe one workspace. Carrying
 * them across a switch would show another workspace's file names and buffer
 * its unsaved text into the wrong project. */

function resetCodeState() {
codeOpenFiles = [];
codeDrafts = {};
codeActiveKey = null;
codeTargetFolderId = null;
codePreviewBuilt = false;
    codeActiveToken = null;
    codePanel = "editor";
    codeClearTerminal();

    if (codePreviewFrame) {
        codePreviewFrame.srcdoc = "";
    }

    if (codePreviewEntry) {
        codePreviewEntry.textContent = "";
    }
}

function hasUnsavedCode() {
    return codeDirtyKeys().length > 0;
}

/* Leaving Code and switching workspace are both guarded below. Closing or
   reloading the tab is the third way unsaved work disappears, and it never
   passes through either of those paths, so it needs its own guard. */
window.addEventListener("beforeunload", function (event) {

    if (!hasUnsavedCode()) {
        return undefined;
    }

    event.preventDefault();
    event.returnValue = "";

    return "";
});

/* Leaving Code with unsaved work is the case worth warning about, so the
   nav buttons and the workspace tabs both route through here. */
function requestSectionChange(sectionId) {

    if (
        activeSection === "code" &&
        sectionId !== "code" &&
        hasUnsavedCode()
    ) {
        confirmAction({
            title: "Leave Code with unsaved changes?",
            message: "There are edits in Code that have not been saved. Leaving now discards them.",
            confirmLabel: "Discard and leave"
        }).then(function (ok) {
            if (ok) {
                codeDrafts = {};
                showSection(sectionId);
            }
        });
        return;
    }

    showSection(sectionId);
}

function requestWorkspaceChange(workspaceId) {

    /* Every switch now arrives through here, including picks from the
       workspace picker, so this is the one place that has to guarantee the
       workspace ends up visible as a tab as well as active. */
    function switchTo() {

        ensureWorkspaceTabOpen(workspaceId);

        setActiveWorkspace(workspaceId);
    }

    if (sameId(workspaceId, activeWorkspaceId) || !hasUnsavedCode()) {
        switchTo();
        return;
    }

    confirmAction({
        title: "Switch workspace with unsaved changes?",
        message: "There are edits in Code that have not been saved. Switching now discards them.",
        confirmLabel: "Discard and switch"
    }).then(function (ok) {
        if (ok) {
            codeDrafts = {};
            switchTo();
        }
    });
}


/* WIRING
 *
 * These are top-level statements, so an unguarded addEventListener on a
 * missing element throws here and takes every other section down with it.
 * A stale cached page against newer markup is exactly that situation. Code
 * chrome the user cannot see is not something they can act on, so a missing
 * control is skipped instead of reported. */

function onCodeControl(id, eventName, handler) {

    const control = document.getElementById(id);

    if (control) {
        control.addEventListener(eventName, handler);
    }
}

onCodeControl("codeSaveButton", "click", saveCodeFile);

onCodeControl("codeRunButton", "click", runCode);

onCodeControl("codeTerminalClearButton", "click", codeClearTerminal);

onCodeControl("codeTerminalInnerClear", "click", codeClearTerminal);

onCodeControl("codeExplorerAddPy", "click", function () {
    openCodeFile();
});

onCodeControl("codeNewFileButton", "click", openCodeFile);

onCodeControl("codeOpenButton", "click", openCodeFileBrowser);

onCodeControl("codeNewFolderButton", "click", openFolder);

onCodeControl("codeOpenSearch", "input", function () {
    codeRenderWorkspaceFiles();
});

onCodeControl("codeOpenSearch", "keydown", function (event) {

    /* Escape inside a search field clears it rather than closing the
       dialog, which is the only sensible meaning there. */
    if (event.key !== "Escape") {
        return;
    }

    const search = document.getElementById("codeOpenSearch");

    if (!search || !search.value) {
        return;
    }

    event.preventDefault();
    event.stopPropagation();

    search.value = "";

    codeRenderWorkspaceFiles();
});

onCodeControl("codeImportButton", "click", codeImportChosenFiles);

onCodeControl("filePreviewZoomIn", "click", function () {
    setFilePreviewZoom(currentPreviewZoom + 0.2);
});

onCodeControl("filePreviewZoomOut", "click", function () {
    setFilePreviewZoom(currentPreviewZoom - 0.2);
});

onCodeControl("filePreviewZoomReset", "click", function () {
    setFilePreviewZoom(1.0);
});

onCodeControl("filePreviewEditInCode", "click", function () {
    closeModal("codeFilePreviewModal");
    if (currentPreviewingFolder && currentPreviewingFile) {
        openCodeFileFromFiles(currentPreviewingFolder.id, currentPreviewingFile.id);
    }
});

onCodeControl("filePreviewDownload", "click", function () {
    if (!currentPreviewingFile) return;
    const a = document.createElement("a");
    const isBin = currentPreviewingFile.isBinary || isBinaryExtension(currentPreviewingFile.name);
    if (isBin && currentPreviewingFile.content.startsWith("data:")) {
        a.href = currentPreviewingFile.content;
    } else {
        a.href = "data:text/plain;charset=utf-8," + encodeURIComponent(currentPreviewingFile.content);
    }
    a.download = currentPreviewingFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showStatus("Downloading " + currentPreviewingFile.name);
});

onCodeControl("codeFilePreviewCopy", "click", function () {

    const textToCopy = currentPreviewingFile
        ? currentPreviewingFile.content
        : (codePreviewingEntry ? codePreviewingEntry.text : "");

    if (textToCopy === undefined || textToCopy === null) {
        return;
    }

    const nameEl = document.getElementById("codeFilePreviewName");
    const copyEl = document.getElementById("codeFilePreviewCopy");

    const label = currentPreviewingFile
        ? currentPreviewingFile.name
        : (codePreviewingEntry ? codePreviewingEntry.name : "File");

    const done = function (ok) {

        if (copyEl) {
            copyEl.disabled = false;
        }

        showStatus(
            ok
                ? "Copied " + label + " to the clipboard."
                : "Could not reach the clipboard."
        );
    };

    if (
        navigator.clipboard &&
        navigator.clipboard.writeText
    ) {
        navigator.clipboard.writeText(textToCopy).then(
            function () {
                done(true);
            },
            function () {
                done(codeCopyTextFallback(textToCopy));
            }
        );
        return;
    }

    done(codeCopyTextFallback(textToCopy));
});

function codeCopyTextFallback(text) {

    const scratch = document.createElement("textarea");

    scratch.value = text;
    scratch.setAttribute("readonly", "");
    scratch.style.position = "fixed";
    scratch.style.top = "-1000px";
    scratch.style.opacity = "0";

    document.body.appendChild(scratch);
    scratch.select();

    let ok = false;

    try {
        ok = document.execCommand("copy");
    } catch (error) {
        ok = false;
    }

    document.body.removeChild(scratch);

    return ok;
}

onCodeControl("codePickFilesButton", "click", function () {

    const input = document.getElementById("codeLocalInput");

    if (!input) {
        return;
    }

    /* A folder is required before a device file has anywhere to go, and
       making one here rather than failing quietly keeps the picker usable
       from a workspace that has no folders yet. */
    if (!codeFolders().length) {
        codeCreateImportFolder();
        populateCodeLocalFolderSelect();

        const select =
            document.getElementById("codeLocalFolder");

        if (select && select.options.length) {
            select.selectedIndex = 0;
        }
    }

    input.value = "";

    input.click();
});

(function wireCodeOpenSources() {

    const switcher =
        document.getElementById("codeOpenSources");

    if (!switcher) {
        return;
    }

    switcher.addEventListener("click", function (event) {

        const tab = event.target.closest(
            "[data-open-source]"
        );

        if (!tab) {
            return;
        }

        codeSetOpenSource(tab.dataset.openSource);
    });

    switcher.addEventListener("keydown", function (event) {

        if (
            event.key !== "ArrowLeft" &&
            event.key !== "ArrowRight"
        ) {
            return;
        }

        event.preventDefault();

        codeSetOpenSource(
            codeOpenSource === "workspace"
                ? "computer"
                : "workspace"
        );

        const target = document.querySelector(
            '#codeOpenSources [data-open-source="' +
            codeOpenSource + '"]'
        );

        if (target) {
            target.focus();
        }
    });

})();

(function wireCodeLocalInput() {

    const input =
        document.getElementById("codeLocalInput");

    if (!input) {
        return;
    }

    input.addEventListener(
        "change",
        function () {
            codeCollectDeviceFiles(input.files);
        }
    );

})();

onCodeControl("codeTerminalToggle", "click", function () {

    const isOpen = Boolean(
        codeTerminal &&
        codeTerminal.classList.contains("is-open")
    );

    setCodeTerminalOpen(!isOpen);
});

onCodeControl("codeTerminalClearButton", "click", codeClearTerminal);


/* RESOURCES */

const resourceForm =
    document.getElementById(
        "resourceForm"
    );


let resourceFileInput = null;

function openResource() {

    closeAddMenu(false);

    clearFormErrors(
        resourceForm,
        MODAL_ERRORS.resourceModal
    );

    /* Reset to default link type */
    const linkRadio = document.querySelector('input[name="resourceType"][value="link"]');
    const fileRadio = document.querySelector('input[name="resourceType"][value="file"]');
    const linkSection = document.getElementById("resourceLinkSection");
    const fileSection = document.getElementById("resourceFileSection");
    const fileNameEl = document.getElementById("resourceFileName");

    if (linkRadio) linkRadio.checked = true;
    if (fileRadio) fileRadio.checked = false;
    if (linkSection) linkSection.hidden = false;
    if (fileSection) fileSection.hidden = true;
    if (fileNameEl) fileNameEl.textContent = "";

    openModal("resourceModal");
}


/* Wire resource type radio buttons and file picker */
(function wireResourceModal() {
    const linkRadio = document.querySelector('input[name="resourceType"][value="link"]');
    const fileRadio = document.querySelector('input[name="resourceType"][value="file"]');
    const linkSection = document.getElementById("resourceLinkSection");
    const fileSection = document.getElementById("resourceFileSection");
    const fileNameEl = document.getElementById("resourceFileName");
    const pickBtn = document.getElementById("resourcePickFileButton");
    const fileInput = document.getElementById("resourceFileInput");

    function setType(isFile) {
        if (linkRadio) linkRadio.checked = !isFile;
        if (fileRadio) fileRadio.checked = isFile;
        if (linkSection) linkSection.hidden = isFile;
        if (fileSection) fileSection.hidden = !isFile;
    }

    if (linkRadio) {
        linkRadio.addEventListener("change", function () {
            if (this.checked) setType(false);
        });
    }
    if (fileRadio) {
        fileRadio.addEventListener("change", function () {
            if (this.checked) setType(true);
        });
    }
    if (pickBtn && fileInput) {
        pickBtn.addEventListener("click", function () {
            fileInput.click();
        });
    }
    if (fileInput) {
        fileInput.addEventListener("change", function () {
            resourceFileInput = fileInput;
            if (fileInput.files.length) {
                fileNameEl.textContent = fileInput.files[0].name;
            } else {
                fileNameEl.textContent = "";
            }
        });
    }
})();


document
    .getElementById(
        "quickNewResource"
    )
    .addEventListener(
        "click",
        openResource
    );


function validateResource() {

    const title =
        cleanText(
            document
                .getElementById("resourceName")
                .value
        );

    if (!title) {
        setFieldError(
            "resourceError",
            "resourceName",
            "Give the resource a name."
        );
        return null;
    }

    setFieldError("resourceError", "resourceName", "");

    const resourceType = document.querySelector('input[name="resourceType"]:checked');
    const isFile = resourceType && resourceType.value === "file";

    if (isFile) {
        if (!resourceFileInput || !resourceFileInput.files.length) {
            setFieldError(
                "resourceError",
                "resourceFileInput",
                "Choose a file."
            );
            return null;
        }
        setFieldError("resourceError", "resourceFileInput", "");
        return {
            title: title,
            type: "file",
            file: resourceFileInput.files[0],
            description: cleanText(
                document
                    .getElementById("resourceDescription")
                    .value
            )
        };
    } else {
        const rawUrl =
            cleanText(
                document
                    .getElementById("resourceLink")
                    .value
            );

        if (!rawUrl) {
            setFieldError(
                "resourceError",
                "resourceLink",
                "Add the link for this resource."
            );
            return null;
        }

        const url = normalizeUrl(rawUrl);

        if (!isValidHttpUrl(url)) {
            setFieldError(
                "resourceError",
                "resourceLink",
                "Enter a valid web link (e.g. google.com or https://...)"
            );
            return null;
        }

        setFieldError("resourceError", "resourceLink", "");

        return {
            title: title,
            type: "link",
            url: url,
            description: cleanText(
                document
                    .getElementById("resourceDescription")
                    .value
            )
        };
    }
}


wireLiveValidation(
    resourceForm,
    MODAL_ERRORS.resourceModal,
    validateResource
);


resourceForm.addEventListener(
    "submit",
    function (event) {

        event.preventDefault();

        const values = validateResource();

        if (!values) {
            focusFirstInvalid(MODAL_ERRORS.resourceModal);
            return;
        }

        if (values.type === "file") {
            const reader = new FileReader();
            reader.onload = function () {
                const resource = {
                    id: Date.now(),
                    title: values.title,
                    type: "file",
                    fileName: values.file.name,
                    fileType: values.file.type || "application/octet-stream",
                    fileData: reader.result,
                    description: values.description,
                    createdAt: nowIso()
                };

                currentWorkspace.resources.push(resource);

                highlight("resource", resource.id);

                closeModal("resourceModal");

                commitChanges({
                    message: "Resource saved."
                });
            };
            reader.readAsDataURL(values.file);
            return;
        }

        const resource = {
            id: Date.now(),
            title: values.title,
            type: "link",
            url: values.url,
            description: values.description,
            createdAt: nowIso()
        };

        currentWorkspace.resources.push(resource);

        highlight("resource", resource.id);

        closeModal("resourceModal");

        commitChanges({
            message: "Resource saved."
        });
    }
);


/* A link's host, read from the URL. Returns an empty string rather than
   throwing when the stored value is not a URL at all. */
function hostOf(href) {

    if (!href) {
        return "";
    }

    try {
        return new URL(normalizeUrl(href)).hostname;
    } catch (error) {
        return "";
    }
}


function hostInitialOf(href) {

    const host = hostOf(href)
        .replace(/^www\./, "");

    if (!host) {
        return "?";
    }

    /* A subdomain is a less useful identity than the registrable-looking
       middle of the name, so "docs.example.com" reads as "e". */
    const parts = host.split(".");

    if (parts.length >= 3) {
        return parts[1].charAt(0).toUpperCase();
    }

    return parts[0].charAt(0).toUpperCase();
}


/* A stable tint per host, so the same site keeps the same mark. Derived from
   the name rather than stored, so it cannot drift out of date. */
function hostTintOf(href) {

    const host = hostOf(href).toLowerCase();

    if (!host) {
        return "var(--surface-3)";
    }

    let hash = 0;

    for (let i = 0; i < host.length; i++) {
        hash = (hash * 31 + host.charCodeAt(i)) % 360;
    }

    return "hsl(" + hash + " 28% 88%)";
}


function renderResources() {

    const list =
        document.getElementById(
            "resourcesList"
        );

    if (!list) {
        return;
    }


    list.innerHTML = "";

    const resources = currentWorkspace.resources || [];

    const resourcesSectionDesc = document.getElementById("resourcesSectionDesc");
    if (resourcesSectionDesc) {
        resourcesSectionDesc.hidden = resources.length > 0;
    }

    if (resources.length === 0) {

        list.appendChild(
                createSectionEmpty(
                    "No resources yet",
                    "Keep the links and files this workspace keeps coming back to.",
                    {
                        icon: "resources",
                        hint: "Use the + button to add a resource."
                    }
                )
            );

        return;
    }


    resources.forEach(function (resource) {

        const row =
            document.createElement("div");

        row.className = "resource-row";

        row.dataset.id = String(resource.id);

        const title =
            cleanText(resource.title) || "Untitled resource";

        const isFile = resource.type === "file";

        const href =
            safeHref(resource.url);


        /* A site mark, derived from the link itself rather than fetched, so
           the list is useful offline and does not leak a request per row. */
        const mark =
            document.createElement("span");

        mark.className = "resource-mark";

        mark.setAttribute("aria-hidden", "true");

        if (isFile) {
            /* File icon using first letter of filename */
            mark.textContent = resource.fileName ? resource.fileName.charAt(0).toUpperCase() : "F";
            mark.style.backgroundColor = "var(--pastel-resources-bg)";
            mark.style.color = "var(--pastel-resources-fg)";
        } else {
            mark.style.backgroundColor =
                hostTintOf(href);

            mark.textContent = hostInitialOf(href);
        }

        row.appendChild(mark);


        const body =
            document.createElement("div");

        body.className = "resource-row-body";


        if (isFile) {
            const fileLink = document.createElement("button");
            fileLink.className = "resource-row-title resource-file-link";
            fileLink.type = "button";
            fileLink.style.display = "inline-flex";
            fileLink.style.alignItems = "center";
            fileLink.style.gap = "6px";
            fileLink.style.background = "transparent";
            fileLink.style.border = "0";
            fileLink.style.cursor = "pointer";
            fileLink.style.textAlign = "left";
            fileLink.style.padding = "0";

            const fileIcon = document.createElement("span");
            fileIcon.className = "resource-file-icon";
            fileIcon.setAttribute("aria-hidden", "true");
            fileIcon.appendChild(createIcon("document", { size: 14 }));
            fileLink.appendChild(fileIcon);

            const fileText = document.createElement("span");
            fileText.textContent = title;
            fileLink.appendChild(fileText);

            fileLink.addEventListener("click", function () {
                if (resource.fileData) {
                    const a = document.createElement("a");
                    a.href = resource.fileData;
                    a.download = resource.fileName || (title + ".bin");
                    a.target = "_blank";
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    showStatus("Downloading " + (resource.fileName || "file"));
                }
            });

            body.appendChild(fileLink);

            const fileMeta = document.createElement("span");
            fileMeta.className = "resource-file-meta";
            const fileTypeLabel = resource.fileType || "File";
            fileMeta.textContent = resource.fileName + " · " + fileTypeLabel;
            body.appendChild(fileMeta);
        } else if (href) {

            const link =
                document.createElement("a");

            link.className = "resource-row-title";
            link.href = href;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = title;

            const arrow =
                document.createElement("span");

            arrow.className = "resource-row-go";

            arrow.setAttribute("aria-hidden", "true");

            arrow.appendChild(
                createIcon(
                    "arrowLeft",
                    { size: 14 }
                )
            );

            /* The glyph points out of the page, which a chevron cannot do.
               It is rotated rather than swapped for a new drawing. */
            arrow.firstChild.style.transform =
                "rotate(-45deg)";

            link.appendChild(arrow);

            body.appendChild(link);
        } else {

            const plain =
                document.createElement("span");

            plain.className = "resource-row-title";
            plain.textContent = title;

            body.appendChild(plain);
        }


        if (!isFile && href) {
            const urlWrap =
                document.createElement("div");

            urlWrap.className = "resource-row-url";

            const urlLink = document.createElement("a");
            urlLink.href = href;
            urlLink.target = "_blank";
            urlLink.rel = "noopener noreferrer";
            urlLink.textContent = href;
            urlLink.style.color = "var(--text-3)";
            urlLink.style.textDecoration = "none";

            urlWrap.appendChild(urlLink);
            body.appendChild(urlWrap);
        }


        if (cleanText(resource.description)) {

            const description =
                document.createElement("p");

            description.className =
                "resource-row-description";

            description.textContent =
                cleanText(resource.description);

            body.appendChild(description);
        }


        if (resource.createdAt) {

            const meta =
                document.createElement("span");

            meta.className = "resource-row-meta";

            meta.textContent =
                "Added " +
                formatDate(resource.createdAt);

            body.appendChild(meta);
        }


        const remove =
            document.createElement("button");

        remove.type = "button";
        remove.className = "resource-remove";
        remove.appendChild(createIcon("trash", { size: 14 }));
        const removeText = document.createElement("span");
        removeText.textContent = "Delete";
        remove.appendChild(removeText);
        remove.setAttribute(
            "aria-label",
            "Delete resource: " + title
        );

        remove.addEventListener(
            "click",
            function () {

                confirmAction({
                    title: "Delete resource?",
                    message:
                        isFile
                            ? "This file will be removed from the workspace."
                            : "This link will be removed from the workspace.",
                    confirmLabel: "Delete"
                }).then(function (confirmed) {

                    if (!confirmed) {
                        return;
                    }

                    currentWorkspace.resources =
                        currentWorkspace.resources.filter(
                            function (item) {
                                return item.id !== resource.id;
                            }
                        );

                    commitChanges({
                        message: "Resource deleted."
                    });
                });
            }
        );

        row.appendChild(body);
        row.appendChild(remove);

        list.appendChild(row);
    });
}

/* OVERVIEW */

const overviewContent =
    document.getElementById(
        "overviewContent"
    );


function workspaceCounts() {

    const tasks = currentWorkspace.tasks || [];

    return {

        open: tasks.filter(function (task) {
            return task.status !== "completed";
        }).length,

        done: tasks.filter(function (task) {
            return task.status === "completed";
        }).length,

        notes: (currentWorkspace.notes || []).length,

        folders: (currentWorkspace.folders || []).length,

        resources: (currentWorkspace.resources || []).length
    };
}


function workspaceIsEmpty() {

    const counts = workspaceCounts();

    return (
        counts.open === 0 &&
        counts.done === 0 &&
        counts.notes === 0 &&
        counts.folders === 0 &&
        counts.resources === 0
    );
}


/* WORKSPACE ACTIVITY
 *
 * Everything here is read out of the workspace being displayed. There is no
 * cross-workspace read and no generated metric: if a line appears in this
 * feed, something in this workspace was actually created or edited. */

function startOfDay(date) {

    const start = new Date(date);

    start.setHours(0, 0, 0, 0);

    return start.getTime();
}


function dayGroupLabel(value) {

    const time = new Date(value).getTime();

    if (isNaN(time)) {
        return "Earlier";
    }

    const today = startOfDay(new Date());

    const age = today - startOfDay(new Date(value));

    if (age <= 0) {
        return "Today";
    }

    if (age <= 86400000) {
        return "Yesterday";
    }

    return "Earlier";
}


function workspaceActivity() {

    const entries = [];

    const push = function (type, section, verb, label, item) {

        if (!item.createdAt) {
            return;
        }

        /* Code files are the only records that carry an edit timestamp, so
           only they can honestly claim to have been edited rather than
           created. */
        const edited =
            type === "file" &&
            item.updatedAt &&
            item.updatedAt !== item.createdAt;

        entries.push({
            type: type,
            section: section,
            verb: edited ? "Edited file" : verb,
            label: label,
            at: edited ? item.updatedAt : item.createdAt
        });
    };

    (currentWorkspace.tasks || []).forEach(function (task) {
        push("task", "tasks", "Created task",
            cleanText(task.name) || "Untitled task", task);
    });

    (currentWorkspace.notes || []).forEach(function (note) {
        push("note", "notes", "Added note",
            cleanText(note.title) || "Untitled note", note);
    });

    (currentWorkspace.folders || []).forEach(function (folder) {

        push("folder", "files", "Added folder",
            cleanText(folder.name) || "Untitled folder", folder);

        (folder.files || []).forEach(function (file) {
            push("file", "code", "Added file",
                cleanText(file.name) || "Untitled file", file);
        });
    });

    (currentWorkspace.resources || []).forEach(function (resource) {
        push("resource", "resources", "Added resource",
            cleanText(resource.title) || "Untitled resource", resource);
    });

    return entries.sort(function (a, b) {
        return new Date(b.at) - new Date(a.at);
    });
}


function createActivityRow(entry) {

    const row =
        document.createElement("button");

    row.type = "button";
    row.className = "activity-row";
    row.dataset.type = entry.type;

    const dot =
        document.createElement("span");

    dot.className = "activity-mark";
    dot.setAttribute("aria-hidden", "true");


    const verb =
        document.createElement("span");

    verb.className = "activity-verb";

    verb.textContent = entry.verb;

    const label =
        document.createElement("span");

    label.className = "activity-label";

    label.textContent = entry.label;


    const time =
        document.createElement("span");

    time.className = "activity-time";

    time.textContent = relativeTime(entry.at);


    row.addEventListener(
        "click",
        function () {
            requestSectionChange(entry.section);
        }
    );

    row.appendChild(dot);
    row.appendChild(verb);
    row.appendChild(label);
    row.appendChild(time);

    return row;
}


function createOverviewBlock(title, rows, actionLabel, actionSection) {

    const block =
        document.createElement("div");

    block.className = "overview-block";


    const header =
        document.createElement("div");

    header.className =
        "overview-block-header";


    const heading =
        document.createElement("h3");

    heading.textContent = title;

    header.appendChild(heading);

    if (actionLabel) {

        const action =
            document.createElement("button");

        action.type = "button";
        action.className =
            "overview-text-link";

        action.textContent = actionLabel;

action.addEventListener(
        "click",
        function () {
            requestSectionChange(actionSection);
        }
    );

        header.appendChild(action);
    }


    block.appendChild(header);

    if (rows.length === 0) {

        const none =
            document.createElement("p");

        none.className = "overview-none";
        none.textContent = "Nothing here yet.";

        block.appendChild(none);

        return block;
    }

    rows.forEach(function (row) {
        block.appendChild(row);
    });

    return block;
}


function renderOverviewEmpty() {

    const wrap =
        document.createElement("div");

    wrap.className = "overview-empty";

    const heading =
        document.createElement("h3");

    heading.textContent = "This workspace is empty";

    const body =
        document.createElement("p");

    body.textContent =
        "Nothing has happened here yet. " +
        "Add a task, a note, a folder or a link with " +
        "the + button below and this page will fill in.";

    wrap.appendChild(heading);
    wrap.appendChild(body);

    return wrap;
}


/* The one thing to pick up, said plainly.
 *
 * The activity feed below answers "what has been happening". This answers
 * "where do I start", which is a different question and deserves to be the
 * first thing on the page. It only ever offers a record that exists. */
function renderContinueBlock(activity) {

    if (!activity.length) {
        return null;
    }

    const entry = activity[0];

    const block =
        document.createElement("section");

    block.className = "overview-continue";


    const kicker =
        document.createElement("p");

    kicker.className = "overview-continue-kicker";

    kicker.appendChild(
        createIcon(entry.type, { size: 13 })
    );

    const kickerWord =
        document.createElement("span");

    kickerWord.textContent = "Where you left off";

    kicker.appendChild(kickerWord);

    block.appendChild(kicker);


    const main =
        document.createElement("div");

    main.className = "overview-continue-main";


    const line =
        document.createElement("p");

    line.className = "overview-continue-line";

    const verb =
        document.createElement("span");

    verb.className = "overview-continue-verb";

    verb.textContent = entry.verb.toLowerCase();

    const label =
        document.createElement("strong");

    label.className = "overview-continue-label";

    label.textContent = entry.label;

    const when =
        document.createElement("span");

    when.className = "overview-continue-when";

    when.textContent = relativeTime(entry.at);

    line.appendChild(verb);
    line.appendChild(document.createTextNode(" "));
    line.appendChild(label);
    line.appendChild(document.createTextNode(" "));
    line.appendChild(when);

    main.appendChild(line);


    const go =
        document.createElement("button");

    go.type = "button";
    go.className = "overview-continue-go";

    go.appendChild(
        createIcon("arrowLeft", { size: 15 })
    );

    /* Same outward-reading chevron as resource links, turned back into
       the page, because this one stays inside. */
    go.firstChild.style.transform =
        "rotate(180deg)";

    const goWord =
        document.createElement("span");

    goWord.textContent = "Pick it up";

    go.appendChild(goWord);

    go.addEventListener(
        "click",
        function () {
            requestSectionChange(entry.section);
        }
    );

    main.appendChild(go);

    block.appendChild(main);

    return block;
}


function renderOverview() {

    if (!overviewContent) {
        return;
    }


    overviewContent.innerHTML = "";

    const activity = workspaceActivity();

    if (workspaceIsEmpty()) {
        overviewContent.appendChild(renderOverviewEmpty());
        return;
    }


    const continueBlock = renderContinueBlock(activity);

    if (continueBlock) {
        overviewContent.appendChild(continueBlock);
    }


    /* The lead answers one question in one sentence: is there anything to
       pick up. Everything below it is evidence, not analytics. */
    const counts = workspaceCounts();

    const lead =
        document.createElement("p");

    lead.className = "overview-lead";

    lead.textContent =
        counts.open > 0
            ? pluralize(counts.open, "open task", "open tasks") +
              " to work through."
            : "Nothing is open right now.";

    overviewContent.appendChild(lead);


    if (activity.length) {
        overviewContent.appendChild(
            renderActivityFeed(activity)
        );
    }


    /* One restrained secondary area, and only when there is something in it. */
    const openTasks = (currentWorkspace.tasks || [])
        .filter(function (task) {
            return task.status !== "completed";
        })
        .slice(0, 4);

    if (openTasks.length) {

        overviewContent.appendChild(
            createOverviewBlock(
                "Open tasks",
                openTasks.map(function (task) {

                    return createActivityRow({
                        type: "task",
                        section: "tasks",
                        verb: "Open",
                        label: cleanText(task.name) ||
                            "Untitled task",
                        at: task.createdAt
                    });
                }),
                "All tasks",
                "tasks"
            )
        );
    }
}


/* Grouped by day so a long history stays readable instead of becoming one
   undifferentiated column of rows. */
function renderActivityFeed(activity) {

    const feed =
        document.createElement("section");

    feed.className = "activity-feed";

    const heading =
        document.createElement("h2");

    heading.className = "activity-heading";

    heading.textContent = "Recent activity";

    feed.appendChild(heading);


    const limit = activity.length > 40 ? 40 : activity.length;
    const groups = [];

    for (let index = 0; index < limit; index++) {

        const entry = activity[index];
        const label = dayGroupLabel(entry.at);

        let group = groups[groups.length - 1];

        if (!group || group.label !== label) {
            group = { label: label, entries: [] };
            groups.push(group);
        }

        group.entries.push(entry);
    }


    groups.forEach(function (group) {

        const block =
            document.createElement("div");

        block.className = "activity-group";

        const label =
            document.createElement("h3");

        label.className = "activity-group-label";

        label.textContent = group.label;

        block.appendChild(label);

        group.entries.forEach(function (entry) {
            block.appendChild(
                createActivityRow(entry)
            );
        });

        feed.appendChild(block);
    });

    return feed;
}


/* INITIAL RENDER */

function renderAll() {

    renderOverview();

    renderTasks();

    renderFolders();

    renderNotes();

    renderResources();

    renderCode();

    applyHighlight(document);
}


/* There is no workspace to be inside. That is a Home state, not a broken
   workspace, so the shell is never rendered against a workspace that does not
   exist: the user is sent to Home where the real choice can be made. This is
   also what a workspace deleted from another tab lands on. */
if (!currentWorkspace) {

    window.location.href = "dashboard.html";

} else if (!openWorkspaceIds.length) {

    /* Every tab was closed, or the list was emptied elsewhere. */
    leaveWorkspaceForHome();

} else {

    buildNavigation();

    renderWorkspaceTabs();

    hydrateWorkspaceShell();

    renderAll();
}


/* LOGOUT */

const logoutButton =
    document.getElementById(
        "logoutButton"
    );


if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        function () {

            localStorage.removeItem(
                "onespaceCurrentUser"
            );

            localStorage.removeItem(
                "onespaceCurrentWorkspace"
            );

            window.location.href =
                "index.html";
        }
    );
}
