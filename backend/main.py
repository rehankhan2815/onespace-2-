from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse as FastAPIFileResponse
from sqlalchemy.orm import Session
import os
import uuid
from pathlib import Path

from config import settings
from database import init_db, get_db
from models import User, Workspace, Task, Folder, File as FileModel, Note
from schemas import (
    UserCreate, UserLogin, UserResponse, Token,
    WorkspaceCreate, WorkspaceUpdate, WorkspaceResponse, WorkspaceListResponse,
    TaskCreate, TaskUpdate, TaskResponse, TaskListResponse,
    FolderCreate, FolderUpdate, FolderResponse, FolderListResponse,
    FileResponse, FileListResponse,
    NoteCreate, NoteUpdate, NoteResponse, NoteListResponse
)
from auth import (
    pwd_context, create_access_token, decode_token,
    oauth2_scheme, get_current_user, get_password_hash,
    verify_password
)


STORAGE_DIR = Path("storage")
STORAGE_DIR.mkdir(exist_ok=True)


def get_workspace_or_404(workspace_id: int, current_user: User, db: Session) -> Workspace:
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.owner_id == current_user.id
    ).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace


def get_folder_or_404(folder_id: int, workspace_id: int, db: Session) -> Folder:
    folder = db.query(Folder).filter(
        Folder.id == folder_id,
        Folder.workspace_id == workspace_id
    ).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    return folder


def get_file_or_404(file_id: int, workspace_id: int, db: Session) -> FileModel:
    file = db.query(FileModel).filter(
        FileModel.id == file_id,
        FileModel.workspace_id == workspace_id
    ).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    return file


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="OneSpace API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "ok", "app": settings.APP_NAME}


