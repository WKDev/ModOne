/**
 * UserAccountManager - CRUD UI for managing OPC UA user accounts.
 *
 * Lists accounts, allows adding new users, editing password/role/enabled state,
 * and deleting accounts. Wired to Tauri backend CRUD commands via opcuaService.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  UserPlus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Check,
  X,
  RefreshCw,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  opcuaService,
  type UserAccountInfo,
  type UserRole,
  type CreateUserRequest,
} from '../../services/opcuaService';

// ============================================================================
// Types
// ============================================================================

interface UserAccountManagerProps {
  /** Optional search filter from parent settings panel */
  searchFilter?: string;
}

interface EditState {
  username: string;
  password: string;
  role: UserRole;
  enabled: boolean;
}

const ROLE_OPTIONS: { value: UserRole; label: string; description: string }[] = [
  { value: 'admin', label: 'Admin', description: 'Full access: read, write, configure' },
  { value: 'operator', label: 'Operator', description: 'Read and write tag values' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only access to tag values' },
];

const ROLE_ICONS: Record<UserRole, typeof Shield> = {
  admin: ShieldCheck,
  operator: Shield,
  viewer: ShieldAlert,
};

const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'text-[var(--color-error)]',
  operator: 'text-[var(--color-accent)]',
  viewer: 'text-[var(--text-muted)]',
};

// ============================================================================
// Component
// ============================================================================

