const currentUser = JSON.parse(
    localStorage.getItem("onespaceCurrentUser") || "null"
);

if (!currentUser) {
    window.location.href = "index.html";
}

let workspaces = JSON.parse(
    localStorage.getItem("onespaceWorkspaces") || "[]"
);

const workspaceGrid =
    document.getElementById("workspaceGrid");

const emptyWorkspaceMessage =
    document.getElementById(
        "emptyWorkspaceMessage"
    );

const createWorkspaceButton =
    document.getElementById(
        "createWorkspaceButton"
    );

const emptyCreateWorkspaceButton =
    document.getElementById(
        "emptyCreateWorkspaceButton"
    );

const workspaceModal =
    document.getElementById("workspaceModal");

const closeWorkspaceModal =
    document.getElementById("closeWorkspaceModal");

const cancelWorkspaceModal =
    document.getElementById(
        "cancelWorkspaceModal"
    );

const workspaceForm =
    document.getElementById("workspaceForm");

const deleteWorkspaceModal =
    document.getElementById("deleteWorkspaceModal");

const cancelDeleteWorkspace =
    document.getElementById(
        "cancelDeleteWorkspace"
    );

const confirmDeleteWorkspace =
    document.getElementById(
        "confirmDeleteWorkspace"
    );

const deleteWorkspaceMessage =
    document.getElementById(
        "deleteWorkspaceMessage"
    );

const logoutButton =
    document.getElementById(
        "logoutButton"
    );

const welcomeMessage =
    document.getElementById("welcomeMessage");

const homeUserName =
    document.getElementById("homeUserName");

const homeDate =
    document.getElementById("homeDate");

const homeSearchWrap =
    document.getElementById("homeSearchWrap");

const homeSearch =
    document.getElementById("homeSearch");

const clearSearchButton =
    document.getElementById("clearSearchButton");

const noSearchResults =
    document.getElementById("noSearchResults");


/* ICONS
 *
 * The same hand-drawn set the workspace uses, kept local rather than shared
 * through a file so Home stays a single self-contained request. Every glyph
 * is hidden from assistive technology; the surrounding text carries the
 * meaning. */

const ICON_PATHS = {
    plus: '<path d="M12 5.5v13"/><path d="M5.5 12h13"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M15.8 15.8 20 20"/>',
    logout: '<path d="M14 5.5H6.5A1.5 1.5 0 0 0 5 7v10a1.5 1.5 0 0 0 1.5 1.5H14"/><path d="M17 8.5 20.5 12 17 15.5"/><path d="M20.5 12H10"/>',
    trash: '<path d="M4.5 6.5h15"/><path d="M9 6.5V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1.5"/><path d="M6.5 6.5 7.4 19a1 1 0 0 0 1 1h7.2a1 1 0 0 0 1-1l.9-12.5"/>',
    layers: '<path d="M12 4.5 20 9l-8 4.5L4 9Z"/><path d="m4 13 8 4.5 8-4.5"/>',
    task: '<path d="M4 7.5 6 9.5 9.5 5.5"/><path d="M4 16.5 6 18.5 9.5 14.5"/><path d="M12.5 7.5H20"/><path d="M12.5 16.5H20"/>',
    note: '<path d="M6 4.5h8.5L19 9v10.5H6Z"/><path d="M14 4.5V9h5"/><path d="M9 13h7"/><path d="M9 16.5h4.5"/>',
    code: '<path d="M9 7.5 4.5 12 9 16.5"/><path d="M15 7.5 19.5 12 15 16.5"/>',
    chevronRight: '<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
    sparkle: '<path d="M12 4.5 13.7 9.3 18.5 11 13.7 12.7 12 17.5 10.3 12.7 5.5 11 10.3 9.3Z"/>'
};


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
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", settings.weight || "1.7");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");

    if (settings.size) {
        svg.setAttribute("width", settings.size);
        svg.setAttribute("height", settings.size);
    }

    svg.setAttribute("class", "icon");

    svg.innerHTML = ICON_PATHS[name] || ICON_PATHS.layers;

    return svg;
}


/* Declared in the markup so the HTML stays readable as a list of what the
   page contains; drawn once, here, rather than inline in every button. */