@app.post("/api/auth/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    hashed_password = get_password_hash(user_data.password)
    user = User(
        email=user_data.email,
        hashed_password=hashed_password,
        full_name=user_data.full_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return user


@app.post("/api/auth/login", response_model=Token)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user or not pwd_context.verify(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )

    access_token = create_access_token(data={"sub": user.id})
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/api/auth/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user


@app.post("/api/workspaces", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
def create_workspace(workspace: WorkspaceCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    workspace_obj = Workspace(
        name=workspace.name,
        description=workspace.description,
        owner_id=current_user.id,
    )
    db.add(workspace_obj)
    db.commit()
    db.refresh(workspace_obj)
    return workspace_obj


@app.get("/api/workspaces", response_model=WorkspaceListResponse)
def list_workspaces(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    workspaces = db.query(Workspace).filter(Workspace.owner_id == current_user.id).all()
    return {
        "workspaces": workspaces,
        "total": len(workspaces)
    }


@app.get("/api/workspaces/{workspace_id}", response_model=WorkspaceResponse)
def get_workspace(workspace_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.owner_id == current_user.id
    ).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace


@app.patch("/api/workspaces/{workspace_id}", response_model=WorkspaceResponse)
def update_workspace(
    workspace_id: int,
    workspace_update: WorkspaceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.owner_id == current_user.id
    ).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    update_data = workspace_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(workspace, field, value)

    db.commit()
    db.refresh(workspace)
    return workspace


@app.delete("/api/workspaces/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workspace(workspace_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.owner_id == current_user.id
    ).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    db.delete(workspace)
    db.commit()
    return None


@app.post("/api/workspaces/{workspace_id}/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(
    workspace_id: int,
    task: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.owner_id == current_user.id
    ).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    task_obj = Task(
        workspace_id=workspace_id,
        title=task.title,
        description=task.description,
    )
    db.add(task_obj)
    db.commit()
    db.refresh(task_obj)
    return task_obj


@app.get("/api/workspaces/{workspace_id}/tasks", response_model=TaskListResponse)
def list_tasks(
    workspace_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.owner_id == current_user.id
    ).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    tasks = db.query(Task).filter(Task.workspace_id == workspace_id).all()
    return {
        "tasks": tasks,
        "total": len(tasks)
    }


@app.get("/api/workspaces/{workspace_id}/tasks/{task_id}", response_model=TaskResponse)
def get_task(
    workspace_id: int,
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.owner_id == current_user.id
    ).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    task = db.query(Task).filter(
        Task.id == task_id,
        Task.workspace_id == workspace_id
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@app.patch("/api/workspaces/{workspace_id}/tasks/{task_id}", response_model=TaskResponse)
def update_task(
    workspace_id: int,
    task_id: int,
    task_update: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.owner_id == current_user.id
    ).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    task = db.query(Task).filter(
        Task.id == task_id,
        Task.workspace_id == workspace_id
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    update_data = task_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)
    return task


@app.delete("/api/workspaces/{workspace_id}/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    workspace_id: int,
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.owner_id == current_user.id
    ).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    task = db.query(Task).filter(
        Task.id == task_id,
        Task.workspace_id == workspace_id
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    db.delete(task)
    db.commit()
    return None


@app.post("/api/workspaces/{workspace_id}/folders", response_model=FolderResponse, status_code=status.HTTP_201_CREATED)
def create_folder(
    workspace_id: int,
    folder: FolderCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workspace = get_workspace_or_404(workspace_id, current_user, db)

    folder_obj = Folder(
        workspace_id=workspace_id,
        parent_folder_id=None,
        name=folder.name,
    )
    db.add(folder_obj)
    db.commit()
    db.refresh(folder_obj)
    return folder_obj


@app.post("/api/workspaces/{workspace_id}/folders/{parent_folder_id}/folders", response_model=FolderResponse, status_code=status.HTTP_201_CREATED)
def create_nested_folder(
    workspace_id: int,
    parent_folder_id: int,
    folder: FolderCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workspace = get_workspace_or_404(workspace_id, current_user, db)
    parent_folder = get_folder_or_404(parent_folder_id, workspace_id, db)

    folder_obj = Folder(
        workspace_id=workspace_id,
        parent_folder_id=parent_folder_id,
        name=folder.name,
    )
    db.add(folder_obj)
    db.commit()
    db.refresh(folder_obj)
    return folder_obj


@app.get("/api/workspaces/{workspace_id}/folders", response_model=FolderListResponse)
def list_folders(
    workspace_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workspace = get_workspace_or_404(workspace_id, current_user, db)

    folders = db.query(Folder).filter(
        Folder.workspace_id == workspace_id,
        Folder.parent_folder_id.is_(None)
    ).all()
    return {
        "folders": folders,
        "total": len(folders)
    }


@app.get("/api/workspaces/{workspace_id}/folders/{folder_id}", response_model=FolderResponse)
def get_folder(
    workspace_id: int,
    folder_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workspace = get_workspace_or_404(workspace_id, current_user, db)
    folder = get_folder_or_404(folder_id, workspace_id, db)
    return folder


@app.patch("/api/workspaces/{workspace_id}/folders/{folder_id}", response_model=FolderResponse)
def update_folder(
    workspace_id: int,
    folder_id: int,
    folder_update: FolderUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workspace = get_workspace_or_404(workspace_id, current_user, db)
    folder = get_folder_or_404(folder_id, workspace_id, db)

    update_data = folder_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(folder, field, value)

    db.commit()
    db.refresh(folder)
    return folder


@app.delete("/api/workspaces/{workspace_id}/folders/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_folder(
    workspace_id: int,
    folder_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workspace = get_workspace_or_404(workspace_id, current_user, db)
    folder = get_folder_or_404(folder_id, workspace_id, db)

    def delete_folder_recursive(f: Folder):
        for file in f.files:
            if os.path.exists(file.storage_path):
                os.remove(file.storage_path)
            db.delete(file)
        for child in f.child_folders:
            delete_folder_recursive(child)
        db.delete(f)

    delete_folder_recursive(folder)
    db.commit()
    return None


@app.post("/api/workspaces/{workspace_id}/folders/{folder_id}/files", response_model=FileResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    workspace_id: int,
    folder_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workspace = get_workspace_or_404(workspace_id, current_user, db)
    folder = get_folder_or_404(folder_id, workspace_id, db)

    content = await file.read()
    file_size = len(content)

    safe_filename = f"{uuid.uuid4().hex}_{file.filename}"
    workspace_storage = STORAGE_DIR / str(workspace_id)
    workspace_storage.mkdir(exist_ok=True)
    storage_path = workspace_storage / safe_filename

    with open(storage_path, "wb") as f:
        f.write(content)

    file_obj = FileModel(
        workspace_id=workspace_id,
        folder_id=folder_id,
        original_filename=file.filename,
        mime_type=file.content_type,
        file_size=file_size,
        storage_path=str(storage_path),
    )
    db.add(file_obj)
    db.commit()
    db.refresh(file_obj)
    return file_obj


@app.get("/api/workspaces/{workspace_id}/folders/{folder_id}/files", response_model=FileListResponse)
def list_files(
    workspace_id: int,
    folder_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workspace = get_workspace_or_404(workspace_id, current_user, db)
    folder = get_folder_or_404(folder_id, workspace_id, db)

    files = db.query(FileModel).filter(FileModel.folder_id == folder_id).all()
    return {
        "files": files,
        "total": len(files)
    }


@app.get("/api/workspaces/{workspace_id}/files/{file_id}", response_model=FileResponse)
def get_file(
    workspace_id: int,
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workspace = get_workspace_or_404(workspace_id, current_user, db)
    file = get_file_or_404(file_id, workspace_id, db)
    return file


@app.get("/api/workspaces/{workspace_id}/files/{file_id}/download")
def download_file(
    workspace_id: int,
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workspace = get_workspace_or_404(workspace_id, current_user, db)
    file = get_file_or_404(file_id, workspace_id, db)

    if not os.path.exists(file.storage_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FastAPIFileResponse(
        path=file.storage_path,
        filename=file.original_filename,
        media_type=file.mime_type
    )


@app.delete("/api/workspaces/{workspace_id}/files/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_file(
    workspace_id: int,
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workspace = get_workspace_or_404(workspace_id, current_user, db)
    file = get_file_or_404(file_id, workspace_id, db)

    if os.path.exists(file.storage_path):
        os.remove(file.storage_path)

    db.delete(file)
    db.commit()
    return None


def get_note_or_404(note_id: int, workspace_id: int, db: Session) -> Note:
    note = db.query(Note).filter(
        Note.id == note_id,
        Note.workspace_id == workspace_id
    ).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


@app.post("/api/workspaces/{workspace_id}/notes", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
def create_note(
    workspace_id: int,
    note: NoteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workspace = get_workspace_or_404(workspace_id, current_user, db)

    note_obj = Note(
        workspace_id=workspace_id,
        title=note.title,
        content=note.content,
        color=note.color or "yellow",
    )
    db.add(note_obj)
    db.commit()
    db.refresh(note_obj)
    return note_obj


@app.get("/api/workspaces/{workspace_id}/notes", response_model=NoteListResponse)
def list_notes(
    workspace_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workspace = get_workspace_or_404(workspace_id, current_user, db)

    notes = db.query(Note).filter(Note.workspace_id == workspace_id).all()
    return {
        "notes": notes,
        "total": len(notes)
    }


@app.get("/api/workspaces/{workspace_id}/notes/{note_id}", response_model=NoteResponse)
def get_note(
    workspace_id: int,
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workspace = get_workspace_or_404(workspace_id, current_user, db)
    note = get_note_or_404(note_id, workspace_id, db)
    return note


@app.patch("/api/workspaces/{workspace_id}/notes/{note_id}", response_model=NoteResponse)
def update_note(
    workspace_id: int,
    note_id: int,
    note_update: NoteUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workspace = get_workspace_or_404(workspace_id, current_user, db)
    note = get_note_or_404(note_id, workspace_id, db)

    update_data = note_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(note, field, value)

    db.commit()
    db.refresh(note)
    return note


@app.delete("/api/workspaces/{workspace_id}/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(
    workspace_id: int,
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workspace = get_workspace_or_404(workspace_id, current_user, db)
    note = get_note_or_404(note_id, workspace_id, db)

    db.delete(note)
    db.commit()
    return None