export function UserAccountManager({ searchFilter = '' }: UserAccountManagerProps) {
  // State
  const [accounts, setAccounts] = useState<UserAccountInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('operator');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Edit state
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirmation
  const [deletingUser, setDeletingUser] = useState<string | null>(null);

  // Search filter
  const filter = searchFilter.toLowerCase();
  const isVisible = useCallback(
    (keywords: string[]) => {
      if (!filter) return true;
      return keywords.some((keyword) => keyword.toLowerCase().includes(filter));
    },
    [filter]
  );

  // ============================================================================
  // Data fetching
  // ============================================================================

  const fetchAccounts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await opcuaService.listUsers();
      setAccounts(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // ============================================================================
  // Create account
  // ============================================================================

  const handleCreate = useCallback(async () => {
    if (!newUsername.trim()) {
      toast.error('Username is required');
      return;
    }
    if (!newPassword || newPassword.length < 4) {
      toast.error('Password must be at least 4 characters');
      return;
    }

    setIsCreating(true);
    try {
      const request: CreateUserRequest = {
        username: newUsername.trim(),
        password: newPassword,
        role: newRole,
      };
      await opcuaService.createUser(request);
      toast.success(`User '${newUsername.trim()}' created`);
      setNewUsername('');
      setNewPassword('');
      setNewRole('operator');
      setShowNewPassword(false);
      setShowAddForm(false);
      await fetchAccounts();
    } catch (err) {
      toast.error('Failed to create user', {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsCreating(false);
    }
  }, [newUsername, newPassword, newRole, fetchAccounts]);

  const handleCancelAdd = useCallback(() => {
    setShowAddForm(false);
    setNewUsername('');
    setNewPassword('');
    setNewRole('operator');
    setShowNewPassword(false);
  }, []);

  // ============================================================================
  // Edit account
  // ============================================================================

  const handleStartEdit = useCallback((account: UserAccountInfo) => {
    setEditingUser(account.username);
    setEditState({
      username: account.username,
      password: '', // Empty means no change
      role: account.role,
      enabled: account.enabled,
    });
    setShowEditPassword(false);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingUser(null);
    setEditState(null);
    setShowEditPassword(false);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editState || !editingUser) return;

    // Validate password if provided
    if (editState.password && editState.password.length < 4) {
      toast.error('Password must be at least 4 characters');
      return;
    }

    setIsSaving(true);
    try {
      const original = accounts.find((a) => a.username === editingUser);
      await opcuaService.updateUser({
        username: editingUser,
        password: editState.password || null,
        role: editState.role !== original?.role ? editState.role : null,
        enabled: editState.enabled !== original?.enabled ? editState.enabled : null,
      });
      toast.success(`User '${editingUser}' updated`);
      setEditingUser(null);
      setEditState(null);
      setShowEditPassword(false);
      await fetchAccounts();
    } catch (err) {
      toast.error('Failed to update user', {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSaving(false);
    }
  }, [editState, editingUser, accounts, fetchAccounts]);

  // ============================================================================
  // Delete account
  // ============================================================================

  const handleDelete = useCallback(
    async (username: string) => {
      try {
        await opcuaService.deleteUser(username);
        toast.success(`User '${username}' deleted`);
        setDeletingUser(null);
        await fetchAccounts();
      } catch (err) {
        toast.error('Failed to delete user', {
          description: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [fetchAccounts]
  );

  // ============================================================================
  // Visibility check
  // ============================================================================

  if (
    !isVisible([
      'user',
      'account',
      'password',
      'role',
      'admin',
      'operator',
      'viewer',
      'auth',
      'authentication',
      'security',
    ])
  ) {
    return null;
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
          <Users size={14} />
          User Accounts
        </h4>
        <div className="flex items-center gap-1">
          <button
            onClick={fetchAccounts}
            disabled={isLoading}
            className="p-1 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            title="Refresh accounts"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            disabled={showAddForm}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            <UserPlus size={12} />
            Add User
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="text-xs text-[var(--color-error)] bg-[var(--color-error)]/10 rounded px-3 py-2">
          {error}
        </div>
      )}

      {/* Add user form */}
      {showAddForm && (
        <div className="bg-[var(--bg-secondary)] rounded-lg p-3 space-y-3 border border-[var(--border-color)]">
          <h5 className="text-xs font-medium text-[var(--text-primary)]">New User Account</h5>

          {/* Username */}
          <div className="space-y-1">
            <label className="text-xs text-[var(--text-muted)]">Username</label>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="Enter username"
              maxLength={64}
              className="w-full px-3 py-1.5 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') handleCancelAdd();
              }}
            />
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="text-xs text-[var(--text-muted)]">Password</label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 4 characters"
                className="w-full px-3 py-1.5 pr-8 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                  if (e.key === 'Escape') handleCancelAdd();
                }}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                tabIndex={-1}
              >
                {showNewPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Role */}
          <div className="space-y-1">
            <label className="text-xs text-[var(--text-muted)]">Role</label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as UserRole)}
              className="w-full px-3 py-1.5 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} - {opt.description}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleCreate}
              disabled={isCreating || !newUsername.trim() || newPassword.length < 4}
              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              <Check size={12} />
              {isCreating ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={handleCancelAdd}
              disabled={isCreating}
              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors"
            >
              <X size={12} />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Account list */}
      {isLoading && accounts.length === 0 ? (
        <div className="text-xs text-[var(--text-muted)] text-center py-4">Loading...</div>
      ) : accounts.length === 0 ? (
        <div className="text-xs text-[var(--text-muted)] text-center py-4 bg-[var(--bg-secondary)] rounded-lg">
          No user accounts configured. Add a user to enable OPC UA authentication.
        </div>
      ) : (
        <div className="space-y-1">
          {accounts.map((account) => {
            const isEditing = editingUser === account.username;
            const isDeleting = deletingUser === account.username;
            const RoleIcon = ROLE_ICONS[account.role];

            if (isEditing && editState) {
              return (
                <EditAccountRow
                  key={account.username}
                  editState={editState}
                  setEditState={setEditState}
                  showEditPassword={showEditPassword}
                  setShowEditPassword={setShowEditPassword}
                  isSaving={isSaving}
                  onSave={handleSaveEdit}
                  onCancel={handleCancelEdit}
                />
              );
            }

            return (
              <div
                key={account.username}
                className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                  account.enabled
                    ? 'bg-[var(--bg-secondary)]'
                    : 'bg-[var(--bg-secondary)] opacity-60'
                }`}
              >
                {/* User info */}
                <div className="flex items-center gap-2 min-w-0">
                  <RoleIcon
                    size={14}
                    className={`shrink-0 ${ROLE_COLORS[account.role]}`}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-[var(--text-primary)] font-medium truncate">
                        {account.username}
                      </span>
                      {!account.enabled && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-warning)]/20 text-[var(--color-warning)]">
                          Disabled
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-[var(--text-muted)] capitalize">
                      {account.role}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5 shrink-0">
                  {isDeleting ? (
                    <>
                      <span className="text-xs text-[var(--color-error)] mr-1">Delete?</span>
                      <button
                        onClick={() => handleDelete(account.username)}
                        className="p-1 rounded hover:bg-[var(--color-error)]/20 text-[var(--color-error)]"
                        title="Confirm delete"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => setDeletingUser(null)}
                        className="p-1 rounded hover:bg-[var(--bg-primary)] text-[var(--text-muted)]"
                        title="Cancel"
                      >
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleStartEdit(account)}
                        className="p-1 rounded hover:bg-[var(--bg-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                        title="Edit account"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeletingUser(account.username)}
                        className="p-1 rounded hover:bg-[var(--color-error)]/10 text-[var(--text-muted)] hover:text-[var(--color-error)] transition-colors"
                        title="Delete account"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info note */}
      <p className="text-xs text-[var(--text-muted)]">
        Server restart required for user account changes to take effect.
      </p>
    </div>
  );
}

// ============================================================================
// Edit Account Row (inline edit form)
// ============================================================================

interface EditAccountRowProps {
  editState: EditState;
  setEditState: (state: EditState) => void;
  showEditPassword: boolean;
  setShowEditPassword: (show: boolean) => void;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
}

function EditAccountRow({
  editState,
  setEditState,
  showEditPassword,
  setShowEditPassword,
  isSaving,
  onSave,
  onCancel,
}: EditAccountRowProps) {
  return (
    <div className="bg-[var(--bg-secondary)] rounded-lg p-3 space-y-2 border border-[var(--color-accent)]/50">
      {/* Username (read-only) */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-[var(--text-primary)]">
          {editState.username}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
          Editing
        </span>
      </div>

      {/* Password (optional change) */}
      <div className="space-y-1">
        <label className="text-xs text-[var(--text-muted)]">
          New Password <span className="opacity-60">(leave empty to keep current)</span>
        </label>
        <div className="relative">
          <input
            type={showEditPassword ? 'text' : 'password'}
            value={editState.password}
            onChange={(e) => setEditState({ ...editState, password: e.target.value })}
            placeholder="Enter new password"
            className="w-full px-3 py-1.5 pr-8 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSave();
              if (e.key === 'Escape') onCancel();
            }}
          />
          <button
            type="button"
            onClick={() => setShowEditPassword(!showEditPassword)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            tabIndex={-1}
          >
            {showEditPassword ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>

      {/* Role */}
      <div className="space-y-1">
        <label className="text-xs text-[var(--text-muted)]">Role</label>
        <select
          value={editState.role}
          onChange={(e) => setEditState({ ...editState, role: e.target.value as UserRole })}
          className="w-full px-3 py-1.5 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
        >
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label} - {opt.description}
            </option>
          ))}
        </select>
      </div>

      {/* Enabled toggle */}
      <div className="flex items-center justify-between">
        <label className="text-xs text-[var(--text-muted)]">Enabled</label>
        <button
          onClick={() => setEditState({ ...editState, enabled: !editState.enabled })}
          className={`relative w-8 h-4 rounded-full transition-colors ${
            editState.enabled ? 'bg-[var(--color-accent)]' : 'bg-[var(--bg-primary)] border border-[var(--border-color)]'
          }`}
        >
          <span
            className={`absolute top-0.5 w-3 h-3 rounded-full transition-transform bg-white shadow-sm ${
              editState.enabled ? 'left-[calc(100%-14px)]' : 'left-0.5'
            }`}
          />
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onSave}
          disabled={isSaving}
          className="flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          <Check size={12} />
          {isSaving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors"
        >
          <X size={12} />
          Cancel
        </button>
      </div>
    </div>
  );
}