document
    .querySelectorAll(
        "[data-icon]"
    )
    .forEach(function (host) {

        host.appendChild(
            createIcon(
                host.dataset.icon,
                { size: Number(host.dataset.size) || 17 }
            )
        );
    });


function initialsOf(name) {

    const words =
        String(name || "")
            .trim()
            .split(/\s+/)
            .filter(Boolean);

    if (!words.length) {
        return "?";
    }

    if (words.length === 1) {
        return words[0].charAt(0).toUpperCase();
    }

    return (
        words[0].charAt(0) +
        words[1].charAt(0)
    ).toUpperCase();
}


if (welcomeMessage) {
    welcomeMessage.textContent =
        greetingOf(currentUser.name);
}

if (homeUserName) {
    homeUserName.textContent =
        currentUser.name;
}

/* The greeting follows the clock, but only the part of it that is actually
   true where the reader is. */
function greetingOf(name) {

    const hour = new Date().getHours();

    const part =
        hour < 5 ? "Still up"
        : hour < 12 ? "Good morning"
        : hour < 18 ? "Good afternoon"
        : "Good evening";

    return part + ", " + name;
}

if (homeDate) {
    homeDate.textContent =
        new Date().toLocaleDateString(
            undefined,
            {
                weekday: "long",
                day: "numeric",
                month: "long"
            }
        );
}


/* Search filters as you type. It is a launcher convenience over a list that
   is normally short, so there is no debounce and no result count announced
   on every keystroke — the cards disappearing is the feedback. */
if (homeSearch) {

    homeSearch.addEventListener(
        "input",
        renderWorkspaces
    );

    /* Escape clears the field rather than closing anything: this is the only
       sensible meaning of Escape inside a search box. */
    homeSearch.addEventListener(
        "keydown",
        function (event) {

            if (event.key === "Escape" && homeSearch.value) {

                event.preventDefault();

                homeSearch.value = "";

                renderWorkspaces();
            }
        }
    );
}

if (clearSearchButton) {

    clearSearchButton.addEventListener(
        "click",
        function () {

            homeSearch.value = "";

            renderWorkspaces();

            homeSearch.focus();
        }
    );
}


function saveWorkspaces() {

    localStorage.setItem(
        "onespaceWorkspaces",
        JSON.stringify(workspaces)
    );
}


/* The tab strip keeps its own list of open workspaces. Ids are compared as
   strings because the two pages were written at different times and one
   stores a number where the other can read either. */
function readOpenWorkspaces() {

    try {
        const parsed = JSON.parse(
            localStorage.getItem(
                "onespaceOpenWorkspaces"
            )
        );

        return Array.isArray(parsed)
            ? parsed.map(String)
            : [];
    } catch (error) {
        return [];
    }
}


function saveOpenWorkspaces(ids) {

    localStorage.setItem(
        "onespaceOpenWorkspaces",
        JSON.stringify(ids.map(String))
    );
}


function readJson(key, fallback) {

    try {
        const raw = localStorage.getItem(key);

        return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
        return fallback;
    }
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

    return date.toLocaleDateString();
}


/* Real activity only: the newest timestamp anywhere inside this workspace.
   Nothing here is synthesised for the sake of filling the card. */
function lastActivityOf(workspace) {

    let newest = 0;

    const consider = function (value) {

        const time = new Date(value).getTime();

        if (!isNaN(time) && time > newest) {
            newest = time;
        }
    };

    consider(workspace.lastOpened);
    consider(workspace.createdAt);

    ["tasks", "notes", "resources", "members",
     "folders"].forEach(function (key) {

        (workspace[key] || []).forEach(
            function (item) {
                consider(item.createdAt);
            }
        );

        (workspace[key] || []).forEach(
            function (item) {
                consider(item.updatedAt);
            }
        );
    });

    (workspace.folders || []).forEach(function (folder) {
        (folder.files || []).forEach(function (file) {
            consider(file.createdAt);
            consider(file.updatedAt);
        });
    });

    return newest || null;
}


function metaLine(workspace) {

    const bits = [];

    const openTasks = (workspace.tasks || []).filter(
        function (task) {
            return task.status !== "completed";
        }
    ).length;

    if (openTasks) {
        bits.push(
            openTasks === 1
                ? "1 open task"
                : openTasks + " open tasks"
        );
    }

    const counts = [
        [workspace.notes, "note", "notes"],
        [workspace.folders, "folder", "folders"],
        [workspace.resources, "resource", "resources"],
        [workspace.members, "member", "members"]
    ];

    counts.forEach(function (pair) {

        const total =
            (pair[0] || []).length +
            (
                pair[0] === workspace.folders
                    ? (workspace.folders || [])
                        .reduce(function (sum, folder) {
                            return sum +
                                (folder.files || []).length;
                        }, 0)
                    : 0
            );

        if (total) {
            bits.push(
                total + " " +
                (total === 1 ? pair[1] : pair[2])
            );
        }
    });

    if (!bits.length) {
        return "Nothing here yet";
    }

    return bits.join("  ·  ");
}


function openWorkspace(workspace) {

    workspace.lastOpened =
        new Date().toISOString();

    workspaces =
        workspaces.map(
            function (item) {

                if (String(item.id) === String(workspace.id)) {
                    return workspace;
                }

                return item;
            }
        );

    saveWorkspaces();

    localStorage.setItem(
        "onespaceCurrentWorkspace",
        JSON.stringify(workspace)
    );

    const open = readOpenWorkspaces();

    if (open.indexOf(String(workspace.id)) === -1) {
        open.push(String(workspace.id));
    }

    saveOpenWorkspaces(open);

    window.location.href =
        "workspace.html";
}


function deleteWorkspace(workspace) {

    const id = String(workspace.id);

    workspaces =
        workspaces.filter(function (item) {
            return String(item.id) !== id;
        });

    saveWorkspaces();

    saveOpenWorkspaces(
        readOpenWorkspaces().filter(
            function (openId) {
                return openId !== id;
            }
        )
    );

    /* If the deleted workspace was the one held as current, leaving that
       behind would drop the user into a workspace that no longer exists the
       next time the app boots. */
    const current = readJson(
        "onespaceCurrentWorkspace",
        null
    );

    if (current && String(current.id) === id) {
        localStorage.removeItem(
            "onespaceCurrentWorkspace"
        );
    }

    renderWorkspaces();
}


/* ---- DELETE CONFIRMATION
 *
 * Nothing is removed until the destructive button is pressed. The dialog
 * remembers which card opened it so focus returns there afterwards, and
 * closes on Escape or a click on the backdrop. */

let pendingDelete = null;
let deleteTrigger = null;


function requestDelete(workspace, trigger) {

    pendingDelete = workspace;
    deleteTrigger = trigger;

    deleteWorkspaceMessage.textContent =
        "This will permanently delete " +
        (workspace.name
            ? '"' + workspace.name + '"'
            : "this workspace") +
        " and its stored data.";

    deleteWorkspaceModal.style.display =
        "flex";

    cancelDeleteWorkspace.focus({
        preventScroll: true
    });
}


function cancelDelete() {

    deleteWorkspaceModal.style.display =
        "none";

    pendingDelete = null;

    if (
        deleteTrigger &&
        document.contains(deleteTrigger)
    ) {
        deleteTrigger.focus({
            preventScroll: true
        });
    }

    deleteTrigger = null;
}


confirmDeleteWorkspace.addEventListener(
    "click",
    function () {

        const target = pendingDelete;

        cancelDelete();

        if (target) {
            deleteWorkspace(target);
        }
    }
);

cancelDeleteWorkspace.addEventListener(
    "click",
    cancelDelete
);

deleteWorkspaceModal.addEventListener(
    "click",
    function (event) {

        if (event.target === deleteWorkspaceModal) {
            cancelDelete();
        }
    }
);


function renderWorkspaces() {

    workspaceGrid.textContent = "";

    const term =
        (homeSearch ? homeSearch.value : "")
            .trim()
            .toLowerCase();

    const isEmpty = workspaces.length === 0;

    emptyWorkspaceMessage.hidden = !isEmpty;

    /* Search is only offered when it can narrow something down. With one
       workspace it is a control that does nothing. */
    homeSearchWrap.hidden = isEmpty || workspaces.length < 2;

    /* The floating action and the empty-state call to action would both be
       on screen doing the same job, so only one of them is ever shown. */
    createWorkspaceButton.hidden = isEmpty;

    if (isEmpty) {

        noSearchResults.hidden = true;

        emptyCreateWorkspaceButton.focus({
            preventScroll: true
        });

        return;
    }


    const sortedWorkspaces =
        [...workspaces].sort(
            function (a, b) {

                const first =
                    new Date(
                        a.lastOpened ||
                        a.createdAt ||
                        0
                    );

                const second =
                    new Date(
                        b.lastOpened ||
                        b.createdAt ||
                        0
                    );

                return second - first;
            }
        );


    const visible = term
        ? sortedWorkspaces.filter(function (workspace) {
              return (
                  (workspace.name || "")
                      .toLowerCase()
                      .indexOf(term) !== -1 ||
                  (workspace.description || "")
                      .toLowerCase()
                      .indexOf(term) !== -1
              );
          })
        : sortedWorkspaces;


    noSearchResults.hidden = visible.length !== 0;

    workspaceGrid.hidden = visible.length === 0;


    /* The most recently touched workspace is lifted out of the grid and given
       a wide card of its own, so the first thing on the page answers "where
       was I?". A workspace that has never been opened cannot answer that
       question, so it does not get the treatment. Searching turns the
       feature off, because a search result is a ranked list, not a
       suggestion. */
    const featured =
        !term &&
        sortedWorkspaces.length > 1 &&
        Boolean(sortedWorkspaces[0].lastOpened);

    visible.forEach(function (workspace, index) {
        workspaceGrid.appendChild(
            buildWorkspaceCard(
                workspace,
                featured && index === 0
            )
        );
    });
}


/* The concrete next step, taken from the workspace's own contents. Returns
   null when there is nothing to point at, so the card can simply omit it
   rather than inventing a suggestion. */
function continueHintOf(workspace) {

    const tasks = (workspace.tasks || []).filter(
        function (task) {
            return task.status !== "completed";
        }
    );

    if (tasks.length) {
        return {
            icon: "task",
            label:
                (tasks.length === 1
                    ? "1 open task"
                    : tasks.length + " open tasks")
        };
    }

    const fileCount = (workspace.folders || []).reduce(
        function (sum, folder) {
            return sum + (folder.files || []).length;
        },
        0
    );

    if (fileCount) {
        return {
            icon: "code",
            label:
                (fileCount === 1
                    ? "1 file"
                    : fileCount + " files")
        };
    }

    if ((workspace.notes || []).length) {
        return { icon: "note", label: "Has notes" };
    }

    return null;
}


function buildWorkspaceCard(workspace, isFeatured) {

    const card =
        document.createElement("article");

    card.className =
        "workspace-card" +
        (isFeatured ? " workspace-card-featured" : "");


    const open =
        document.createElement("button");

    open.type = "button";

    open.className =
        "workspace-card-open";


    const avatar =
        document.createElement("span");

    avatar.className =
        "workspace-card-avatar";

    avatar.setAttribute(
        "aria-hidden",
        "true"
    );

    avatar.textContent = initialsOf(workspace.name);


    const body =
        document.createElement("span");

    body.className =
        "workspace-card-body";


    if (isFeatured) {

        const kicker =
            document.createElement("span");

        kicker.className =
            "workspace-card-kicker";

        kicker.textContent =
            "Pick up where you left off";

        body.appendChild(kicker);
    }


    const title =
        document.createElement("span");

    title.className =
        "workspace-card-name";

    title.textContent =
        workspace.name;


    const description =
        document.createElement("span");

    description.className =
        "workspace-card-description";

    /* An absent description is left out rather than filled with a
       placeholder, so the cards keep an honest height. */
    if (workspace.description) {
        description.textContent =
            workspace.description;
    }


    const meta =
        document.createElement("span");

    meta.className =
        "workspace-card-meta";

    const activity =
        lastActivityOf(workspace);

    meta.textContent =
        (activity
            ? "Last activity " +
              relativeTime(activity)
            : "Not opened yet") +
        "  ·  " +
        metaLine(workspace);


    body.appendChild(title);
    body.appendChild(description);
    body.appendChild(meta);


    if (isFeatured) {

        const hint = continueHintOf(workspace);

        if (hint) {

            const step =
                document.createElement("span");

            step.className =
                "workspace-card-step";

            const stepIcon =
                document.createElement("span");

            stepIcon.className =
                "workspace-card-step-icon";

            stepIcon.appendChild(
                createIcon(hint.icon, { size: 14 })
            );

            const stepWord =
                document.createElement("span");

            stepWord.textContent = hint.label;

            step.appendChild(stepIcon);
            step.appendChild(stepWord);

            body.appendChild(step);
        }

        const go =
            document.createElement("span");

        go.className =
            "workspace-card-go";

        const goWord =
            document.createElement("span");

        goWord.className =
            "workspace-card-go-word";

        goWord.textContent = "Continue";

        const arrow =
            document.createElement("span");

        arrow.setAttribute("aria-hidden", "true");

        arrow.appendChild(
            createIcon("chevronRight", { size: 16 })
        );

        go.appendChild(goWord);
        go.appendChild(arrow);

        body.appendChild(go);
    }


    open.appendChild(avatar);
    open.appendChild(body);

    open.addEventListener(
        "click",
        function () {

            openWorkspace(workspace);

        }
    );


    const remove =
        document.createElement("button");

    remove.type = "button";

    remove.className =
        "workspace-card-delete";

    remove.title =
        "Delete workspace";

    remove.setAttribute(
        "aria-label",
        "Delete workspace " +
        workspace.name
    );

    remove.appendChild(
        createIcon("trash", { size: 15 })
    );

    remove.addEventListener(
        "click",
        function () {

            requestDelete(
                workspace,
                remove
            );

        }
    );


    card.appendChild(open);
    card.appendChild(remove);

    return card;
}


function openCreateModal() {

    workspaceForm.reset();

    workspaceModal.style.display = "flex";

    const name =
        document.getElementById(
            "workspaceName"
        );

    if (name) {
        name.focus({ preventScroll: true });
    }
}


function closeCreateModal() {

    workspaceModal.style.display = "none";

    if (createWorkspaceButton) {
        createWorkspaceButton.focus({
            preventScroll: true
        });
    }
}


createWorkspaceButton.addEventListener(
    "click",
    openCreateModal
);

emptyCreateWorkspaceButton.addEventListener(
    "click",
    openCreateModal
);

closeWorkspaceModal.addEventListener(
    "click",
    closeCreateModal
);

cancelWorkspaceModal.addEventListener(
    "click",
    closeCreateModal
);

workspaceModal.addEventListener(
    "click",
    function (event) {

        if (event.target === workspaceModal) {
            closeCreateModal();
        }
    }
);

document.addEventListener(
    "keydown",
    function (event) {

        if (event.key !== "Escape") {
            return;
        }

        if (pendingDelete) {
            cancelDelete();
            return;
        }

        if (
            workspaceModal.style.display ===
            "flex"
        ) {
            closeCreateModal();
        }
    }
);


workspaceForm.addEventListener(
    "submit",
    function (event) {

        event.preventDefault();


        const name =
            document
                .getElementById(
                    "workspaceName"
                )
                .value
                .trim();


        const description =
            document
                .getElementById(
                    "workspaceDescription"
                )
                .value
                .trim();


        if (!name) {
            return;
        }


        const now =
            new Date().toISOString();

        const workspace = {

            id: Date.now(),

            name: name,

            description: description,

            ownerId: currentUser.id,

            createdAt: now,

            lastOpened: now,

            tasks: [],

            notes: [],

            folders: [],

            resources: [],

            members: [],

            groupMessages: [],

            personalChats: []
        };


        workspaces.push(workspace);

        saveWorkspaces();


        localStorage.setItem(
            "onespaceCurrentWorkspace",
            JSON.stringify(workspace)
        );

        saveOpenWorkspaces(
            readOpenWorkspaces().concat([
                String(workspace.id)
            ])
        );

        window.location.href =
            "workspace.html";
    }
);


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


renderWorkspaces();
